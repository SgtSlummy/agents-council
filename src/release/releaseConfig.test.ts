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
  });

  test("keeps cross-platform release assembly gated by manifests and checksums", async () => {
    const ci = await Bun.file(".github/workflows/ci.yml").text();
    const release = await Bun.file(".github/workflows/release.yml").text();

    for (const platform of ["ubuntu-latest", "macos-latest", "windows-latest"]) {
      expect(ci).toContain(platform);
      expect(release).toContain(platform);
    }
    expect(ci).toContain("generateOccultReleaseManifest.ts");
    expect(release).toContain("occult-release-manifest.json");
    expect(release).toContain("SHA256SUMS.txt");
    expect(release).toContain('contractVersions: ["1.0.0"]');
  });
});
