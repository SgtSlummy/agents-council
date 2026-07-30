import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { OccultStatusResponse } from "../types";
import { OccultReadingsPanel } from "./OccultReadingsPanel";

const status: OccultStatusResponse = {
  contract_version: "1.0.0",
  enabled: true,
  session_id: "session-1",
  readings: [
    {
      contract_version: "1.0.0",
      reading_id: "reading-1",
      session_id: "session-1",
      spread_id: "occult.spread.production",
      spread_version: "1.0.0",
      state: "running",
      created_at: "2026-07-27T12:00:00.000Z",
      updated_at: "2026-07-27T12:00:01.000Z",
      next_sequence: 2,
      nodes: [
        {
          node_id: "audit",
          major_arcana: "occult.major.justice",
          minor_arcana: "minor.swords.king.audit",
          provider_id: "provider-safe",
          model_id: "model-safe",
          state: "failed",
          attempt: 1,
          started_at: "2026-07-27T12:00:00.000Z",
          completed_at: "2026-07-27T12:00:01.000Z",
          error: {
            code: "AUDIT_FAILED",
            message: "The audit failed without sensitive details.",
            retryable: false,
            redacted: true,
          },
        },
      ],
      approvals: [
        {
          approval_id: "approval-1",
          node_id: "publish",
          state: "pending",
          requested_at: "2026-07-27T12:00:01.000Z",
          resolved_at: null,
          resolved_by: null,
        },
      ],
      events: [],
      outcome_error: null,
    },
  ],
};

describe("OccultReadingsPanel", () => {
  test("renders sanitized pairings, state, approvals, and redacted errors", () => {
    const html = renderToStaticMarkup(<OccultReadingsPanel status={status} />);

    expect(html).toContain("occult.major.justice + minor.swords.king.audit");
    expect(html).toContain("publish: pending");
    expect(html).toContain("AUDIT_FAILED");
    expect(html).not.toContain("api_key");
    expect(html).not.toContain("Authorization");
  });

  test("does not render the panel while Occult is disabled", () => {
    expect(
      renderToStaticMarkup(
        <OccultReadingsPanel status={{ contract_version: "1.0.0", enabled: false, session_id: null, readings: [] }} />,
      ),
    ).toBe("");
  });
});
