# Tarot Router provider-mesh Council canary

Status: operator canary for Hermes provider-mesh PR #52.  This document is
Council-side validation only; it does not change the Occult wire contract,
reading-state schema, provider credentials, or provider routing.

## Invariants

- Occult contract version remains `1.0.0`.
- Council reading-state schema remains `3`.
- Hermes owns provider discovery, credentials, model selection, and upstream
  response handling.
- Council receives only route identifiers and redacted summaries.
- Provider mesh is opt-in and remains disabled unless Hermes configuration
  explicitly enables it.
- No provider account creation, credential scraping, CAPTCHA bypass, or quota
  evasion is performed.

## Canary matrix

Run each case against a disposable Council state file and a local Hermes
runtime.  Save only redacted JSON/Markdown results to the launch issue.

### 1. Feature gate and local route

1. Start Council with `OCCULT_ENABLED=false` and verify ordinary Council
   sessions still work.
2. Enable Occult with a local-only Hermes route.
3. Create a reading through the CLI or MCP bridge.
4. Verify the reading completes and the persisted state contains contract
   `1.0.0`, schema `3`, route identifiers, and no prompt or credential text.

### 2. Explicit external route

1. Configure Hermes provider mesh with `allow_external_routes=true` and one
   explicitly authorized, free-only provider.
2. Invoke one small text node through Hermes.
3. Verify Council records the selected card/provider/model identifiers only.
4. If the provider is unavailable, verify the node fails with a redacted,
   retryable error and no upstream body or authorization details.

### 3. Approval pause, restart, and resume

1. Create a spread containing an approval-gated node.
2. Confirm the reading pauses with a pending approval.
3. Stop Council, preserve the state file, and restart it.
4. Approve and resume using the same reading ID and complete spread plan.
5. Verify completed nodes are not repeated and event sequences remain
   contiguous.

### 4. Audit redaction

Inspect the CLI/MCP response, persisted state, and canary report.  The report
must not contain prompts, provider responses, API keys, access or refresh
tokens, authorization headers, signed URLs, or secret-shaped field names.

## Required checks

```text
bun run typecheck
bun run format:check
bun test src/core/occult/contract.test.ts
bun test src/interfaces/occult/service.test.ts
bun test src/core/state/fileStateStore.test.ts
```

The Hermes side must separately pass its provider-mesh, production-gate,
interoperability, packaging, and provenance checks before this canary is
considered release evidence.

## Evidence record

Attach a redacted report to Council issue #36 containing:

- commit SHAs for Hermes and Council;
- contract and state-schema versions;
- route identifiers and health outcome;
- approval/restart/resume outcome;
- audit-redaction assertions;
- backup/restore and rollback result;
- any skipped or pending authorization routes.

Do not upload environment files, credentials, raw prompts, provider responses,
signed release URLs, or telemetry.

## Rollback

Disable the Hermes provider mesh or set `allow_external_routes=false`; Council
continues using the existing local-only path.  If a state rollback is needed,
stop Council writers, back up the current state file, restore the prior
checksummed copy, and run a read-only inspection before resuming traffic.
