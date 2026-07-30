# Occult Reading Interfaces

## Status and trust boundary

Occult reading execution is additive, versioned at contract `1.0.0`, and disabled
unless `OCCULT_ENABLED=true` is set. Existing Council CLI, MCP, and Council Hall
behavior is unchanged while disabled.

The interface layer exposes sanitized reading state only:

- Major Arcana agent identifiers
- selected Minor Arcana card, provider, and model identifiers
- node, reading, and approval states
- redacted error codes and messages
- monotonic event sequence numbers

It never returns node prompts, Hermes request bodies, route explanations,
credentials, service tokens, or authorization headers.

## Configuration

```text
OCCULT_ENABLED=true
OCCULT_HERMES_URL=http://127.0.0.1:8642
OCCULT_HERMES_SERVICE_TOKEN=<optional service token>
```

`OCCULT_HERMES_URL` is required only for create/resume. Inspect and cancel use
persisted Council state. The service token is sent only to the configured Hermes
bridge and is never persisted in a reading or returned through an interface.

## Spread plan file

Create and resume require the complete plan because node messages are
intentionally not persisted.

```json
{
  "session_id": "council-session-id",
  "spread_id": "occult.spread.production",
  "spread_version": "1.0.0",
  "idempotency_key": "project-alpha:production-1",
  "maximum_parallelism": 1,
  "nodes": [
    {
      "node_id": "build",
      "agent_id": "occult.major.magician",
      "message": "Build the approved production slice."
    }
  ],
  "dependencies": []
}
```

Unknown fields are rejected. The plan `session_id` must match the explicitly
targeted Council session.

## CLI

The named caller must already be a participant in the targeted active session.

```text
council occult create --session-id <session> --agent-name <participant> --plan spread.json
council occult inspect --session-id <session> --agent-name <participant> --reading-id <reading>
council occult inspect --session-id <session> --agent-name <participant> --reading-id <reading> --after-sequence 12 --json
council occult cancel --session-id <session> --agent-name <participant> --reading-id <reading>
council occult resume --session-id <session> --agent-name <participant> --reading-id <reading> --plan spread.json
```

Ctrl+C or process termination propagates cancellation to an active create or
resume call. Resume must use the same full plan and idempotency key; a mismatch
is rejected instead of creating or attaching to a different reading.

## MCP tools

The MCP server registers these tools only when Occult is enabled:

- `occult_create_reading_v1`
- `occult_get_reading_v1`
- `occult_cancel_reading_v1`
- `occult_resume_reading_v1`

Every payload includes `contract_version: "1.0.0"`. Start MCP with an
`--agent-name` that is already joined to the targeted Council session. Create
and resume accept MCP cancellation signals. Inspect accepts `after_sequence`
for incremental progress without replaying older events.

## Council Hall

Council Hall requests the sanitized Occult status for the selected session. An
Occult panel appears only when the feature is enabled and shows:

- spread and reading state
- Major/Minor Arcana pairing per node
- provider/model selection
- attempts, pending approvals, and redacted errors

The existing state watcher refreshes the panel as reading state changes.

The status surface also derives safe operational data from persisted events:
reading totals, failed-node count, average/maximum invocation latency, last
bridge success/failure, bridge health classification, and redacted audit-event
counts. It does not expose prompts or detailed provider routing explanations.

## Authorization and errors

Authorization is session-scoped across CLI, MCP, desktop bridge, and HTTP UI
fallback. A caller must be an exact participant in the explicitly targeted
session. Closed sessions cannot create or resume readings.

Expected error classes include disabled configuration, incompatible contract
version, missing/closed session, unauthorized caller, and reading/session
mismatch. Errors are redacted before storage and display.

## Migration, disable, and rollback

No new state migration is introduced: readings use state schema v3.

To disable the interfaces, remove `OCCULT_ENABLED` or set it to any value other
than the exact string `true`, then restart Council processes. Occult MCP tools
and the Council Hall panel disappear; ordinary Council operations remain
available. Existing readings stay preserved for later inspection after
re-enabling.

For code rollback, stop active reading creation, back up the Council state file,
deploy the previous build, and leave Occult disabled. State schema v3 remains
readable by the prior Occult persistence/scheduler slice; follow
`docs/occult-reading-state.md` for backup and restore checks.

## Verification

Run:

```text
bun test
bun run typecheck
bun run lint
bun run build
bun run format:check
```

The interface tests cover disabled gates, incompatible versions, unauthorized
session access, sanitized output, cursor inspection, interruption, cancellation,
and approval-based resume.

Production assembly, checksum, upgrade, security review, and rollback gates are
documented in `docs/occult-production-release.md`.
