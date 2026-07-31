---
id: TASK-26.5
title: >-
  Implement desktop bridge for council actions, summon flows, and live state
  updates
status: Done
assignee: []
created_date: '2026-02-21 21:11'
updated_date: '2026-07-31 07:44'
labels:
  - desktop
  - bridge
  - summon
  - week-4
milestone: m-4
dependencies:
  - TASK-26.2
  - TASK-26.3
references:
  - src/interfaces/chat/server.ts
  - src/interfaces/chat/ui/api.ts
  - src/interfaces/chat/ui/hooks/useCouncil.ts
  - src/core/services/council/summon.ts
  - src/core/state/watcher.ts
documentation:
  - docs/electrobun/apis/browser-view.md
  - docs/electrobun/apis/browser/electroview-class.md
  - docs/electrobun/apis/events.md
parent_task_id: TASK-26
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide the Electrobun-side application bridge between desktop renderer and core council services, including council actions, summon/settings operations, and live state notifications without Bun.serve HTTP/WebSocket dependencies.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Desktop renderer can execute start/join/get/send/close council actions through the new bridge.
- [x] #2 Summon settings and summon-agent flows are fully accessible through desktop bridge APIs.
- [x] #3 Live update notifications propagate to renderer when council state changes.
- [x] #4 Desktop bridge error handling provides actionable messages equivalent to current UI behavior.
- [x] #5 Legacy Bun.serve-specific transport dependencies are removed from the primary UI path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define a typed desktop bridge contract for Council and summon actions. 2. Route renderer start/join/get/send/close and summon/settings requests through shared services. 3. Propagate file-state watcher updates to the renderer. 4. Normalize actionable errors and remove HTTP/WebSocket dependence from the primary desktop path.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reconciliation evidence: src/interfaces/chat/bridge/actions.ts and contract.ts expose the desktop action surface, desktop/bun/index.ts wires the bridge, and actions.test.ts verifies start/join/get/send/close, watcher events, summon settings, summon execution, and actionable failures. CI run 30613369629 passed the full suite and Electrobun builds on macOS, Linux, and Windows.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped the typed Electrobun desktop bridge over shared Council services. The renderer can perform the full Council lifecycle and summon/settings flows, receives live state updates, and gets actionable errors without requiring the former Bun.serve HTTP/WebSocket transport as its primary path. Focused bridge tests and cross-platform desktop builds are green.
<!-- SECTION:FINAL_SUMMARY:END -->
