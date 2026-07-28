# Occult Production Release Guide

## Release contract

Agents Council supports Occult contract `1.0.0`. Occult remains fail-closed
unless `OCCULT_ENABLED=true`. The Electrobun runtime, root npm package, platform
npm packages, and generated release manifests declare this compatibility.

No state migration is introduced. Occult readings remain part of Council state
schema version 3.

## Security review

The production persistence boundary applies these controls before any Occult
data reaches Council state:

- prompts and Hermes invocation bodies are never persisted
- event metadata is allowlisted per event type
- provider route explanations are replaced with a fixed safe statement
- credential-shaped route, model, card, node, agent, and artifact identifiers
  are rejected without echoing their values
- artifact URL user information, query strings, and fragments are removed
- credential-shaped error and outcome text is replaced with a redacted message
- public status and audit events contain only identifiers, timestamps, states,
  counts, latency, and errors marked `redacted: true`

The release assembler rejects `.env`, Council `state.json`/`config.json`, key,
credential, or secret files. It also scans text payloads for bearer tokens,
secret assignments, and API-key-shaped values. Provider credentials and the
optional Hermes service token are neither persisted nor packaged.

Residual boundary: Hermes owns detailed prompts, provider routing rationale,
and provider audit records. Operators must secure Hermes independently and use
only an authenticated private bridge URL.

## Production observability

The session-authorized Occult status response and Council Hall expose:

- reading totals by running/completed/failed/cancelled state
- failed-node count
- average and maximum completed invocation latency
- last successful route/completion timestamp
- last node/reading failure timestamp
- bridge status: `disabled`, `unconfigured`, `unknown`, `healthy`, or `degraded`
- total audit-event count and count of redacted error events

Bridge health is derived from persisted safe events. `degraded` means the newest
failure is later than the newest success; it does not replace infrastructure
health monitoring of the Hermes process or network.

## Clean validation gate

Run from a clean checkout with the locked dependencies:

```text
bun install --frozen-lockfile --linker=isolated
bun test
bun run lint
bun run typecheck
bun run format:check
bun run build
bun run desktop:build:stable
```

CI runs the code gates on Windows, macOS, and Linux. Host-native matrix jobs
compile the CLI, smoke-test `--version`/`--help`, build Electrobun installers
and update bundles, validate the expected artifact set, then generate and
validate Occult manifests and checksums. A host can verify only its own native
Electrobun artifact; the complete platform claim requires the green CI matrix.

## Assembly and checksums

For each platform payload:

```text
bun scripts/generateOccultReleaseManifest.ts --root bundle --version 1.2.3 --package agents-council-windows-x64
```

The command fails on forbidden sensitive files or values and writes:

- `occult-release-manifest.json`: package/version, Occult compatibility, feature
  gate, file size, and SHA-256 per payload artifact
- `SHA256SUMS.txt`: payload and manifest checksums

Verify on Linux/macOS:

```text
sha256sum --check SHA256SUMS.txt
```

Verify one entry on PowerShell:

```powershell
Get-FileHash .\cli\council.exe -Algorithm SHA256
```

Compare the value with `SHA256SUMS.txt`. Release CI attaches platform-labeled
manifests and checksum files to the GitHub release and includes them in each
platform npm package.

## Upgrade

1. Stop new Council/Occult reading creation.
2. Allow active readings to finish or cancel them explicitly.
3. Copy the Council state file and its lock-free backup to protected storage.
4. Record the current package version and preserve its installer/package.
5. Verify the new artifact checksum and that its manifest includes contract
   `1.0.0`.
6. Install the new version with `OCCULT_ENABLED` unset.
7. Run `council --version`, `council --help`, and an MCP startup smoke test.
8. Start Council Hall and verify ordinary sessions.
9. Enable Occult, inspect existing readings, then run one disposable canary
   reading through the private Hermes bridge.

## Backup and restore validation

Use the state procedure in `docs/occult-reading-state.md`. A valid restore must:

- load without schema or relationship errors
- retain Council sessions and Occult reading/event sequence integrity
- expose no prompt, authorization, credential, signed URL query, or provider
  route-explanation material
- allow an approval-paused reading to resume with its original complete plan

Never package a backup inside a release payload.

## Interruption recovery

- An interrupted create/resume request persists a cancelled terminal reading.
- An approval-paused running reading resumes after restart when the same reading
  ID, complete plan, idempotency key, and authorized session participant are
  supplied.
- Inspect with `after_sequence` to continue incremental monitoring.
- If Hermes becomes unavailable, leave the persisted reading intact, restore
  bridge health, and resume only with the original plan.

## Disable and rollback

Emergency disable:

1. Unset `OCCULT_ENABLED` or set it to any value other than exact `true`.
2. Restart Council/MCP/desktop processes.
3. Confirm Occult MCP tools and Council Hall panel are absent.
4. Confirm ordinary session, summon, and MCP behavior remains available.

Application rollback:

1. Stop writes and back up state.
2. Install the previously checksummed artifact.
3. Keep Occult disabled during startup.
4. Verify state schema version 3 loads and ordinary Council smoke tests pass.
5. Re-enable Occult only after inspecting existing readings.

Because this release does not migrate state, rollback does not require a
down-migration.

## Release checklist

- [ ] Release tag matches package and Electrobun versions.
- [ ] Changelog and operator upgrade notes are current.
- [ ] Windows, macOS, and Linux CI matrices are green.
- [ ] Tests, lint, typecheck, format, CLI, and Electrobun gates are green.
- [ ] Root plus five platform npm dry runs contain expected files.
- [ ] Package metadata declares Occult contract `1.0.0`.
- [ ] Manifests and checksums exist for every platform payload.
- [ ] No state/config/key/credential file is present in any payload.
- [ ] Install sanity passes on Windows, macOS, and Linux.
- [ ] Backup/restore and rollback smoke procedures are recorded.
- [ ] Paid providers remain controlled by Hermes policy; Council has no keys.
- [ ] GitHub release contains installers, update payloads, manifests, checksums,
      changelog, and rollback link.
