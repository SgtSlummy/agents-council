---
id: TASK-27.5
title: 'Harden, build, package, and release Council Occult integration'
status: To Do
assignee: []
created_date: '2026-07-27 20:51'
updated_date: '2026-07-27 20:51'
labels:
  - occult
  - security
  - release
  - packaging
dependencies:
  - TASK-27.4
  - TASK-26.7
references:
  - 'https://github.com/SgtSlummy/agents-council/issues/5'
  - 'https://github.com/SgtSlummy/agents-council/pull/6'
  - 'https://github.com/SgtSlummy/hermes-agent/pull/7'
parent_task_id: TASK-27
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Complete production hardening, cross-platform assembly, packaging, release validation, and operational documentation for the Agents Council Occult integration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Security review verifies that provider secrets, authorization headers, sensitive prompts, and tool credentials cannot enter Council state, logs, events, or release artifacts.
- [ ] #2 Type checking, formatting, unit, integration, security, end-to-end, and build gates pass from clean supported environments.
- [ ] #3 Migration, backup, restore, rollback, interruption recovery, and feature disablement are validated and documented.
- [ ] #4 Electrobun, CLI, and package artifacts are reproducible for supported platforms and declare compatible Occult contract versions.
- [ ] #5 Production observability covers reading state, bridge health, failures, latency, and redacted audit events.
- [ ] #6 Release checklist, changelog, operator upgrade guide, checksums, and rollback instructions are complete.
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
