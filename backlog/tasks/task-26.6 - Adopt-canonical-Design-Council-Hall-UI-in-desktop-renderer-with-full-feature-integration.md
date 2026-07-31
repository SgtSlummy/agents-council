---
id: TASK-26.6
title: >-
  Adopt canonical Design Council Hall UI in desktop renderer with full feature
  integration
status: Done
assignee: []
created_date: '2026-02-21 21:11'
updated_date: '2026-07-31 07:45'
labels:
  - ui
  - desktop
  - design-system
  - week-5
milestone: m-4
dependencies:
  - TASK-26.5
  - TASK-26.3
references:
  - Design Council Hall Interface/src/app/components/CouncilSidebar.tsx
  - Design Council Hall Interface/src/app/components/CouncilHall.tsx
  - Design Council Hall Interface/src/app/components/MessageBubble.tsx
  - src/interfaces/chat/ui/pages/Hall.tsx
  - src/interfaces/chat/ui/components/Settings.tsx
documentation:
  - docs/ui-spec.md
  - docs/ui-implementation-progress.md
parent_task_id: TASK-26
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the current production chat UI implementation with the canonical "Design Council Hall Interface" structure and visuals, adapted for repository compatibility and fully wired to real council/summon workflows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Desktop renderer uses canonical two-pane sidebar + hall layout aligned with `docs/ui-spec.md`.
- [x] #2 UI supports real session selection/listing, message rendering, composer behavior, and council closure flows.
- [x] #3 Summon modal and settings integrate model/reasoning controls and version visibility from current production capabilities.
- [x] #4 Design-bundle compatibility blockers (including non-standard asset imports) are resolved without introducing broken runtime references.
- [x] #5 Parity tracker in `docs/ui-implementation-progress.md` is updated to reflect implemented status for touched areas.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Port the canonical Council Sidebar and Council Hall structure into the production renderer. 2. Replace mock flows with real multi-session bridge data, composer, closure, summon, and settings operations. 3. Resolve design-bundle asset, font, and dependency incompatibilities for offline desktop builds. 4. Track parity and validate the renderer through cross-platform Electrobun builds.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reconciliation evidence: production CouncilSidebar, CouncilHall, MessageBubble, Hall, Settings, hooks, assets, and styles are wired to the real bridge and multi-session model. docs/ui-implementation-progress.md records touched areas as Aligned, including session navigation. CI run 30613369629 passed the complete test and Electrobun build matrix, and v0.5.2 includes desktop installer and update artifacts for each supported platform.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped the canonical two-pane Council Hall experience as the production Electrobun renderer. Real session navigation, messages, composer and closure, summon and settings controls, model and reasoning visibility, and version information replace the design bundle mocks. Asset and dependency incompatibilities are resolved, parity is recorded, and all supported platform builds pass.
<!-- SECTION:FINAL_SUMMARY:END -->
