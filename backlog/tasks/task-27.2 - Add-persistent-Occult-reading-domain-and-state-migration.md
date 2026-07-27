---
id: TASK-27.2
title: Add persistent Occult reading domain and state migration
status: In Progress
assignee:
  - Codex
created_date: '2026-07-27 20:49'
updated_date: '2026-07-27 21:03'
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
- [ ] #1 Reading state records the spread version, node states, event sequence, idempotency keys, route summaries, approvals, artifacts, and terminal outcome.
- [ ] #2 Existing Council state migrates without data loss and without creating active Occult readings.
- [ ] #3 Reading state persists atomically and resumes deterministically after restart.
- [ ] #4 Participant, request, feedback, and artifact relationships remain isolated per reading and Council session.
- [ ] #5 Tests cover migration, restart, duplicate idempotency keys, event ordering, and terminal-state enforcement.
- [ ] #6 User and developer documentation explains storage, migration, backup, and rollback behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria are fully checked and match implemented behavior.
- [ ] #2 Implementation plan is recorded in the task and reflects the final approach.
- [ ] #3 bun run typecheck passes (when code changed).
- [ ] #4 bun run format:check passes (when code changed).
- [ ] #5 Relevant validation is run and recorded in task notes (tests, smoke checks, or manual verification).
- [ ] #6 Documentation is updated in the same task when user/developer behavior changes (CLI, MCP contract, UI flow,      packaging/release behavior).
- [ ] #7 Breaking changes and migration impact are documented in notes/final summary when applicable.
- [ ] #8 Final summary is added with what changed, why, validation run, and remaining risks/follow-ups.
- [ ] #9 Task status is set to Done only after all DoD items are checked.
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
<!-- SECTION:NOTES:END -->
