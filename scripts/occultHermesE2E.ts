import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { OCCULT_CONTRACT_VERSION } from "../src/core/occult/contract";
import { OccultReadingService } from "../src/core/occult/readingState";
import type { TarotSpreadExecution } from "../src/core/occult/spreadScheduler";
import { CouncilServiceImpl } from "../src/core/services/council";
import { FileCouncilStateStore } from "../src/core/state/fileStateStore";
import { OccultInterfaceService } from "../src/interfaces/occult/service";
import type { OccultInterfaceConfig } from "../src/interfaces/occult/types";

const baseUrl = requireEnvironment("OCCULT_E2E_HERMES_URL");
const serviceToken = requireEnvironment("OCCULT_E2E_HERMES_TOKEN");
const directory = await mkdtemp(path.join(os.tmpdir(), "agents-council-hermes-e2e-"));

try {
  const statePath = path.join(directory, "state.json");
  const firstStore = new FileCouncilStateStore(statePath);
  const council = new CouncilServiceImpl(firstStore);
  const started = await council.startCouncil({
    agentName: "e2e-operator",
    request: "Build, review, and synthesize the Occult production artifact.",
  });
  const plan = productionSpread(started.session.id);
  const config: OccultInterfaceConfig = {
    enabled: true,
    hermesBaseUrl: baseUrl,
    hermesServiceToken: serviceToken,
  };

  const firstService = new OccultInterfaceService(firstStore, config);
  const paused = await firstService.execute({
    contractVersion: OCCULT_CONTRACT_VERSION,
    agentName: "e2e-operator",
    plan,
  });

  assert.equal(paused.state, "running");
  assert.deepEqual(
    paused.nodes.map((node) => [node.node_id, node.state, node.attempt]),
    [
      ["build", "completed", 1],
      ["review", "pending", 0],
      ["synthesis", "pending", 0],
    ],
  );
  const approval = paused.approvals.find((candidate) => candidate.node_id === "review");
  assert.ok(approval, "review approval must be persisted");

  // Recreate every Council stateful service to prove restart-safe resume.
  const restartedStore = new FileCouncilStateStore(statePath);
  await new OccultReadingService(restartedStore).resolveApproval(
    paused.reading_id,
    approval.approval_id,
    "approved",
    "e2e-operator",
  );
  const restartedService = new OccultInterfaceService(restartedStore, config);
  const completed = await restartedService.execute({
    contractVersion: OCCULT_CONTRACT_VERSION,
    agentName: "e2e-operator",
    plan,
    expectedReadingId: paused.reading_id,
  });

  assert.equal(completed.reading_id, paused.reading_id);
  assert.equal(completed.state, "completed");
  assert.deepEqual(
    completed.nodes.map((node) => [node.node_id, node.state, node.attempt]),
    [
      ["build", "completed", 1],
      ["review", "completed", 1],
      ["synthesis", "completed", 1],
    ],
  );
  const terminalEvents = completed.events.filter((event) =>
    ["reading.cancelled", "reading.completed", "reading.failed"].includes(event.event_type),
  );
  assert.equal(terminalEvents.length, 1);
  assert.equal(terminalEvents[0]?.event_type, "reading.completed");

  const serialized = JSON.stringify(completed);
  assert.ok(!serialized.includes(serviceToken));
  assert.ok(!serialized.toLowerCase().includes("authorization"));
  assert.ok(!serialized.toLowerCase().includes("api_key"));

  process.stdout.write(
    `${JSON.stringify({
      contract_version: OCCULT_CONTRACT_VERSION,
      reading_id: completed.reading_id,
      state: completed.state,
      node_attempts: Object.fromEntries(completed.nodes.map((node) => [node.node_id, node.attempt])),
      terminal_event: terminalEvents[0]?.event_type,
    })}\n`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}

function productionSpread(councilSessionId: string): TarotSpreadExecution {
  return {
    councilSessionId,
    spreadId: "occult.spread.build-review-synthesis",
    spreadVersion: "1.0.0",
    idempotencyKey: "cross-repo-e2e:build-review-synthesis",
    maximumParallelism: 1,
    routing: {
      mode: "local_only",
      free_only: true,
      local_only: true,
      maximum_fallbacks: 0,
      maximum_cost_usd: 0,
    },
    nodes: [
      {
        nodeId: "build",
        agentId: "occult.major.magician",
        message: "Build the production artifact.",
      },
      {
        nodeId: "review",
        agentId: "occult.major.justice",
        message: "Review the production artifact.",
        requiresApproval: true,
      },
      {
        nodeId: "synthesis",
        agentId: "occult.major.temperance",
        message: "Synthesize the approved result.",
      },
    ],
    dependencies: [
      { source: "build", target: "review" },
      { source: "review", target: "synthesis" },
    ],
  };
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
