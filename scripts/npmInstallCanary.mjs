#!/usr/bin/env node

import { spawn } from "node:child_process";

const options = parseOptions(process.argv.slice(2));

try {
  const versionResult = await runCommand(options.command, ["--version"]);
  if (versionResult.stdout.trim() !== options.expectedVersion) {
    throw new Error(
      `Version mismatch: expected ${options.expectedVersion}, received ${versionResult.stdout.trim() || "<empty>"}`,
    );
  }

  const helpResult = await runCommand(options.command, ["--help"]);
  if (!/\bUsage:\s+council\b/i.test(helpResult.stdout)) {
    throw new Error("Council help output did not contain the expected usage header.");
  }

  const initializeRequest = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: {
        name: "agents-council-npm-canary",
        version: "1.0.0",
      },
    },
  });
  const mcpResult = await runCommand(options.command, ["mcp"], {
    stdin: `${initializeRequest}\n`,
    timeoutMs: 15_000,
  });
  const response = mcpResult.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .find((message) => message?.id === 1);
  if (!response?.result?.serverInfo || response.error) {
    throw new Error("Council MCP startup did not return a valid initialize response.");
  }

  console.log(
    JSON.stringify({
      status: "passed",
      version: options.expectedVersion,
      checks: ["version", "help", "mcp_initialize"],
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const executable =
      process.platform === "win32" && /\.(cmd|bat)$/i.test(command) ? (process.env.ComSpec ?? "cmd.exe") : command;
    const executableArgs = executable === command ? args : ["/d", "/s", "/c", command, ...args];
    const child = spawn(executable, executableArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out after ${options.timeoutMs ?? 10_000}ms: ${command} ${args.join(" ")}`));
    }, options.timeoutMs ?? 10_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new Error(
            `Command failed with exit code ${code}: ${command} ${args.join(" ")}${stderr ? `\n${stderr.trim()}` : ""}`,
          ),
        );
        return;
      }
      resolve({ stdout, stderr });
    });
    child.stdin.end(options.stdin ?? "");
  });
}

function parseOptions(args) {
  const options = {
    command: process.platform === "win32" ? "council.cmd" : "council",
    expectedVersion: null,
  };
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!value) {
      throw new Error(`Missing value for ${name}`);
    }
    if (name === "--command") {
      options.command = value;
    } else if (name === "--expected-version") {
      options.expectedVersion = value;
    } else {
      throw new Error(`Unknown option: ${name}`);
    }
  }
  if (!options.expectedVersion) {
    throw new Error("Usage: node scripts/npmInstallCanary.mjs --expected-version <semver> [--command <path>]");
  }
  return options;
}
