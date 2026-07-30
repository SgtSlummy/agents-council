# Occult System Production Plan for Agents Council

Status: proposal
Target branch: `main`
Scope of this change: planning only; no provider access, credentials, runtime
behavior, or deployment is enabled

## 1. Outcome

Agents Council will become the orchestration and deliberation plane for the
Occult System while Hermes remains the execution and provider-routing authority.

The finished system will let a user:

- Start an ordinary council session exactly as today.
- Start an Occult reading from Council Hall or MCP.
- Select a **Deck** and **Spread**, or use a validated default.
- Assign **Major Arcana** agent identities to reading positions.
- Let Hermes/Mythos select compatible **Minor Arcana** model routes, or request
  an explicit eligible route.
- Watch node status, agent contributions, route summaries, approvals,
  retries, artifacts, and synthesis in the Council Hall.
- Disconnect and later resume a reading without repeating completed work.
- Close or cancel a reading and retain a redacted, inspectable chronicle.

Council stores orchestration state and opaque invocation references. It never
stores provider credentials or calls provider APIs directly.

## 2. Finished request path

```text
Council Hall / MCP client
          |
          v
  Agents Council core
  session + reading state
          |
          v
  Versioned Occult bridge
          |
          v
  Hermes Occult runtime
          |
          v
     Mythos router
          |
          v
  Authorized provider/model
          |
          v
  Redacted result + reading events
          |
          v
  Council chronicle and synthesis
```

Concept ownership:

```text
Major Arcana = who is acting
Minor Arcana = which eligible intelligence route powers the invocation
Deck         = reusable agent/route/tool/memory policy
Spread       = workflow definition
Reading      = one persisted execution of a spread
Council      = orchestration, collaboration, and human participation
Hermes       = prompt, memory, tools, policy, and invocation execution
Mythos       = route selection and fallback
```

## 3. Boundaries and non-goals

### Council owns

- Session and reading lifecycle.
- Spread graph state and dependency progression.
- Participant/agent role assignments.
- Human approvals and cancellation.
- Redacted contributions, conclusions, and artifact references.
- Bridge request idempotency and event ordering.
- Council Hall and MCP presentation of reading progress.

### Hermes owns

- Major Arcana package validation and effective prompt composition.
- Minor Arcana registry, provider/model compatibility, and route scoring.
- Provider credentials and credential references.
- Memory retrieval, privacy filtering, and tool enforcement.
- Provider calls, retries, circuit breakers, quota reservation, and cost policy.
- Invocation audit details and artifact production.

### Council must never own or persist

- API keys, refresh tokens, cookies, authorization headers, or provider secrets.
- Direct provider SDK clients.
- Secret-bearing request/response headers.
- Raw credential-pool topology.
- Sensitive memory or full prompts unless Hermes explicitly classifies them as
  permitted Council output.

### Not part of this project

- Automated provider account creation.
- CAPTCHA, phone, email, or identity verification bypass.
- Disposable-account or promotional-credit farming.
- Scraped, leaked, shared, or reverse-engineered credentials.
- Quota evasion through account/key multiplication.
- Silent paid-model use.
- Replacing the existing Council core with a second workflow engine.

## 4. Fit with the current codebase

This plan extends the existing architecture:

- Bun + TypeScript remains the implementation stack.
- Business logic remains in `src/core`.
- MCP and desktop bridge layers remain adapters over core behavior.
- Session-targeted v2 semantics remain the persistence foundation.
- Electrobun remains the desktop packaging target.
- The single user-facing npm package and platform optional packages remain the
  distribution model.
- The TypeScript MCP SDK stays on the repository's supported v1.x line.
- Existing `start_council`, `join_council`,
  `get_current_session_data`, `send_response`, `close_council`, and
  `summon_agent` behavior remains available.
- New Occult behavior is feature-gated and additive until its contract is
  production-ready.

Simplicity constraints:

1. A reading is a specialized council session, not a separate duplicate state
   store.
2. Existing session, watcher, locking, and event helpers are reused or
   generalized.
3. The bridge is one small boundary client, not provider-specific adapters in
   Council.
4. New MCP operations are added only when the current operations cannot express
   the behavior cleanly.
5. No exported abstraction is added without an immediate caller.

Production Occult work starts only after the current Electrobun/multi-session
release gate is complete, including the canonical Council Hall integration
required by `DEVELOPMENT.md`.

## 5. Shared contract

Agents Council and Hermes must pin the same Occult contract version and validate
the same fixtures.

Required schemas:

