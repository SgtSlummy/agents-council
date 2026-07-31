# Changelog

All notable changes to Agents Council are documented here.

## Unreleased

### Added

- Added `council tarot` as the public command for Tarot Router readings.
- Added fork-owned scoped npm assembly for one root launcher and five native
  platform packages sourced only from a verified signed GitHub release.
- Added tokenless trusted-publishing gates, platform-first ordering, dry-run
  packaging, native tarball canaries, and public registry canaries.
- Added inert namespace-bootstrap packages so the first human-authorized npm
  action can establish package ownership without publishing executable code.

### Changed

- Renamed the user-facing Occult System product to **Tarot Router** across the
  CLI, Council Hall, README, and operator documentation.

### Compatibility

- `council occult`, contract `1.0.0`, state schema 3, `OCCULT_*` environment
  variables, MCP tool names, persisted fields, and release assets are unchanged.

### Security

- Marked the repository source package private and removed upstream unscoped
  optional dependencies to prevent accidental fork publication or namespace
  confusion.
- npm writes require the `npm-production` environment, OIDC, and an exact typed
  confirmation. The workflow contains no npm token path.

## 0.5.2 - 2026-07-30

### Added

- Signed the complete GitHub release checksum manifest with Sigstore and
  published the verification bundle beside the platform archives.
- Added a GitHub-release-first installation path for the Occult-enabled fork.

### Security

- Stable release assets are verified against the exact tag workflow identity
  before publication.
- Releases are published without advancing GitHub's `latest` marker until the
  protected Occult launch canary passes.

### Compatibility

- Occult contract `1.0.0`, state schema 3, and the `OCCULT_ENABLED` fail-closed
  gate are unchanged.
- npm publication remains out of scope; v0.5.2 is consumed as an immutable
  GitHub release by Hermes Agent v1.0.1.

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
