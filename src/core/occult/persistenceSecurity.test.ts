import { describe, expect, test } from "bun:test";

import { OCCULT_CONTRACT_VERSION } from "./contract";
import {
  assertSafeOccultIdentifier,
  sanitizePersistedArtifact,
  sanitizePersistedError,
  sanitizePersistedEventData,
  sanitizePersistedRouteSummary,
  UnsafeOccultPersistenceValue,
} from "./persistenceSecurity";

describe("Occult persistence security", () => {
  test("replaces route explanations and strips signed artifact URL material", () => {
    const route = sanitizePersistedRouteSummary({
      contract_version: OCCULT_CONTRACT_VERSION,
      invocation_id: "invocation-1",
      selected_card_id: "minor.swords.king.reasoning",
      provider_id: "provider-safe",
      model_id: "model-safe",
      fallback_count: 0,
      explanation: "Prompt fragment and private routing rationale.",
    });
    const artifact = sanitizePersistedArtifact({
      artifactId: "artifact-1",
      name: "report.md",
      mediaType: "text/markdown",
      uri: "https://artifacts.example/report.md?token=super-secret-value#private",
    });

    expect(route.explanation).not.toContain("Prompt fragment");
    expect(artifact.uri).toBe("https://artifacts.example/report.md");
  });

  test("allowlists event data and redacts credential-shaped error values", () => {
    expect(
      sanitizePersistedEventData("node.started", {
        attempt: 1,
        node_id: "build",
        message: "sensitive prompt",
        credentials: "tool credential",
      }),
    ).toEqual({ attempt: 1, node_id: "build" });
    expect(
      sanitizePersistedError({
        contract_version: OCCULT_CONTRACT_VERSION,
        code: "HERMES_UNAVAILABLE",
        message: "Authorization: Bearer abcdefghijklmnop",
        retryable: true,
        redacted: true,
      })?.message,
    ).toBe("Occult operation failed; sensitive details were redacted.");
  });

  test("rejects credential-shaped values in persisted identifiers", () => {
    expect(() => assertSafeOccultIdentifier("api_key=abcdefghijk", "provider.id")).toThrow(
      UnsafeOccultPersistenceValue,
    );
  });
});
