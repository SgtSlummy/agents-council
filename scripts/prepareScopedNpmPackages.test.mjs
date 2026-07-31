import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { afterEach, test } from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { PLATFORM_PACKAGES, prepareScopedNpmPackages } from "./prepareScopedNpmPackages.mjs";
import { normalizeNpmPackResult, packScopedNpmPackages } from "./packScopedNpmPackages.mjs";
import { prepareNpmBootstrapPackages } from "./prepareNpmBootstrapPackages.mjs";

const tempDirectories = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("assembles a scoped root package after all exact-version platform packages", async () => {
  const fixture = await createFixture("1.2.3");
  const manifest = await prepareScopedNpmPackages({
    releaseRoot: fixture.releaseRoot,
    output: fixture.output,
    sourceRoot: process.cwd(),
    version: "1.2.3",
  });

  assert.equal(manifest.packages.length, 6);
  assert.deepEqual(manifest.publish_order, [
    "@sgtslummy/agents-council-linux-x64",
    "@sgtslummy/agents-council-linux-arm64",
    "@sgtslummy/agents-council-darwin-x64",
    "@sgtslummy/agents-council-darwin-arm64",
    "@sgtslummy/agents-council-windows-x64",
    "@sgtslummy/agents-council",
  ]);

  const rootPackageDirectory = path.join(fixture.output, "packages", "agents-council");
  const rootPackage = JSON.parse(await readFile(path.join(rootPackageDirectory, "package.json"), "utf8"));
  assert.equal(rootPackage.name, "@sgtslummy/agents-council");
  assert.equal(rootPackage.version, "1.2.3");
  assert.equal(rootPackage.private, undefined);
  assert.deepEqual(Object.values(rootPackage.optionalDependencies), Array(5).fill("1.2.3"));
  assert.equal(rootPackage.repository.url, "git+https://github.com/SgtSlummy/agents-council.git");
  assert.equal(rootPackage.publishConfig.provenance, true);

  const generatedRequire = createRequire(path.join(rootPackageDirectory, "scripts", "resolveBinary.cjs"));
  const resolver = generatedRequire(path.join(rootPackageDirectory, "scripts", "resolveBinary.cjs"));
  assert.equal(resolver.getPackageName("win32", "x64"), "@sgtslummy/agents-council-windows-x64");

  const windowsPackage = JSON.parse(
    await readFile(path.join(fixture.output, "packages", "agents-council-windows-x64", "package.json"), "utf8"),
  );
  assert.deepEqual(windowsPackage.os, ["win32"]);
  assert.deepEqual(windowsPackage.cpu, ["x64"]);
  assert.ok(windowsPackage.files.includes("council.exe"));
});

test("rejects a release payload whose signed checksum contract no longer matches", async () => {
  const fixture = await createFixture("2.0.0");
  await writeFile(path.join(fixture.releaseRoot, "agents-council-linux-x64", "cli", "council"), "tampered", "utf8");

  await assert.rejects(
    prepareScopedNpmPackages({
      releaseRoot: fixture.releaseRoot,
      output: fixture.output,
      sourceRoot: process.cwd(),
      version: "2.0.0",
    }),
    /Checksum mismatch/,
  );
});

test("packs deterministic platform-first tarballs and records registry integrity", { timeout: 20_000 }, async () => {
  const fixture = await createFixture("1.2.4");
  const packOutput = path.join(fixture.base, "packed");
  await prepareScopedNpmPackages({
    releaseRoot: fixture.releaseRoot,
    output: fixture.output,
    sourceRoot: process.cwd(),
    version: "1.2.4",
  });
  const manifest = await packScopedNpmPackages({
    assemblyRoot: fixture.output,
    output: packOutput,
  });

  assert.equal(manifest.packages.length, 6);
  assert.ok(manifest.packages.slice(0, -1).every((entry) => entry.kind === "platform"));
  assert.equal(manifest.packages.at(-1).name, "@sgtslummy/agents-council");
  assert.ok(manifest.packages.every((entry) => entry.integrity.startsWith("sha512-")));
  assert.ok(manifest.packages.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));
});