- `OccultInvocationRequest`
- `OccultInvocationResult`
- `MajorArcanaReference`
- `MinorArcanaReference`
- `DeckReference`
- `SpreadManifest`
- `ReadingState`
- `ReadingEvent`
- `RouteDecisionSummary`
- `OccultError`

Required contract behavior:

- Every bridge request has an idempotency key.
- Every invocation has a correlation ID and reading/node IDs.
- Events are monotonic within one invocation and end with exactly one terminal
  state.
- Unknown optional fields are ignored.
- Unknown required capabilities fail before execution.
- Breaking changes require a new contract version and a coordinated release.
- Errors are normalized and redacted.
- Credential and authorization data has no field in the Council-facing schema.

Minimal persisted reading metadata:

```json
{
  "reading_id": "uuid",
  "session_id": "uuid",
  "contract_version": "1",
  "deck_id": "occult.deck.development",
  "spread_id": "occult.spread.build-review",
  "status": "running",
  "nodes": [
    {
      "node_id": "architecture",
      "major_arcana": "occult.major.emperor",
      "orientation": "upright",
      "invocation_id": "opaque-id",
      "minor_arcana": "minor.swords.king.provider.model",
      "status": "complete",
      "artifact_refs": []
    }
  ]
}
```

The stored Minor Arcana ID is route metadata, not a credential reference.

## 6. Start-to-finish execution plan

### Phase 0 — Compatibility, sequencing, and contract ADR

Deliverables:

- Confirm the current Electrobun, multi-session, MCP, state, and release
  baselines on `main`.
- Record the Hermes/Council ownership boundary.
- Define the shared schemas, fixtures, error taxonomy, event ordering, and
  idempotency rules.
- Decide whether Occult parameters extend existing tools or require a minimal
  new tool surface.
- Define feature flags, migration strategy, and rollback behavior.
- Define privacy classes and the exact redacted fields Council may persist.

Exit gate:

- Both repositories validate the same fixtures.
- Existing Council CLI, MCP, desktop, sessions, and summon behavior is unchanged
  with Occult disabled.
- A contract review confirms that Council cannot receive provider secrets.

### Phase 1 — Core reading domain and persistence

Deliverables:

- Represent a reading as session-linked core domain state.
- Add deck, spread, node, dependency, approval, invocation, artifact, and route
  summary fields.
- Define states for queued, running, awaiting approval, complete, failed,
  canceled, and blocked.
- Add migration and corruption-recovery behavior for existing state.
- Preserve atomic writes, lock behavior, explicit session targeting, and
  multi-session isolation.

Validation:

- Existing state files load without Occult data.
- Two readings in separate sessions cannot leak messages or node state.
- Replaying the same idempotency key does not duplicate a reading or node.
- Unknown enum/schema values fail with an actionable error.
- A failed migration leaves the prior state recoverable.

Exit gate:

- Core tests create, advance, pause, cancel, close, reload, and recover a reading
  without using MCP, desktop, or a real Hermes service.

### Phase 2 — Hermes bridge

Deliverables:

- Add one typed bridge client for the versioned Hermes Occult API.
- Support health/capability negotiation before a reading starts.
- Submit idempotent node invocations and consume ordered events.
- Support timeout, retryable failure, terminal failure, cancellation, and
  reconnect/resume.
- Persist only opaque invocation/artifact references and redacted summaries.
- Add feature flags and endpoint/token configuration without storing provider
  credentials.

Validation:

- A contract mismatch fails before a node is started.
- Bridge retries do not duplicate completed invocations.
- Secret-like response fields are rejected or redacted before persistence.
- Network loss moves nodes to a recoverable state.
- Cancellation is propagated and does not start downstream nodes.

Exit gate:

- Council completes a one-node reading against a deterministic mock Hermes
  service and resumes it after a simulated restart.

### Phase 3 — Spread scheduler and council collaboration

Deliverables:

- Validate spread graphs and reject cycles unless an explicitly bounded loop is
  part of the contract.
- Run sequential and bounded-parallel nodes.
- Support agent, evaluator, synthesizer, condition, approval, retry, and
  artifact-reference nodes.
- Map node contributions into the existing Council voice stream with clear
  reading/node metadata.
- Enforce maximum concurrency, retry count, timeout, and reading lifetime.
- Allow human participants to add guidance without mutating completed node
  history.

Validation:

- Dependency ordering is deterministic.
- Parallel branches cannot exceed configured concurrency.
- Evaluator rules can require a different model/provider family from the author.
- Approval nodes pause without polling loops or accidental progression.
- Restart resumes from durable node boundaries.
- Closed/canceled readings reject new mutations.

Exit gate:

- A local three-node build/review/synthesis spread completes, pauses for one
  approval, resumes, and closes with a conclusion.

