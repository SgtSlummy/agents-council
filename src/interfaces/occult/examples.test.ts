import { describe, expect, test } from "bun:test";

import { occultSpreadPlanSchema } from "./protocol";

describe("Occult example spreads", () => {
  for (const name of ["production-build", "three-card", "full-major-arcana"]) {
    test(`${name} matches the public wire contract`, async () => {
      const input = await Bun.file(`examples/occult/${name}.json`).json();
      const parsed = occultSpreadPlanSchema.parse(input);

      expect(parsed.routing?.local_only).toBe(true);
      expect(parsed.routing?.free_only).toBe(true);
      expect(parsed.routing?.maximum_cost_usd).toBe(0);
      expect(parsed.nodes.every((node) => !node.requires_approval)).toBe(true);
      if (name === "full-major-arcana") {
        expect(parsed.maximum_parallelism).toBe(4);
        expect(parsed.nodes.filter((node) => node.agent_id.startsWith("occult.major.")).length).toBeGreaterThanOrEqual(
          22,
        );
      }
    });
  }
});
