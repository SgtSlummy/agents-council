#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function verifyChecksumManifest(options) {
  const directory = path.resolve(options.directory);
  const manifestName = options.manifest ?? "WORKFLOW-SHA256SUMS.txt";
  assertSafeFilename(manifestName);

  const manifestPath = path.join(directory, manifestName);
  const entries = parseChecksumManifest(await readFile(manifestPath, "utf8"));
  if (entries.length === 0) {
    throw new Error(`Checksum manifest is empty: ${manifestName}`);
  }

  for (const entry of entries) {
    const target = path.join(directory, entry.filename);
    const targetStat = await lstat(target);
    if (!targetStat.isFile() || targetStat.isSymbolicLink()) {
      throw new Error(`Checksum target is not a regular file: ${entry.filename}`);
    }
    const actual = createHash("sha256")
      .update(await readFile(target))
      .digest("hex");
    if (actual !== entry.sha256) {
      throw new Error(`Checksum mismatch for ${entry.filename}`);
    }
  }

  return entries.length;
}

export function parseChecksumManifest(content) {
  const entries = [];
  const filenames = new Set();
  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine) continue;
    const match = /^([a-f0-9]{64}) [ *](.+)$/.exec(rawLine);
    if (!match) {
      throw new Error("Invalid checksum manifest line");
    }
    const [, sha256, filename] = match;
    assertSafeFilename(filename);
    if (filenames.has(filename)) {
      throw new Error(`Duplicate checksum target: ${filename}`);
    }
    filenames.add(filename);
    entries.push({ filename, sha256 });
  }
  return entries;
}

function assertSafeFilename(filename) {
  if (
    !filename ||
    filename !== path.basename(filename) ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename === "." ||
    filename === ".."
  ) {
    throw new Error("Unsafe checksum filename");
  }
}

function parseOptions(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (!argument.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Invalid option: ${argument}`);
    }
    values.set(argument, value);
    index += 1;
  }
  if (!values.has("--directory")) {
    throw new Error("Usage: node verifyChecksumManifest.mjs --directory <directory> [--manifest <filename>]");
  }
  return {
    directory: values.get("--directory"),
    manifest: values.get("--manifest"),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const count = await verifyChecksumManifest(parseOptions(process.argv.slice(2)));
    console.log(`Verified ${count} SHA-256 checksums.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
