import { createHash } from "node:crypto";

import { z } from "zod";

import { OCCULT_CONTRACT_VERSION, routingPolicySchema } from "./contract";
import type { OccultError, OccultInvocation } from "./contract";
import { createOccultInvocation, HermesBridgeError } from "./hermesBridge";
import type { HermesOccultBridge } from "./hermesBridge";
import type { OccultReadingService } from "./readingState";
import type { OccultReading } from "./readingTypes";

const spreadNodeExecutionSchema = z.strictObject({
  nodeId: z.string().min(1).max(128),
  agentId: z.string().min(1).max(256),
  message: z.string().min(1),
  requiredCapabilities: z.array(z.string()).default(["text"]),
  orientation: z.enum(["upright", "reversed"]).default("upright"),
  requiresApproval: z.boolean().default(false),
  maximumAttempts: z.number().int().min(1).max(10).default(2),
  timeoutMs: z.number().int().min(1).max(3_600_000).default(60_000),
});

const spreadDependencySchema = z.strictObject({
  source: z.string().min(1),
  target: z.string().min(1),
});

const tarotSpreadExecutionSchema = z.strictObject({
  councilSessionId: z.string().min(1),
  spreadId: z.string().min(1),
  spreadVersion: z.string().min(1),
  idempotencyKey: z.string().min(1).max(256),
  deckId: z.string().nullable().default(null),
  routing: routingPolicySchema.default({
    mode: "local_first",
    free_only: true,
    local_only: false,
    maximum_fallbacks: 2,
    maximum_cost_usd: 0,
  }),
  maximumParallelism: z.number().int().min(1).max(16).default(1),
  nodes: z.array(spreadNodeExecutionSchema).min(1),
  dependencies: z.array(spreadDependencySchema).default([]),
});

type ParsedTarotSpreadExecution = z.output<typeof tarotSpreadExecutionSchema>;
export type TarotSpreadExecution = z.input<typeof tarotSpreadExecutionSchema>;
export type TarotSpreadNodeExecution = z.output<typeof spreadNodeExecutionSchema>;

export class InvalidTarotSpread extends Error {}

export class TarotSpreadScheduler {
  private readonly activeReadings = new Map<string, Promise<OccultReading>>();

  constructor(
    private readonly readings: OccultReadingService,
    private readonly hermes: HermesOccultBridge,
  ) {
    if (hermes.contractVersion !== OCCULT_CONTRACT_VERSION) {
      throw new InvalidTarotSpread(
        `Hermes bridge contract mismatch: expected ${OCCULT_CONTRACT_VERSION}, received ${hermes.contractVersion}`,
      );
    }
  }

  async execute(input: TarotSpreadExecution, signal?: AbortSignal): Promise<OccultReading> {
    const plan = parseSpread(input);
    const started = await this.readings.startReading({
      councilSessionId: plan.councilSessionId,
      spreadId: plan.spreadId,
      spreadVersion: plan.spreadVersion,
      idempotencyKey: plan.idempotencyKey,
      executionFingerprint: fingerprintPlan(plan),
      nodes: plan.nodes.map((node) => ({
        nodeId: node.nodeId,
        agentId: node.agentId,
      })),
    });

    const existing = this.activeReadings.get(started.reading.id);
    if (existing) {
      return existing;
    }
    const execution = this.run(started.reading.id, plan, signal).finally(() => {
      this.activeReadings.delete(started.reading.id);
    });
    this.activeReadings.set(started.reading.id, execution);
    return execution;
  }

  async resolveApproval(
    readingId: string,
    approvalId: string,
    resolution: "approved" | "rejected",
    resolvedBy: string,
  ): Promise<void> {
    await this.readings.resolveApproval(readingId, approvalId, resolution, resolvedBy);
  }

