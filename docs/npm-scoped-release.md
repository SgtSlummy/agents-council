# Fork-owned scoped npm release

The signed GitHub release remains the canonical Agents Council distribution.
The optional npm channel mirrors that exact binary payload under fork-owned
package names and never publishes the upstream unscoped names.

## Package contract

User-facing package:

```text
@sgtslummy/agents-council
```

Exact-version optional dependencies:

```text
@sgtslummy/agents-council-linux-x64
@sgtslummy/agents-council-linux-arm64
@sgtslummy/agents-council-darwin-x64
@sgtslummy/agents-council-darwin-arm64
@sgtslummy/agents-council-windows-x64
```

The root launcher derives the scope from its own package name. Platform
packages contain the standalone CLI, the Occult release manifest, and its
checksums. Electrobun desktop installers remain signed GitHub release assets;
they are intentionally excluded from npm packages to stay below registry
request-size limits. Occult remains disabled unless `OCCULT_ENABLED=true`.

The repository source package is marked `private`. Only
`scripts/prepareScopedNpmPackages.mjs` may create publishable manifests.

## Routine release path

`.github/workflows/npm-release.yml` is manual and has four modes:

- `verify-only`: verifies the signed GitHub release, assembles all six
  packages, runs `npm publish --dry-run`, and runs native tarball canaries.
- `canary`: repeats verification and tests the exact packages already public
  on npm without writing to the registry.
- `stage`: stages all platform packages first and the root last. A maintainer
  must review and approve every staged package with 2FA.
- `publish`: directly publishes platform packages first and the root last,
  verifying registry integrity after every package.

Both write modes require the protected `npm-production` GitHub environment,
OIDC `id-token: write`, an exact typed confirmation, and npm trusted-publisher
configuration. No npm token is read by the workflow.

Run the non-writing gate:

```bash
gh workflow run npm-release.yml \
  --repo SgtSlummy/agents-council \
  -f release_tag=v0.5.2 \
  -f mode=verify-only
```

The workflow rejects draft or prerelease sources, a source/tag version
mismatch, an invalid Sigstore workflow identity, checksum changes, archive
links or traversal, manifest drift, unsafe package files, a missing platform,
and root-before-platform publication.

## One-time namespace bootstrap

npm requires a package to exist before staged publishing or a trusted
publisher can be configured. This is the only unavoidable account-authorized
step.

1. Confirm the operator owns or administers the `@sgtslummy` npm scope, has 2FA
   enabled, and is locally authenticated:

   ```bash
   npm whoami
   ```

2. Recheck that all six scoped package names are unclaimed.

3. Generate inert namespace-only packages:

   ```bash
   node scripts/prepareNpmBootstrapPackages.mjs \
     --output .tmp/npm-bootstrap
   ```

4. Inspect every generated `package.json`. Publish each directory with the
   non-default `bootstrap` tag and `--access public`, authenticating with 2FA:

   ```bash
   npm publish .tmp/npm-bootstrap/agents-council-linux-x64 --tag bootstrap --access public
   npm publish .tmp/npm-bootstrap/agents-council-linux-arm64 --tag bootstrap --access public
   npm publish .tmp/npm-bootstrap/agents-council-darwin-x64 --tag bootstrap --access public
   npm publish .tmp/npm-bootstrap/agents-council-darwin-arm64 --tag bootstrap --access public
   npm publish .tmp/npm-bootstrap/agents-council-windows-x64 --tag bootstrap --access public
   npm publish .tmp/npm-bootstrap/agents-council --tag bootstrap --access public
   ```

   These packages contain no executable, dependency, or default `latest` tag.
   They exist only to establish ownership before OIDC is enabled.

5. On each npm package, configure the same trusted publisher:

   ```text
   Provider: GitHub Actions
   Organization or user: SgtSlummy
   Repository: agents-council
   Workflow filename: npm-release.yml
   Environment: npm-production
   Allowed action: npm stage publish
   ```

6. In GitHub, protect the `npm-production` environment with a required
   reviewer and restrict deployment to `main`. Then disallow traditional npm
   publish tokens for each package.

Do not place an npm credential in the repository, an issue, a workflow input,
or an uploaded canary report.

## First signed npm release

After the six trusted-publisher records exist, stage the signed release:

```bash
gh workflow run npm-release.yml \
  --repo SgtSlummy/agents-council \
  -f release_tag=v0.5.2 \
  -f mode=stage \
  -f 'confirm=stage:@sgtslummy/agents-council@0.5.2'
```

Approve the five platform packages with 2FA, verify their public integrity,
then approve the root package. Run the read-only public canary:

```bash
gh workflow run npm-release.yml \
  --repo SgtSlummy/agents-council \
  -f release_tag=v0.5.2 \
  -f mode=canary
```

Only after that canary passes should documentation advertise:

```bash
npm install --global @sgtslummy/agents-council@0.5.2
```

## Failure and recovery

- If preparation or a tarball canary fails, publish nothing and fix the source.
- If a platform publish fails, rerun direct publication only after comparing
  its public `dist.integrity` with `npm-pack-manifest.json`.
- Never publish the root until all five exact platform versions are public.
- A published npm version is immutable. Fixes use a new patch version.
- If the root is unsafe, remove its `latest` dist-tag or deprecate the version;
  do not overwrite or silently replace it.
- GitHub release installation remains available throughout npm incidents.

Release evidence is the workflow run, the two generated manifests, SHA-256
files, public npm provenance, and the five native registry canaries. Evidence
must not include prompts, credentials, tokens, or signed download URLs.
