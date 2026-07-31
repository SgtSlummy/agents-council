import type { ElectrobunConfig } from "electrobun";

const appVersion = process.env.AGENTS_COUNCIL_VERSION ?? "0.5.4";

export default {
  app: {
    name: "Agents Council",
    identifier: "dev.agents.council",
    version: appVersion,
  },
  runtime: {
    exitOnLastWindowClosed: true,
    occultContractVersions: ["1.0.0"],
    occultFeatureGate: "OCCULT_ENABLED",
  },
  build: {
    bun: {
      entrypoint: "desktop/bun/index.ts",
    },
    views: {
      council: {
        entrypoint: "desktop/views/council/index.ts",
      },
    },
    copy: {
      "desktop/views/council/index.html": "views/council/index.html",
      "src/interfaces/chat/ui/styles.css": "views/council/styles.css",
    },
    mac: {
      defaultRenderer: "native",
    },
    win: {
      defaultRenderer: "native",
    },
    linux: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
  },
} satisfies ElectrobunConfig;
