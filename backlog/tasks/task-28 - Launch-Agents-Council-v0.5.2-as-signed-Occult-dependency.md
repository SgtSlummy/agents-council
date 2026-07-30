---
id: TASK-28
title: Launch Agents Council v0.5.2 as signed Occult dependency
status: In Progress
assignee:
  - Codex
created_date: '2026-07-30 23:20'
updated_date: '2026-07-30 23:25'
labels:
  - occult
  - release
  - security
dependencies: []
references:
  - 'https://github.com/SgtSlummy/agents-council/issues/16'
  - 'https://github.com/SgtSlummy/hermes-agent/issues/28'
documentation:
  - docs/occult-production-release.md
  - docs/occult-contract-v1.md
modified_files:
  - .github/workflows/release.yml
  - package.json
  - CHANGELOG.md
  - README.md
  - docs/occult-production-release.md
  - src/release
priority: high
type: chore
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ship a GitHub-release-first Agents Council patch release for Occult System v1.0.1. The release must not depend on the upstream unscoped npm package. Preserve Occult contract 1.0.0, state schema 3, fail-closed gating, ordinary Council behavior, and existing platform support.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every platform archive, manifest, and checksum remains reproducible and passes release validation.
- [ ] #2 The complete release checksum manifest has a verifiable Sigstore bundle tied to the repository release workflow.
- [ ] #3 Fork installation instructions use signed GitHub release assets and never invoke agents-council@latest.
- [ ] #4 CLI, desktop, MCP, Occult persistence, redaction, restart/resume, backup/restore, and rollback checks pass.
- [ ] #5 v0.5.1 remains immutable and v0.5.2 is published only after the protected launch canary succeeds.
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
1. Update package/changelog release metadata to v0.5.2 without changing the Occult protocol or state schema.
2. Extend the existing tag release workflow to keylessly sign RELEASE-SHA256SUMS.txt, verify the bundle against the exact workflow identity, and publish the Sigstore bundle with all current platform artifacts.
3. Add a GitHub-release installer helper that detects platform/architecture, downloads the pinned archive and release checksum manifest, verifies the release checksum plus internal platform checksums, extracts per-user, and never invokes npm.
4. Replace fork-facing npm installation examples with signed GitHub release instructions and link the canonical Hermes Occult quickstart.
5. Add behavior-focused installer/release tests, run typecheck/format/tests/build/release validation, and record redacted evidence before finalization.

Boundary refinement after repository inspection: the end-to-end Occult bootstrap belongs only in Hermes, which owns composition and onboarding. Council will not duplicate installer logic; it will publish signed platform assets, expose direct GitHub-release installation guidance, and remain a pinned dependency.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented v0.5.2 metadata, Sigstore signing/verification for the complete release checksum manifest, delayed latest-marker promotion, GitHub-release-first documentation, and release-policy tests. Validation: typecheck passed; lint passed; full 62-test suite passed; standalone build passed; release YAML parsed successfully. Repository-wide format:check is blocked locally by the existing Windows CRLF checkout baseline across 79 untouched files; changed-file semantics will be verified by clean GitHub Actions checkouts.
<!-- SECTION:NOTES:END -->
