#!/usr/bin/env node

import { createHash } from "node:crypto";
import { chmod, copyFile, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_SCOPE = "@sgtslummy";
const REPOSITORY_URL = "https://github.com/SgtSlummy/agents-council.git";
const RELEASE_MANIFEST = "occult-release-manifest.json";
const RELEASE_CHECKSUMS = "SHA256SUMS.txt";
const OUTPUT_MANIFEST = "scoped-npm-manifest.json";

export const PLATFORM_PACKAGES = Object.freeze([
  {
    releaseName: "agents-council-linux-x64",
    suffix: "linux-x64",
    os: "linux",
    cpu: "x64",
    binary: "council",
  },
  {
    releaseName: "agents-council-linux-arm64",
    suffix: "linux-arm64",
    os: "linux",
    cpu: "arm64",
    binary: "council",
  },
  {
    releaseName: "agents-council-darwin-x64",
    suffix: "darwin-x64",
    os: "darwin",
    cpu: "x64",
    binary: "council",
  },
  {
    releaseName: "agents-council-darwin-arm64",
    suffix: "darwin-arm64",
    os: "darwin",
    cpu: "arm64",
    binary: "council",
  },
  {
    releaseName: "agents-council-windows-x64",
    suffix: "windows-x64",
    os: "win32",
    cpu: "x64",
    binary: "council.exe",
  },
]);

export async function prepareScopedNpmPackages(options) {
  const releaseRoot = path.resolve(options.releaseRoot);
  const output = path.resolve(options.output);
  const sourceRoot = path.resolve(options.sourceRoot ?? process.cwd());
  const version = validateVersion(options.version);
  const scope = validateScope(options.scope ?? DEFAULT_SCOPE);

  await assertDirectory(releaseRoot, "Release root");
  await assertDirectory(sourceRoot, "Source root");
  assertSeparatedPaths(releaseRoot, output);

  if (await pathExists(output)) {
    if (!options.replaceOutput) {
      throw new Error(`Output already exists; pass --replace-output to recreate it: ${output}`);
    }
    await rm(output, { recursive: true, force: true });
  }
  await mkdir(path.join(output, "packages"), { recursive: true });

  const optionalDependencies = {};
  const packageEntries = [];
  for (const platform of PLATFORM_PACKAGES) {
    const packageName = `${scope}/agents-council-${platform.suffix}`;
    optionalDependencies[packageName] = version;
    packageEntries.push(
      await preparePlatformPackage({
        output,
        releaseRoot,
        sourceRoot,
        version,
        packageName,
        platform,
      }),
    );
  }

  packageEntries.push(
    await prepareRootPackage({
      output,
      sourceRoot,
      version,
      scope,
      optionalDependencies,
    }),
  );

  const manifest = {
    schema_version: "1.0.0",
    source: {
      repository: REPOSITORY_URL,
      release_tag: `v${version}`,
      release_checksum_manifest: RELEASE_CHECKSUMS,
      release_signature_bundle: `${RELEASE_CHECKSUMS}.sigstore.json`,
    },
    publish_order: [
      ...packageEntries.filter((entry) => entry.kind === "platform").map((entry) => entry.name),
      `${scope}/agents-council`,
    ],
    packages: packageEntries,
  };
  await writeJson(path.join(output, OUTPUT_MANIFEST), manifest);
  return manifest;
}

async function preparePlatformPackage({ output, releaseRoot, sourceRoot, version, packageName, platform }) {
  const bundleRoot = path.join(releaseRoot, platform.releaseName);
  await verifyReleaseBundle(bundleRoot, platform, version);

  const packageRoot = path.join(output, "packages", platform.releaseName);
  await mkdir(packageRoot, { recursive: true });
  await copyFile(path.join(bundleRoot, "cli", platform.binary), path.join(packageRoot, platform.binary));
  if (platform.os !== "win32") {
    await chmod(path.join(packageRoot, platform.binary), 0o755);
  }
  await copyFile(path.join(bundleRoot, RELEASE_MANIFEST), path.join(packageRoot, RELEASE_MANIFEST));
  await copyFile(path.join(bundleRoot, RELEASE_CHECKSUMS), path.join(packageRoot, RELEASE_CHECKSUMS));
  await copyFile(path.join(sourceRoot, "LICENSE"), path.join(packageRoot, "LICENSE"));
  await writeFile(
    path.join(packageRoot, "README.md"),
    platformReadme(packageName, version, platform.releaseName),
    "utf8",
  );

  await writeJson(path.join(packageRoot, "package.json"), {
    name: packageName,
    version,
    description: `Native Agents Council CLI for ${platform.os}-${platform.cpu}.`,
    os: [platform.os],
    cpu: [platform.cpu],
    files: [platform.binary, RELEASE_MANIFEST, RELEASE_CHECKSUMS, "README.md", "LICENSE"],
    occult: {
      contractVersions: ["1.0.0"],
      featureGate: "OCCULT_ENABLED",
      sourceRelease: `v${version}`,
    },
    repository: {
      type: "git",
      url: `git+${REPOSITORY_URL}`,
    },
    bugs: {
      url: "https://github.com/SgtSlummy/agents-council/issues",
    },
    homepage: "https://github.com/SgtSlummy/agents-council",
    publishConfig: {
      access: "public",
      provenance: true,
      registry: "https://registry.npmjs.org/",
    },
    license: "MIT",
  });

  return {
    kind: "platform",
    name: packageName,
    version,
    directory: slash(path.relative(output, packageRoot)),
    os: platform.os,
    cpu: platform.cpu,
    files: await hashTree(packageRoot),
  };
}

async function prepareRootPackage({ output, sourceRoot, version, scope, optionalDependencies }) {
  const packageName = `${scope}/agents-council`;
  const packageRoot = path.join(output, "packages", "agents-council");
  await mkdir(path.join(packageRoot, "scripts"), { recursive: true });
  for (const script of ["cli.cjs", "resolveBinary.cjs"]) {
    await copyFile(path.join(sourceRoot, "scripts", script), path.join(packageRoot, "scripts", script));
  }
  await copyFile(path.join(sourceRoot, "LICENSE"), path.join(packageRoot, "LICENSE"));
  await writeFile(path.join(packageRoot, "README.md"), rootReadme(packageName, version), "utf8");
  await writeJson(path.join(packageRoot, "package.json"), {
    name: packageName,
    version,
    description: "Scoped npm launcher for the signed Agents Council desktop and CLI release.",
    type: "commonjs",
    files: ["scripts/cli.cjs", "scripts/resolveBinary.cjs", "README.md", "LICENSE"],
    bin: {
      council: "scripts/cli.cjs",
    },
    engines: {
      node: ">=18",
    },
    occult: {
      contractVersions: ["1.0.0"],
      featureGate: "OCCULT_ENABLED",
      sourceRelease: `v${version}`,
    },
    optionalDependencies,
    repository: {
      type: "git",
      url: `git+${REPOSITORY_URL}`,
    },
    bugs: {
      url: "https://github.com/SgtSlummy/agents-council/issues",
    },
    homepage: "https://github.com/SgtSlummy/agents-council",
    publishConfig: {
      access: "public",
      provenance: true,
      registry: "https://registry.npmjs.org/",
    },
    keywords: ["mcp", "council", "agents", "cli", "mcp-server", "occult"],
    license: "MIT",
  });

  return {
    kind: "root",
    name: packageName,
    version,
    directory: slash(path.relative(output, packageRoot)),
    files: await hashTree(packageRoot),
  };
}

async function verifyReleaseBundle(bundleRoot, platform, version) {
  await assertDirectory(bundleRoot, `Release bundle ${platform.releaseName}`);
  await assertRegularTree(bundleRoot);

  const manifestPath = path.join(bundleRoot, RELEASE_MANIFEST);
  const checksumsPath = path.join(bundleRoot, RELEASE_CHECKSUMS);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    manifest.schema_version !== "1.0.0" ||
    manifest.package_name !== platform.releaseName ||
    manifest.package_version !== version ||
    JSON.stringify(manifest.occult_contract_versions) !== JSON.stringify(["1.0.0"]) ||
    manifest.feature_gate !== "OCCULT_ENABLED" ||
    !Array.isArray(manifest.artifacts)
  ) {
    throw new Error(`Release manifest mismatch for ${platform.releaseName}`);
  }

  const checksumEntries = parseChecksums(await readFile(checksumsPath, "utf8"));
  const artifactPaths = manifest.artifacts.map((artifact) => validateRelativePath(artifact.path));
  if (new Set(artifactPaths).size !== artifactPaths.length) {
    throw new Error(`Duplicate artifact paths in ${platform.releaseName}/${RELEASE_MANIFEST}`);
  }
  const expectedPaths = new Set([...artifactPaths, RELEASE_MANIFEST]);
  for (const expectedPath of expectedPaths) {
    const expectedHash = checksumEntries.get(expectedPath);
    if (!expectedHash) {
      throw new Error(`Missing checksum for ${platform.releaseName}/${expectedPath}`);
    }
    const filePath = path.join(bundleRoot, ...expectedPath.split("/"));
    const actualHash = await sha256File(filePath);
    if (actualHash !== expectedHash) {
      throw new Error(`Checksum mismatch for ${platform.releaseName}/${expectedPath}`);
    }
  }
  for (const artifact of manifest.artifacts) {
    const artifactPath = validateRelativePath(artifact.path);
    const artifactStat = await stat(path.join(bundleRoot, ...artifactPath.split("/")));
    if (artifact.sha256 !== checksumEntries.get(artifactPath) || artifact.bytes !== artifactStat.size) {
      throw new Error(`Release manifest artifact mismatch for ${platform.releaseName}/${artifactPath}`);
    }
  }
  if (checksumEntries.size !== expectedPaths.size) {
    throw new Error(`Unexpected checksum entries in ${platform.releaseName}/${RELEASE_CHECKSUMS}`);
  }

  const actualFiles = (await listFiles(bundleRoot)).map((file) => slash(path.relative(bundleRoot, file))).sort();
  const allowedFiles = [...expectedPaths, RELEASE_CHECKSUMS].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(allowedFiles)) {
    throw new Error(`Release bundle file set does not match its manifest: ${platform.releaseName}`);
  }

  const binaryPath = `cli/${platform.binary}`;
  if (!expectedPaths.has(binaryPath)) {
    throw new Error(`Missing CLI binary in ${platform.releaseName}: ${binaryPath}`);
  }
  if (![...expectedPaths].some((file) => file.startsWith("desktop-artifacts/"))) {
    throw new Error(`Missing desktop artifacts in ${platform.releaseName}`);
  }
}

