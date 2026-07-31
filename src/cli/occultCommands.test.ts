import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import { registerOccultCliCommands } from "./occultCommands";

describe("Tarot Router CLI compatibility", () => {
  test("uses tarot as the public command and retains occult as an alias", () => {
    const program = new Command();

    registerOccultCliCommands(program);

    const tarot = program.commands.find((command) => command.name() === "tarot");
    expect(tarot).toBeDefined();
    expect(tarot?.aliases()).toContain("occult");
    expect(tarot?.commands.map((command) => command.name())).toEqual(["create", "inspect", "cancel", "resume"]);
  });
});
