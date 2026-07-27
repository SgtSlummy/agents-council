---
id: TASK-27
title: Occult System integration for Agents Council
status: To Do
assignee: []
created_date: '2026-07-27 20:48'
labels:
  - occult
  - agents-council
  - hermes
  - mythos
dependencies: []
references:
  - 'https://github.com/SgtSlummy/agents-council/issues/1'
  - 'https://github.com/SgtSlummy/agents-council/pull/6'
  - 'https://github.com/SgtSlummy/hermes-agent/pull/7'
documentation:
  - docs/occult-system-production-plan.md
  - docs/council.md
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrate Agents Council with the provider-independent Occult System so Council readings can coordinate Major Arcana agents through Hermes and Mythos while preserving existing Council sessions, MCP tools, CLI behavior, desktop behavior, and credential isolation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Council and Hermes share a versioned contract with no provider credentials or authorization headers crossing the boundary.
- [ ] #2 Council supports durable, resumable Occult readings without changing ordinary sessions while the feature is disabled.
- [ ] #3 Hermes remains the sole provider-routing authority and Council never implements a second model router.
- [ ] #4 Occult reading controls are available through the approved Council interfaces with compatibility and rollback documentation.
- [ ] #5 Build, packaging, migration, security, and release validation preserve the current Council production baseline.
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
