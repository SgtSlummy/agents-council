import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  ContractVersionMismatch,
  InvalidContractPayload,
  OCCULT_CONTRACT_VERSION,
  UnsupportedCapability,
  isOccultEnabled,
  validateOccultInvocation,
  validateReadingEventStream,
} from "./contract";

async function loadFixture(name: "events.valid.json" | "invocation.valid.json"): Promise<unknown> {
  const url = new URL(`./spec/v1/fixtures/${name}`, import.meta.url);
  return JSON.parse(await readFile(url, "utf8"));
}

describe("Occult contract v1", () => {
  test("keeps the feature gate explicit and fail-closed", () => {
    expect(isOccultEnabled(null)).toBe(false);
    expect(isOccultEnabled({})).toBe(false);
    expect(isOccultEnabled({ occult: true })).toBe(false);
    expect(isOccultEnabled({ occult: { enabled: false } })).toBe(false);
    expect(isOccultEnabled({ occult: { enabled: true } })).toBe(true);
    expect(isOccultEnabled({ occult: { enabled: 1 } })).toBe(false);
  });

  test("validates the Hermes invocation fixture", async () => {
    const invocation = validateOccultInvocation(await loadFixture("invocation.valid.json"));

    expect(invocation.contract_version).toBe(OCCULT_CONTRACT_VERSION);
    expect(invocation.routing.free_only).toBe(true);
    expect(invocation.routing.maximum_cost_usd).toBe(0);
  });

  test("rejects a contract mismatch before schema validation", async () => {
    const fixture = (await loadFixture("invocation.valid.json")) as Record<string, unknown>;
    fixture.contract_version = "2.0.0";
    fixture.input = { message: "" };

    expect(() => validateOccultInvocation(fixture)).toThrow(ContractVersionMismatch);
    expect(() => validateOccultInvocation(fixture)).toThrow("expected '1.0.0'");
  });

  test("rejects unknown required capabilities before execution", async () => {
    const fixture = (await loadFixture("invocation.valid.json")) as Record<string, unknown>;
    fixture.required_capabilities = ["text", "telepathy"];

    expect(() => validateOccultInvocation(fixture)).toThrow(UnsupportedCapability);
    expect(() => validateOccultInvocation(fixture)).toThrow("unsupported required capabilities: telepathy");
  });

  test.each([
    "api_key",
    "Authorization",
    "refresh-token",
    "credentials",
    "password",
  ])("rejects recursive secret-shaped field %s", async (secretField) => {
    const fixture = (await loadFixture("invocation.valid.json")) as Record<string, unknown>;
    fixture.metadata = {
      nested: {
        [secretField]: "must-not-cross-boundary",
      },
    };

    expect(() => validateOccultInvocation(fixture)).toThrow(InvalidContractPayload);
    expect(() => validateOccultInvocation(fixture)).toThrow("forbidden secret-shaped field");
  });

  test("does not echo payload values in schema errors", async () => {
    const fixture = (await loadFixture("invocation.valid.json")) as Record<string, unknown>;
    fixture.input = { message: "" };
    fixture.metadata = { private_note: "do-not-echo-this-value" };

    try {
      validateOccultInvocation(fixture);
      throw new Error("expected validation failure");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidContractPayload);
      expect(String(error)).toContain("input.message");
      expect(String(error)).not.toContain("do-not-echo-this-value");
    }
  });

  test("validates the Hermes event fixture and one terminal event", async () => {
    const events = validateReadingEventStream(await loadFixture("events.valid.json"));

    expect(events.map((event) => event.sequence)).toEqual([0, 1]);
    expect(events.at(-1)?.event_type).toBe("reading.completed");
    expect(events.at(-1)?.error).toBeNull();
  });

  test("rejects sequence gaps, mixed readings, and events after terminal", async () => {
    const fixture = (await loadFixture("events.valid.json")) as Array<Record<string, unknown>>;

    const withGap = structuredClone(fixture);
    if (withGap[1]) {
      withGap[1].sequence = 2;
    }
    expect(() => validateReadingEventStream(withGap)).toThrow("contiguous");

    const mixedReadings = structuredClone(fixture);
    if (mixedReadings[1]) {
      mixedReadings[1].reading_id = "another-reading";
    }
    expect(() => validateReadingEventStream(mixedReadings)).toThrow("mixes reading ids");

    const afterTerminal = [
      ...structuredClone(fixture),
      {
        ...structuredClone(fixture[0]),
        event_id: "evt_example_003",
        sequence: 2,
      },
    ];
    expect(() => validateReadingEventStream(afterTerminal)).toThrow("terminal");
  });

  test("requires redacted error events", async () => {
    const fixture = (await loadFixture("events.valid.json")) as Array<Record<string, unknown>>;
    const failed = structuredClone(fixture);
    if (failed[1]) {
      failed[1].event_type = "reading.failed";
      failed[1].error = {
        contract_version: "1.0.0",
        code: "provider_unavailable",
        message: "Provider unavailable",
        retryable: true,
        redacted: false,
      };
    }

    expect(() => validateReadingEventStream(failed)).toThrow(InvalidContractPayload);
    expect(() => validateReadingEventStream(failed)).toThrow("error.redacted");
  });
});
