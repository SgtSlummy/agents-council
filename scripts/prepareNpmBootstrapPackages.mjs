#!/usr/bin/env node

import { lstat, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BOOTSTRAP_VERSION = "0.0.0-bootstrap.0";
const SUFFIXES = ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64", null];

export async function prepareNpmBootstrapPackages(options) {
  const output = path.resolve(options.output);
  const scope = validateScope(options.scope ?? "@sgtslummy");
  if (output === path.parse(output).root) {
    throw new Error(`Refusing to use a filesystem root as bootstrap output: ${output}`);
  }
  if (await pathExists(output)) {
    if (!options.replaceOutput) {
      throw new Error(`Bootstrap output already exists; pass --replace-output: ${output}`);
    }
    await rm(output, { recursive: true, force: true });
  }
  await mkdir(output, { recursive: true });

  const packages = [];
  for (const suffix of SUFFIXES) {
    const unscopedName = suffix ? `agents-council-${suffix}` : "agents-council";
    const name = `${scope}/${unscopedName}`;
    const directory = path.join(output, unscopedName);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "README.md"),
      `# ${name}

Namespace bootstrap only. Install a signed production version after the
trusted publisher is configured.
`,
      "utf8",
    );
    await writeFile(
      path.join(directory, "package.json"),
      `${JSON.stringify(
        {
          name,
          version: BOOTSTRAP_VERSION,
          description: "Namespace bootstrap for the signed Agents Council distribution.",
          files: ["README.md"],
          repository: {
            type: "git",
            url: "git+https://github.com/SgtSlummy/agents-council.git",
          },
          homepage: "https://github.com/SgtSlummy/agents-council",
          publishConfig: {
            access: "public",
            registry: "https://registry.npmjs.org/",
          },
          license: "MIT",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    packages.push({
      name,
      version: BOOTSTRAP_VERSION,
      directory: unscopedName,
      tag: "bootstrap",
    });
  }

  const manifest = {
    schema_version: "1.0.0",
    purpose: "namespace-bootstrap-only",
    packages,
  };
  await writeFile(path.join(output, "npm-bootstrap-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
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

function validateScope(scope) {
  if (!/^@[a-z0-9][a-z0-9._-]*$/.test(scope)) {
    throw new Error(`Invalid npm scope: ${scope}`);
  }
  return scope;
}

function parseOptions(args) {
  const outputIndex = args.indexOf("--output");
  const scopeIndex = args.indexOf("--scope");
  const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
  if (!output) {
    throw new Error(
      "Usage: node scripts/prepareNpmBootstrapPackages.mjs --output <directory> [--scope @scope] [--replace-output]",
    );
  }
  return {
    output,
    scope: scopeIndex >= 0 ? args[scopeIndex + 1] : undefined,
    replaceOutput: args.includes("--replace-output"),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const manifest = await prepareNpmBootstrapPackages(parseOptions(process.argv.slice(2)));
    console.log(`Prepared ${manifest.packages.length} inert namespace bootstrap packages.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
