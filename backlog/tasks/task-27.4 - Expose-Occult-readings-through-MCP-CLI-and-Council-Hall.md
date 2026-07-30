---
id: TASK-27.4
title: 'Expose Occult readings through MCP, CLI, and Council Hall'
status: Done
assignee:
  - Codex
created_date: '2026-07-27 20:50'
updated_date: '2026-07-27 21:55'
labels:
  - occult
  - mcp
  - cli
  - desktop
dependencies:
  - TASK-27.3
  - TASK-26.4
  - TASK-26.5
  - TASK-26.6
references:
  - 'https://github.com/SgtSlummy/agents-council/issues/4'
  - 'https://github.com/SgtSlummy/hermes-agent/pull/7'
modified_files:
  - desktop/bun/index.ts
  - desktop/views/council/index.ts
  - docs/council.md
  - docs/mcp.md
  - docs/occult-interfaces.md
  - docs/ui-implementation-progress.md
  - src/cli/index.ts
  - src/cli/occultCommands.ts
  - src/core/occult/spreadScheduler.ts
  - src/interfaces/chat/bridge/actions.test.ts
  - src/interfaces/chat/bridge/actions.ts
  - src/interfaces/chat/bridge/contract.ts
  - src/interfaces/chat/server.ts
  - src/interfaces/chat/ui/api.ts
  - src/interfaces/chat/ui/components/CouncilHall.tsx
  - src/interfaces/chat/ui/components/OccultReadingsPanel.test.tsx
  - src/interfaces/chat/ui/components/OccultReadingsPanel.tsx
  - src/interfaces/chat/ui/hooks/useCouncil.ts
  - src/interfaces/chat/ui/pages/Hall.tsx
  - src/interfaces/chat/ui/styles.css
  - src/interfaces/chat/ui/types.ts
  - src/interfaces/mcp/occultTools.test.ts
  - src/interfaces/mcp/server.ts
  - src/interfaces/occult/config.ts
  - src/interfaces/occult/protocol.test.ts
  - src/interfaces/occult/protocol.ts
  - src/interfaces/occult/service.test.ts
  - src/interfaces/occult/service.ts
  - src/interfaces/occult/types.ts
parent_task_id: TASK-27
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose feature-gated Occult reading creation, inspection, cancellation, and resume through Council interfaces without replacing ordinary session or summon behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Additive versioned MCP tools and CLI commands expose reading create, inspect, cancel, and resume while ordinary Council tools remain unchanged when the feature is disabled.
- [x] #2 Council Hall displays Major and Minor Arcana pairings, reading and node status, approvals, and errors without exposing provider credentials or sensitive prompt material.
- [x] #3 Authentication, authorization, and session targeting remain consistent with existing Council controls.
- [x] #4 Streaming progress, interruption, cancellation, and resume semantics are consistent across supported interfaces.
- [x] #5 Contract and interface tests cover the disabled gate, incompatible contract versions, unauthorized calls, and interrupted readings.
- [x] #6 Operator documentation explains commands, tools, UI states, migration, feature disablement, and rollback.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria are fully checked and match implemented behavior.
- [x] #2 Implementation plan is recorded in the task and reflects the final approach.
- [x] #3 bun run typecheck passes (when code changed).
- [x] #4 bun run format:check passes (when code changed).
- [x] #5 Relevant validation is run and recorded in task notes (tests, smoke checks, or manual verification).
- [x] #6 Documentation is updated in the same task when user/developer behavior changes (CLI, MCP contract, UI flow,      packaging/release behavior).
- [x] #7 Breaking changes and migration impact are documented in notes/final summary when applicable.
- [x] #8 Final summary is added with what changed, why, validation run, and remaining risks/follow-ups.
- [x] #9 Task status is set to Done only after all DoD items are checked.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a fail-closed Occult interface configuration and a shared interface service over the existing state store, reading service, and scheduler. Enforce contract version, enabled gate, active-session requirements, and exact Council participant authorization before create, inspect, cancel, or resume. Return only sanitized reading DTOs with Major/Minor pairing metadata, approval state, redacted errors, and sequence cursors; never return node prompts, bridge headers, or credentials.
2. Export a validated spread-plan entrypoint and add deterministic interface mappings for versioned snake_case requests. Creation and resume will accept the full plan because node prompts are intentionally not persisted; resume will verify that the supplied plan resolves to the requested persisted reading.
3. Add versioned Occult MCP tools and nested CLI commands for create, inspect, cancel, and resume. MCP tools register only when OCCULT_ENABLED=true; CLI commands remain discoverable but fail closed when disabled. Both will propagate interruption signals to the scheduler and expose event progress through after-sequence/next-sequence polling.
4. Extend the existing desktop bridge, HTTP compatibility adapter, UI API, and live-state hook with a read-only Occult status surface. Add a Council Hall reading panel showing agents, selected Minor Arcana, node/reading state, approvals, and redacted errors without sensitive prompt text. Ordinary Council and summon behavior remains unchanged when disabled.
5. Add core and interface tests covering the disabled gate, version mismatch, participant authorization, session targeting, sanitized projections, interrupted/cancelled readings, resume identity, and unchanged disabled UI data. Update MCP, Council, and operator documentation with commands, tools, UI states, migration impact, disablement, and rollback, then run the full test/typecheck/build/clean-LF-format gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dependencies TASK-26.4, TASK-26.5, and TASK-26.6 remain administratively To Do. Before implementation, this task will verify that their required session-targeted MCP, desktop bridge/live updates, and canonical Council Hall foundations are present on the current stacked branch; their statuses will not be changed by TASK-27.4.

