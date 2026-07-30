import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CouncilServiceImpl } from "../services/council";
import { FileCouncilStateStore } from "../state/fileStateStore";
import { OCCULT_CONTRACT_VERSION } from "./contract";
import { OccultIdempotencyConflict, OccultReadingService, OccultReadingTerminalStateError } from "./readingState";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (directory) => {
      await rm(directory, { recursive: true, force: true });
    }),
  );
});

async function createStoreAndSession(): Promise<{
  statePath: string;
  store: FileCouncilStateStore;
  sessionId: string;
}> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agents-council-occult-reading-"));
  tempDirs.push(directory);
  const statePath = path.join(directory, "state.json");
  const store = new FileCouncilStateStore(statePath);
  const council = new CouncilServiceImpl(store);
  const started = await council.startCouncil({
    agentName: "host",
    request: "Execute the production spread.",
  });
  return { statePath, store, sessionId: started.session.id };
}

function readingInput(sessionId: string) {
  return {
    councilSessionId: sessionId,
    spreadId: "occult.spread.production-build",
    spreadVersion: "1.0.0",
    idempotencyKey: "project-alpha:reading-1",
    nodes: [
      {
        nodeId: "research",
        agentId: "occult.major.hermit",
      },
      {
        nodeId: "build",
        agentId: "occult.major.magician",
      },
    ],
  };
}

describe("Occult reading persistence", () => {
  test("atomically starts, replays, and restores a reading across process restart", async () => {
    const { statePath, store, sessionId } = await createStoreAndSession();
    const service = new OccultReadingService(store);
    const input = readingInput(sessionId);

    const starts = await Promise.all([service.startReading(input), service.startReading(input)]);
    expect(starts.map((result) => result.created).sort()).toEqual([false, true]);
    expect(starts[0]?.reading.id).toBe(starts[1]?.reading.id);

    const persisted = await store.load();
    expect(persisted.occultReadings).toHaveLength(1);
    expect(persisted.occultReadings[0]?.events.map((event) => event.sequence)).toEqual([0]);
    expect(persisted.occultReadings[0]?.nextSequence).toBe(1);

    const restartedStore = new FileCouncilStateStore(statePath);
    const restartedService = new OccultReadingService(restartedStore);
    const restored = await restartedService.getReading(starts[0]?.reading.id ?? "");
    expect(restored.councilSessionId).toBe(sessionId);
    expect(restored.spreadVersion).toBe("1.0.0");
    expect(restored.nodes.map((node) => node.nodeId)).toEqual(["research", "build"]);
    expect(restored.state).toBe("running");
    expect(restored.outcome).toBeNull();

    const resumed = await restartedService.appendEvent({
      readingId: restored.id,
      eventType: "node.started",
      data: { node_id: "research" },
    });
    expect(resumed.events.at(-1)?.sequence).toBe(1);
    expect(resumed.nextSequence).toBe(2);
  });

  test("rejects conflicting idempotency input but scopes keys to Council sessions", async () => {
    const { store, sessionId } = await createStoreAndSession();
    const council = new CouncilServiceImpl(store);
    const secondSession = await council.startCouncil({
      agentName: "second-host",
      request: "A separate reading.",
    });
    const service = new OccultReadingService(store);

    await service.startReading(readingInput(sessionId));
    await expect(
      service.startReading({
        ...readingInput(sessionId),
        spreadVersion: "2.0.0",
      }),
    ).rejects.toBeInstanceOf(OccultIdempotencyConflict);

    const separate = await service.startReading(readingInput(secondSession.session.id));
    expect(separate.created).toBe(true);

    const state = await store.load();
    expect(state.occultReadings).toHaveLength(2);
    expect(new Set(state.occultReadings.map((reading) => reading.councilSessionId)).size).toBe(2);
  });

  test("persists route, approval, and artifact relationships within one reading", async () => {
    const { store, sessionId } = await createStoreAndSession();
    const service = new OccultReadingService(store);
    const started = await service.startReading(readingInput(sessionId));
    const now = "2026-07-27T12:00:00.000Z";

    await store.update((state) => {
      const reading = state.occultReadings.find((candidate) => candidate.id === started.reading.id);
      if (!reading) {
        throw new Error("reading missing");
      }
      const updated = {
        ...reading,
        routeSummaries: [
          {
            contract_version: OCCULT_CONTRACT_VERSION,
            invocation_id: "invocation-research-1",
            selected_card_id: "minor.swords.king.hermes.reasoning",
            provider_id: "provider-redacted-id",
            model_id: "model-redacted-id",
            fallback_count: 0,
            explanation: "Selected by Hermes for reasoning capability.",
          },
        ],
        approvals: [
          {
            approvalId: "approval-research-1",
            nodeId: "research",
            state: "approved" as const,
            requestedAt: now,
            resolvedAt: now,
            resolvedBy: "operator",
          },
        ],
        artifacts: [
          {
            artifactId: "artifact-research-1",
            nodeId: "research",
            name: "research.md",
            mediaType: "text/markdown",
            uri: "artifact://reading/research.md",
            createdAt: now,
          },
        ],
      };
      return {
        state: {
          ...state,
          occultReadings: state.occultReadings.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
        },
        result: undefined,
      };
    });

    const restored = await service.getReading(started.reading.id);
    expect(restored.routeSummaries).toHaveLength(1);
    expect(restored.approvals[0]?.nodeId).toBe("research");
    expect(restored.artifacts[0]?.nodeId).toBe("research");

    const invalid = structuredClone(await store.load());
    const target = invalid.occultReadings.find((reading) => reading.id === started.reading.id);
    if (target?.artifacts[0]) {
      target.artifacts[0].nodeId = "another-reading-node";
    }
    await expect(store.save(invalid)).rejects.toThrow("references unknown node");
  });

  test("assigns event sequence atomically and enforces terminal state", async () => {
    const { store, sessionId } = await createStoreAndSession();
    const times = ["2026-07-27T12:00:00.000Z", "2026-07-27T12:00:01.000Z", "2026-07-27T12:00:02.000Z"];
    const service = new OccultReadingService(store, () => times.shift() ?? "2026-07-27T12:00:03.000Z");
    const started = await service.startReading(readingInput(sessionId));

    await service.appendEvent({
      readingId: started.reading.id,
      eventType: "node.started",
      data: { node_id: "research" },
    });
    const completed = await service.appendEvent({
      readingId: started.reading.id,
      eventType: "reading.completed",
      data: { summary: "Reading complete." },
    });

    expect(completed.events.map((event) => event.sequence)).toEqual([0, 1, 2]);
    expect(completed.nextSequence).toBe(3);
    expect(completed.state).toBe("completed");
    expect(completed.outcome).toEqual({
      state: "completed",
      completedAt: "2026-07-27T12:00:02.000Z",
      summary: "Reading complete.",
      error: null,
    });

    await expect(
      service.appendEvent({
        readingId: started.reading.id,
        eventType: "node.started",
      }),
    ).rejects.toBeInstanceOf(OccultReadingTerminalStateError);

    const invalid = structuredClone(await store.load());
    const target = invalid.occultReadings.find((reading) => reading.id === started.reading.id);
    if (target?.events[1]) {
      target.events[1].sequence = 9;
    }
    await expect(store.save(invalid)).rejects.toThrow("contiguous from zero");
  });
});
