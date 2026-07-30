import { describe, expect, test } from "bun:test";

import { OCCULT_CONTRACT_VERSION } from "../../core/occult/contract";
import { occultCreateSchema, occultResumeSchema, mapWireSpreadPlan } from "./protocol";

function wirePlan() {
  return {
    session_id: "session-1",
    spread_id: "occult.spread.production",
    spread_version: "1.0.0",
    idempotency_key: "project-alpha:production",
    nodes: [
      {
        node_id: "build",
        agent_id: "occult.major.magician",
        message: "Build the release.",
      },
    ],
  };
}

describe("Occult interface protocol", () => {
  test("maps the strict versioned wire plan to the scheduler contract", () => {
    const parsed = occultCreateSchema.parse({
      contract_version: OCCULT_CONTRACT_VERSION,
      plan: wirePlan(),
    });

    expect(mapWireSpreadPlan(parsed.plan)).toMatchObject({
      councilSessionId: "session-1",
      spreadId: "occult.spread.production",
      maximumParallelism: 1,
      nodes: [
        {
          nodeId: "build",
          agentId: "occult.major.magician",
          message: "Build the release.",
          orientation: "upright",
        },
      ],
    });
  });

  test("rejects incompatible versions and unknown secret-bearing fields", () => {
    expect(() =>
      occultCreateSchema.parse({
        contract_version: "2.0.0",
        plan: wirePlan(),
      }),
    ).toThrow();
    expect(() =>
      occultResumeSchema.parse({
        contract_version: OCCULT_CONTRACT_VERSION,
        reading_id: "reading-1",
        plan: {
          ...wirePlan(),
          api_key: "must-not-be-accepted",
        },
      }),
    ).toThrow();
  });
});