### Phase 4 — MCP and CLI surface

Deliverables:

- Expose the smallest tool/command changes needed to create, inspect, resume,
  cancel, and close readings.
- Keep explicit `session_id` targeting for all existing-session operations.
- Return concise Markdown and stable JSON representations.
- Add cursor-based incremental reading events.
- Add plain-language capability, contract, authorization, and recovery errors.
- Document migration and client configuration.

Validation:

- Current six MCP tools retain their non-Occult behavior.
- MCP inputs and outputs match shared schemas.
- Missing/invalid session, reading, deck, spread, and contract versions produce
  distinct errors.
- Cursor polling returns no duplicates and no missed terminal event.
- MCP Inspector covers ordinary Council and Occult reading flows.

Exit gate:

- Claude, Codex, or another MCP client can start and monitor a mock/local reading
  without using the desktop UI.

### Phase 5 — Council Hall experience

Deliverables:

- Add reading creation to the canonical Council Hall flow.
- Add deck/spread selection and Major Arcana assignment.
- Show orientation, requested route constraints, selected Minor Arcana summary,
  node status, approvals, retries, artifacts, and conclusion.
- Add resume, cancel, and close actions wired to real core operations.
- Preserve ordinary sessions and summon behavior.
- Persist non-secret user selections in the existing settings boundary.

Validation:

- No control is a placeholder.
- Secrets and raw credential references cannot render in the UI.
- Keyboard navigation, focus order, labels, contrast, reduced motion, empty
  states, and narrow layouts are verified.
- Reloading the desktop app restores the active reading.
- Bridge failure does not corrupt the Council session or prevent manual use.

Exit gate:

- A user can create, observe, approve, resume, cancel, and inspect a mock/local
  reading entirely through Council Hall.

### Phase 6 — Integration, security, and reliability

Deliverables:

- Add shared fixture tests pinned to the Hermes contract version.
- Add restart, cancellation, duplicate-delivery, out-of-order-event, timeout,
  and malformed-payload tests.
- Add secret-pattern and sensitive-field persistence tests.
- Add load tests for multiple sessions/readings and bounded parallel nodes.
- Add metrics and redacted logs for reading/node/bridge lifecycle.
- Add backup, restore, migration, and rollback tests for Council state/config.

Exit gate:

- No critical security finding remains.
- Provider outage or bridge loss does not crash Council.
- Existing ordinary Council E2E tests still pass.
- A clean restore resumes unfinished readings or marks them recoverable without
  duplication.

### Phase 7 — Build, compile, and assemble

Expected host build:

```bash
bun install
bun run typecheck
bun run format:check
bun run lint
bun test
bun run build
bun run desktop:build:stable
```

CI must use the repository's locked Bun/dependency versions and current release
workflow. The release build:

1. Validates shared contract fixtures.
2. Runs unit, integration, MCP, desktop bridge, and UI tests.
3. Compiles the `council` binary for supported targets.
4. Builds stable Electrobun artifacts on each host platform.
5. Assembles root and platform optional npm packages.
6. Runs install-sanity for `--version`, `--help`, `mcp`, ordinary session, and
   mock/local Occult reading startup.
7. Generates checksums, SBOM, provenance, and a compatibility manifest.

The assembled package must not contain credentials, live tokens, user state, or
private reading content.

Exit gate:

- macOS, Windows, and Linux artifacts build from pinned inputs.
- The single root npm package resolves the correct platform package.
- The installed binary can launch desktop mode and MCP mode.

### Phase 8 — Staging and production

Staging requirements:

- Separate state, Hermes token, and endpoint.
- Production artifacts and configuration.
- Mock/local routes first; limited authorized external routes only after
  contract/security gates.
- Full metrics, logs, backup, restore, and rollback rehearsal.

Production rollout:

1. Merge inert schemas and feature flags.
2. Release contract-compatible preview builds of Hermes and Council.
3. Enable mock/local readings for selected users.
4. Enable authorized free external routing in staging.
5. Run cross-repository canary readings.
6. Promote the same immutable artifacts to stable.
7. Keep Occult opt-in until operational acceptance is recorded.

Rollback:

1. Stop new readings.
2. Cancel or drain active nodes.
3. Disable the Occult feature flag.
4. Preserve a redacted diagnostic bundle.
5. Restore the previous binary/desktop artifacts.
6. Restore state only when migration rollback is declared safe.
7. Run ordinary Council and local/mock bridge smoke tests.

## 7. Release assembly

Agents Council retains its current distribution model:

