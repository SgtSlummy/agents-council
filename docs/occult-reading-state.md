# Occult reading state

Status: persistent domain foundation; no public CLI, MCP, or Council Hall
reading controls yet.

## Storage

Occult readings are stored in the existing Council state file:

```text
~/.agents-council/state.json
```

`AGENTS_COUNCIL_STATE_PATH` continues to override that location. State schema
version 3 adds the `occultReadings` collection while preserving the existing
sessions, requests, feedback, participants, and active-session fields.

Each reading is nested under one Council session and records:

- contract, spread, and spread-version identifiers
- a session-scoped idempotency key and semantic fingerprint
- reading and node states
- a contiguous event sequence and next sequence number
- redacted route summaries containing identifiers, never credentials
- approval records
- artifact metadata linked to reading-local nodes
- one terminal outcome for completed, failed, or cancelled readings

Hermes remains the owner of provider clients, API keys, access and refresh
tokens, authorization headers, direct provider responses, memory policy, and
tool authorization. Those values do not belong in Council state.

## Migration

The file store performs migration while holding the existing state lock:

1. Version 1 single-session data is normalized into multi-session records.
2. Version 2 multi-session data is preserved as-is.
3. Both become version 3 with `occultReadings: []`.
4. No migration creates or resumes a reading.
5. The canonical version is written only on the next successful save or
   update.

Unsupported explicit versions and malformed state fail closed. The original
file is not overwritten when parsing or integrity validation fails.

## Idempotency and resume

Reading creation is atomic. An idempotency key is scoped to its Council
session:

- the same key and semantic spread input returns the existing reading
- the same key with different spread or node input fails
- another Council session may use the same key

The service assigns event sequence numbers while holding the state lock.
Reloading the file reconstructs the reading with its next sequence, node
state, events, approvals, route summaries, artifacts, and outcome. A terminal
reading rejects further events.

## Integrity boundaries

Persistence rejects:

- duplicate reading IDs or session-scoped idempotency keys
- readings that reference an unknown Council session
- duplicate node, event, approval, or artifact IDs
- approvals or artifacts that reference a node outside their reading
- mixed reading IDs or gaps in an event sequence
- events after a terminal event
- running readings with terminal outcomes
- terminal readings whose final event and outcome disagree
- unredacted or secret-shaped event fields

Ordinary Council participants, requests, and feedback remain scoped by their
existing `sessionId`. Reading artifacts are nested inside the reading and
must reference a node from that same reading.

## Backup and restore

Back up the state file only after Council processes have stopped or while no
writes are in flight. Preserve file permissions.

To restore:

1. Stop Council processes.
2. Keep a copy of the current state file.
3. Restore the selected `state.json`.
4. Start Council and run a read-only session/reading inspection.
5. If validation fails, stop Council and restore the previous copy.

The lock file (`state.json.lock`) is temporary coordination state and should
not be backed up or restored.

## Rollback

Version 2 binaries do not understand version 3 state. Before rolling back:

1. Stop all Council writers.
2. Back up the version 3 file.
3. Confirm `occultReadings` is empty or export the reading records for later
   recovery.
4. Remove `occultReadings` and set `version` to `2` in an offline copy.
5. Validate the remaining sessions, requests, feedback, and participants.
6. Replace the live file and start the previous binary.

Rolling back with active or historical readings discards reading state from
the version 2 view. Provider credentials are unaffected because Council never
stores them.
