import { z } from "zod";

export const OCCULT_CONTRACT_VERSION = "1.0.0" as const;

export const SUPPORTED_OCCULT_CAPABILITIES: ReadonlySet<string> = new Set([
  "audio_input",
  "audio_output",
  "citations",
  "embeddings",
  "reasoning",
  "streaming",
  "structured_output",
  "text",
  "tool_calling",
  "vision",
] as const);

const TERMINAL_EVENT_TYPES: ReadonlySet<string> = new Set(["reading.cancelled", "reading.completed", "reading.failed"]);

const SECRET_FIELD_NAMES = new Set([
  "accesstoken",
  "apikey",
  "authorization",
  "authorizationheader",
  "credential",
  "credentials",
  "password",
  "refreshtoken",
  "secret",
  "token",
]);

export class OccultContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ContractVersionMismatch extends OccultContractError {}

export class UnsupportedCapability extends OccultContractError {}

export class InvalidContractPayload extends OccultContractError {}

const contractVersionSchema = z.literal(OCCULT_CONTRACT_VERSION);
const orientationSchema = z.enum(["upright", "reversed"]);
const routeModeSchema = z.enum([
  "free_only",
  "local_first",
  "local_only",
  "manual",
  "privacy_first",
  "quality_first",
  "speed_first",
]);
const readingStateSchema = z.enum(["cancelled", "completed", "failed", "pending", "running"]);
const eventTypeSchema = z.enum([
  "node.completed",
  "node.failed",
  "node.started",
  "reading.cancelled",
  "reading.completed",
  "reading.failed",
  "reading.started",
  "route.selected",
]);

export const invocationInputSchema = z.strictObject({
  message: z.string().min(1),
});

export const routingPolicySchema = z.strictObject({
  mode: routeModeSchema.default("local_first"),
  free_only: z.boolean().default(true),
  local_only: z.boolean().default(false),
  maximum_fallbacks: z.number().int().min(0).max(10).default(2),
  maximum_cost_usd: z.number().min(0).default(0),
});

export const occultInvocationSchema = z.strictObject({
  contract_version: contractVersionSchema,
  invocation_id: z.string().min(1).max(128),
  idempotency_key: z.string().min(1).max(256),
  agent_id: z.string().min(1).max(256),
  orientation: orientationSchema.default("upright"),
  input: invocationInputSchema,
  required_capabilities: z.array(z.string()).default(["text"]),
  routing: routingPolicySchema.default({
    mode: "local_first",
    free_only: true,
    local_only: false,
    maximum_fallbacks: 2,
    maximum_cost_usd: 0,
  }),
  deck_id: z.string().nullable().default(null),
  spread_id: z.string().nullable().default(null),
  metadata: z.record(z.string(), z.string()).default({}),
});

export const majorArcanaAgentSchema = z.strictObject({
  contract_version: contractVersionSchema,
  agent_id: z.string(),
  name: z.string(),
  version: z.string(),
  capabilities: z.array(z.string()),
  maximum_risk_level: z.number().int().min(0).max(3),
});

export const minorArcanaRouteSchema = z.strictObject({
  contract_version: contractVersionSchema,
  card_id: z.string(),
  provider_id: z.string(),
  model_id: z.string(),
  capabilities: z.array(z.string()),
  local: z.boolean(),
  free: z.boolean(),
  healthy: z.boolean(),
});

export const deckDescriptorSchema = z.strictObject({
  contract_version: contractVersionSchema,
  deck_id: z.string(),
  version: z.string(),
  allowed_agent_ids: z.array(z.string()),
  allowed_card_ids: z.array(z.string()),
  routing: routingPolicySchema,
});

export const spreadNodeSchema = z.strictObject({
  node_id: z.string(),
  agent_id: z.string(),
  required_capabilities: z.array(z.string()).default(["text"]),
});

export const spreadEdgeSchema = z.strictObject({
  source: z.string(),
  target: z.string(),
  condition: z.string().default("success"),
});

export const spreadDescriptorSchema = z.strictObject({
  contract_version: contractVersionSchema,
  spread_id: z.string(),
  version: z.string(),
  nodes: z.array(spreadNodeSchema),
  edges: z.array(spreadEdgeSchema),
});

export const readingDescriptorSchema = z.strictObject({
  contract_version: contractVersionSchema,
  reading_id: z.string(),
  spread_id: z.string(),
  state: readingStateSchema,
  next_sequence: z.number().int().min(0),
});

