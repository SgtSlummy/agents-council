import { resolve } from "node:path";

import { writeOccultReleaseMetadata } from "../src/release/occultRelease";

const options = parseOptions(process.argv.slice(2));
const manifest = await writeOccultReleaseMetadata(options);
console.log(
  `Wrote Occult ${manifest.occult_contract_versions.join(", ")} manifest for ${manifest.artifacts.length} artifact(s).`,
);

function parseOptions(args: string[]) {
  const root = readArgument(args, "--root");
  const packageVersion = readArgument(args, "--version");
  const packageName = readArgument(args, "--package") ?? "agents-council";
  if (!root || !packageVersion) {
    throw new Error(
      "Usage: bun scripts/generateOccultReleaseManifest.ts --root <directory> --version <version> [--package <name>]",
    );
  }
  return {
    root: resolve(root),
    packageName,
    packageVersion,
  };
}

function readArgument(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  return value?.trim() || null;
}
