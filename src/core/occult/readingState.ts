import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import type { CouncilSession, CouncilState } from "../services/council/types";
import type { CouncilStateStore } from "../state/store";
import {
  OCCULT_CONTRACT_VERSION,
  occultErrorSchema,
  readingEventSchema,
  routeSummarySchema,
  validateReadingEvent,
  validateRouteSummary,
} from "./contract";
import type { RouteSummary } from "./contract";
import type {
  OccultReading,
  OccultReadingArtifact,
  OccultReadingApproval,
  OccultReadingNode,
  OccultReadingOutcome,
  OccultReadingState,
} from "./readingTypes";

const TERMINAL_READING_STATES = new Set<OccultReadingState>(["cancelled", "completed", "failed"]);
const TERMINAL_EVENT_TYPES: ReadonlyMap<string, OccultReadingOutcome["state"]> = new Map([
  ["reading.cancelled", "cancelled"],
  ["reading.completed", "completed"],
  ["reading.failed", "failed"],
] as const);

const isoDateTimeSchema = z.iso.datetime({ offset: true });
const readingNodeSchema = z.strictObject({
  nodeId: z.string().min(1),
  agentId: z.string().min(1),
  state: z.enum(["cancelled", "completed", "failed", "pending", "running"]),
  attempt: z.number().int().min(0),
  startedAt: isoDateTimeSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
});
const readingApprovalSchema = z.strictObject({
  approvalId: z.string().min(1),
  nodeId: z.string().min(1),
  state: z.enum(["approved", "pending", "rejected"]),
  requestedAt: isoDateTimeSchema,
  resolvedAt: isoDateTimeSchema.nullable(),
  resolvedBy: z.string().min(1).nullable(),
});
const readingArtifactSchema = z.strictObject({
  artifactId: z.string().min(1),
  nodeId: z.string().min(1),
  name: z.string().min(1),
  mediaType: z.string().min(1),
  uri: z.string().min(1),
  createdAt: isoDateTimeSchema,
});
const readingOutcomeSchema = z.strictObject({
  state: z.enum(["cancelled", "completed", "failed"]),
  completedAt: isoDateTimeSchema,
  summary: z.string().nullable(),
  error: occultErrorSchema.nullable(),
});
const persistedReadingSchema = z.strictObject({
  id: z.string().min(1),
  councilSessionId: z.string().min(1),
  contractVersion: z.literal(OCCULT_CONTRACT_VERSION),
  spreadId: z.string().min(1),
  spreadVersion: z.string().min(1),
  idempotencyKey: z.string().min(1),
  idempotencyFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum(["cancelled", "completed", "failed", "running"]),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  nextSequence: z.number().int().min(0),
  nodes: z.array(readingNodeSchema),
  events: z.array(readingEventSchema),
  routeSummaries: z.array(routeSummarySchema),
  approvals: z.array(readingApprovalSchema),
  artifacts: z.array(readingArtifactSchema),
  outcome: readingOutcomeSchema.nullable(),
});

const startReadingInputSchema = z.strictObject({
  councilSessionId: z.string().min(1),
  spreadId: z.string().min(1),
  spreadVersion: z.string().min(1),
  idempotencyKey: z.string().min(1).max(256),
  executionFingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable()
    .default(null),
  nodes: z
    .array(
      z.strictObject({
        nodeId: z.string().min(1),
        agentId: z.string().min(1),
      }),
    )
    .min(1),
});

export type StartOccultReadingInput = z.input<typeof startReadingInputSchema>;
export type StartOccultReadingResult = {
  reading: OccultReading;
  created: boolean;
};

export type AppendOccultReadingEventInput = {
  readingId: string;
  eventType:
    | "node.completed"
    | "node.failed"
    | "node.started"
    | "reading.cancelled"
    | "reading.completed"
    | "reading.failed"
    | "route.selected";
  data?: Record<string, unknown>;
  error?: z.input<typeof occultErrorSchema> | null;
};

export type CompleteOccultNodeInput = {
  readingId: string;
  nodeId: string;
  routeSummary: unknown;
  artifacts?: Omit<OccultReadingArtifact, "createdAt" | "nodeId">[];
};

export class OccultReadingNotFound extends Error {}

export class OccultIdempotencyConflict extends Error {}

export class OccultReadingTerminalStateError extends Error {}

export class OccultReadingTransitionError extends Error {}

export class OccultReadingService {
  constructor(
    private readonly store: CouncilStateStore,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly idFactory: () => string = randomUUID,
  ) {}

