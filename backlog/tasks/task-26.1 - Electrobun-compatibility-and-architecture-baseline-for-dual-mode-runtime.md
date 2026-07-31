---
id: TASK-26.1
title: Electrobun compatibility and architecture baseline for dual-mode runtime
status: Done
assignee: []
created_date: '2026-02-21 21:11'
updated_date: '2026-07-31 07:43'
labels:
  - electrobun
  - architecture
  - week-1
milestone: m-4
dependencies: []
references:
  - src/cli/index.ts
  - scripts/cli.cjs
  - .github/workflows/release.yml
  - Design Council Hall Interface/src/app/components/CouncilHall.tsx
documentation:
  - docs/electrobun.md
  - docs/electrobun/guides/cross-platform-development.md
  - docs/electrobun/apis/cli/build-configuration.md
parent_task_id: TASK-26
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish and document the concrete runtime architecture for Electrobun in this repo, including mode detection, process boundaries, and platform constraints that impact desktop-launch vs terminal-CLI behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Architecture decision record defines desktop mode, CLI mode, and MCP mode lifecycle boundaries for macOS/Windows/Linux.
- [x] #2 Known compatibility issues in the incoming design bundle are enumerated with explicit remediation decisions.
- [x] #3 Mode-detection strategy is specified with platform-specific behavior and failure handling (including Windows console constraints).
- [x] #4 The task output includes an approved implementation sequence for downstream subtasks without unresolved technical decisions.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define desktop, CLI, and MCP lifecycle boundaries and shared-core process ownership. 2. Record macOS, Windows, and Linux renderer, console, startup, shutdown, and failure behavior. 3. Inventory canonical design-bundle incompatibilities and assign explicit remediations. 4. Lock the dependency-ordered implementation sequence for TASK-26.2 through TASK-26.7.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reconciliation evidence: docs/electrobun-architecture-baseline.md is the completed ADR and covers all three runtime modes, platform-specific behavior, the compatibility/remediation matrix, deterministic mode selection, failure handling, and dependency gates. The implementation is shipped in Agents Council v0.5.2; current macOS/Linux/Windows lint, typecheck, full tests, and Electrobun build-smoke jobs passed in CI run 30613369629.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Established and shipped the Electrobun architecture baseline. The ADR fixes desktop-default, terminal CLI, and stdio MCP boundaries across macOS, Windows, and Linux; assigns every known canonical-design compatibility issue to a downstream remediation; defines Windows console and Linux CEF behavior; and leaves no unresolved sequencing decision. Current cross-platform CI and the signed v0.5.2 release validate that the baseline was implemented without regressing the shared Council core.
<!-- SECTION:FINAL_SUMMARY:END -->
