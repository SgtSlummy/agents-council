---
id: TASK-27.4
title: 'Expose Occult readings through MCP, CLI, and Council Hall'
status: To Do
assignee: []
created_date: '2026-07-27 20:50'
updated_date: '2026-07-27 20:51'
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
parent_task_id: TASK-27
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose feature-gated Occult reading creation, inspection, cancellation, and resume through Council interfaces without replacing ordinary session or summon behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Additive versioned MCP tools and CLI commands expose reading create, inspect, cancel, and resume while ordinary Council tools remain unchanged when the feature is disabled.
- [ ] #2 Council Hall displays Major and Minor Arcana pairings, reading and node status, approvals, and errors without exposing provider credentials or sensitive prompt material.
- [ ] #3 Authentication, authorization, and session targeting remain consistent with existing Council controls.
- [ ] #4 Streaming progress, interruption, cancellation, and resume semantics are consistent across supported interfaces.
- [ ] #5 Contract and interface tests cover the disabled gate, incompatible contract versions, unauthorized calls, and interrupted readings.
- [ ] #6 Operator documentation explains commands, tools, UI states, migration, feature disablement, and rollback.
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
