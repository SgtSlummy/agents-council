---
id: TASK-27.3
title: Add Hermes bridge and Tarot spread scheduler
status: Done
assignee:
  - Codex
created_date: '2026-07-27 20:49'
updated_date: '2026-07-27 21:35'
labels:
  - occult
  - hermes
  - spreads
  - scheduler
dependencies:
  - TASK-27.2
references:
  - 'https://github.com/SgtSlummy/agents-council/issues/3'
  - 'https://github.com/SgtSlummy/hermes-agent/pull/7'
documentation:
  - docs/occult-system-production-plan.md
  - docs/council.md
  - docs/occult-hermes-spreads.md
modified_files:
  - docs/council.md
  - docs/occult-hermes-spreads.md
  - src/core/occult/contract.ts
  - src/core/occult/hermesBridge.test.ts
  - src/core/occult/hermesBridge.ts
  - src/core/occult/readingState.test.ts
  - src/core/occult/readingState.ts
  - src/core/occult/spreadScheduler.test.ts
  - src/core/occult/spreadScheduler.ts
parent_task_id: TASK-27
priority: high
type: feature
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow Council to execute Tarot spread nodes through a bounded Hermes bridge while Hermes remains the sole owner of Mythos routing, provider access, credentials, memory policy, and tool authorization.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Council invokes Hermes through a versioned bridge and never calls an LLM provider directly.
- [x] #2 Spread execution supports sequential nodes, bounded parallel nodes, retries, cancellation, and human approval gates.
- [x] #3 The bridge exchanges only contract-approved data and redacted route summaries.
- [x] #4 Timeouts, duplicate requests, bridge outages, and partial failures produce deterministic reading states.
- [x] #5 Tests use a deterministic fake Hermes bridge and cover success, retry, timeout, cancellation, and resume.
- [x] #6 Documentation explains trust boundaries, configuration, observability, and rollback.
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
1. Extend the durable reading service with atomic node transitions, approval resolution, redacted route/artifact recording, and deterministic terminal operations while preserving the v3 state schema.
2. Add a strict versioned Hermes bridge boundary with contract validation, recursive secret rejection, timeout/cancellation handling, and a configurable HTTP implementation that exposes no provider client.
3. Implement a dependency-aware Tarot spread scheduler with bounded parallelism, persisted retries, approval pauses, cancellation, idempotent replay, and restart/resume behavior.
4. Add deterministic fake-Hermes tests for sequential and parallel success, retry, timeout, outage/partial failure, cancellation, approvals, duplicate starts, and process restart/resume.
5. Document trust boundaries, configuration, observability, rollback, and the intentionally disabled-by-default live bridge; run targeted tests, typecheck, format validation, and build before publishing the stacked draft PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a strict Occult 1.0.0 Council-to-Hermes bridge. Council sends only validated Occult invocations and stores only redacted route summaries, artifact references, and errors. Recursive secret-shaped fields are rejected; no provider adapter, provider key, or provider endpoint was added to Council.

Implemented dependency-aware spread execution with bounded parallel batches, idempotent duplicate coalescing, deterministic per-attempt invocation IDs, retryable-error handling, timeout aborts, caller cancellation, approval pause/resolution, partial-failure preservation, and process restart/resume. Durable node transitions use the existing version 3 Council state without a schema migration.

Validation evidence: bun test passed 38/38 tests with 187 expectations; bun run typecheck passed; bun run build compiled 242 modules; bun run format:check passed all 60 files from a clean LF checkout. Deterministic fake-Hermes coverage includes sequential success, bounded parallel execution, permanent partial failure, retry, timeout exhaustion, cancellation, duplicate requests, human approval, and restart/resume.

Compatibility and remaining scope: persisted state remains version 3, and legacy reading fingerprints without an execution fingerprint remain replay-compatible. Live CLI, MCP, and desktop wiring remains intentionally disabled by default and is tracked by TASK-27.4; the matching Hermes endpoint must be enabled before production traffic.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

- Added a strict versioned Hermes bridge that accepts only shared Occult invocations and redacted, contract-validated results.
- Added an executable Tarot spread scheduler with sequential dependencies, bounded parallelism, deterministic retries and timeouts, cancellation, human approval gates, idempotent duplicates, and restart/resume.
- Extended durable reading operations for atomic node claims, route and artifact recording, failure transitions, approval resolution, and terminal outcomes without changing state schema version 3.
- Documented trust boundaries, configuration, observability, recovery, and rollback; live public interfaces remain disabled by default.

## Validation

- `bun test`: 38 passed, 0 failed, 187 expectations.
- `bun run typecheck`: passed.
- `bun run build`: passed; 242 modules compiled.
- `bun run format:check`: passed all 60 files from a clean LF checkout.

## Risk and follow-up

Council still has no provider authority or credentials. The HTTP bridge is a core adapter only and is not reachable from CLI, MCP, or desktop surfaces in this slice. TASK-27.4 owns those feature-gated interfaces, and Hermes must supply the matching `/v1/occult/invoke` endpoint before live use. Rollback requires disabling the Occult gate and cancelling or draining active readings; no state-schema downgrade is required.
<!-- SECTION:FINAL_SUMMARY:END -->
