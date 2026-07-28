# Development

## Prerequisites

- Bun (latest recommended)
- Node.js (for npm publish and install-sanity parity checks)

## Install

```bash
bun install
```

## Local runtime

Start CLI directly from source:

```bash
bun run cli mcp
```

Build a host CLI binary:

```bash
bun run build
```

This writes `dist/council` (or `dist/council.exe` on Windows if compiled there).

Desktop development runtime:

```bash
bun run desktop:dev
```

Build stable desktop artifacts (installer + update payloads) for the current host platform:

```bash
bun run desktop:build:stable
```

The command above creates a local `artifacts/` folder with files prefixed `stable-<platform>-<arch>-...`.

## Quality checks

```bash
bun test
bun run lint
bun run format:check
bun run typecheck
bun run build
```

## Packaging model

- Root package: `agents-council` (single user-facing package).
- Optional platform packages:
  - `agents-council-linux-x64`
  - `agents-council-linux-arm64`
  - `agents-council-darwin-x64`
  - `agents-council-darwin-arm64`
  - `agents-council-windows-x64`
- Runtime resolution:
  - `scripts/cli.cjs` resolves the local platform package via `scripts/resolveBinary.cjs`.
  - The resolved `council` binary handles CLI entrypoints (`--help`, `--version`, `mcp`) and desktop-default launch.

Each platform package includes:
- `council` (or `council.exe`) for terminal CLI usage.
- `desktop-artifacts/*` (Electrobun installer/update artifacts for that platform release).
- `occult-release-manifest.json` and `SHA256SUMS.txt`.

Root and platform package metadata declares Occult contract `1.0.0`
compatibility and the `OCCULT_ENABLED` feature gate.

Generate and security-check a collected payload:

```bash
bun scripts/generateOccultReleaseManifest.ts \
  --root bundle \
  --version 1.2.3 \
  --package agents-council-linux-x64
```

## CI and release expectations

- `.github/workflows/ci.yml` validates Electrobun stable artifact generation on macOS, Windows, and Linux.
- `.github/workflows/release.yml`:
  - builds host-native desktop artifacts and CLI binaries for all supported platform packages,
  - publishes the root npm package and platform optional packages,
  - runs install-sanity on macOS/Windows/Linux for `--version`, `--help`, and `mcp`,
  - uploads desktop-launchable installer/artifact files to GitHub Releases.
  - attaches platform-labeled Occult manifests and SHA-256 checksum files.

See `docs/occult-production-release.md` for the clean release gate, security
review, upgrade, backup/restore, interruption recovery, and rollback checklist.

Release sequencing gate:
- Do not cut a public release tag until TASK-26.6 (canonical desktop UI integration) is merged and validated.

## Notes

- State path defaults to `~/.agents-council/state.json` and can be overridden with `AGENTS_COUNCIL_STATE_PATH`.
- Husky hooks are installed during `bun install`.
