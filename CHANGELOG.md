# Changelog

All notable changes to Agents Council are documented here.

## Unreleased

## 0.5.6 - 2026-08-02

### Added

- Added the complete signed 22-card Major Arcana example for Tarot Router
  Council readings, with bounded parallelism and resumable approval state.

### Compatibility

- Tarot Router contract `1.0.0`, Council state schema 3, CLI aliases, and
  signed asset names remain unchanged.

## 0.5.5 - 2026-07-31

### Fixed

- Made npm registry metadata probes explicitly unauthenticated so the
  protected OIDC publisher can verify public package integrity without
  inheriting the setup-node placeholder token.
- Added regression coverage for public release-existence, staged-bootstrap,
  and post-publish integrity probes.

### Compatibility

- The partially published Linux x64 package at `0.5.4` remains immutable.
  The complete six-package scoped npm release moves forward as `0.5.5`.
- Tarot Router branding, runtime contract `1.0.0`, Council state schema 3,
  package names, CLI aliases, and signed asset names are unchanged.

## 0.5.4 - 2026-07-31

### Fixed

- Preserved repository LF line endings before Windows release checkouts so the
  release formatter validates the same source bytes as protected CI.
- Increased the deterministic npm packaging test timeout for slower hosted
  Windows release runners without weakening its assertions or cleanup.

### Compatibility

- Tarot Router branding, runtime contract `1.0.0`, Council state schema 3,
  package names, CLI aliases, and signed asset names are unchanged.
- The failed `v0.5.3` tag remains immutable and unpublished; `v0.5.4` is the
  replacement release candidate.

## 0.5.3 - 2026-07-31

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