test("accepts npm 10 array and npm 12 keyed pack JSON without weakening identity checks", () => {
  const packed = {
    name: "@sgtslummy/agents-council",
    version: "1.2.4",
    filename: "sgtslummy-agents-council-1.2.4.tgz",
  };
  assert.equal(normalizeNpmPackResult([packed], "@sgtslummy/agents-council"), packed);
  assert.equal(normalizeNpmPackResult({ "@sgtslummy/agents-council": packed }, "@sgtslummy/agents-council"), packed);
  assert.throws(
    () =>
      normalizeNpmPackResult(
        { "@sgtslummy/other": { ...packed, name: "@sgtslummy/other" } },
        "@sgtslummy/agents-council",
      ),
    /Unexpected npm pack result/,
  );
});

test("fails closed on version mismatch and requires explicit output replacement", async () => {
  const fixture = await createFixture("3.0.0");
  await assert.rejects(
    prepareScopedNpmPackages({
      releaseRoot: fixture.releaseRoot,
      output: fixture.output,
      sourceRoot: process.cwd(),
      version: "3.0.1",
    }),
    /Release manifest mismatch/,
  );

  await mkdir(fixture.output, { recursive: true });
  await assert.rejects(
    prepareScopedNpmPackages({
      releaseRoot: fixture.releaseRoot,
      output: fixture.output,
      sourceRoot: process.cwd(),
      version: "3.0.0",
    }),
    /Output already exists/,
  );

  const manifest = await prepareScopedNpmPackages({
    releaseRoot: fixture.releaseRoot,
    output: fixture.output,
    sourceRoot: process.cwd(),
    version: "3.0.0",
    replaceOutput: true,
  });
  assert.equal(manifest.packages.at(-1).name, "@sgtslummy/agents-council");
});

test("creates inert bootstrap-only namespace packages without executables", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "council-npm-bootstrap-"));
  tempDirectories.push(base);
  const output = path.join(base, "bootstrap");
  const manifest = await prepareNpmBootstrapPackages({ output });

  assert.equal(manifest.purpose, "namespace-bootstrap-only");
  assert.equal(manifest.packages.length, 6);
  assert.ok(manifest.packages.every((entry) => entry.version === "0.0.0-bootstrap.0"));
  assert.ok(manifest.packages.every((entry) => entry.tag === "bootstrap"));
  const rootPackage = JSON.parse(await readFile(path.join(output, "agents-council", "package.json"), "utf8"));
  assert.equal(rootPackage.name, "@sgtslummy/agents-council");
  assert.equal(rootPackage.bin, undefined);
  assert.equal(rootPackage.optionalDependencies, undefined);
});

async function createFixture(version) {
  const base = await mkdtemp(path.join(os.tmpdir(), "council-scoped-npm-"));
  tempDirectories.push(base);
  const releaseRoot = path.join(base, "release");
  const output = path.join(base, "output");
  await mkdir(releaseRoot, { recursive: true });
  for (const platform of PLATFORM_PACKAGES) {
    await writeBundle(releaseRoot, platform, version);
  }
  return { base, releaseRoot, output };
}

async function writeBundle(releaseRoot, platform, version) {
  const bundleRoot = path.join(releaseRoot, platform.releaseName);
  const binaryPath = path.join(bundleRoot, "cli", platform.binary);
  const desktopPath = path.join(bundleRoot, "desktop-artifacts", `stable-${platform.os}-${platform.cpu}-Setup.fixture`);
  await mkdir(path.dirname(binaryPath), { recursive: true });
  await mkdir(path.dirname(desktopPath), { recursive: true });
  await writeFile(binaryPath, `binary:${platform.releaseName}`, "utf8");
  await writeFile(desktopPath, `desktop:${platform.releaseName}`, "utf8");

  const artifacts = [];
  for (const [relative, file] of [
    [`cli/${platform.binary}`, binaryPath],
    [`desktop-artifacts/${path.basename(desktopPath)}`, desktopPath],
  ]) {
    const content = await readFile(file);
    artifacts.push({
      path: relative,
      bytes: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  const manifest = {
    schema_version: "1.0.0",
    package_name: platform.releaseName,
    package_version: version,
    occult_contract_versions: ["1.0.0"],
    feature_gate: "OCCULT_ENABLED",
    artifacts,
  };
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(path.join(bundleRoot, "occult-release-manifest.json"), manifestContent, "utf8");
  const checksumLines = [
    ...artifacts.map((artifact) => `${artifact.sha256}  ${artifact.path}`),
    `${createHash("sha256").update(manifestContent).digest("hex")}  occult-release-manifest.json`,
  ];
  await writeFile(path.join(bundleRoot, "SHA256SUMS.txt"), `${checksumLines.join("\n")}\n`, "utf8");
}