  async startReading(input: StartOccultReadingInput): Promise<StartOccultReadingResult> {
    const parsed = parseStartReadingInput(input);
    const fingerprint = fingerprintStartInput(parsed);

    return this.store.update<StartOccultReadingResult>((state) => {
      if (!state.sessions.some((session) => session.id === parsed.councilSessionId)) {
        throw new Error(`Occult reading references unknown Council session: ${parsed.councilSessionId}`);
      }

      const existing = state.occultReadings.find(
        (reading) =>
          reading.councilSessionId === parsed.councilSessionId && reading.idempotencyKey === parsed.idempotencyKey,
      );
      if (existing) {
        if (existing.idempotencyFingerprint !== fingerprint) {
          throw new OccultIdempotencyConflict(
            `Occult idempotency key already exists with different input: ${parsed.idempotencyKey}`,
          );
        }
        return {
          state,
          result: {
            reading: existing,
            created: false,
          },
        };
      }

      const readingId = this.idFactory();
      const now = this.clock();
      const startedEvent = validateReadingEvent({
        contract_version: OCCULT_CONTRACT_VERSION,
        event_id: this.idFactory(),
        reading_id: readingId,
        sequence: 0,
        event_type: "reading.started",
        occurred_at: now,
        data: {
          spread_id: parsed.spreadId,
          spread_version: parsed.spreadVersion,
        },
        error: null,
      });
      const reading: OccultReading = {
        id: readingId,
        councilSessionId: parsed.councilSessionId,
        contractVersion: OCCULT_CONTRACT_VERSION,
        spreadId: parsed.spreadId,
        spreadVersion: parsed.spreadVersion,
        idempotencyKey: parsed.idempotencyKey,
        idempotencyFingerprint: fingerprint,
        state: "running",
        createdAt: now,
        updatedAt: now,
        nextSequence: 1,
        nodes: parsed.nodes.map<OccultReadingNode>((node) => ({
          nodeId: node.nodeId,
          agentId: node.agentId,
          state: "pending",
          attempt: 0,
          startedAt: null,
          completedAt: null,
        })),
        events: [startedEvent],
        routeSummaries: [],
        approvals: [],
        artifacts: [],
        outcome: null,
      };

      return {
        state: {
          ...state,
          occultReadings: [...state.occultReadings, reading],
        },
        result: {
          reading,
          created: true,
        },
      };
    });
  }

  async getReading(readingId: string): Promise<OccultReading> {
    const state = await this.store.load();
    const reading = state.occultReadings.find((candidate) => candidate.id === readingId);
    if (!reading) {
      throw new OccultReadingNotFound(`Occult reading not found: ${readingId}`);
    }
    return reading;
  }

  async appendEvent(input: AppendOccultReadingEventInput): Promise<OccultReading> {
    return this.store.update((state) => {
      const index = state.occultReadings.findIndex((candidate) => candidate.id === input.readingId);
      const reading = index >= 0 ? state.occultReadings[index] : undefined;
      if (!reading) {
        throw new OccultReadingNotFound(`Occult reading not found: ${input.readingId}`);
      }
      if (TERMINAL_READING_STATES.has(reading.state)) {
        throw new OccultReadingTerminalStateError(`Occult reading is already ${reading.state}: ${reading.id}`);
      }

      const now = this.clock();
      const event = validateReadingEvent({
        contract_version: OCCULT_CONTRACT_VERSION,
        event_id: this.idFactory(),
        reading_id: reading.id,
        sequence: reading.nextSequence,
        event_type: input.eventType,
        occurred_at: now,
        data: input.data ?? {},
        error: input.error ?? null,
      });
      const terminalState = TERMINAL_EVENT_TYPES.get(event.event_type);
      const outcome = terminalState ? createOutcome(terminalState, now, event.data, event.error) : null;
      const updated: OccultReading = {
        ...reading,
        state: terminalState ?? reading.state,
        updatedAt: now,
        nextSequence: reading.nextSequence + 1,
        events: [...reading.events, event],
        outcome,
      };

      return {
        state: {
          ...state,
          occultReadings: [...state.occultReadings.slice(0, index), updated, ...state.occultReadings.slice(index + 1)],
        },
        result: updated,
      };
    });
  }

