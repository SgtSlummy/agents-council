import { describe, expect, test } from "bun:test";

import { OCCULT_CONTRACT_VERSION } from "./contract";
import { HttpHermesOccultBridge, parseBridgeResponse } from "./hermesBridge";

const invocation = {
  contract_version: OCCULT_CONTRACT_VERSION,
  invocation_id: "invocation-1",
  idempotency_key: "reading:node:1",
  agent_id: "occult.major.magician",
  orientation: "upright" as const,
  input: { message: "Build the system." },
  required_capabilities: ["text"],
  routing: {
    mode: "local_first" as const,
    free_only: true,
    local_only: false,
    maximum_fallbacks: 2,
    maximum_cost_usd: 0,
  },
  deck_id: null,
  spread_id: "occult.spread.production",
  metadata: {},
};

function completedResponse() {
  return {
    contract_version: OCCULT_CONTRACT_VERSION,
    invocation_id: invocation.invocation_id,
    status: "completed" as const,
    summary: "Built.",
    route_summary: {
      contract_version: OCCULT_CONTRACT_VERSION,
      invocation_id: invocation.invocation_id,
      selected_card_id: "minor.swords.king.hermes.reasoning",
      provider_id: "provider-redacted",
      model_id: "model-redacted",
      fallback_count: 0,
      explanation: "Selected by Hermes.",
    },
    artifacts: [],
    error: null,
  };
}

describe("Hermes Occult bridge", () => {
  test("posts only the versioned invocation and accepts a redacted route summary", async () => {
    let requestBody: unknown;
    const bridge = new HttpHermesOccultBridge({
      baseUrl: "http://127.0.0.1:8642",
      serviceToken: "council-service-token",
      fetch: (async (_url: URL | RequestInfo, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body));
        expect(init?.headers).toEqual({
          "content-type": "application/json",
          authorization: "Bearer council-service-token",
        });
        return Response.json(completedResponse());
      }) as typeof fetch,
    });

    const result = await bridge.invoke(invocation, { signal: new AbortController().signal });

    expect(requestBody).toEqual(invocation);
    expect(result.routeSummary.provider_id).toBe("provider-redacted");
    expect(result.invocation).toEqual(invocation);
  });

  test("rejects secret-shaped bridge payloads and mismatched response ids", async () => {
    expect(() =>
      parseBridgeResponse({
        ...completedResponse(),
        api_key: "must-never-cross-the-bridge",
      }),
    ).toThrow("forbidden secret-shaped field");

    const bridge = new HttpHermesOccultBridge({
      baseUrl: "http://127.0.0.1:8642",
      fetch: (async () =>
        Response.json({
          ...completedResponse(),
          invocation_id: "another-invocation",
        })) as unknown as typeof fetch,
    });
    await expect(bridge.invoke(invocation, { signal: new AbortController().signal })).rejects.toMatchObject({
      code: "HERMES_PROTOCOL_ERROR",
      retryable: false,
    });
  });

  test("normalizes network failures without leaking their details", async () => {
    const bridge = new HttpHermesOccultBridge({
      baseUrl: "http://127.0.0.1:8642",
      fetch: (async () => {
        throw new Error("socket failure containing internal details");
      }) as unknown as typeof fetch,
    });

    await expect(bridge.invoke(invocation, { signal: new AbortController().signal })).rejects.toEqual(
      expect.objectContaining({
        code: "HERMES_UNAVAILABLE",
        message: "Hermes bridge is unavailable.",
        retryable: true,
      }),
    );
  });
});
