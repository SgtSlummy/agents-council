---
id: TASK-26.7
title: >-
  Migrate CI and npm packaging to Electrobun desktop+CLI artifacts across
  platforms
status: To Do
assignee: []
created_date: '2026-02-21 21:11'
updated_date: '2026-07-31 07:45'
labels:
  - ci
  - release
  - npm
  - week-6
milestone: m-4
dependencies:
  - TASK-26.2
  - TASK-26.4
references:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - scripts/cli.cjs
  - scripts/resolveBinary.cjs
  - package.json
documentation:
  - docs/electrobun/guides/bundling-and-distribution.md
  - docs/electrobun/guides/cross-platform-development.md
  - DEVELOPMENT.md
  - README.md
  - docs/council.md
parent_task_id: TASK-26
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update build and release automation so Electrobun-generated binaries/artifacts are published via the existing single user-facing npm package model (with platform optional dependencies) and validated across macOS, Windows, and Linux.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CI builds and validates platform artifacts for Electrobun runtime targets on macOS, Windows, and Linux.
- [ ] #2 Release workflow publishes a single user-facing npm package plus platform optional dependency packages for binaries/artifacts.
- [ ] #3 Install-sanity workflow verifies terminal CLI behavior (`--help`, `--version`, `mcp`) from published packages on all supported OS runners.
- [x] #4 Release artifacts include desktop-launchable binaries/installers appropriate for each platform.
- [ ] #5 Packaging and release documentation reflects the new Electrobun-based distribution model.
- [ ] #6 Developer and release documentation is updated in the same task (`DEVELOPMENT.md` plus Electrobun packaging docs) to reflect the implemented desktop+CLI distribution workflow and cross-platform expectations.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the signed GitHub-release artifact pipeline as the production source of truth. 2. Define an explicitly authorized npm trusted-publishing policy for the root and five platform package names. 3. Build platform packages first, publish the root only after every optional dependency is available, and validate registry provenance and exact versions. 4. Run fresh install-sanity for help, version, mcp startup, and desktop launch on macOS, Linux, and Windows. 5. Update development and operator documentation only after the registry workflow is proven.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Post-launch audit: current main satisfies cross-platform Electrobun artifact build/validation and publishes desktop-launchable GitHub release assets. The approved Occult v1 launch intentionally excluded npm publication, and the hardened v0.5.2 release workflow therefore has no npm publish or registry install-sanity jobs. Acceptance criteria 2, 3, 5, and 6 remain open. Resuming them requires an explicit public npm distribution decision plus trusted-publisher authorization for the root and five platform package names; no registry write was attempted.
<!-- SECTION:NOTES:END -->
