---
id: TASK-26.4
title: Evolve MCP tools for explicit session selection in multi-session councils
status: Done
assignee: []
created_date: '2026-02-21 21:11'
updated_date: '2026-07-31 07:44'
labels:
  - mcp
  - api
  - multi-session
  - week-3
  - week-4
milestone: m-4
dependencies:
  - TASK-26.3
references:
  - src/interfaces/mcp/server.ts
  - src/interfaces/mcp/mapper.ts
  - src/interfaces/mcp/dtos/types.ts
  - src/core/services/council/index.ts
documentation:
  - docs/mcp.md
  - docs/council.md
parent_task_id: TASK-26
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update MCP council tool contracts and behavior so agents can target specific sessions explicitly in a multi-session environment, with clear validation and response semantics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MCP tool schemas include explicit session targeting where required for deterministic multi-session operations.
- [x] #2 Server validation and errors clearly handle missing, invalid, or closed session targets.
- [x] #3 Markdown and JSON tool outputs reflect session-scoped behavior consistently.
- [x] #4 MCP Inspector validation covers session-specific start/join/get/send/close flows.
- [x] #5 MCP documentation updates are delivered in the same task (`docs/mcp.md` and `docs/council.md`) and include explicit migration notes for clients moving from implicit-session behavior to session-targeted calls.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add explicit session_id fields to all existing-session MCP operations. 2. Validate missing, unknown, and closed targets before mutation. 3. Normalize Markdown and JSON outputs around the selected session. 4. Cover mapper/server flows and document the migration from implicit active-session behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reconciliation evidence: src/interfaces/mcp/server.ts, mapper.ts, DTO schemas, and mapper/server tests implement explicit session targeting and error behavior. docs/mcp.md and docs/council.md contain the client migration and MCP Inspector commands for start/join/get/send/close plus missing, invalid, and closed targets. Current cross-platform CI passed, and the signed v0.5.2 launch canary exercised the MCP-backed Council reading pause/restart/resume path.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped the session-targeted MCP v2 contract. Every operation on an existing Council requires an explicit session_id, validation rejects missing/invalid/closed targets, Markdown and JSON responses remain session-scoped, and the migration plus Inspector validation flow is documented. The behavior is covered by automated mapper/server tests and the public restart/resume canary.
<!-- SECTION:FINAL_SUMMARY:END -->
