#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { getPackageName } = require("./resolveBinary.cjs");

const platformPackages = [
  getPackageName("linux", "x64"),
  getPackageName("linux", "arm64"),
  getPackageName("darwin", "x64"),
  getPackageName("darwin", "arm64"),
  getPackageName("win32", "x64"),
];

const packageManager = process.env.npm_config_user_agent?.split("/")[0] || "npm";

console.log("Cleaning up platform-specific packages...");

for (const pkg of platformPackages) {
  const args = packageManager === "bun" ? ["remove", "-g", pkg] : ["uninstall", "-g", pkg];

  const child = spawn(packageManager, args, {
    stdio: "pipe",
    windowsHide: true,
  });

  child.on("exit", (code) => {
    if (code === 0) {
      console.log(`Cleaned up ${pkg}`);
    }
  });
}

console.log("Platform package cleanup completed.");
