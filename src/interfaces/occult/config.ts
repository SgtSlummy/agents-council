import type { OccultInterfaceConfig } from "./types";

type Environment = Record<string, string | undefined>;

export function loadOccultInterfaceConfig(environment: Environment = process.env): OccultInterfaceConfig {
  return {
    enabled: environment.OCCULT_ENABLED === "true",
    hermesBaseUrl: normalizeOptional(environment.OCCULT_HERMES_URL),
    hermesServiceToken: normalizeOptional(environment.OCCULT_HERMES_SERVICE_TOKEN),
  };
}

function normalizeOptional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
