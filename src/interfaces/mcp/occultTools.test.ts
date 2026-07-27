import { describe, expect, test } from "bun:test";

import { getOccultMcpToolNames, OCCULT_MCP_TOOL_NAMES } from "./server";

describe("Occult MCP tool registration", () => {
  test("keeps all Occult tools absent when the fail-closed feature gate is disabled", () => {
    expect(getOccultMcpToolNames(false)).toEqual([]);
  });

  test("exposes only explicitly versioned Occult tools when enabled", () => {
    expect(getOccultMcpToolNames(true)).toEqual(OCCULT_MCP_TOOL_NAMES);
    expect(OCCULT_MCP_TOOL_NAMES.every((name) => name.endsWith("_v1"))).toBe(true);
  });
});
