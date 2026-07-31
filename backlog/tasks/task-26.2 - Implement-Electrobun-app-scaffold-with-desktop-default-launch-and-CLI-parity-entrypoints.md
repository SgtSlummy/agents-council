---
id: TASK-26.2
title: >-
  Implement Electrobun app scaffold with desktop-default launch and CLI parity
  entrypoints
status: Done
assignee: []
created_date: '2026-02-21 21:11'
updated_date: '2026-07-31 07:44'
labels:
  - electrobun
  - runtime
  - cli
  - week-2
milestone: m-4
dependencies:
  - TASK-26.1
references:
  - src/cli/index.ts
  - scripts/cli.cjs
  - scripts/resolveBinary.cjs
  - package.json
documentation:
  - docs/council.md
  - docs/electrobun/guides/hello-world.md
  - docs/electrobun/guides/creating-ui.md
  - README.md
parent_task_id: TASK-26
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce the Electrobun runtime scaffold and wire command entrypoints so direct app launch opens the desktop window, while terminal invocation preserves CLI command behavior (`mcp`, `--help`, `--version`) and keeps `council chat` as desktop alias.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Project includes Electrobun build configuration and runtime entrypoints required to launch desktop UI.
- [x] #2 Direct launch path opens desktop interface without requiring CLI flags.
- [x] #3 Terminal command behavior remains compatible for existing CLI usage patterns, including `council mcp`.
- [x] #4 `council chat` remains available and opens/focuses desktop UI instead of starting Bun.serve web chat.
- [x] #5 No legacy web-chat server startup is required for primary UI operation.
- [x] #6 User-facing docs are updated in the same task (`README.md` and `docs/council.md`) to describe desktop-default launch, terminal CLI parity, and `council chat` alias behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add Electrobun application configuration and desktop Bun/view entrypoints. 2. Make no-argument execution launch the desktop runtime while preserving explicit CLI and MCP commands. 3. Route council chat to the desktop launcher and keep legacy flags as warnings only. 4. Document desktop-default and CLI-parity behavior and validate host artifacts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reconciliation evidence: electrobun.config.ts, desktop/bun/index.ts, desktop/views/council, src/cli/index.ts, and src/cli/desktopLauncher.ts implement the shipped desktop/default and explicit CLI/MCP paths. README.md and docs/council.md document the behavior. CI run 30613369629 passed CLI and Electrobun build smoke on macOS, Linux, and Windows; v0.5.2 publishes the resulting desktop and CLI assets.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped the Electrobun desktop scaffold with deterministic dual-mode entrypoints. Running Council with no command launches the desktop interface, explicit CLI and mcp commands retain terminal semantics, and council chat remains a compatibility alias to desktop launch without requiring the legacy Bun.serve web-chat path. User documentation and cross-platform artifact validation are in place.
<!-- SECTION:FINAL_SUMMARY:END -->
