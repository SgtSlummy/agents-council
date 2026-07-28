---
id: TASK-27
title: Occult System integration for Agents Council
status: Done
assignee:
  - Codex
created_date: '2026-07-27 20:48'
updated_date: '2026-07-28 02:11'
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
  - 'https://github.com/SgtSlummy/agents-council/pull/7'
  - 'https://github.com/SgtSlummy/agents-council/pull/8'
  - 'https://github.com/SgtSlummy/agents-council/pull/9'
  - 'https://github.com/SgtSlummy/agents-council/pull/10'
  - 'https://github.com/SgtSlummy/agents-council/pull/11'
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
- [x] #1 Council and Hermes share a versioned contract with no provider credentials or authorization headers crossing the boundary.
- [x] #2 Council supports durable, resumable Occult readings without changing ordinary sessions while the feature is disabled.
- [x] #3 Hermes remains the sole provider-routing authority and Council never implements a second model router.
- [x] #4 Occult reading controls are available through the approved Council interfaces with compatibility and rollback documentation.
- [x] #5 Build, packaging, migration, security, and release validation preserve the current Council production baseline.
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
1. Establish a versioned, credential-free Occult contract and feature-gated Council architecture shared with Hermes.
2. Add durable reading state, safe migration, interruption recovery, and feature-disable behavior without changing ordinary Council sessions.
3. Integrate the Hermes bridge and Tarot spread scheduler while keeping Hermes/Mythos as the sole model-routing authority.
4. Expose authorized reading controls through MCP, CLI, HTTP/desktop, and Council Hall interfaces with compatibility documentation.
5. Harden persistence and audit boundaries, add production observability, validate cross-platform build/package/release assembly, and document upgrade, backup, restore, disablement, and rollback.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Parent completion evidence (2026-07-27): TASK-27.1 through TASK-27.5 are Done. The implementation is split into focused draft PRs #7-#11 stacked on the production-plan PR #6 and targeting main. Verified behavior includes versioned credential-free contracts, feature-gated and migrated durable readings, cancellation/resume and atomic persistence, Hermes-only routing, spread scheduling, MCP/CLI/HTTP/Council Hall controls, redacted security boundaries, release observability, deterministic manifests/checksums, 59 tests/256 assertions, local lint/typecheck/build/format/security checks, stress validation, and green Linux/macOS/Windows lint/test and Electrobun build matrices. Migration impact is additive and feature-gated; no breaking ordinary-session or provider-routing behavior is introduced. Remaining integration risk: stacked PRs must be reviewed and merged in dependency order before issue #1 can be closed in main.

Parent completion evidence (2026-07-27): TASK-27.1 through TASK-27.5 are Done. The delivered stack defines contract 1.0.0 with credential isolation and feature gating; adds durable/resumable reading state and migration; routes spread execution through the Hermes bridge without adding a Council model router; exposes approved MCP, CLI, HTTP/desktop, and Council Hall controls; and adds redacted observability, security validation, deterministic manifests/checksums, and production operations documentation. Validation includes 59 tests/256 assertions, lint, typecheck, build, clean-LF format validation, stress tests for watcher and cancellation races, Windows bundle checksum verification, and green Linux/macOS/Windows lint/test plus Electrobun CI. Migration impact is additive and reversible through the feature gate; no provider credentials cross into Council. Remaining integration constraint: draft PRs #7-#11 are stacked and must merge in dependency order after review.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the Agents Council Occult integration across five reviewed slices: versioned contract and feature gate, persistent reading domain, Hermes bridge and scheduler, approved operator interfaces, and production hardening/packaging. Hermes remains the sole provider router, Council state is credential-free and redacted, existing sessions remain unchanged while disabled, and the cross-platform production baseline passes. No breaking data migration is introduced. Draft PRs #7 through #11 target main and remain intentionally stacked for review and ordered merge.
<!-- SECTION:FINAL_SUMMARY:END -->