function parseChecksums(content) {
  const entries = new Map();
  for (const rawLine of content.split(/\r?\n/)) {
    if (!rawLine) continue;
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(rawLine);
    if (!match) {
      throw new Error(`Invalid checksum line: ${rawLine}`);
    }
    const relative = validateRelativePath(match[2]);
    if (entries.has(relative)) {
      throw new Error(`Duplicate checksum entry: ${relative}`);
    }
    entries.set(relative, match[1]);
  }
  return entries;
}

function validateRelativePath(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\\") ||
    path.posix.isAbsolute(value) ||
    value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe release path: ${String(value)}`);
  }
  return value;
}

async function assertRegularTree(root) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    const entryStat = await lstat(entryPath);
    if (entryStat.isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed in release bundles: ${entryPath}`);
    }
    if (entryStat.isDirectory()) {
      await assertRegularTree(entryPath);
    } else if (!entryStat.isFile()) {
      throw new Error(`Unsupported release entry type: ${entryPath}`);
    }
  }
}

async function hashTree(root) {
  const files = await listFiles(root);
  const entries = [];
  for (const file of files.sort()) {
    entries.push({
      path: slash(path.relative(root, file)),
      bytes: (await stat(file)).size,
      sha256: await sha256File(file),
    });
  }
  return entries;
}

