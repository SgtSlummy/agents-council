---
id: TASK-27.1
title: Define Occult contract and feature-gated Council architecture
status: Done
assignee:
  - Codex
created_date: '2026-07-27 20:49'
updated_date: '2026-07-27 20:59'
labels:
  - occult
  - contract
  - feature-gate
dependencies: []
references:
  - 'https://github.com/SgtSlummy/agents-council/issues/1'
  - 'https://github.com/SgtSlummy/hermes-agent/pull/7'
documentation:
  - docs/occult-system-production-plan.md
  - docs/council.md
parent_task_id: TASK-27
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish the Agents Council side of the Occult v1 contract and ownership boundary so later reading, bridge, interface, and production work can proceed without changing current Council behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Agents Council validates contract version 1.0.0 and the same valid fixture semantics as Hermes.
- [x] #2 Existing Council CLI, MCP, desktop, session, and summon behavior is unchanged while Occult is disabled.
- [x] #3 Council-facing schemas contain no provider credential, authorization header, or direct provider-client field.
- [x] #4 Contract mismatch and unknown required capabilities fail before a reading node starts.
- [x] #5 Reading events define stable ordering, idempotency, one terminal state, and redacted errors.
- [x] #6 Tests and developer documentation cover the contract and default-off feature gate.
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
1. Add an isolated `src/core/occult/contract.ts` module containing the exact Occult contract version, supported capability set, strict Zod wire schemas, typed safe errors, a recursive secret-shaped-field preflight, invocation validation, event-stream ordering and terminal-state validation, and a fail-closed default-off feature-gate helper. Keep the module unreferenced by existing CLI, MCP, desktop, session, and summon entry points so this slice is behaviorally inert.
2. Check in the Hermes v1 invocation and event fixtures under `src/core/occult/spec/v1/fixtures/` without provider credentials or runtime authority.
3. Add focused Bun tests for fixture parity, exact version rejection, unknown capabilities, recursive secret rejection without value echo, default-off feature-gate behavior, contiguous event ordering, one-reading isolation, and exactly one terminal event at the end.
4. Add developer documentation describing the Hermes/Council ownership boundary, contract compatibility rules, event/idempotency semantics, security exclusions, enablement boundary, and rollback.
5. Run the focused contract tests plus required `bun run typecheck` and `bun run format:check`; record evidence and any environment limitations in task notes before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented an isolated Council-side Occult v1 contract using strict Zod schemas and safe typed errors. The module remains unreferenced by existing CLI, MCP, desktop, state, session, and summon paths, preserving default-off behavior.

Validation evidence: `bun test` passed 24/24 tests (115 expectations), including 13 focused Occult tests; `bun run typecheck` passed; `bun run build` compiled 240 modules into the Windows CLI executable; Hermes/Council JSON fixtures matched semantically 2/2; `bun run format:check` passed all 53 files from a clean LF checkout. The active Windows checkout itself converts untouched main files to CRLF, so the clean checkout was used to verify the repository-wide formatter gate without rewriting unrelated files.

No persistent state, migration, provider client, credential flow, command, MCP tool, desktop route, or runtime enablement was added. Rollback is removal of this isolated contract foundation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

- Added the Council-side Occult contract `1.0.0` as an isolated, default-off Zod validation module.
- Added Hermes-parity invocation and event fixtures plus focused validation, security, ordering, and redaction tests.
- Documented the Hermes/Council ownership boundary, compatibility rules, idempotency/event semantics, security exclusions, and rollback.
- Added the parent Occult implementation initiative and five GitHub-issue-aligned Backlog subtasks with dependencies on the existing Electrobun/multi-session roadmap.

## Validation

- `bun test`: 24 passed, 0 failed, 115 expectations.
- `bun run typecheck`: passed.
- `bun run build`: passed; 240 modules compiled.
- `bun run format:check`: passed all 53 files in a clean LF checkout.
- Hermes/Council fixtures: 2/2 semantic matches.

## Risk and rollback

The module is not wired into any existing runtime entry point and creates no state, so ordinary Council behavior is unchanged. Rollback is removal of the isolated contract module, fixtures, tests, documentation, and backlog records.
<!-- SECTION:FINAL_SUMMARY:END -->
