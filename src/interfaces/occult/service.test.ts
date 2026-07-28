import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { OCCULT_CONTRACT_VERSION } from "../../core/occult/contract";
import type { OccultInvocation } from "../../core/occult/contract";
import type { HermesBridgeInvokeOptions, HermesBridgeResult, HermesOccultBridge } from "../../core/occult/hermesBridge";
import { OccultReadingService } from "../../core/occult/readingState";
import type { TarotSpreadExecution } from "../../core/occult/spreadScheduler";
import { CouncilServiceImpl } from "../../core/services/council";
import { FileCouncilStateStore } from "../../core/state/fileStateStore";
import { OccultInterfaceError, OccultInterfaceService } from "./service";
import type { OccultInterfaceConfig } from "./types";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

class FakeBridge implements HermesOccultBridge {
  readonly contractVersion = OCCULT_CONTRACT_VERSION;
  readonly calls: OccultInvocation[] = [];

  constructor(private readonly hang = false) {}

  async invoke(invocation: OccultInvocation, options: HermesBridgeInvokeOptions): Promise<HermesBridgeResult> {
    this.calls.push(invocation);
    if (this.hang) {
      await new Promise<void>((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
    }
    const nodeId = invocation.metadata.node_id ?? "node";
    return {
      invocation,
      summary: `${nodeId} completed.`,
      routeSummary: {
        contract_version: OCCULT_CONTRACT_VERSION,
        invocation_id: invocation.invocation_id,
        selected_card_id: `minor.swords.king.${nodeId}`,
        provider_id: "provider-safe",
        model_id: "model-safe",
        fallback_count: 0,
        explanation: "Sensitive internal route explanation.",
      },
      artifacts: [
        {
          artifact_id: `artifact-${nodeId}`,
          name: `${nodeId}.md`,
          media_type: "text/markdown",
          uri: `https://artifacts.example/${nodeId}.md?token=super-secret-value#private`,
        },
      ],
    };
  }
}

const enabledConfig: OccultInterfaceConfig = {
  enabled: true,
  hermesBaseUrl: null,
  hermesServiceToken: null,
};

async function createHarness(bridge = new FakeBridge()) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agents-council-occult-interface-"));
  tempDirs.push(directory);
  const store = new FileCouncilStateStore(path.join(directory, "state.json"));
  const council = new CouncilServiceImpl(store);
  const started = await council.startCouncil({
    agentName: "host",
    request: "Build the production release.",
  });
  return {
    bridge,
    store,
    sessionId: started.session.id,
    service: new OccultInterfaceService(store, enabledConfig, () => bridge),
  };
}

function plan(sessionId: string, overrides: Partial<TarotSpreadExecution> = {}): TarotSpreadExecution {
  return {
    councilSessionId: sessionId,
    spreadId: "occult.spread.production",
    spreadVersion: "1.0.0",
    idempotencyKey: "project-alpha:production",
    maximumParallelism: 1,
    nodes: [
      {
        nodeId: "build",
        agentId: "occult.major.magician",
        message: "Build with secret prompt details.",
      },
    ],
    dependencies: [],
    ...overrides,
  };
}

describe("Occult interface service", () => {
  test("fails closed while leaving a safe disabled status response", async () => {
    const harness = await createHarness();
    const service = new OccultInterfaceService(harness.store, { ...enabledConfig, enabled: false });

    expect(await service.status("host", harness.sessionId)).toEqual({
      contract_version: OCCULT_CONTRACT_VERSION,
      enabled: false,
      session_id: harness.sessionId,
      readings: [],
      observability: {
        bridge: {
          configured: false,
          status: "disabled",
          last_success_at: null,
          last_failure_at: null,
        },
        readings: { total: 0, running: 0, completed: 0, failed: 0, cancelled: 0 },
        nodes: { failed: 0, average_invocation_latency_ms: null, maximum_invocation_latency_ms: null },
        audit: { event_count: 0, redacted_error_count: 0 },
      },
    });
    await expect(
      service.execute({
        contractVersion: OCCULT_CONTRACT_VERSION,
        agentName: "host",
        plan: plan(harness.sessionId),
      }),
    ).rejects.toMatchObject({ code: "OCCULT_DISABLED" });
  });

  test("rejects incompatible versions and unauthorized session access before invocation", async () => {
    let bridgeCreated = false;
    const harness = await createHarness();
    const service = new OccultInterfaceService(harness.store, enabledConfig, () => {
      bridgeCreated = true;
      return harness.bridge;
    });

    await expect(
      service.execute({
        contractVersion: "2.0.0",
        agentName: "host",
        plan: plan(harness.sessionId),
      }),
    ).rejects.toMatchObject({ code: "OCCULT_VERSION_MISMATCH" });
    await expect(service.status("stranger", harness.sessionId)).rejects.toMatchObject({
      code: "OCCULT_FORBIDDEN",
    });
    expect(bridgeCreated).toBe(false);
  });

  test("returns sanitized pairings and cursor-based progress without prompts or credentials", async () => {
    const harness = await createHarness();
    const reading = await harness.service.execute({
      contractVersion: OCCULT_CONTRACT_VERSION,
      agentName: "host",
      plan: plan(harness.sessionId),
    });

    expect(reading.state).toBe("completed");
    expect(reading.nodes[0]).toMatchObject({
      major_arcana: "occult.major.magician",
      minor_arcana: "minor.swords.king.build",
      provider_id: "provider-safe",
      model_id: "model-safe",
    });
    const serialized = JSON.stringify(reading);
    expect(serialized).not.toContain("secret prompt");
    expect(serialized).not.toContain("Sensitive internal route explanation");
    expect(serialized).not.toContain("api_key");
    const persisted = JSON.stringify(await harness.store.load());
    expect(persisted).not.toContain("secret prompt");
    expect(persisted).not.toContain("Sensitive internal route explanation");
    expect(persisted).not.toContain("super-secret-value");
    expect(persisted).toContain(`https://artifacts.example/build.md`);
    const status = await new OccultInterfaceService(
      harness.store,
      { ...enabledConfig, hermesBaseUrl: "http://hermes.internal" },
      () => harness.bridge,
    ).status("host", harness.sessionId);
    expect(status.observability.bridge.status).toBe("healthy");
    expect(status.observability.readings.completed).toBe(1);
    expect(status.observability.audit.event_count).toBeGreaterThan(0);
    expect(
      (
        await harness.service.inspect({
          contractVersion: OCCULT_CONTRACT_VERSION,
          agentName: "host",
          sessionId: harness.sessionId,
          readingId: reading.reading_id,
          afterSequence: reading.next_sequence - 1,
        })
      ).events,
    ).toHaveLength(0);
  });

  test("turns caller interruption into a persisted cancelled reading", async () => {
    const harness = await createHarness(new FakeBridge(true));
    const controller = new AbortController();
    const execution = harness.service.execute({
      contractVersion: OCCULT_CONTRACT_VERSION,
      agentName: "host",
      plan: plan(harness.sessionId),
      signal: controller.signal,
    });
    await Bun.sleep(10);
    controller.abort(new Error("operator interrupted"));

    const reading = await execution;
    expect(reading.state).toBe("cancelled");
    expect(reading.outcome_error).toMatchObject({
      code: "READING_CANCELLED",
      redacted: true,
    });
  });

  test("resumes an approval-paused reading with the same id and full plan", async () => {
    const harness = await createHarness();
    const executionPlan = plan(harness.sessionId, {
      nodes: [
        {
          nodeId: "publish",
          agentId: "occult.major.sun",
          message: "Publish the approved summary.",
          requiresApproval: true,
        },
      ],
    });
    const paused = await harness.service.execute({
      contractVersion: OCCULT_CONTRACT_VERSION,
      agentName: "host",
      plan: executionPlan,
    });
    expect(paused.state).toBe("running");
    const approval = paused.approvals[0];
    if (!approval) {
      throw new Error("Expected a pending approval.");
    }
    await new OccultReadingService(harness.store).resolveApproval(
      paused.reading_id,
      approval.approval_id,
      "approved",
      "host",
    );

    const resumed = await harness.service.execute({
      contractVersion: OCCULT_CONTRACT_VERSION,
      agentName: "host",
      plan: executionPlan,
      expectedReadingId: paused.reading_id,
    });
    expect(resumed.reading_id).toBe(paused.reading_id);
    expect(resumed.state).toBe("completed");
  });

  test("cancels an authorized paused reading idempotently", async () => {
    const harness = await createHarness();
    const paused = await harness.service.execute({
      contractVersion: OCCULT_CONTRACT_VERSION,
      agentName: "host",
      plan: plan(harness.sessionId, {
        nodes: [
          {
            nodeId: "deploy",
            agentId: "occult.major.chariot",
            message: "Deploy after approval.",
            requiresApproval: true,
          },
        ],
      }),
    });

    const cancelled = await harness.service.cancel({
      contractVersion: OCCULT_CONTRACT_VERSION,
      agentName: "host",
      sessionId: harness.sessionId,
      readingId: paused.reading_id,
    });
    expect(cancelled.state).toBe("cancelled");
    expect(
      await harness.service.cancel({
        contractVersion: OCCULT_CONTRACT_VERSION,
        agentName: "host",
        sessionId: harness.sessionId,
        readingId: paused.reading_id,
      }),
    ).toEqual(cancelled);
  });

  test("uses typed interface errors", () => {
    expect(new OccultInterfaceError("forbidden", "OCCULT_FORBIDDEN").code).toBe("OCCULT_FORBIDDEN");
  });
});