async function listFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

async function sha256File(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function assertDirectory(directory, label) {
  let directoryStat;
  try {
    directoryStat = await stat(directory);
  } catch {
    throw new Error(`${label} does not exist: ${directory}`);
  }
  if (!directoryStat.isDirectory()) {
    throw new Error(`${label} is not a directory: ${directory}`);
  }
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

function assertSeparatedPaths(releaseRoot, output) {
  const root = path.parse(output).root;
  if (output === root || output === releaseRoot || isWithin(output, releaseRoot) || isWithin(releaseRoot, output)) {
    throw new Error(`Output must be a dedicated directory outside the release root: ${output}`);
  }
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function validateScope(scope) {
  if (!/^@[a-z0-9][a-z0-9._-]*$/.test(scope)) {
    throw new Error(`Invalid npm scope: ${scope}`);
  }
  return scope;
}

function validateVersion(version) {
  const value = String(version ?? "").trim();
  const semver =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  if (!semver.test(value)) {
    throw new Error(`Invalid package version: ${value || "<empty>"}`);
  }
  return value;
}

function slash(value) {
  return value.split(path.sep).join("/");
}

function platformReadme(packageName, version, releaseName) {
  const packageScope = packageName.slice(0, packageName.indexOf("/"));
  return `# ${packageName}

Native Agents Council payload for \`${releaseName}\`, version \`${version}\`.

This package is an optional dependency of \`${packageScope}/agents-council\`.
Its CLI is assembled only from the signed GitHub release at
https://github.com/SgtSlummy/agents-council/releases/tag/v${version}.
Electrobun desktop installers remain signed GitHub release assets and are not
duplicated in the npm package.
`;
}

function rootReadme(packageName, version) {
  return `# ${packageName}

Scoped npm launcher for Agents Council \`${version}\`.

The package selects the matching native optional dependency and launches the
bundled \`council\` binary. The signed GitHub release remains the canonical
source of the binary and Electrobun artifacts:

https://github.com/SgtSlummy/agents-council/releases/tag/v${version}

Occult remains disabled unless \`OCCULT_ENABLED=true\`.
`;
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
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${argument}`);
    }
    values.set(argument, value);
    index += 1;
  }
  for (const required of ["--release-root", "--output", "--version"]) {
    if (!values.has(required)) {
      throw new Error(
        "Usage: node scripts/prepareScopedNpmPackages.mjs --release-root <directory> --output <directory> --version <semver> [--scope @scope] [--replace-output]",
      );
    }
  }
  return {
    releaseRoot: values.get("--release-root"),
    output: values.get("--output"),
    version: values.get("--version"),
    scope: values.get("--scope"),
    replaceOutput: flags.has("--replace-output"),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const manifest = await prepareScopedNpmPackages(parseOptions(process.argv.slice(2)));
    console.log(`Prepared ${manifest.packages.length} scoped npm packages in platform-first publish order.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