  async claimNode(readingId: string, nodeId: string): Promise<OccultReadingNode> {
    return this.updateRunningReading(readingId, (reading, now) => {
      const node = requireNode(reading, nodeId);
      if (node.state === "completed" || node.state === "cancelled") {
        throw new OccultReadingTransitionError(`Cannot claim ${node.state} Occult node: ${nodeId}`);
      }
      if (node.state === "running") {
        return { reading, result: node };
      }

      const updatedNode: OccultReadingNode = {
        ...node,
        state: "running",
        attempt: node.attempt + 1,
        startedAt: now,
        completedAt: null,
      };
      const updated = appendReadingEvent(replaceNode(reading, updatedNode), "node.started", now, this.idFactory(), {
        attempt: updatedNode.attempt,
        node_id: nodeId,
      });
      return { reading: updated, result: updatedNode };
    });
  }

  async completeNode(input: CompleteOccultNodeInput): Promise<OccultReading> {
    const routeSummary = validateRouteSummary(input.routeSummary);
    return this.updateRunningReading(input.readingId, (reading, now) => {
      const node = requireNode(reading, input.nodeId);
      if (node.state === "completed") {
        const replayed = reading.routeSummaries.some((summary) => summary.invocation_id === routeSummary.invocation_id);
        if (replayed) {
          return { reading, result: reading };
        }
        throw new OccultReadingTransitionError(`Occult node already completed: ${input.nodeId}`);
      }
      if (node.state !== "running") {
        throw new OccultReadingTransitionError(`Cannot complete Occult node in ${node.state} state: ${input.nodeId}`);
      }

      const artifacts = (input.artifacts ?? []).map<OccultReadingArtifact>((artifact) => ({
        ...artifact,
        nodeId: input.nodeId,
        createdAt: now,
      }));
      const updatedNode: OccultReadingNode = {
        ...node,
        state: "completed",
        completedAt: now,
      };
      const routed = appendReadingEvent(
        {
          ...replaceNode(reading, updatedNode),
          routeSummaries: appendUniqueRouteSummary(reading.routeSummaries, routeSummary),
          artifacts: appendUniqueArtifacts(reading.artifacts, artifacts),
        },
        "route.selected",
        now,
        this.idFactory(),
        {
          fallback_count: routeSummary.fallback_count,
          invocation_id: routeSummary.invocation_id,
          node_id: input.nodeId,
          selected_card_id: routeSummary.selected_card_id,
        },
      );
      const updated = appendReadingEvent(routed, "node.completed", now, this.idFactory(), {
        attempt: node.attempt,
        node_id: input.nodeId,
      });
      return { reading: updated, result: updated };
    });
  }

  async failNode(readingId: string, nodeId: string, error: z.input<typeof occultErrorSchema>): Promise<OccultReading> {
    const parsedError = occultErrorSchema.parse(error);
    return this.updateRunningReading(readingId, (reading, now) => {
      const node = requireNode(reading, nodeId);
      if (node.state === "completed" || node.state === "cancelled") {
        return { reading, result: reading };
      }
      if (node.state !== "running") {
        throw new OccultReadingTransitionError(`Cannot fail Occult node in ${node.state} state: ${nodeId}`);
      }

      const updatedNode: OccultReadingNode = {
        ...node,
        state: "failed",
        completedAt: now,
      };
      const updated = appendReadingEvent(
        replaceNode(reading, updatedNode),
        "node.failed",
        now,
        this.idFactory(),
        { attempt: node.attempt, node_id: nodeId },
        parsedError,
      );
      return { reading: updated, result: updated };
    });
  }

  async ensureApproval(readingId: string, nodeId: string): Promise<OccultReadingApproval> {
    return this.updateRunningReading(readingId, (reading, now) => {
      requireNode(reading, nodeId);
      const existing = reading.approvals.find((approval) => approval.nodeId === nodeId);
      if (existing) {
        return { reading, result: existing };
      }
      const approval: OccultReadingApproval = {
        approvalId: this.idFactory(),
        nodeId,
        state: "pending",
        requestedAt: now,
        resolvedAt: null,
        resolvedBy: null,
      };
      return {
        reading: {
          ...reading,
          approvals: [...reading.approvals, approval],
          updatedAt: now,
        },
        result: approval,
      };
    });
  }

