import { z } from "zod";

import { OCCULT_CONTRACT_VERSION, routingPolicySchema } from "../../core/occult/contract";
import type { TarotSpreadExecution } from "../../core/occult/spreadScheduler";

const contractVersionSchema = z.literal(OCCULT_CONTRACT_VERSION);
const sessionIdSchema = z.string().trim().min(1, "session_id is required.");
const readingIdSchema = z.string().trim().min(1, "reading_id is required.");

export const occultSpreadPlanSchema = z
  .object({
    session_id: sessionIdSchema,
    spread_id: z.string().trim().min(1),
    spread_version: z.string().trim().min(1),
    idempotency_key: z.string().trim().min(1).max(256),
    deck_id: z.string().trim().min(1).nullable().default(null),
    routing: routingPolicySchema.optional(),
    maximum_parallelism: z.number().int().min(1).max(16).default(1),
    nodes: z
      .array(
        z
          .object({
            node_id: z.string().trim().min(1).max(128),
            agent_id: z.string().trim().min(1).max(256),
            message: z.string().min(1),
            required_capabilities: z.array(z.string()).default(["text"]),
            orientation: z.enum(["upright", "reversed"]).default("upright"),
            requires_approval: z.boolean().default(false),
            maximum_attempts: z.number().int().min(1).max(10).default(2),
            timeout_ms: z.number().int().min(1).max(3_600_000).default(60_000),
          })
          .strict(),
      )
      .min(1),
    dependencies: z
      .array(
        z
          .object({
            source: z.string().trim().min(1),
            target: z.string().trim().min(1),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export const occultCreateSchema = z
  .object({
    contract_version: contractVersionSchema,
    plan: occultSpreadPlanSchema,
  })
  .strict();

export const occultInspectSchema = z
  .object({
    contract_version: contractVersionSchema,
    session_id: sessionIdSchema,
    reading_id: readingIdSchema,
    after_sequence: z.number().int().min(-1).optional(),
  })
  .strict();

export const occultCancelSchema = occultInspectSchema.omit({ after_sequence: true });

export const occultResumeSchema = z
  .object({
    contract_version: contractVersionSchema,
    reading_id: readingIdSchema,
    plan: occultSpreadPlanSchema,
  })
  .strict();

export type OccultCreateParams = z.input<typeof occultCreateSchema>;
export type OccultInspectParams = z.input<typeof occultInspectSchema>;
export type OccultCancelParams = z.input<typeof occultCancelSchema>;
export type OccultResumeParams = z.input<typeof occultResumeSchema>;
export type OccultWireSpreadPlan = z.input<typeof occultSpreadPlanSchema>;

export function mapWireSpreadPlan(input: OccultWireSpreadPlan): TarotSpreadExecution {
  const plan = occultSpreadPlanSchema.parse(input);
  return {
    councilSessionId: plan.session_id,
    spreadId: plan.spread_id,
    spreadVersion: plan.spread_version,
    idempotencyKey: plan.idempotency_key,
    deckId: plan.deck_id,
    routing: plan.routing,
    maximumParallelism: plan.maximum_parallelism,
    nodes: plan.nodes.map((node) => ({
      nodeId: node.node_id,
      agentId: node.agent_id,
      message: node.message,
      requiredCapabilities: node.required_capabilities,
      orientation: node.orientation,
      requiresApproval: node.requires_approval,
      maximumAttempts: node.maximum_attempts,
      timeoutMs: node.timeout_ms,
    })),
    dependencies: plan.dependencies,
  };
}
