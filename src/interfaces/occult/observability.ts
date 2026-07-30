import type { OccultReading } from "../../core/occult/readingTypes";
import type { OccultInterfaceConfig, OccultObservabilityDto } from "./types";

export function buildOccultObservability(
  config: OccultInterfaceConfig,
  readings: OccultReading[],
): OccultObservabilityDto {
  const successTimes = collectEventTimes(readings, new Set(["route.selected", "reading.completed"]));
  const failureTimes = collectEventTimes(readings, new Set(["node.failed", "reading.failed"]));
  const lastSuccess = latest(successTimes);
  const lastFailure = latest(failureTimes);
  const latencies = readings.flatMap((reading) =>
    reading.nodes.flatMap((node) => {
      if (!node.startedAt || !node.completedAt) {
        return [];
      }
      const duration = Date.parse(node.completedAt) - Date.parse(node.startedAt);
      return Number.isFinite(duration) && duration >= 0 ? [duration] : [];
    }),
  );

  return {
    bridge: {
      configured: config.hermesBaseUrl !== null,
      status: bridgeStatus(config, lastSuccess, lastFailure),
      last_success_at: lastSuccess,
      last_failure_at: lastFailure,
    },
    readings: {
      total: readings.length,
      running: countReadings(readings, "running"),
      completed: countReadings(readings, "completed"),
      failed: countReadings(readings, "failed"),
      cancelled: countReadings(readings, "cancelled"),
    },
    nodes: {
      failed: readings.flatMap((reading) => reading.nodes).filter((node) => node.state === "failed").length,
      average_invocation_latency_ms:
        latencies.length > 0
          ? Math.round(latencies.reduce((total, value) => total + value, 0) / latencies.length)
          : null,
      maximum_invocation_latency_ms: latencies.length > 0 ? Math.max(...latencies) : null,
    },
    audit: {
      event_count: readings.reduce((total, reading) => total + reading.events.length, 0),
      redacted_error_count: readings.reduce(
        (total, reading) => total + reading.events.filter((event) => event.error?.redacted === true).length,
        0,
      ),
    },
  };
}

function collectEventTimes(readings: OccultReading[], eventTypes: ReadonlySet<string>): string[] {
  return readings.flatMap((reading) =>
    reading.events.filter((event) => eventTypes.has(event.event_type)).map((event) => event.occurred_at),
  );
}

function latest(values: string[]): string | null {
  return values.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function countReadings(readings: OccultReading[], state: OccultReading["state"]): number {
  return readings.filter((reading) => reading.state === state).length;
}

function bridgeStatus(
  config: OccultInterfaceConfig,
  lastSuccess: string | null,
  lastFailure: string | null,
): OccultObservabilityDto["bridge"]["status"] {
  if (!config.enabled) {
    return "disabled";
  }
  if (!config.hermesBaseUrl) {
    return "unconfigured";
  }
  if (lastFailure && (!lastSuccess || Date.parse(lastFailure) > Date.parse(lastSuccess))) {
    return "degraded";
  }
  if (lastSuccess) {
    return "healthy";
  }
  return "unknown";
}