  async resolveApproval(
    readingId: string,
    approvalId: string,
    resolution: "approved" | "rejected",
    resolvedBy: string,
  ): Promise<OccultReadingApproval> {
    if (!resolvedBy.trim()) {
      throw new OccultReadingTransitionError("Approval resolver must not be empty.");
    }
    return this.updateRunningReading(readingId, (reading, now) => {
      const index = reading.approvals.findIndex((approval) => approval.approvalId === approvalId);
      const approval = index >= 0 ? reading.approvals[index] : undefined;
      if (!approval) {
        throw new OccultReadingTransitionError(`Occult approval not found: ${approvalId}`);
      }
      if (approval.state !== "pending") {
        if (approval.state === resolution && approval.resolvedBy === resolvedBy) {
          return { reading, result: approval };
        }
        throw new OccultReadingTransitionError(`Occult approval is already ${approval.state}: ${approvalId}`);
      }
      const resolved: OccultReadingApproval = {
        ...approval,
        state: resolution,
        resolvedAt: now,
        resolvedBy,
      };
      return {
        reading: {
          ...reading,
          approvals: [...reading.approvals.slice(0, index), resolved, ...reading.approvals.slice(index + 1)],
          updatedAt: now,
        },
        result: resolved,
      };
    });
  }

  async finishReading(
    readingId: string,
    state: OccultReadingOutcome["state"],
    summary: string,
    error: z.input<typeof occultErrorSchema> | null = null,
  ): Promise<OccultReading> {
    const eventType = `reading.${state}` as "reading.cancelled" | "reading.completed" | "reading.failed";
    return this.store.update((storeState) => {
      const index = storeState.occultReadings.findIndex((candidate) => candidate.id === readingId);
      const reading = index >= 0 ? storeState.occultReadings[index] : undefined;
      if (!reading) {
        throw new OccultReadingNotFound(`Occult reading not found: ${readingId}`);
      }
      if (TERMINAL_READING_STATES.has(reading.state)) {
        if (reading.state === state) {
          return { state: storeState, result: reading };
        }
        throw new OccultReadingTerminalStateError(`Occult reading is already ${reading.state}: ${reading.id}`);
      }
      if (state === "completed" && reading.nodes.some((node) => node.state !== "completed")) {
        throw new OccultReadingTransitionError(`Cannot complete Occult reading with unfinished nodes: ${readingId}`);
      }

      const now = this.clock();
      const terminalNodes =
        state === "completed"
          ? reading.nodes
          : reading.nodes.map<OccultReadingNode>((node) =>
              node.state === "pending" || node.state === "running"
                ? { ...node, state: "cancelled", completedAt: now }
                : node,
            );
      const updated = appendReadingEvent(
        { ...reading, nodes: terminalNodes },
        eventType,
        now,
        this.idFactory(),
        { summary },
        error ? occultErrorSchema.parse(error) : null,
      );
      return {
        state: replaceReading(storeState, index, updated),
        result: updated,
      };
    });
  }

  private async updateRunningReading<T>(
    readingId: string,
    update: (reading: OccultReading, now: string) => { reading: OccultReading; result: T },
  ): Promise<T> {
    return this.store.update((state) => {
      const index = state.occultReadings.findIndex((candidate) => candidate.id === readingId);
      const reading = index >= 0 ? state.occultReadings[index] : undefined;
      if (!reading) {
        throw new OccultReadingNotFound(`Occult reading not found: ${readingId}`);
      }
      if (TERMINAL_READING_STATES.has(reading.state)) {
        throw new OccultReadingTerminalStateError(`Occult reading is already ${reading.state}: ${reading.id}`);
      }
      const mutation = update(reading, this.clock());
      return {
        state: mutation.reading === reading ? state : replaceReading(state, index, mutation.reading),
        result: mutation.result,
      };
    });
  }
}

function appendReadingEvent(
  reading: OccultReading,
  eventType: AppendOccultReadingEventInput["eventType"],
  now: string,
  eventId: string,
  data: Record<string, unknown>,
  error: z.output<typeof occultErrorSchema> | null = null,
): OccultReading {
  const event = validateReadingEvent({
    contract_version: OCCULT_CONTRACT_VERSION,
    event_id: eventId,
    reading_id: reading.id,
    sequence: reading.nextSequence,
    event_type: eventType,
    occurred_at: now,
    data,
    error,
  });
  const terminalState = TERMINAL_EVENT_TYPES.get(event.event_type);
  return {
    ...reading,
    state: terminalState ?? reading.state,
    updatedAt: now,
    nextSequence: reading.nextSequence + 1,
    events: [...reading.events, event],
    outcome: terminalState ? createOutcome(terminalState, now, event.data, event.error) : reading.outcome,
  };
}

