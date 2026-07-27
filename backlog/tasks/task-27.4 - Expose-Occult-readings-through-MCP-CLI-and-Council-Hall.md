---
id: TASK-27.4
title: 'Expose Occult readings through MCP, CLI, and Council Hall'
status: In Progress
assignee:
  - Codex
created_date: '2026-07-27 20:50'
updated_date: '2026-07-27 21:40'
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
<!-- SECTION:NOTES:END -->
