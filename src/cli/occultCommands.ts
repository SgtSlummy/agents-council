import { resolve } from "node:path";

import type { Command } from "commander";

import { OCCULT_CONTRACT_VERSION } from "../core/occult/contract";
import { FileCouncilStateStore } from "../core/state/fileStateStore";
import { loadOccultInterfaceConfig } from "../interfaces/occult/config";
import { mapWireSpreadPlan, occultSpreadPlanSchema } from "../interfaces/occult/protocol";
import { OccultInterfaceService } from "../interfaces/occult/service";
import type { OccultReadingDto } from "../interfaces/occult/types";

type SharedOptions = {
  agentName: string;
  contractVersion: string;
  json?: boolean;
  sessionId: string;
};

type PlanOptions = SharedOptions & {
  plan: string;
};

type ReadingOptions = SharedOptions & {
  afterSequence?: string;
  readingId: string;
};

export function registerOccultCliCommands(program: Command): void {
  const occult = program.command("tarot").alias("occult").description("Manage feature-gated Tarot Router readings.");

  occult
    .command("create")
    .description("Create or idempotently replay a reading from a JSON spread plan.")
    .requiredOption("--session-id <id>", "Target Council session")
    .requiredOption("--agent-name <name>", "Existing participant name in the targeted session")
    .requiredOption("--plan <path>", "Path to a versioned JSON spread plan")
    .option("--contract-version <version>", "Tarot Router v1 contract version", OCCULT_CONTRACT_VERSION)
    .option("--json", "Print machine-readable JSON")
    .action(async (options: PlanOptions) => {
      await runWithInterrupt(async (signal) => {
        const plan = await loadPlan(options.plan, options.sessionId);
        const reading = await createService().execute({
          contractVersion: options.contractVersion,
          agentName: options.agentName,
          plan,
          signal,
        });
        printReading(reading, options.json);
      });
    });

  occult
    .command("inspect")
    .description("Inspect sanitized reading state and optionally request only newer events.")
    .requiredOption("--session-id <id>", "Target Council session")
    .requiredOption("--agent-name <name>", "Existing participant name in the targeted session")
    .requiredOption("--reading-id <id>", "Tarot Router reading id")
    .option("--after-sequence <number>", "Return events after this sequence")
    .option("--contract-version <version>", "Tarot Router v1 contract version", OCCULT_CONTRACT_VERSION)
    .option("--json", "Print machine-readable JSON")
    .action(async (options: ReadingOptions) => {
      const reading = await createService().inspect({
        contractVersion: options.contractVersion,
        agentName: options.agentName,
        sessionId: options.sessionId,
        readingId: options.readingId,
        afterSequence: parseSequence(options.afterSequence),
      });
      printReading(reading, options.json);
    });

  occult
    .command("cancel")
    .description("Cancel a running reading.")
    .requiredOption("--session-id <id>", "Target Council session")
    .requiredOption("--agent-name <name>", "Existing participant name in the targeted session")
    .requiredOption("--reading-id <id>", "Tarot Router reading id")
    .option("--contract-version <version>", "Tarot Router v1 contract version", OCCULT_CONTRACT_VERSION)
    .option("--json", "Print machine-readable JSON")
    .action(async (options: ReadingOptions) => {
      const reading = await createService().cancel({
        contractVersion: options.contractVersion,
        agentName: options.agentName,
        sessionId: options.sessionId,
        readingId: options.readingId,
      });
      printReading(reading, options.json);
    });

  occult
    .command("resume")
    .description("Resume a reading using its original complete JSON spread plan.")
    .requiredOption("--session-id <id>", "Target Council session")
    .requiredOption("--agent-name <name>", "Existing participant name in the targeted session")
    .requiredOption("--reading-id <id>", "Tarot Router reading id")
    .requiredOption("--plan <path>", "Path to the same versioned JSON spread plan")
    .option("--contract-version <version>", "Tarot Router v1 contract version", OCCULT_CONTRACT_VERSION)
    .option("--json", "Print machine-readable JSON")
    .action(async (options: PlanOptions & { readingId: string }) => {
      await runWithInterrupt(async (signal) => {
        const plan = await loadPlan(options.plan, options.sessionId);
        const reading = await createService().execute({
          contractVersion: options.contractVersion,
          agentName: options.agentName,
          plan,
          expectedReadingId: options.readingId,
          signal,
        });
        printReading(reading, options.json);
      });
    });
}

async function loadPlan(filePath: string, sessionId: string) {
  const absolutePath = resolve(filePath);
  let payload: unknown;
  try {
    payload = await Bun.file(absolutePath).json();
  } catch {
    throw new Error(`Unable to read Tarot Router spread plan: ${absolutePath}`);
  }
  const wirePlan = occultSpreadPlanSchema.parse(payload);
  if (wirePlan.session_id !== sessionId) {
    throw new Error("The spread plan session_id must match --session-id.");
  }
  return mapWireSpreadPlan(wirePlan);
}

function createService(): OccultInterfaceService {
  return new OccultInterfaceService(new FileCouncilStateStore(), loadOccultInterfaceConfig());
}

function parseSequence(value?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const sequence = Number(value);
  if (!Number.isInteger(sequence) || sequence < -1) {
    throw new Error("--after-sequence must be an integer greater than or equal to -1.");
  }
  return sequence;
}

function printReading(reading: OccultReadingDto, json = false): void {
  if (json) {
    console.log(JSON.stringify(reading, null, 2));
    return;
  }
  console.log(`Reading ${reading.reading_id}: ${reading.state}`);
  console.log(`Session ${reading.session_id}; spread ${reading.spread_id}@${reading.spread_version}`);
  for (const node of reading.nodes) {
    const pairing = node.minor_arcana ? `${node.major_arcana} + ${node.minor_arcana}` : node.major_arcana;
    console.log(`- ${node.node_id}: ${pairing} [${node.state}; attempt ${node.attempt}]`);
    if (node.error) {
      console.log(`  ${node.error.code}: ${node.error.message}`);
    }
  }
  console.log(`Next sequence: ${reading.next_sequence}`);
}

async function runWithInterrupt(action: (signal: AbortSignal) => Promise<void>): Promise<void> {
  const controller = new AbortController();
  const abort = () => controller.abort(new Error("Council CLI interrupted"));
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  try {
    await action(controller.signal);
  } finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
  }
}
