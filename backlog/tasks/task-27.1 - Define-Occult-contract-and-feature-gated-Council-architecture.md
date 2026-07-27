---
id: TASK-27.1
title: Define Occult contract and feature-gated Council architecture
status: In Progress
assignee:
  - Codex
created_date: '2026-07-27 20:49'
updated_date: '2026-07-27 20:52'
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
- [ ] #1 Agents Council validates contract version 1.0.0 and the same valid fixture semantics as Hermes.
- [ ] #2 Existing Council CLI, MCP, desktop, session, and summon behavior is unchanged while Occult is disabled.
- [ ] #3 Council-facing schemas contain no provider credential, authorization header, or direct provider-client field.
- [ ] #4 Contract mismatch and unknown required capabilities fail before a reading node starts.
- [ ] #5 Reading events define stable ordering, idempotency, one terminal state, and redacted errors.
- [ ] #6 Tests and developer documentation cover the contract and default-off feature gate.
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
1. Add an isolated `src/core/occult/contract.ts` module containing the exact Occult contract version, supported capability set, strict Zod wire schemas, typed safe errors, a recursive secret-shaped-field preflight, invocation validation, event-stream ordering and terminal-state validation, and a fail-closed default-off feature-gate helper. Keep the module unreferenced by existing CLI, MCP, desktop, session, and summon entry points so this slice is behaviorally inert.
2. Check in the Hermes v1 invocation and event fixtures under `src/core/occult/spec/v1/fixtures/` without provider credentials or runtime authority.
3. Add focused Bun tests for fixture parity, exact version rejection, unknown capabilities, recursive secret rejection without value echo, default-off feature-gate behavior, contiguous event ordering, one-reading isolation, and exactly one terminal event at the end.
4. Add developer documentation describing the Hermes/Council ownership boundary, contract compatibility rules, event/idempotency semantics, security exclusions, enablement boundary, and rollback.
5. Run the focused contract tests plus required `bun run typecheck` and `bun run format:check`; record evidence and any environment limitations in task notes before finalization.
<!-- SECTION:PLAN:END -->
