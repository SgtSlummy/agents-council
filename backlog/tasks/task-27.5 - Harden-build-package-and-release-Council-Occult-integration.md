---
id: TASK-27.5
title: 'Harden, build, package, and release Council Occult integration'
status: In Progress
assignee:
  - Codex
created_date: '2026-07-27 20:51'
updated_date: '2026-07-27 22:21'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Harden the persisted Occult boundary so prompts, route explanations, authorization material, signed URL query data, and secret-shaped values cannot enter Council state, events, logs, or packaged runtime metadata. Add regression tests against serialized state and sanitized interface output.
2. Add derived production observability to the versioned status surface: reading totals by terminal state, node failures, invocation latency, last bridge success/failure, and a fail-closed bridge health classification. Keep audit events redacted and session-authorized across desktop and HTTP paths.
3. Add a deterministic release-manifest/checksum tool and package metadata declaring Occult contract 1.0.0 compatibility. Integrate it into cross-platform CI/release assembly, attach manifests and SHA-256 checksums to platform packages and GitHub releases, and validate root/platform package contents without publishing.
4. Extend clean environment gates to run tests, typecheck, lint, formatting, security/release validation, CLI smoke tests, and Electrobun artifact validation across supported runners. Verify the Windows host build locally and rely on the existing matrix for macOS/Linux host-only artifacts.
5. Add changelog, security review, release checklist, upgrade, backup/restore, interruption recovery, feature-disablement, and rollback guidance. Run complete validation, record evidence, finalize TASK-27.5, then publish a draft PR stacked on #10 and targeting main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified TASK-26.7 foundations on the current stacked branch without changing its administrative status: CI has Windows/macOS/Linux Electrobun smoke builds; release builds five CLI/desktop platform packages, publishes one root npm package plus optional dependencies, runs cross-platform install sanity, and creates a GitHub release. TASK-27.5 will extend this existing mechanism with Occult-specific security, observability, contract metadata, checksums, and release gates.
<!-- SECTION:NOTES:END -->