  private async run(readingId: string, plan: ParsedTarotSpreadExecution, signal?: AbortSignal): Promise<OccultReading> {
    while (true) {
      let reading = await this.readings.getReading(readingId);
      if (reading.state !== "running") {
        return reading;
      }
      if (signal?.aborted) {
        return this.cancel(readingId);
      }

      const rejectedApproval = reading.approvals.find((approval) => approval.state === "rejected");
      if (rejectedApproval) {
        return this.readings.finishReading(
          readingId,
          "failed",
          `Approval rejected for node ${rejectedApproval.nodeId}.`,
          occultError("APPROVAL_REJECTED", "A required human approval was rejected.", false),
        );
      }

      const permanentFailure = reading.nodes.find(
        (node) => node.state === "failed" && !lastNodeFailure(reading, node.nodeId)?.retryable,
      );
      if (permanentFailure) {
        return this.readings.finishReading(
          readingId,
          "failed",
          `Node ${permanentFailure.nodeId} failed permanently.`,
          lastNodeFailure(reading, permanentFailure.nodeId) ??
            occultError("NODE_FAILED", "A spread node failed permanently.", false),
        );
      }

      const exhausted = reading.nodes.find((node) => {
        const planNode = requirePlanNode(plan, node.nodeId);
        return node.state === "failed" && node.attempt >= planNode.maximumAttempts;
      });
      if (exhausted) {
        return this.readings.finishReading(
          readingId,
          "failed",
          `Node ${exhausted.nodeId} exhausted ${exhausted.attempt} attempt(s).`,
          occultError("NODE_ATTEMPTS_EXHAUSTED", "A spread node exhausted its allowed attempts.", false),
        );
      }

      if (reading.nodes.every((node) => node.state === "completed")) {
        return this.readings.finishReading(readingId, "completed", "Tarot spread completed.");
      }

      const ready: TarotSpreadNodeExecution[] = [];
      for (const node of plan.nodes) {
        const persisted = reading.nodes.find((candidate) => candidate.nodeId === node.nodeId);
        if (!persisted || persisted.state === "completed" || persisted.state === "cancelled") {
          continue;
        }
        if (!dependenciesComplete(plan, reading, node.nodeId)) {
          continue;
        }
        if (node.requiresApproval) {
          const approval = reading.approvals.find((candidate) => candidate.nodeId === node.nodeId);
          if (!approval) {
            await this.readings.ensureApproval(readingId, node.nodeId);
            continue;
          }
          if (approval.state !== "approved") {
            continue;
          }
        }
        ready.push(node);
      }

      if (ready.length === 0) {
        reading = await this.readings.getReading(readingId);
        if (reading.approvals.some((approval) => approval.state === "pending")) {
          return reading;
        }
        return this.readings.finishReading(
          readingId,
          "failed",
          "Tarot spread cannot make progress.",
          occultError("SPREAD_DEADLOCK", "Spread dependencies cannot make progress.", false),
        );
      }

      const batch = ready.slice(0, plan.maximumParallelism);
      await Promise.all(batch.map((node) => this.runNode(readingId, plan, node, signal)));
    }
  }

  private async runNode(
    readingId: string,
    plan: ParsedTarotSpreadExecution,
    node: TarotSpreadNodeExecution,
    outerSignal?: AbortSignal,
  ): Promise<void> {
    if (outerSignal?.aborted) {
      return;
    }
    const claimed = await this.readings.claimNode(readingId, node.nodeId);
    const invocation = buildInvocation(readingId, plan, node, claimed.attempt);
    const controller = new AbortController();
    let timedOut = false;
    const abortFromOuter = () => controller.abort(outerSignal?.reason);
    outerSignal?.addEventListener("abort", abortFromOuter, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error("Hermes invocation timeout"));
    }, node.timeoutMs);

    try {
      const result = await this.hermes.invoke(invocation, { signal: controller.signal });
      await this.readings.completeNode({
        readingId,
        nodeId: node.nodeId,
        routeSummary: result.routeSummary,
        artifacts: result.artifacts.map((artifact) => ({
          artifactId: artifact.artifact_id,
          name: artifact.name,
          mediaType: artifact.media_type,
          uri: artifact.uri,
        })),
      });
    } catch (error) {
      if (outerSignal?.aborted) {
        return;
      }
      const occultFailure = timedOut
        ? occultError("HERMES_TIMEOUT", "Hermes invocation timed out.", true)
        : normalizeBridgeError(error);
      await this.readings.failNode(readingId, node.nodeId, occultFailure);
    } finally {
      clearTimeout(timeout);
      outerSignal?.removeEventListener("abort", abortFromOuter);
    }
  }

  private async cancel(readingId: string): Promise<OccultReading> {
    return this.readings.finishReading(
      readingId,
      "cancelled",
      "Tarot spread cancelled.",
      occultError("READING_CANCELLED", "Reading cancelled by caller.", false),
    );
  }
}

