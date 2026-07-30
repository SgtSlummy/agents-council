import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CouncilServiceImpl } from "../services/council";
import { FileCouncilStateStore } from "../state/fileStateStore";
import { OCCULT_CONTRACT_VERSION } from "./contract";
import type { OccultInvocation } from "./contract";
import { HermesBridgeError } from "./hermesBridge";
import type { HermesBridgeInvokeOptions, HermesBridgeResult, HermesOccultBridge } from "./hermesBridge";
import { OccultReadingService } from "./readingState";
import { TarotSpreadScheduler } from "./spreadScheduler";
import type { TarotSpreadExecution } from "./spreadScheduler";

type Behavior = "fatal" | "hang" | "retryable" | "success";

class FakeHermesBridge implements HermesOccultBridge {
  readonly contractVersion = OCCULT_CONTRACT_VERSION;
  readonly calls: OccultInvocation[] = [];
  active = 0;
  maximumActive = 0;

  constructor(
    private readonly behaviors: Record<string, Behavior[]> = {},
    private readonly successDelayMs = 0,
  ) {}

  async invoke(invocation: OccultInvocation, options: HermesBridgeInvokeOptions): Promise<HermesBridgeResult> {
    this.calls.push(invocation);
    this.active += 1;
    this.maximumActive = Math.max(this.maximumActive, this.active);
    const nodeId = invocation.metadata.node_id ?? "";
    const behavior = this.behaviors[nodeId]?.shift() ?? "success";
    try {
      if (behavior === "hang") {
        await waitForAbort(options.signal);
      }
      if (this.successDelayMs > 0) {
        await delay(this.successDelayMs, options.signal);
      }
      if (behavior === "retryable") {
        throw new HermesBridgeError("Hermes is temporarily unavailable.", "HERMES_UNAVAILABLE", true);
      }
      if (behavior === "fatal") {
        throw new HermesBridgeError("Hermes rejected the invocation.", "HERMES_REJECTED", false);
      }
      return {
        invocation,
        summary: `${nodeId} completed.`,
        routeSummary: {
          contract_version: OCCULT_CONTRACT_VERSION,
          invocation_id: invocation.invocation_id,
          selected_card_id: `minor.swords.king.${nodeId}`,
          provider_id: "provider-redacted",
          model_id: "model-redacted",
          fallback_count: 0,
          explanation: "Selected by deterministic fake Hermes.",
        },
        artifacts: [
          {
            artifact_id: `artifact-${nodeId}`,
            name: `${nodeId}.md`,
            media_type: "text/markdown",
            uri: `artifact://reading/${nodeId}.md`,
          },
        ],
      };
    } finally {
      this.active -= 1;
    }
  }
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createHarness(bridge: HermesOccultBridge) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agents-council-occult-spread-"));
  tempDirs.push(directory);
  const statePath = path.join(directory, "state.json");
  const store = new FileCouncilStateStore(statePath);
  const council = new CouncilServiceImpl(store);
  const session = await council.startCouncil({
    agentName: "host",
    request: "Execute the production spread.",
  });
  const readings = new OccultReadingService(store);
  return {
    statePath,
    store,
    readings,
    scheduler: new TarotSpreadScheduler(readings, bridge),
    sessionId: session.session.id,
  };
}

function plan(sessionId: string, overrides: Partial<TarotSpreadExecution> = {}): TarotSpreadExecution {
  return {
    councilSessionId: sessionId,
    spreadId: "occult.spread.production",
    spreadVersion: "1.0.0",
    idempotencyKey: "project-alpha:production-1",
    maximumParallelism: 1,
    nodes: [
      {
        nodeId: "research",
        agentId: "occult.major.hermit",
        message: "Research the system.",
      },
      {
        nodeId: "build",
        agentId: "occult.major.magician",
        message: "Build the system.",
      },
    ],
    dependencies: [{ source: "research", target: "build" }],
    ...overrides,
  };
}

