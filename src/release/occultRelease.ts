import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { OCCULT_CONTRACT_VERSION } from "../core/occult/contract";
import { containsSensitiveOccultValue } from "../core/occult/persistenceSecurity";

export const OCCULT_RELEASE_MANIFEST = "occult-release-manifest.json";
export const OCCULT_RELEASE_CHECKSUMS = "SHA256SUMS.txt";

const FORBIDDEN_RELEASE_NAMES = new Set([".env", "config.json", "state.json"]);
const TEXT_EXTENSIONS = new Set([".cjs", ".js", ".json", ".md", ".txt", ".yaml", ".yml"]);

export type OccultReleaseArtifact = {
  path: string;
  bytes: number;
  sha256: string;
};

export type OccultReleaseManifest = {
  schema_version: "1.0.0";
  package_name: string;
  package_version: string;
  occult_contract_versions: ["1.0.0"];
  feature_gate: "OCCULT_ENABLED";
  artifacts: OccultReleaseArtifact[];
};

export async function generateOccultReleaseMetadata(options: {
  root: string;
  packageName: string;
  packageVersion: string;
}): Promise<OccultReleaseManifest> {
  const root = path.resolve(options.root);
  const files = (await listFiles(root))
    .filter((file) => ![OCCULT_RELEASE_MANIFEST, OCCULT_RELEASE_CHECKSUMS].includes(relativePath(root, file)))
    .sort((left, right) => relativePath(root, left).localeCompare(relativePath(root, right)));
  const artifacts: OccultReleaseArtifact[] = [];
  for (const file of files) {
    const relative = relativePath(root, file);
    await assertSafeReleaseFile(file, relative);
    const content = await readFile(file);
    artifacts.push({
      path: relative,
      bytes: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  return {
    schema_version: "1.0.0",
    package_name: options.packageName,
    package_version: options.packageVersion,
    occult_contract_versions: [OCCULT_CONTRACT_VERSION],
    feature_gate: "OCCULT_ENABLED",
    artifacts,
  };
}

export async function writeOccultReleaseMetadata(options: {
  root: string;
  packageName: string;
  packageVersion: string;
}): Promise<OccultReleaseManifest> {
  const root = path.resolve(options.root);
  const manifest = await generateOccultReleaseMetadata(options);
  const manifestPath = path.join(root, OCCULT_RELEASE_MANIFEST);
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(manifestPath, manifestContent, "utf8");
  const manifestHash = createHash("sha256").update(manifestContent).digest("hex");
  const checksumLines = [
    ...manifest.artifacts.map((artifact) => `${artifact.sha256}  ${artifact.path}`),
    `${manifestHash}  ${OCCULT_RELEASE_MANIFEST}`,
  ];
  await writeFile(path.join(root, OCCULT_RELEASE_CHECKSUMS), `${checksumLines.join("\n")}\n`, "utf8");
  return manifest;
}

async function assertSafeReleaseFile(file: string, relative: string): Promise<void> {
  const basename = path.basename(file).toLowerCase();
  if (
    FORBIDDEN_RELEASE_NAMES.has(basename) ||
    basename.includes("credential") ||
    basename.includes("secret") ||
    basename.endsWith(".key")
  ) {
    throw new Error(`Forbidden sensitive file in release payload: ${relative}`);
  }
  if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) {
    return;
  }
  const text = await readFile(file, "utf8");
  if (containsSensitiveOccultValue(text)) {
    throw new Error(`Sensitive value pattern detected in release payload: ${relative}`);
  }
}

async function listFiles(root: string): Promise<string[]> {
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) {
    throw new Error(`Release payload root is not a directory: ${root}`);
  }
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function relativePath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}
