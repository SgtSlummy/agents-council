# Changelog

All notable changes to Agents Council are documented here.

## 0.5.1 - 2026-07-29

### Fixed

- Windows release builds now invoke Electrobun from PowerShell so its CLI
  archive extractor receives a native drive-letter path instead of a Git Bash
  path that GNU `tar` interprets as a remote host.

## 0.5.0 - 2026-07-29

### Added

- Feature-gated Occult contract `1.0.0` support across MCP, CLI, desktop bridge,
  HTTP fallback, and Council Hall.
- Persisted Tarot readings with deterministic spread scheduling, interruption,
  cancellation, approval, retry, and resume semantics.
- Sanitized operational metrics for reading state, Hermes bridge health,
  failures, invocation latency, and redacted audit events.
- Deterministic `occult-release-manifest.json` and `SHA256SUMS.txt` generation
  for platform CLI and Electrobun release payloads.

### Security

- Council persistence now allowlists Occult event metadata, replaces provider
  route explanations, strips signed artifact URL credentials/query fragments,
  redacts credential-shaped errors, and rejects secret-shaped identifiers.
- Release assembly rejects Council state/configuration, key/credential files,
  and credential-shaped values in text artifacts.

### Compatibility

- Occult remains disabled unless `OCCULT_ENABLED=true`.
- State schema remains version 3; no migration is added by this release.
- Root and platform npm package metadata declares compatible Occult contract
  versions and the feature-gate name.
