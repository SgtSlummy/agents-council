---
id: TASK-26.3
title: Upgrade core council state and service layer for multi-session lifecycle
status: Done
assignee: []
created_date: '2026-02-21 21:11'
updated_date: '2026-07-31 07:44'
labels:
  - core
  - state
  - multi-session
  - week-2
  - week-3
milestone: m-4
dependencies:
  - TASK-26.1
references:
  - src/core/services/council/index.ts
  - src/core/services/council/types.ts
  - src/core/state/fileStateStore.ts
  - src/core/state/fileStore.ts
documentation:
  - docs/council.md
parent_task_id: TASK-26
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Evolve the council domain model from single-session state to multi-session lifecycle management, including active-session selection, archive-ready history, and migration from existing persisted state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Core state schema supports multiple sessions with clear active-session semantics.
- [x] #2 Existing single-session persisted state is migrated safely without data loss or invalid state.
- [x] #3 Council service operations can create, list, retrieve, and update sessions using deterministic rules.
- [x] #4 Participant/request/feedback relationships remain consistent per session.
- [x] #5 State locking and atomic-write guarantees remain intact after schema evolution.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Introduce a versioned multi-session state schema with active-session semantics. 2. Migrate legacy single-session and v2 state deterministically. 3. Extend the Council service with create/list/get/update/close operations scoped to session IDs. 4. Preserve per-session relationships, locking, and atomic writes with focused tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reconciliation evidence: state schema 3, CouncilServiceImpl multi-session lifecycle tests, file-state migration tests, watcher behavior, and atomic file-store logic are present on main. CI run 30613369629 passed the complete test suite on all three operating systems. The public v0.5.2 recovery canary also passed Council pause, restart, resume, backup, restore, and rollback without session loss.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped deterministic multi-session Council state and service behavior. Schema migrations preserve earlier state, service operations scope participants, requests, feedback, and closure to explicit sessions, active-session reassignment is deterministic, and the existing lock/atomic-write guarantees remain covered by tests and restart/recovery canaries.
<!-- SECTION:FINAL_SUMMARY:END -->
