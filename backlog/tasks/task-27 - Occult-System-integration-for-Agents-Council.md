---
id: TASK-27
title: Occult System integration for Agents Council
status: Done
assignee:
  - Codex
created_date: '2026-07-27 20:48'
updated_date: '2026-07-28 02:55'
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
1. Define and version the credential-free Council-Hermes Occult contract behind a disabled-by-default feature gate.
2. Add migrated persistent reading state with resumable scheduling, cancellation, and ordinary-session compatibility.
3. Keep Hermes as the exclusive execution and provider-routing bridge while Council orchestrates spread nodes only.
4. Expose authorized, redacted reading controls and status through MCP, CLI, HTTP, and Council Hall interfaces.
5. Harden persistence and release boundaries, add observability, reproducible contract manifests/checksums, cross-platform gates, and upgrade/rollback documentation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Parent completion evidence (2026-07-27): TASK-27.1 through TASK-27.5 are Done. The implementation is split into focused draft PRs #7-#11 stacked on the production-plan PR #6 and targeting main. Delivered behavior includes contract 1.0.0 credential isolation and disabled-by-default feature gating; durable migrated and resumable reading state with cancellation and atomic persistence; Hermes-only provider routing and Tarot spread scheduling; authorized MCP, CLI, HTTP/desktop, and Council Hall controls; redacted persistence and production observability; deterministic manifests/checksums; and migration, backup/restore, disablement, upgrade, and rollback guidance. Validation includes 59 tests/256 assertions, lint, typecheck, build, clean-LF format verification, watcher stress 10/10, cancellation stress 25/25, Windows bundle manifest/checksum verification, and green Linux/macOS/Windows lint/test plus Electrobun CI. Migration is additive and non-destructive; ordinary sessions remain unchanged when Occult is disabled. Remaining integration constraint: draft PRs #7-#11 must be reviewed and merged in dependency order before closing the GitHub issue on main.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the Agents Council Occult integration umbrella across five implementation slices. Council now has a feature-gated, versioned, credential-isolated contract with Hermes; durable resumable readings and spread orchestration; approved MCP, CLI, HTTP, and Council Hall controls; redacted observability; and reproducible cross-platform release packaging with operator recovery documentation. All supported-platform CI gates pass. No breaking migration is introduced; the stacked draft PR sequence remains #10 followed by #11.
<!-- SECTION:FINAL_SUMMARY:END -->