export const routeSummarySchema = z.strictObject({
  contract_version: contractVersionSchema,
  invocation_id: z.string(),
  selected_card_id: z.string(),
  provider_id: z.string(),
  model_id: z.string(),
  fallback_count: z.number().int().min(0),
  explanation: z.string(),
});

export const occultErrorSchema = z.strictObject({
  contract_version: contractVersionSchema,
  code: z.string(),
  message: z.string(),
  retryable: z.boolean().default(false),
  redacted: z.literal(true),
});

export const readingEventSchema = z.strictObject({
  contract_version: contractVersionSchema,
  event_id: z.string(),
  reading_id: z.string(),
  sequence: z.number().int().min(0),
  event_type: eventTypeSchema,
  occurred_at: z.iso.datetime({ offset: true }),
  data: z.record(z.string(), z.unknown()).default({}),
  error: occultErrorSchema.nullable().default(null),
});

export type OccultInvocation = z.infer<typeof occultInvocationSchema>;
export type ReadingEvent = z.infer<typeof readingEventSchema>;

export function isOccultEnabled(config: unknown): boolean {
  if (!isRecord(config)) {
    return false;
  }
  const occult = config.occult;
  return isRecord(occult) && occult.enabled === true;
}

export function validateOccultInvocation(payload: unknown): OccultInvocation {
  const invocation = validatePayload(occultInvocationSchema, payload, "OccultInvocation");
  const unsupported = [...new Set(invocation.required_capabilities)]
    .filter((capability) => !SUPPORTED_OCCULT_CAPABILITIES.has(capability))
    .sort();

  if (unsupported.length > 0) {
    throw new UnsupportedCapability(`unsupported required capabilities: ${unsupported.join(", ")}`);
  }

  return invocation;
}

export function validateReadingEventStream(payloads: unknown): ReadingEvent[] {
  if (!Array.isArray(payloads) || payloads.length === 0) {
    throw new InvalidContractPayload("event stream must not be empty");
  }

  const events = payloads.map((payload) => validatePayload(readingEventSchema, payload, "ReadingEvent"));
  const readingIds = new Set(events.map((event) => event.reading_id));
  if (readingIds.size !== 1) {
    throw new InvalidContractPayload("event stream mixes reading ids");
  }

  const firstSequence = events[0]?.sequence;
  if (firstSequence === undefined) {
    throw new InvalidContractPayload("event stream must not be empty");
  }
  const hasStableSequence = events.every((event, index) => event.sequence === firstSequence + index);
  if (!hasStableSequence) {
    throw new InvalidContractPayload("event sequence must be contiguous and strictly increasing");
  }

  const terminalIndexes = events.flatMap((event, index) => (TERMINAL_EVENT_TYPES.has(event.event_type) ? [index] : []));
  if (terminalIndexes.length !== 1 || terminalIndexes[0] !== events.length - 1) {
    throw new InvalidContractPayload("event stream must end with exactly one terminal reading event");
  }

  return events;
}

function validatePayload<T>(schema: z.ZodType<T>, payload: unknown, modelName: string): T {
  rejectSecretFields(payload);
  requireContractVersion(payload);

  const result = schema.safeParse(payload);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.map((part) => String(part)).join(".") || "payload")),
    ].sort();
    throw new InvalidContractPayload(`invalid ${modelName} fields: ${fields.join(", ")}`);
  }
  return result.data;
}

function requireContractVersion(payload: unknown): void {
  const actual = isRecord(payload) ? payload.contract_version : undefined;
  if (actual !== OCCULT_CONTRACT_VERSION) {
    throw new ContractVersionMismatch(
      `Occult contract version mismatch: expected '${OCCULT_CONTRACT_VERSION}', received ${formatVersion(actual)}`,
    );
  }
}

function rejectSecretFields(value: unknown, path = "$", visited = new WeakSet<object>()): void {
  if (Array.isArray(value)) {
    if (visited.has(value)) {
      return;
    }
    visited.add(value);
    value.forEach((child, index) => {
      rejectSecretFields(child, `${path}[${index}]`, visited);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }
  if (visited.has(value)) {
    return;
  }
  visited.add(value);

  for (const [key, child] of Object.entries(value)) {
    if (SECRET_FIELD_NAMES.has(normalizeFieldName(key))) {
      throw new InvalidContractPayload(`forbidden secret-shaped field at ${path}.${key}`);
    }
    rejectSecretFields(child, `${path}.${key}`, visited);
  }
}

function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatVersion(value: unknown): string {
  if (typeof value === "string") {
    return `'${value}'`;
  }
  if (value === undefined) {
    return "undefined";
  }
  return typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