```text
agents-council
├── council CLI launcher
├── README and license
└── optional platform package
    ├── council / council.exe
    └── desktop-artifacts/
```

Occult adds:

- Shared JSON Schemas and fixtures.
- A compiled-in supported contract version.
- Non-secret configuration examples.
- Migration metadata.
- Reading/bridge operations documentation.
- Compatibility, checksum, SBOM, and provenance metadata.

The release manifest records:

- Agents Council version and commit.
- Hermes compatibility range.
- Occult contract version.
- State schema and migration version.
- Electrobun/Bun build versions.
- Platform package versions and artifact hashes.

## 8. Test matrix

| Area | Required evidence |
|---|---|
| Core | Reading states, graph validation, dependencies, idempotency, isolation |
| Persistence | Atomic writes, locks, migrations, corruption recovery, restart |
| Contract | Shared Hermes fixtures and version negotiation |
| Bridge | Timeout, retry, resume, cancellation, redaction, event order |
| MCP | Ordinary sessions plus reading create/status/cursor/cancel/close |
| Desktop | Real wired controls, accessibility, reload/recovery |
| Security | Secret rejection, injection-safe rendering, auth scope, log redaction |
| Reliability | Outage, duplicate event, queue pressure, parallel limits |
| Packaging | CLI, desktop, npm optional packages, install-sanity |
| Recovery | Backup, restore, state migration rollback, artifact rollback |

## 9. Updates after production

### Continuous

- Reading/node/bridge health, latency, retry, cancellation, and error metrics.
- Contract mismatch and secret-redaction alerts.
- Crash-safe state and lock monitoring.

### Weekly

- Cross-repository contract tests against the supported Hermes versions.
- Dependency and security-advisory review.
- Backup integrity and sampled restore.
- Review failed or manually corrected readings.

### Monthly

- Signed stable or preview release from immutable artifacts.
- Compatibility-range review.
- Accessibility and supported-platform smoke pass.
- Deprecation review for old contract/state versions.

### Emergency

- Disable the bridge or Occult feature flag without disabling ordinary Council.
- Quarantine malformed events or incompatible Hermes versions.
- Publish a signed hotfix and security advisory when appropriate.
- Preserve redacted diagnostic evidence and rehearse rollback.

## 10. Implementation workstreams

The implementation should be delivered as focused, reviewable issues/PRs:

1. **Council Occult contract, sequencing, and feature-gated architecture**
   - Owns Phase 0 and the inert compatibility baseline.
2. **Reading domain, state migration, and idempotent persistence**
   - Owns Phase 1.
3. **Hermes bridge, spread scheduling, restart, and cancellation**
   - Owns Phases 2–3.
4. **MCP/CLI and Council Hall reading experience**
   - Owns Phases 4–5.
5. **Cross-repository hardening, compilation, packaging, and rollout**
   - Owns Phases 6–8.

Each issue includes its own tests and user/developer documentation. Tests and
documentation are not deferred to cleanup-only follow-ups.

This repository uses Backlog.md for implementation task execution. The GitHub
issues created for this initiative are external work orders and review entry
points; before implementation begins, the assigned worker must use the
repository's Backlog MCP workflow to search for and create or link the matching
Backlog task, then record the current implementation plan after taking that task
into progress.

## 11. Definition of production ready

The Agents Council portion is production ready only when:

1. Existing ordinary Council behavior is unchanged with Occult disabled.
2. The shared contract and fixtures pass in both repositories.
3. Council persists no provider credential or secret-bearing field.
4. Readings are session-targeted, isolated, idempotent, and resumable.
5. Sequential, bounded-parallel, approval, evaluator, synthesis, retry, and
   cancellation behavior is tested.
6. Contract mismatch fails before starting a provider invocation.
7. The bridge recovers from disconnects without duplicate completed nodes.
8. MCP Markdown/JSON and cursor behavior are stable and documented.
9. Council Hall controls are real, accessible, and recover after reload.
10. Existing CLI, MCP, summon, multi-session, and desktop tests still pass.
11. Bun/TypeScript, compiled CLI, Electrobun, npm root, and platform packages
    build from pinned inputs.
12. Supported-platform install-sanity passes.
13. Backup, restore, migration rollback, and application rollback are
    demonstrated.
14. Release artifacts include checksums, SBOM, provenance, and compatibility
    metadata.
15. Staging passes security, reliability, load, restart, and cross-repository
    end-to-end gates.
16. Production remains opt-in and can be disabled without disabling ordinary
    Council.

The foundational rule is:

> Major Arcana owns identity. Minor Arcana supplies intelligence. Mythos chooses
> the route. Hermes enforces execution. Agents Council coordinates the reading.
