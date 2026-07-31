const rootPackage = require("../package.json");

function mapPlatform(platform = process.platform) {
  switch (platform) {
    case "win32":
      return "windows";
    case "darwin":
    case "linux":
      return platform;
    default:
      return platform;
  }
}

function mapArch(arch = process.arch) {
  switch (arch) {
    case "x64":
    case "arm64":
      return arch;
    default:
      return arch;
  }
}

function getPackageScope(packageName = rootPackage.name) {
  const match = /^(@[^/]+)\//.exec(packageName);
  return match?.[1] ?? null;
}

function getPackageName(platform = process.platform, arch = process.arch, packageName = rootPackage.name) {
  const platformPackage = `agents-council-${mapPlatform(platform)}-${mapArch(arch)}`;
  const scope = getPackageScope(packageName);
  return scope ? `${scope}/${platformPackage}` : platformPackage;
}

function resolveBinaryPath(platform = process.platform, arch = process.arch, packageName = rootPackage.name) {
  const platformPackageName = getPackageName(platform, arch, packageName);
  const binary = `council${platform === "win32" ? ".exe" : ""}`;
  return require.resolve(`${platformPackageName}/${binary}`);
}

module.exports = { getPackageName, getPackageScope, resolveBinaryPath };