function parseSpread(input: TarotSpreadExecution): ParsedTarotSpreadExecution {
  const result = tarotSpreadExecutionSchema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.map(String).join(".") || "payload")),
    ].sort();
    throw new InvalidTarotSpread(`Invalid Tarot spread fields: ${fields.join(", ")}`);
  }

  const nodeIds = new Set<string>();
  for (const node of result.data.nodes) {
    if (nodeIds.has(node.nodeId)) {
      throw new InvalidTarotSpread(`Duplicate Tarot spread node: ${node.nodeId}`);
    }
    nodeIds.add(node.nodeId);
  }
  for (const dependency of result.data.dependencies) {
    if (!nodeIds.has(dependency.source) || !nodeIds.has(dependency.target)) {
      throw new InvalidTarotSpread(
        `Tarot spread dependency references an unknown node: ${dependency.source} -> ${dependency.target}`,
      );
    }
    if (dependency.source === dependency.target) {
      throw new InvalidTarotSpread(`Tarot spread node cannot depend on itself: ${dependency.source}`);
    }
  }
  assertAcyclic(result.data);
  return result.data;
}

function assertAcyclic(plan: ParsedTarotSpreadExecution): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dependencies = new Map<string, string[]>();
  for (const edge of plan.dependencies) {
    dependencies.set(edge.target, [...(dependencies.get(edge.target) ?? []), edge.source]);
  }
  const visit = (nodeId: string): void => {
    if (visiting.has(nodeId)) {
      throw new InvalidTarotSpread(`Tarot spread contains a dependency cycle at node: ${nodeId}`);
    }
    if (visited.has(nodeId)) {
      return;
    }
    visiting.add(nodeId);
    for (const dependency of dependencies.get(nodeId) ?? []) {
      visit(dependency);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  for (const node of plan.nodes) {
    visit(node.nodeId);
  }
}

function dependenciesComplete(plan: ParsedTarotSpreadExecution, reading: OccultReading, nodeId: string): boolean {
  const dependencies = plan.dependencies.filter((edge) => edge.target === nodeId).map((edge) => edge.source);
  return dependencies.every(
    (dependency) => reading.nodes.find((node) => node.nodeId === dependency)?.state === "completed",
  );
}

function requirePlanNode(plan: ParsedTarotSpreadExecution, nodeId: string): TarotSpreadNodeExecution {
  const node = plan.nodes.find((candidate) => candidate.nodeId === nodeId);
  if (!node) {
    throw new InvalidTarotSpread(`Persisted reading references an unknown plan node: ${nodeId}`);
  }
  return node;
}

function lastNodeFailure(reading: OccultReading, nodeId: string): OccultError | null {
  for (let index = reading.events.length - 1; index >= 0; index -= 1) {
    const event = reading.events[index];
    if (event?.event_type === "node.failed" && event.data.node_id === nodeId) {
      return event.error;
    }
  }
  return null;
}

function buildInvocation(
  readingId: string,
  plan: ParsedTarotSpreadExecution,
  node: TarotSpreadNodeExecution,
  attempt: number,
): OccultInvocation {
  const invocationId = `occult-${createHash("sha256")
    .update(`${readingId}:${node.nodeId}:${attempt}`)
    .digest("hex")
    .slice(0, 32)}`;
  return createOccultInvocation({
    contract_version: OCCULT_CONTRACT_VERSION,
    invocation_id: invocationId,
    idempotency_key: `${readingId}:${node.nodeId}:${attempt}`,
    agent_id: node.agentId,
    orientation: node.orientation,
    input: { message: node.message },
    required_capabilities: node.requiredCapabilities,
    routing: plan.routing,
    deck_id: plan.deckId,
    spread_id: plan.spreadId,
    metadata: {
      attempt: String(attempt),
      node_id: node.nodeId,
      reading_id: readingId,
      spread_version: plan.spreadVersion,
    },
  });
}

function fingerprintPlan(plan: ParsedTarotSpreadExecution): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

function normalizeBridgeError(error: unknown): OccultError {
  if (error instanceof HermesBridgeError) {
    return error.toOccultError();
  }
  return occultError("HERMES_UNAVAILABLE", "Hermes bridge invocation failed.", true);
}

function occultError(code: string, message: string, retryable: boolean): OccultError {
  return {
    contract_version: OCCULT_CONTRACT_VERSION,
    code,
    message,
    retryable,
    redacted: true,
  };
}
