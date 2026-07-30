---
id: TASK-27.3
title: Add Hermes bridge and Tarot spread scheduler
status: To Do
assignee: []
created_date: '2026-07-27 20:49'
updated_date: '2026-07-27 20:51'
labels:
  - occult
  - hermes
  - spreads
  - scheduler
dependencies:
  - TASK-27.2
references:
  - 'https://github.com/SgtSlummy/agents-council/issues/3'
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
Allow Council to execute Tarot spread nodes through a bounded Hermes bridge while Hermes remains the sole owner of Mythos routing, provider access, credentials, memory policy, and tool authorization.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Council invokes Hermes through a versioned bridge and never calls an LLM provider directly.
- [ ] #2 Spread execution supports sequential nodes, bounded parallel nodes, retries, cancellation, and human approval gates.
- [ ] #3 The bridge exchanges only contract-approved data and redacted route summaries.
- [ ] #4 Timeouts, duplicate requests, bridge outages, and partial failures produce deterministic reading states.
- [ ] #5 Tests use a deterministic fake Hermes bridge and cover success, retry, timeout, cancellation, and resume.
- [ ] #6 Documentation explains trust boundaries, configuration, observability, and rollback.
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
