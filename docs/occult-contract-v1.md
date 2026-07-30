# Occult contract v1 in Agents Council

Status: implemented and feature-gated; disabled by default.

## Purpose

`src/core/occult/contract.ts` defines the Council-side wire contract shared
with Hermes Occult contract version `1.0.0`. It validates contract payloads
before later reading or bridge code may create state or invoke Hermes.

The contract types and validators are side-effect free. The production runtime
registers bounded CLI, MCP, and Council Hall entry points only when
`OCCULT_ENABLED=true`; it can then persist readings and contact the configured
Hermes bridge. Existing Council behavior is unchanged while the gate is off.

Portable Hermes parity fixtures live in:

```text
src/core/occult/spec/v1/fixtures/
```

## Ownership boundary

| Concern | Owner |
|---|---|
| Provider credentials and authorization headers | Hermes credential broker |
| Provider discovery, health, quota, and route selection | Mythos inside Hermes |
| Major Arcana validation and prompt composition | Hermes Occult runtime |
| Reading graph, node state, collaboration, and resume | Agents Council |
| Memory storage and tool authorization | Existing Hermes owners through scoped adapters |
| Council session and reading presentation | Agents Council interfaces |

Council may receive provider and model identifiers in a redacted route
summary. It must never receive API keys, access or refresh tokens,
authorization headers, passwords, credential objects, or a provider client.
The validator rejects secret-shaped fields recursively and does not echo
payload values in validation errors.

## Compatibility and capability checks

- Every top-level payload requires `contract_version`.
- Version `1.0.0` uses exact matching; a mismatch fails before schema parsing.
- Unknown required capabilities fail before a reading node can start.
- Wire objects are strict. Unknown fields fail instead of granting undeclared
  authority.
- Breaking field, enum, or semantic changes require a new major contract
  version and an explicit migration window.

The feature gate is fail-closed. Public CLI, MCP, and Council Hall entry points
are registered only when `OCCULT_ENABLED=true`; the Hermes bridge and durable
reading service are then composed through those bounded interfaces.

## Idempotency and event semantics

- Every invocation carries a non-empty `idempotency_key`.
- Persistent duplicate detection belongs to the reading-state task.
- Events in a validated stream belong to one reading.
- Event sequence numbers are contiguous and strictly increasing.
- Exactly one terminal event must be last:
  `reading.completed`, `reading.failed`, or `reading.cancelled`.
- Error payloads require `redacted: true`.

## Validation

Run:

```text
bun test src/core/occult/contract.test.ts
bun run typecheck
bun run format:check
```

## Rollback

When enabled, the runtime creates durable reading state and registers the
bounded entry points described above. Rollback is disabling `OCCULT_ENABLED`;
removing the isolated runtime, contract modules, fixtures, tests, and
documentation removes the feature entirely. Future runtime work must retain a
single default-off boundary so the reading
integration can be disabled without changing ordinary Council sessions.
