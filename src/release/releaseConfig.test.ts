import { describe, expect, test } from "bun:test";

describe("Occult release configuration", () => {
  test("declares contract compatibility in npm and Electrobun metadata", async () => {
    const packageJson = await Bun.file("package.json").json();
    const electrobunConfig = await Bun.file("electrobun.config.ts").text();

    expect(packageJson.occult).toEqual({
      contractVersions: ["1.0.0"],
      featureGate: "OCCULT_ENABLED",
    });
    expect(electrobunConfig).toContain('occultContractVersions: ["1.0.0"]');
    expect(electrobunConfig).toContain('occultFeatureGate: "OCCULT_ENABLED"');
    expect(electrobunConfig).toContain(`?? "${packageJson.version}"`);
  });

  test("keeps cross-platform release assembly gated by manifests and checksums", async () => {
    const ci = await Bun.file(".github/workflows/ci.yml").text();
    const release = await Bun.file(".github/workflows/release.yml").text();

    for (const platform of ["ubuntu-latest", "macos-latest", "windows-latest"]) {
      expect(ci).toContain(platform);
    }
    for (const runner of ["ubuntu-latest", "ubuntu-24.04-arm", "macos-15-intel", "macos-14", "windows-latest"]) {
      expect(release).toContain(runner);
    }
    expect(release).not.toContain("macos-13");
    expect(ci).toContain("generateOccultReleaseManifest.ts");
    expect(release).toContain("occult-release-manifest.json");
    expect(release).toContain("SHA256SUMS.txt");
    expect(release).toContain(`compgen -G "artifacts/\${PREFIX}*"`);
    expect(release).toContain('chmod +x "$bundle/cli/council"');
    expect(release).toContain("! -name RELEASE-SHA256SUMS.txt");
    expect(release).toContain("xargs -0 sha256sum > RELEASE-SHA256SUMS.txt");
    expect(release).toContain("id-token: write");
    expect(release).toContain("sigstore/gh-action-sigstore-python@790bc6befb9d733738f18d8f895854b453640ec9");
    expect(release).toContain("inputs: publish/RELEASE-SHA256SUMS.txt");
    expect(release).toContain(
      `https://github.com/SgtSlummy/agents-council/.github/workflows/release.yml@\${{ github.ref }}`,
    );
    expect(release).toContain("verify-oidc-issuer: https://token.actions.githubusercontent.com");
    expect(release).toContain("--latest=false");
    expect(release).toContain("--notes-file publish/RELEASE-NOTES.md");
    expect(release).toContain("Build stable desktop artifacts (Windows)");
    expect(release).toContain("shell: pwsh");
    expect(release).toContain("$env:AGENTS_COUNCIL_VERSION = $tag");
  });

  test("documents only the GitHub-first Occult distribution path", async () => {
    const readme = await Bun.file("README.md").text();

    expect(readme).toContain("https://github.com/SgtSlummy/agents-council/releases");
    expect(readme).toContain("SgtSlummy/hermes-agent/blob/main/docs/occult/quickstart.md");
    expect(readme).not.toContain("agents-council@latest");
    expect(readme).not.toContain("npm install -g agents-council");
  });

  test("keeps scoped npm distribution fork-owned, tokenless, and platform-first", async () => {
    const packageJson = await Bun.file("package.json").json();
    const workflow = await Bun.file(".github/workflows/npm-release.yml").text();

    expect(packageJson.private).toBe(true);
    expect(packageJson.optionalDependencies).toBeUndefined();
    for (const packageName of [
      "@sgtslummy/agents-council",
      "@sgtslummy/agents-council-linux-x64",
      "@sgtslummy/agents-council-linux-arm64",
      "@sgtslummy/agents-council-darwin-x64",
      "@sgtslummy/agents-council-darwin-arm64",
      "@sgtslummy/agents-council-windows-x64",
    ]) {
      expect(workflow).toContain(packageName);
    }
    expect(workflow).toContain("environment: npm-production");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("npm stage publish");
    expect(workflow).toContain('npm publish "$tarball" --access public');
    expect(workflow).toContain('select(.kind == "platform")');
    expect(workflow).toContain('select(.kind == "root")');
    expect(workflow).toContain("cosign verify-blob");
    expect(workflow).toContain("npmInstallCanary.mjs");
    expect(workflow).not.toContain("secrets.NPM_TOKEN");
    expect(workflow).not.toContain("NODE_AUTH_TOKEN");
  });
});
