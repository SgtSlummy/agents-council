import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  generateOccultReleaseMetadata,
  OCCULT_RELEASE_CHECKSUMS,
  OCCULT_RELEASE_MANIFEST,
  writeOccultReleaseMetadata,
} from "./occultRelease";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createPayload(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agents-council-release-"));
  tempDirs.push(directory);
  await Bun.write(path.join(directory, "council.exe"), new Uint8Array([1, 2, 3, 4]));
  await writeFile(path.join(directory, "README.md"), "Agents Council release payload.\n", "utf8");
  return directory;
}

describe("Occult release metadata", () => {
  test("creates deterministic contract-aware manifests and SHA-256 checksums", async () => {
    const root = await createPayload();
    const options = { root, packageName: "agents-council-windows-x64", packageVersion: "1.2.3" };
    const first = await writeOccultReleaseMetadata(options);
    const second = await generateOccultReleaseMetadata(options);

    expect(second).toEqual(first);
    expect(first.occult_contract_versions).toEqual(["1.0.0"]);
    expect(first.feature_gate).toBe("OCCULT_ENABLED");
    expect(first.artifacts.map((artifact) => artifact.path)).toEqual(["council.exe", "README.md"]);
    expect(await readFile(path.join(root, OCCULT_RELEASE_MANIFEST), "utf8")).toContain('"sha256"');
    const checksums = await readFile(path.join(root, OCCULT_RELEASE_CHECKSUMS), "utf8");
    expect(checksums).toContain("council.exe");
    expect(checksums).toContain(OCCULT_RELEASE_MANIFEST);
  });

  test("rejects state, secret, and credential-bearing release files", async () => {
    const stateRoot = await createPayload();
    await writeFile(path.join(stateRoot, "state.json"), "{}\n", "utf8");
    await expect(
      generateOccultReleaseMetadata({ root: stateRoot, packageName: "agents-council", packageVersion: "1.2.3" }),
    ).rejects.toThrow("Forbidden sensitive file");

    const tokenRoot = await createPayload();
    await writeFile(path.join(tokenRoot, "notes.txt"), "Authorization: Bearer abcdefghijklmnop\n", "utf8");
    await expect(
      generateOccultReleaseMetadata({ root: tokenRoot, packageName: "agents-council", packageVersion: "1.2.3" }),
    ).rejects.toThrow("Sensitive value pattern");
  });
});
