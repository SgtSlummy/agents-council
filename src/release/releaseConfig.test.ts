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
    expect(release).toContain("--notes-file publish/RELEASE-NOTES.md");
    expect(release).toContain("Build stable desktop artifacts (Windows)");
    expect(release).toContain("shell: pwsh");
    expect(release).toContain("$env:AGENTS_COUNCIL_VERSION = $tag");
  });
});