Verified prerequisite implementation on the current branch: MCP requires explicit session_id for session-scoped operations; the desktop bridge exposes council/summon actions and stateChanged notifications; the React Council Hall uses the canonical sidebar plus hall layout with real session selection. Existing tests cover mapper session scope, desktop bridge actions/live notifications, and the Council service multi-session lifecycle. TASK-26.4, TASK-26.5, and TASK-26.6 remain administratively unchanged.

Implemented a fail-closed shared Occult interface service and strict v1 wire protocol over persisted readings and the Hermes spread scheduler. MCP tools are registered only when enabled; CLI commands, desktop bridge, HTTP fallback, live UI status, and the Council Hall panel share exact participant/session authorization and sanitized DTOs. Create/resume propagate cancellation signals, inspect uses monotonic sequence cursors, and resume verifies reading identity against the complete plan.

Objective validation: `bun test` passed 52 tests with 220 assertions, including disabled gate, version mismatch, unauthorized access, sanitized projections, interruption, cancellation, approval resume, desktop disabled status, and server-rendered Council Hall output. `bun run typecheck`, `bun run lint`, and `bun run build` passed. A detached LF-only checkout of commit cefab00 passed `bun run format:check` across 70 files. No state schema migration was introduced; docs describe enablement, disablement, and rollback.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

- Added strict Occult contract 1.0.0 create, inspect, cancel, and resume interfaces for MCP and CLI, gated by exact `OCCULT_ENABLED=true`.
- Added a shared session-authorized service that exposes only sanitized Major/Minor pairings, state, approvals, sequence progress, and redacted errors.
- Extended the desktop/HTTP bridge and Council Hall with live, read-only Occult status while preserving ordinary Council behavior when disabled.
- Added operator documentation for configuration, commands, tools, UI states, migration impact, disablement, and rollback.

## Validation

- `bun test`: 52 tests, 220 assertions passed.
- `bun run typecheck`: passed.
- `bun run lint`: passed.
- `bun run build`: compiled `dist/council.exe`.
- Clean detached LF checkout `bun run format:check`: 70 files passed.

## Compatibility and risk

This is additive and fail-closed. It introduces no state schema migration. Create/resume require the full plan because prompt content is deliberately not persisted. Existing stored readings remain available after re-enabling the feature.
<!-- SECTION:FINAL_SUMMARY:END -->
