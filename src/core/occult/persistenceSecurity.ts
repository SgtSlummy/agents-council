import type { OccultError, ReadingEvent, RouteSummary } from "./contract";
import type { OccultReadingArtifact, OccultReadingOutcome } from "./readingTypes";

const SENSITIVE_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /\b(?:api[_-]?key|authorization|credential|password|refresh[_-]?token|secret|token)\s*[:=]\s*\S+/i,
  /\bsk-[A-Za-z0-9_-]{8,}/i,
];

const SAFE_ROUTE_EXPLANATION = "Route selected by Hermes; detailed reasoning is retained outside Council state.";

const EVENT_DATA_KEYS: Record<ReadingEvent["event_type"], readonly string[]> = {
  "node.completed": ["attempt", "node_id"],
  "node.failed": ["attempt", "node_id"],
  "node.started": ["attempt", "node_id"],
  "reading.cancelled": ["summary"],
  "reading.completed": ["summary"],
  "reading.failed": ["summary"],
  "reading.started": ["spread_id", "spread_version"],
  "route.selected": ["fallback_count", "invocation_id", "node_id", "selected_card_id"],
};

export class UnsafeOccultPersistenceValue extends Error {}

export function containsSensitiveOccultValue(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

export function assertSafeOccultIdentifier(value: string, field: string): string {
  if (containsSensitiveOccultValue(value)) {
    throw new UnsafeOccultPersistenceValue(`Sensitive value rejected from persisted Occult field: ${field}`);
  }
  return value;
}

export function sanitizePersistedRouteSummary(route: RouteSummary): RouteSummary {
  return {
    ...route,
    invocation_id: assertSafeOccultIdentifier(route.invocation_id, "route.invocation_id"),
    selected_card_id: assertSafeOccultIdentifier(route.selected_card_id, "route.selected_card_id"),
    provider_id: assertSafeOccultIdentifier(route.provider_id, "route.provider_id"),
    model_id: assertSafeOccultIdentifier(route.model_id, "route.model_id"),
    explanation: SAFE_ROUTE_EXPLANATION,
  };
}

export function sanitizePersistedArtifact(
  artifact: Omit<OccultReadingArtifact, "createdAt" | "nodeId">,
): Omit<OccultReadingArtifact, "createdAt" | "nodeId"> {
  return {
    artifactId: assertSafeOccultIdentifier(artifact.artifactId, "artifact.id"),
    name: assertSafeOccultIdentifier(artifact.name, "artifact.name"),
    mediaType: assertSafeOccultIdentifier(artifact.mediaType, "artifact.media_type"),
    uri: sanitizeArtifactUri(artifact.uri),
  };
}

export function sanitizePersistedEventData(
  eventType: ReadingEvent["event_type"],
  input: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const key of EVENT_DATA_KEYS[eventType]) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    if (key === "summary" && typeof value === "string") {
      output[key] = redactSensitiveOccultText(value, defaultSummary(eventType));
      continue;
    }
    if (typeof value === "string") {
      output[key] = assertSafeOccultIdentifier(value, `event.${key}`);
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      output[key] = value;
    }
  }
  return output;
}

export function sanitizePersistedError(error: OccultError | null): OccultError | null {
  if (!error) {
    return null;
  }
  return {
    ...error,
    code: assertSafeOccultIdentifier(error.code, "error.code"),
    message: redactSensitiveOccultText(error.message, "Occult operation failed; sensitive details were redacted."),
    redacted: true,
  };
}

export function sanitizePersistedOutcome(outcome: OccultReadingOutcome | null): OccultReadingOutcome | null {
  if (!outcome) {
    return null;
  }
  return {
    ...outcome,
    summary: outcome.summary
      ? redactSensitiveOccultText(outcome.summary, defaultSummary(`reading.${outcome.state}`))
      : null,
    error: sanitizePersistedError(outcome.error),
  };
}

function redactSensitiveOccultText(value: string, fallback: string): string {
  return containsSensitiveOccultValue(value) ? fallback : value;
}

function sanitizeArtifactUri(value: string): string {
  try {
    const uri = new URL(value);
    uri.username = "";
    uri.password = "";
    uri.search = "";
    uri.hash = "";
    return assertSafeOccultIdentifier(uri.toString(), "artifact.uri");
  } catch {
    return assertSafeOccultIdentifier(value, "artifact.uri");
  }
}

function defaultSummary(eventType: ReadingEvent["event_type"] | `reading.${OccultReadingOutcome["state"]}`): string {
  switch (eventType) {
    case "reading.cancelled":
      return "Tarot spread cancelled.";
    case "reading.completed":
      return "Tarot spread completed.";
    case "reading.failed":
      return "Tarot spread failed.";
    default:
      return "Occult reading updated.";
  }
}