function requireNode(reading: OccultReading, nodeId: string): OccultReadingNode {
  const node = reading.nodes.find((candidate) => candidate.nodeId === nodeId);
  if (!node) {
    throw new OccultReadingTransitionError(`Occult node not found: ${nodeId}`);
  }
  return node;
}

function replaceNode(reading: OccultReading, node: OccultReadingNode): OccultReading {
  return {
    ...reading,
    nodes: reading.nodes.map((candidate) => (candidate.nodeId === node.nodeId ? node : candidate)),
  };
}

function replaceReading(state: CouncilState, index: number, reading: OccultReading): CouncilState {
  return {
    ...state,
    occultReadings: [...state.occultReadings.slice(0, index), reading, ...state.occultReadings.slice(index + 1)],
  };
}

function appendUniqueRouteSummary(routeSummaries: RouteSummary[], routeSummary: RouteSummary): RouteSummary[] {
  const existing = routeSummaries.find((summary) => summary.invocation_id === routeSummary.invocation_id);
  if (!existing) {
    return [...routeSummaries, routeSummary];
  }
  if (JSON.stringify(existing) !== JSON.stringify(routeSummary)) {
    throw new OccultReadingTransitionError(`Conflicting route summary replay: ${routeSummary.invocation_id}`);
  }
  return routeSummaries;
}

function appendUniqueArtifacts(
  existingArtifacts: OccultReadingArtifact[],
  artifacts: OccultReadingArtifact[],
): OccultReadingArtifact[] {
  const known = new Map(existingArtifacts.map((artifact) => [artifact.artifactId, artifact]));
  for (const artifact of artifacts) {
    const existing = known.get(artifact.artifactId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(artifact)) {
      throw new OccultReadingTransitionError(`Conflicting artifact replay: ${artifact.artifactId}`);
    }
    known.set(artifact.artifactId, existing ?? artifact);
  }
  return [...known.values()];
}

export function normalizeOccultReadings(input: unknown, sessions: CouncilSession[]): OccultReading[] {
  if (!Array.isArray(input)) {
    throw new Error("occultReadings must be an array.");
  }

  const readings = input.map((raw, index) => {
    const result = persistedReadingSchema.safeParse(raw);
    if (!result.success) {
      const fields = [
        ...new Set(
          result.error.issues.map(
            (issue) => `occultReadings[${index}].${issue.path.map(String).join(".") || "payload"}`,
          ),
        ),
      ].sort();
      throw new Error(`Invalid Occult reading fields: ${fields.join(", ")}`);
    }

    return {
      ...result.data,
      events: result.data.events.map((event) => validateReadingEvent(event)),
    };
  });

  assertOccultReadingIntegrity(readings, sessions);
  return readings;
}

export function assertOccultReadingIntegrity(readings: OccultReading[], sessions: CouncilSession[]): void {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const readingIds = new Set<string>();
  const idempotencyKeys = new Set<string>();

  for (const reading of readings) {
    if (readingIds.has(reading.id)) {
      throw new Error(`Duplicate Occult reading id detected: ${reading.id}`);
    }
    readingIds.add(reading.id);

    if (!sessionIds.has(reading.councilSessionId)) {
      throw new Error(`Occult reading ${reading.id} references unknown Council session ${reading.councilSessionId}`);
    }

    const scopedKey = `${reading.councilSessionId}::${reading.idempotencyKey}`;
    if (idempotencyKeys.has(scopedKey)) {
      throw new Error(`Duplicate Occult idempotency key detected: ${scopedKey}`);
    }
    idempotencyKeys.add(scopedKey);

    assertReadingRelationships(reading);
    assertReadingEvents(reading);
  }
}

function assertReadingRelationships(reading: OccultReading): void {
  const nodeIds = collectUniqueIds(reading.nodes, (node) => node.nodeId, `reading ${reading.id} node`);
  collectUniqueIds(reading.approvals, (approval) => approval.approvalId, `reading ${reading.id} approval`);
  collectUniqueIds(reading.artifacts, (artifact) => artifact.artifactId, `reading ${reading.id} artifact`);

  for (const approval of reading.approvals) {
    assertNodeReference(reading, nodeIds, approval.nodeId, `approval ${approval.approvalId}`);
    if (approval.state === "pending" && (approval.resolvedAt !== null || approval.resolvedBy !== null)) {
      throw new Error(`Pending approval ${approval.approvalId} cannot have resolution metadata`);
    }
    if (approval.state !== "pending" && (!approval.resolvedAt || !approval.resolvedBy)) {
      throw new Error(`Resolved approval ${approval.approvalId} requires resolution metadata`);
    }
  }

  for (const artifact of reading.artifacts) {
    assertNodeReference(reading, nodeIds, artifact.nodeId, `artifact ${artifact.artifactId}`);
  }
}

