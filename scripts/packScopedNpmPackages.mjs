#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const execFile = promisify(execFileCallback);
const ASSEMBLY_MANIFEST = "scoped-npm-manifest.json";
const PACK_MANIFEST = "npm-pack-manifest.json";

export async function packScopedNpmPackages(options) {
  const assemblyRoot = path.resolve(options.assemblyRoot);
  const output = path.resolve(options.output);
  const npmCommand = options.npmCommand ?? (process.platform === "win32" ? "npm.cmd" : "npm");
  const assembly = JSON.parse(await readFile(path.join(assemblyRoot, ASSEMBLY_MANIFEST), "utf8"));
  validateAssembly(assembly);
  assertSeparateOutput(assemblyRoot, output);

  if (await pathExists(output)) {
    if (!options.replaceOutput) {
      throw new Error(`Pack output already exists; pass --replace-output: ${output}`);
    }
    await rm(output, { recursive: true, force: true });
  }
  await mkdir(output, { recursive: true });

  const packages = [];
  for (const packageName of assembly.publish_order) {
    const entry = assembly.packages.find((candidate) => candidate.name === packageName);
    const packageRoot = path.resolve(assemblyRoot, entry.directory);
    if (!isWithin(assemblyRoot, packageRoot)) {
      throw new Error(`Package directory escapes assembly root: ${entry.directory}`);
    }
    const { stdout } = await runNpm(
      npmCommand,
      ["pack", packageRoot, "--pack-destination", output, "--json", "--ignore-scripts"],
      {
        cwd: assemblyRoot,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      },
    );
    const packed = normalizeNpmPackResult(JSON.parse(stdout), packageName);
    if (packed.name !== packageName || packed.version !== entry.version) {
      throw new Error(`npm pack identity mismatch for ${packageName}`);
    }
    validatePackedFiles(packageName, packed.files);
    const tarball = path.join(output, packed.filename);
    packages.push({
      kind: entry.kind,
      name: packageName,
      version: entry.version,
      filename: packed.filename,
      bytes: (await lstat(tarball)).size,
      sha256: await sha256File(tarball),
      shasum: packed.shasum,
      integrity: packed.integrity,
    });
  }

  const manifest = {
    schema_version: "1.0.0",
    source_release: assembly.source,
    publish_order: assembly.publish_order,
    packages,
  };
  await writeFile(path.join(output, PACK_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const checksumLines = packages.map((entry) => `${entry.sha256}  ${entry.filename}`);
  const manifestHash = await sha256File(path.join(output, PACK_MANIFEST));
  checksumLines.push(`${manifestHash}  ${PACK_MANIFEST}`);
  await writeFile(path.join(output, "SHA256SUMS.txt"), `${checksumLines.join("\n")}\n`, "utf8");
  return manifest;
}

export function normalizeNpmPackResult(result, packageName) {
  if (Array.isArray(result) && result.length === 1) {
    return result[0];
  }
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const entries = Object.values(result);
    if (entries.length === 1 && entries[0]?.name === packageName) {
      return entries[0];
    }
  }
  throw new Error(`Unexpected npm pack result for ${packageName}`);
}

function runNpm(npmCommand, args, options) {
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(npmCommand)) {
    return execFile(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", npmCommand, ...args], options);
  }
  return execFile(npmCommand, args, options);
}

function validateAssembly(assembly) {
  if (
    assembly.schema_version !== "1.0.0" ||
    !Array.isArray(assembly.packages) ||
    !Array.isArray(assembly.publish_order) ||
    assembly.packages.length !== 6 ||
    assembly.publish_order.length !== 6
  ) {
    throw new Error("Invalid scoped npm assembly manifest.");
  }
  const names = new Set(assembly.packages.map((entry) => entry.name));
  if (names.size !== 6 || assembly.publish_order.some((name) => !names.has(name))) {
    throw new Error("Scoped npm assembly contains duplicate or unknown package names.");
  }
  const orderedEntries = assembly.publish_order.map((name) => assembly.packages.find((entry) => entry.name === name));
  if (
    orderedEntries.slice(0, -1).some((entry) => entry.kind !== "platform") ||
    orderedEntries.at(-1)?.kind !== "root"
  ) {
    throw new Error("Root package must be last after all platform packages.");
  }
}

function validatePackedFiles(packageName, files) {
  if (!Array.isArray(files) || !files.some((entry) => entry.path === "package.json")) {
    throw new Error(`npm pack did not include package.json for ${packageName}`);
  }
  for (const entry of files) {
    const file = String(entry.path ?? "");
    if (
      !file ||
      file.startsWith("/") ||
      file.includes("\\") ||
      file.split("/").some((part) => part === "" || part === "." || part === "..") ||
      /(^|[/_.-])(secret|credential|token|state)([/_.-]|$)/i.test(file) ||
      /(^|\/)\.env($|\.)/i.test(file) ||
      /\.key$/i.test(file)
    ) {
      throw new Error(`Unsafe file in npm package ${packageName}: ${file}`);
    }
  }
}

async function sha256File(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function assertSeparateOutput(assemblyRoot, output) {
  const root = path.parse(output).root;
  if (output === root || output === assemblyRoot || isWithin(output, assemblyRoot) || isWithin(assemblyRoot, output)) {
    throw new Error(`Pack output must be outside the assembly root: ${output}`);
  }
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function parseOptions(args) {
  const values = new Map();
  const flags = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--replace-output") {
      flags.add(argument);
      continue;
    }
    const value = args[index + 1];
    if (!argument.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Invalid option: ${argument}`);
    }
    values.set(argument, value);
    index += 1;
  }
  if (!values.has("--assembly-root") || !values.has("--output")) {
    throw new Error(
      "Usage: node scripts/packScopedNpmPackages.mjs --assembly-root <directory> --output <directory> [--replace-output]",
    );
  }
  return {
    assemblyRoot: values.get("--assembly-root"),
    output: values.get("--output"),
    replaceOutput: flags.has("--replace-output"),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const manifest = await packScopedNpmPackages(parseOptions(process.argv.slice(2)));
    console.log(`Packed ${manifest.packages.length} scoped npm tarballs with the root package last.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
