# Hermes bridge and Tarot spread scheduler

## Status

The Hermes bridge and spread scheduler are core-library capabilities. They are
not wired into the CLI, MCP server, or desktop UI yet, so live Occult execution
remains disabled by default. That public integration is tracked separately.

The implementation provides:

- a versioned Council-to-Hermes HTTP bridge
- strict request and response validation
- dependency-aware sequential and bounded-parallel spread execution
- persisted retries, cancellation, approval gates, and restart/resume
- deterministic reading outcomes for timeouts, outages, partial failures, and
  duplicate requests

## Trust boundary

Agents Council owns the reading graph and durable execution state. It sends a
validated Occult `1.0.0` invocation to Hermes and receives a strict bridge
response containing a summary, artifact references, and a redacted route
summary.

Hermes remains the sole owner of:

- Mythos route selection
- provider clients and endpoints
- provider API keys, OAuth tokens, and credential pools
- provider quota and cost enforcement
- Major Arcana prompt composition
- memory policy and tool authorization

Council contains no provider adapter and never receives provider credentials.
Bridge payload validation recursively rejects secret-shaped fields such as API
keys, authorization headers, passwords, and refresh tokens. The optional bearer
token used to authenticate Council to Hermes is a service credential, is held
only by the HTTP adapter, and is never written to reading state or an event.

## Bridge profile

`HttpHermesOccultBridge` posts to:

```text
POST {HERMES_BASE_URL}/v1/occult/invoke
```

The request is the shared `OccultInvocation` contract. The response is a strict
Occult `1.0.0` bridge profile:

```json
{
  "contract_version": "1.0.0",
  "invocation_id": "occult-...",
  "status": "completed",
  "summary": "Node completed.",
  "route_summary": {
    "contract_version": "1.0.0",
    "invocation_id": "occult-...",
    "selected_card_id": "minor.swords.king.example",
    "provider_id": "provider-redacted",
    "model_id": "model-redacted",
    "fallback_count": 0,
    "explanation": "Selected by Hermes."
  },
  "artifacts": [],
  "error": null
}
```

The invocation ID must match in the response and route summary. Failed
responses must contain a redacted Occult error. Completed responses must
contain a route summary and no error.

## Configuration

Live bridge construction should occur only when the existing Occult feature
gate is explicitly enabled. A future interface adapter should read its own
configuration and instantiate the core object:

```yaml
occult:
  enabled: false
  hermes_bridge:
    base_url: http://127.0.0.1:8642
    service_token_secret: agents-council/hermes-service-token
```

Keep the service token in an approved secret store and inject its value into
`HttpHermesOccultBridge` at runtime. Do not place it in this YAML, Council
state, logs, events, or task metadata.

Each spread also declares:

- `maximumParallelism`: global concurrency bound from 1 through 16
- per-node `maximumAttempts`: 1 through 10
- per-node `timeoutMs`: 1 millisecond through 1 hour
- per-node human approval requirement
- a directed acyclic dependency graph

Invalid graphs, unknown nodes, duplicate nodes, unsupported capabilities, and
contract version mismatches fail before Hermes is invoked.

## Execution and recovery

Each node attempt uses a deterministic invocation ID and idempotency key based
on the reading, node, and attempt. A duplicate scheduler call reuses the
existing reading. Concurrent calls within one scheduler coalesce; calls after a
process restart safely replay the same in-flight attempt for Hermes to
deduplicate.

Execution persists these transitions:

```text
pending -> running -> completed
                   -> failed -> running (retry)
pending -> cancelled
running -> cancelled
```

Approval-required nodes stay pending until an approval record is resolved.
The scheduler returns the still-running reading while it waits. Supplying the
same spread after approval or restart resumes the existing reading.

When one parallel node fails, successful siblings remain completed. Once the
failed node exhausts its attempts, the reading becomes failed and unstarted
nodes become cancelled. Caller cancellation aborts active Hermes requests and
terminalizes the reading as cancelled.

## Observability

Use the existing version 3 Council state as the source of truth:

- `events` provides contiguous node, route, and terminal transitions
- `nodes` provides current state, attempt count, and timestamps
- `routeSummaries` provides Hermes' redacted route choices
- `approvals` provides request and resolution history
- `artifacts` provides references without embedding artifact bodies
- `outcome.error` provides a redacted stable code and retry classification

Expected stable failure codes include:

- `HERMES_TIMEOUT`
- `HERMES_UNAVAILABLE`
- `HERMES_PROTOCOL_ERROR`
- `HERMES_REJECTED`
- `NODE_ATTEMPTS_EXHAUSTED`
- `APPROVAL_REJECTED`
- `SPREAD_DEADLOCK`
- `READING_CANCELLED`

Do not log raw bridge request headers or response bodies.

## Rollback

This slice does not change the version 3 persisted schema.

1. Disable the Occult feature gate so no new bridge execution starts.
2. Let active node calls finish or cancel their readings.
3. Back up `~/.agents-council/state.json`.
4. Deploy the previous Council build.
5. Keep version 3 state in place; the prior reading-state build can still read
   the records.

Rolling back does not undo work already performed by Hermes or external tools.
Review completed artifacts and Hermes audit records separately.