function assertReadingEvents(reading: OccultReading): void {
  if (reading.events.length === 0 || reading.events[0]?.event_type !== "reading.started") {
    throw new Error(`Occult reading ${reading.id} must begin with reading.started`);
  }
  if (reading.nextSequence !== reading.events.length) {
    throw new Error(`Occult reading ${reading.id} nextSequence does not match its event count`);
  }

  const eventIds = new Set<string>();
  const terminalIndexes: number[] = [];
  for (const [index, event] of reading.events.entries()) {
    if (event.reading_id !== reading.id) {
      throw new Error(`Occult reading ${reading.id} contains an event for ${event.reading_id}`);
    }
    if (event.sequence !== index) {
      throw new Error(`Occult reading ${reading.id} event sequence must be contiguous from zero`);
    }
    if (eventIds.has(event.event_id)) {
      throw new Error(`Duplicate Occult event id detected: ${event.event_id}`);
    }
    eventIds.add(event.event_id);
    if (TERMINAL_EVENT_TYPES.has(event.event_type)) {
      terminalIndexes.push(index);
    }
  }

  if (TERMINAL_READING_STATES.has(reading.state)) {
    if (terminalIndexes.length !== 1 || terminalIndexes[0] !== reading.events.length - 1) {
      throw new Error(`Terminal Occult reading ${reading.id} must end with exactly one terminal event`);
    }
    const terminalEvent = reading.events.at(-1);
    const eventState = terminalEvent ? TERMINAL_EVENT_TYPES.get(terminalEvent.event_type) : undefined;
    if (!reading.outcome || reading.outcome.state !== reading.state || eventState !== reading.state) {
      throw new Error(`Terminal Occult reading ${reading.id} has inconsistent outcome state`);
    }
    return;
  }

  if (terminalIndexes.length > 0 || reading.outcome !== null) {
    throw new Error(`Running Occult reading ${reading.id} cannot contain a terminal outcome`);
  }
}

function parseStartReadingInput(input: StartOccultReadingInput): z.output<typeof startReadingInputSchema> {
  const result = startReadingInputSchema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.map(String).join(".") || "payload")),
    ].sort();
    throw new Error(`Invalid Occult reading start fields: ${fields.join(", ")}`);
  }

  const nodeIds = new Set<string>();
  for (const node of result.data.nodes) {
    if (nodeIds.has(node.nodeId)) {
      throw new Error(`Duplicate Occult reading node id: ${node.nodeId}`);
    }
    nodeIds.add(node.nodeId);
  }
  return result.data;
}

function fingerprintStartInput(input: z.output<typeof startReadingInputSchema>): string {
  const fingerprintInput: Record<string, unknown> = {
    contractVersion: OCCULT_CONTRACT_VERSION,
    spreadId: input.spreadId,
    spreadVersion: input.spreadVersion,
    nodes: input.nodes,
  };
  if (input.executionFingerprint) {
    fingerprintInput.executionFingerprint = input.executionFingerprint;
  }
  return createHash("sha256").update(JSON.stringify(fingerprintInput)).digest("hex");
}

function createOutcome(
  state: OccultReadingOutcome["state"],
  completedAt: string,
  data: Record<string, unknown>,
  error: OccultReadingOutcome["error"],
): OccultReadingOutcome {
  const summary = typeof data.summary === "string" && data.summary.trim() ? data.summary.trim() : null;
  return {
    state,
    completedAt,
    summary,
    error,
  };
}

function collectUniqueIds<T>(items: T[], getId: (item: T) => string, label: string): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    const id = getId(item);
    if (ids.has(id)) {
      throw new Error(`Duplicate ${label} id detected: ${id}`);
    }
    ids.add(id);
  }
  return ids;
}

function assertNodeReference(reading: OccultReading, nodeIds: Set<string>, nodeId: string, label: string): void {
  if (!nodeIds.has(nodeId)) {
    throw new Error(`Occult reading ${reading.id} ${label} references unknown node ${nodeId}`);
  }
}

export type { OccultReading, OccultReadingArtifact, OccultReadingApproval };
