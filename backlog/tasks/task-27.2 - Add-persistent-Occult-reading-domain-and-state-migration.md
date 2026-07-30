---
id: TASK-27.2
title: Add persistent Occult reading domain and state migration
status: Done
assignee:
  - Codex
created_date: '2026-07-27 20:49'
updated_date: '2026-07-27 21:11'
labels:
  - occult
  - readings
  - state
  - migration
dependencies:
  - TASK-27.1
  - TASK-26.3
references:
  - 'https://github.com/SgtSlummy/agents-council/issues/2'
documentation:
  - docs/occult-system-production-plan.md
  - docs/council.md
parent_task_id: TASK-27
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add durable Occult reading state to the Council domain so multi-agent workflows can resume safely across process restarts while remaining isolated from ordinary Council sessions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reading state records the spread version, node states, event sequence, idempotency keys, route summaries, approvals, artifacts, and terminal outcome.
- [x] #2 Existing Council state migrates without data loss and without creating active Occult readings.
- [x] #3 Reading state persists atomically and resumes deterministically after restart.
- [x] #4 Participant, request, feedback, and artifact relationships remain isolated per reading and Council session.
- [x] #5 Tests cover migration, restart, duplicate idempotency keys, event ordering, and terminal-state enforcement.
- [x] #6 User and developer documentation explains storage, migration, backup, and rollback behavior.
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
1. Evolve canonical `CouncilState` from version 2 to version 3 by adding an `occultReadings` collection. Migrate version-2 and legacy version-1 files to version 3 while preserving sessions, requests, feedback, participants, active-session selection, locking, and atomic writes; migrations create no readings.
2. Add focused Occult reading domain types and a small service over the existing `CouncilStateStore`. A reading will own its Council session, spread identity/version, idempotency key and semantic fingerprint, nodes, ordered events, redacted route summaries, approvals, artifacts, and terminal outcome.
3. Enforce invariants at the persistence boundary: unique reading IDs and session-scoped idempotency keys, valid session references, reading-local node/artifact/approval relationships, contiguous event sequences, no events after terminal state, and terminal outcome/state agreement. The service will atomically create or replay idempotent starts and append sequenced events.
4. Add migration and lifecycle tests covering v1/v2 preservation, empty reading migration, restart/resume, same-key replay, conflicting duplicate keys, session isolation, event ordering, relationship validation, terminal completion, and post-terminal rejection.
5. Document storage format, backup/restore behavior, migration, rollback, and the boundary that Council persists only redacted provider/model summaries while Hermes retains credentials and direct provider authority.
6. Run the full Bun test suite, typecheck, build, and repository formatter gate from an LF checkout; record evidence before task finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-26.3 remains administratively To Do, but its referenced multi-session v2 state, migration, atomic file-store locking, deterministic service lifecycle, and relationship tests are present on current `main` (commit `164770f`). This task will build on that verified code without changing TASK-26.3 status.

Implemented canonical Council state version 3 with nested `occultReadings`. Version 1 and version 2 data normalize to version 3 without creating readings; writes continue to use the existing lock and atomic replacement path.

Implemented an atomic reading service for session-scoped idempotent creation, semantic conflict detection, restart lookup, sequential event append, and terminal lockout. Persistence validates session ownership, reading-local node/approval/artifact relationships, unique IDs and idempotency keys, event continuity, redacted errors, and terminal outcome agreement.

Validation evidence: `bun test` passed 29/29 tests with 150 expectations; `bun run typecheck` passed; `bun run build` compiled 242 modules; `bun run format:check` passed all 56 files from a clean LF checkout. Migration tests preserve v1/v2 Council data and create zero readings. Lifecycle tests cover concurrent same-key replay, conflicts, cross-session isolation, restart/resume sequencing, nested route/approval/artifact persistence, relationship rejection, completion, and post-terminal rejection.

Migration impact: version 2 binaries cannot read version 3 state. The operator guide requires an offline backup and removal/export of `occultReadings` before setting the file back to version 2. No provider credential or direct-provider state is migrated or stored.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

- Upgraded canonical Council state to version 3 with durable, session-owned Occult readings.
- Added atomic idempotent reading start/replay, deterministic restart/resume sequencing, semantic conflict detection, and terminal-state enforcement.
- Added persisted nodes, ordered events, redacted route summaries, approvals, artifacts, and terminal outcomes with strict reading-local relationship validation.
- Added lossless v1/v2 migration to version 3 with an empty reading collection.
- Documented storage, security ownership, backup, restore, migration, and version-2 rollback.

## Validation

- `bun test`: 29 passed, 0 failed, 150 expectations.
- `bun run typecheck`: passed.
- `bun run build`: passed; 242 modules compiled.
- `bun run format:check`: passed all 56 files in a clean LF checkout.

## Risk and rollback

This is a persistent schema change from version 2 to version 3. Older binaries require an offline conversion that removes or exports `occultReadings` before restoring version 2. Existing Council sessions, requests, feedback, participants, locking, and atomic writes are preserved. No public reading interfaces or provider calls are introduced in this slice.
<!-- SECTION:FINAL_SUMMARY:END -->