describe("Tarot spread scheduler", () => {
  test("executes sequential nodes and idempotently coalesces duplicate requests", async () => {
    const bridge = new FakeHermesBridge({}, 5);
    const harness = await createHarness(bridge);
    const execution = plan(harness.sessionId);

    const [first, duplicate] = await Promise.all([
      harness.scheduler.execute(execution),
      harness.scheduler.execute(execution),
    ]);

    expect(first.id).toBe(duplicate.id);
    expect(first.state).toBe("completed");
    expect(bridge.calls.map((call) => call.metadata.node_id)).toEqual(["research", "build"]);
    expect(first.nodes.map((node) => [node.nodeId, node.state, node.attempt])).toEqual([
      ["research", "completed", 1],
      ["build", "completed", 1],
    ]);
    expect(first.routeSummaries).toHaveLength(2);
    expect(first.artifacts).toHaveLength(2);
  });

  test("enforces bounded parallelism and preserves partial failure state", async () => {
    const bridge = new FakeHermesBridge({ audit: ["fatal"] }, 200);
    const harness = await createHarness(bridge);
    const execution = plan(harness.sessionId, {
      maximumParallelism: 2,
      nodes: [
        { nodeId: "build", agentId: "occult.major.magician", message: "Build.", maximumAttempts: 1 },
        { nodeId: "audit", agentId: "occult.major.justice", message: "Audit." },
        { nodeId: "publish", agentId: "occult.major.sun", message: "Publish." },
      ],
      dependencies: [
        { source: "build", target: "publish" },
        { source: "audit", target: "publish" },
      ],
    });

    const reading = await harness.scheduler.execute(execution);

    expect(bridge.maximumActive).toBe(2);
    expect(reading.state).toBe("failed");
    expect(reading.nodes.find((node) => node.nodeId === "build")?.state).toBe("completed");
    expect(reading.nodes.find((node) => node.nodeId === "audit")?.state).toBe("failed");
    expect(reading.nodes.find((node) => node.nodeId === "publish")?.state).toBe("cancelled");
    expect(bridge.calls.filter((call) => call.metadata.node_id === "audit")).toHaveLength(1);
  });

  test("retries retryable bridge outages with a new deterministic attempt", async () => {
    const bridge = new FakeHermesBridge({ research: ["retryable", "success"] });
    const harness = await createHarness(bridge);

    const reading = await harness.scheduler.execute(plan(harness.sessionId));

    expect(reading.state).toBe("completed");
    expect(reading.nodes.find((node) => node.nodeId === "research")?.attempt).toBe(2);
    const researchCalls = bridge.calls.filter((call) => call.metadata.node_id === "research");
    expect(researchCalls).toHaveLength(2);
    expect(new Set(researchCalls.map((call) => call.invocation_id)).size).toBe(2);
  });

  test("turns repeated timeouts into a deterministic failed reading", async () => {
    const bridge = new FakeHermesBridge({ research: ["hang", "hang"] });
    const harness = await createHarness(bridge);
    const execution = plan(harness.sessionId, {
      nodes: [
        {
          nodeId: "research",
          agentId: "occult.major.hermit",
          message: "Research.",
          maximumAttempts: 2,
          timeoutMs: 5,
        },
      ],
      dependencies: [],
    });

    const reading = await harness.scheduler.execute(execution);

    expect(reading.state).toBe("failed");
    expect(reading.nodes[0]?.attempt).toBe(2);
    expect(reading.events.filter((event) => event.event_type === "node.failed")).toHaveLength(2);
    expect(reading.outcome?.error?.code).toBe("NODE_ATTEMPTS_EXHAUSTED");
  });

  test("cancels an active Hermes invocation and terminalizes the reading", async () => {
    const bridge = new FakeHermesBridge({ research: ["hang"] });
    const harness = await createHarness(bridge);
    const controller = new AbortController();
    const running = harness.scheduler.execute(
      plan(harness.sessionId, {
        nodes: [
          {
            nodeId: "research",
            agentId: "occult.major.hermit",
            message: "Research.",
            timeoutMs: 60_000,
          },
        ],
        dependencies: [],
      }),
      controller.signal,
    );
    await waitUntil(() => bridge.calls.length === 1);
    controller.abort();

    const reading = await running;

    expect(reading.state).toBe("cancelled");
    expect(reading.nodes[0]?.state).toBe("cancelled");
    expect(reading.outcome?.error?.code).toBe("READING_CANCELLED");
  });

  test("pauses for human approval and resumes after a process-style restart", async () => {
    const bridge = new FakeHermesBridge();
    const harness = await createHarness(bridge);
    const execution = plan(harness.sessionId, {
      nodes: [
        {
          nodeId: "deploy",
          agentId: "occult.major.chariot",
          message: "Deploy.",
          requiresApproval: true,
        },
      ],
      dependencies: [],
    });

    const paused = await harness.scheduler.execute(execution);
    expect(paused.state).toBe("running");
    expect(paused.approvals[0]?.state).toBe("pending");
    expect(bridge.calls).toHaveLength(0);

    const restartedStore = new FileCouncilStateStore(harness.statePath);
    const restartedReadings = new OccultReadingService(restartedStore);
    const restartedScheduler = new TarotSpreadScheduler(restartedReadings, bridge);
    const approval = paused.approvals[0];
    if (!approval) {
      throw new Error("approval missing");
    }
    await restartedScheduler.resolveApproval(paused.id, approval.approvalId, "approved", "operator");
    const completed = await restartedScheduler.execute(execution);

    expect(completed.id).toBe(paused.id);
    expect(completed.state).toBe("completed");
    expect(completed.approvals[0]?.resolvedBy).toBe("operator");
    expect(bridge.calls).toHaveLength(1);
  });
});

function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const rejectAbort = () => reject(new HermesBridgeError("Invocation aborted.", "HERMES_TIMEOUT", true));
    if (signal.aborted) {
      rejectAbort();
      return;
    }
    signal.addEventListener("abort", rejectAbort, { once: true });
  });
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new HermesBridgeError("Invocation aborted.", "HERMES_TIMEOUT", true));
      },
      { once: true },
    );
  });
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error("Condition was not reached.");
}
