import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { loadSummonSettings } from "../../core/config/summonSettings";
import { OCCULT_CONTRACT_VERSION } from "../../core/occult/contract";
import { CouncilServiceImpl } from "../../core/services/council";
import {
  SUPPORTED_SUMMON_AGENTS,
  loadCachedSummonModelsByAgent,
  resolveDefaultSummonAgent,
  summonAgent,
} from "../../core/services/council/summon";
import { FileCouncilStateStore } from "../../core/state/fileStateStore";
import { loadOccultInterfaceConfig } from "../occult/config";
import {
  occultCancelSchema,
  occultCreateSchema,
  occultInspectSchema,
  occultResumeSchema,
  mapWireSpreadPlan,
} from "../occult/protocol";
import type {
  OccultCancelParams,
  OccultCreateParams,
  OccultInspectParams,
  OccultResumeParams,
} from "../occult/protocol";
import { OccultInterfaceService } from "../occult/service";
import type { OccultInterfaceConfig, OccultReadingDto } from "../occult/types";
import {
  mapCloseSessionInput,
  mapCloseCouncilResponse,
  mapGetSessionDataInput,
  mapGetCurrentSessionDataResponse,
  mapSendResponseToSessionInput,
  mapSendResponseResponse,
  mapSummonAgentInput,
  mapSummonAgentResponse,
  mapStartCouncilInput,
  mapStartCouncilResponse,
} from "./mapper";
import type {
  CloseCouncilParams,
  CloseCouncilResponse,
  GetCurrentSessionDataParams,
  GetCurrentSessionDataResponse,
  JoinCouncilParams,
  SendResponseParams,
  SendResponseResponse,
  SummonAgentParams,
  SummonAgentResponse,
  StartCouncilParams,
  StartCouncilResponse,
} from "./dtos/types";

type ResponseFormat = "markdown" | "json";
type ToolName =
  | "start_council"
  | "join_council"
  | "get_current_session_data"
  | "close_council"
  | "occult_cancel_reading_v1"
  | "occult_create_reading_v1"
  | "occult_get_reading_v1"
  | "occult_resume_reading_v1"
  | "send_response"
  | "summon_agent";
type ToolContext = {
  cursor?: string;
  sessionId?: string;
};

export const OCCULT_MCP_TOOL_NAMES = [
  "occult_cancel_reading_v1",
  "occult_create_reading_v1",
  "occult_get_reading_v1",
  "occult_resume_reading_v1",
] as const;

export function getOccultMcpToolNames(enabled: boolean): readonly string[] {
  return enabled ? OCCULT_MCP_TOOL_NAMES : [];
}

const serverInstructions = [
  "If you need feedback from other AI agents, start a council with start_council.",
  "If you are requested to join the council, call join_council with session_id, read the request, and send_response with the same session_id as soon as possible.",
  "Use get_current_session_data with session_id to poll for new responses; pass the cursor returned to fetch only newer messages.",
  "Use close_council with session_id to end that session with a conclusion.",
].join("\n");

const server = new McpServer(
  {
    name: "agents-council",
    version: "0.1.0",
  },
  {
    instructions: serverInstructions,
  },
);

const service = new CouncilServiceImpl(new FileCouncilStateStore());
let occultService: OccultInterfaceService | null = null;
let responseFormat: ResponseFormat = "markdown";
let agentName: string | null = null;
let toolsRegistered = false;

const registerTool = <TParams>(
  name: string,
  config: { description: string; inputSchema: z.ZodTypeAny },
  handler: (params: TParams, extra: { signal?: AbortSignal }) => Promise<CallToolResult> | CallToolResult,
) => {
  (server.registerTool as unknown as (toolName: string, toolConfig: unknown, cb: unknown) => void)(
    name,
    config,
    handler,
  );
};

export async function startMcpServer(
  options: { format?: ResponseFormat; agentName?: string; occultConfig?: OccultInterfaceConfig } = {},
): Promise<void> {
  const format = options.format ?? "markdown";
  if (format !== "markdown" && format !== "json") {
    throw new Error("Unsupported response format. Use 'markdown' or 'json'.");
  }
  responseFormat = format;
  const configuredAgentName = options.agentName?.trim() || null;
  agentName = configuredAgentName;
  const occultConfig = options.occultConfig ?? loadOccultInterfaceConfig();
  occultService = occultConfig.enabled ? new OccultInterfaceService(new FileCouncilStateStore(), occultConfig) : null;
  const supportedModelsByAgent = await loadCachedSummonModelsByAgent();
  registerTools({
    hasDefaultAgentName: configuredAgentName !== null,
    supportedModelsByAgent,
    occultEnabled: occultConfig.enabled,
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Council MCP server running on stdio");
}

function registerTools(options: {
  hasDefaultAgentName: boolean;
  supportedModelsByAgent: Record<string, { value: string; displayName: string; description: string }[]>;
  occultEnabled: boolean;
}): void {
  if (toolsRegistered) {
    return;
  }
  toolsRegistered = true;
  const sessionIdSchema = z.string().trim().min(1, "session_id is required.");

  const startCouncilSchema: z.ZodTypeAny = options.hasDefaultAgentName
    ? z.object({ request: z.string().min(1) }).strict()
    : z
        .object({
          request: z.string().min(1),
          agent_name: z.string().min(1),
        })
        .strict();

  const joinCouncilSchema: z.ZodTypeAny = options.hasDefaultAgentName
    ? z
        .object({
          session_id: sessionIdSchema,
        })
        .strict()
    : z
        .object({
          session_id: sessionIdSchema,
          agent_name: z.string().min(1),
        })
        .strict();

  const getCurrentSessionDataSchema: z.ZodTypeAny = z
    .object({
      session_id: sessionIdSchema,
      cursor: z.string().min(1).optional(),
    })
    .strict();

  const sendResponseSchema: z.ZodTypeAny = z
    .object({
      session_id: sessionIdSchema,
      content: z.string().min(1),
    })
    .strict();

  const closeCouncilSchema: z.ZodTypeAny = z
    .object({
      session_id: sessionIdSchema,
      conclusion: z.string().min(1),
    })
    .strict();

  const modelSchema = z.string().min(1);
  const summonAgentSchema: z.ZodTypeAny = z
    .object({
      agent: z.enum(SUPPORTED_SUMMON_AGENTS),
      model: modelSchema.optional(),
    })
    .superRefine((data, ctx) => {
      if (!data.model) {
        return;
      }
      const models = options.supportedModelsByAgent[data.agent] ?? [];
      if (models.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["model"],
          message: "Model override is unavailable without a cached model list.",
        });
        return;
      }
      if (!models.some((model) => model.value === data.model)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["model"],
          message: "Model is not supported for this agent.",
        });
      }
    })
    .strict();

  const startCouncilDescription = options.hasDefaultAgentName
    ? "Start a new council session and submit your request. Other council members will reply shortly after."
    : "Start a new council session and submit your request. Other council members will reply shortly after. Provide agent_name to identify yourself; the server may append #1, #2, etc. if the name is already taken.";

  registerTool<StartCouncilParams>(
    "start_council",
    {
      description: startCouncilDescription,
      inputSchema: startCouncilSchema,
    },
    async (params) => {
      try {
        const resolvedName = options.hasDefaultAgentName ? agentName : params.agent_name?.trim();
        if (!resolvedName) {
          throw new Error(
            options.hasDefaultAgentName
              ? "Agent name not set for start_council."
              : "agent_name is required for start_council.",
          );
        }
        const result = await service.startCouncil(
          mapStartCouncilInput({ request: params.request, agent_name: resolvedName }),
        );
        const response = mapStartCouncilResponse(result);
        agentName = response.agent_name;
        return toolOk("start_council", response);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  registerTool<GetCurrentSessionDataParams>(
    "get_current_session_data",
    {
      description: "Get request and responses for a specific session_id since the last cursor.",
      inputSchema: getCurrentSessionDataSchema,
    },
    async (params) => {
      try {
        const sessionId = params.session_id?.trim();
        if (!sessionId) {
          throw new Error("session_id is required for get_current_session_data.");
        }
        const resolvedName = agentName;
        if (!resolvedName) {
          throw new Error(
            "get_current_session_data needs a stored agent name. Call join_council (or start_council) once, then retry.",
          );
        }
        const result = await service.getSessionData(
          mapGetSessionDataInput({
            session_id: sessionId,
            cursor: params.cursor,
            agent_name: resolvedName,
          }),
        );
        const response = mapGetCurrentSessionDataResponse(result);
        return toolOk("get_current_session_data", response, {
          sessionId,
          cursor: params.cursor,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  const joinCouncilDescription = options.hasDefaultAgentName
    ? "Join a specific council session via session_id and fetch the request and responses."
    : "Join a specific council session via session_id and fetch the request and responses. Provide agent_name to identify yourself; the server may append #1, #2, etc. if the name is already taken.";

  const modelDescriptions = formatSummonModelDescriptions(options.supportedModelsByAgent);
  const summonAgentDescription = modelDescriptions
    ? `Summon an agent into the active council. agent is required; model is an optional override. Defaults use the last used agent or alphabetical fallback. Available models: ${modelDescriptions}.`
    : "Summon an agent into the active council. agent is required; model is an optional override. Defaults use the last used agent or alphabetical fallback.";

  registerTool<JoinCouncilParams>(
    "join_council",
    {
      description: joinCouncilDescription,
      inputSchema: joinCouncilSchema,
    },
    async (params) => {
      try {
        const sessionId = params.session_id?.trim();
        if (!sessionId) {
          throw new Error("session_id is required for join_council.");
        }
        const resolvedName = options.hasDefaultAgentName ? agentName : params.agent_name?.trim();
        if (!resolvedName) {
          throw new Error(
            options.hasDefaultAgentName
              ? "Agent name not set for join_council."
              : "agent_name is required for join_council.",
          );
        }
        const result = await service.getSessionData(
          mapGetSessionDataInput({
            session_id: sessionId,
            agent_name: resolvedName,
          }),
        );
        const response = mapGetCurrentSessionDataResponse(result);
        agentName = response.agent_name;
        return toolOk("join_council", response, {
          sessionId,
          cursor: undefined,
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  registerTool<CloseCouncilParams>(
    "close_council",
    {
      description: "Close a specific council session with a conclusion.",
      inputSchema: closeCouncilSchema,
    },
    async (params) => {
      try {
        const sessionId = params.session_id?.trim();
        if (!sessionId) {
          throw new Error("session_id is required for close_council.");
        }
        const resolvedName = agentName;
        if (!resolvedName) {
          throw new Error("Agent name not set for close_council. Call start_council or join_council first.");
        }
        const result = await service.closeSession(
          mapCloseSessionInput({
            session_id: sessionId,
            conclusion: params.conclusion,
            agent_name: resolvedName,
          }),
        );
        const response = mapCloseCouncilResponse(result);
        return toolOk("close_council", response, { sessionId });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  registerTool<SendResponseParams>(
    "send_response",
    {
      description: "Send a response for a specific session_id.",
      inputSchema: sendResponseSchema,
    },
    async (params) => {
      try {
        const sessionId = params.session_id?.trim();
        if (!sessionId) {
          throw new Error("session_id is required for send_response.");
        }
        const resolvedName = agentName;
        if (!resolvedName) {
          throw new Error(
            "send_response needs a stored agent name. Call join_council (or start_council) once, then retry.",
          );
        }
        const result = await service.sendResponseToSession(
          mapSendResponseToSessionInput({
            session_id: sessionId,
            content: params.content,
            agent_name: resolvedName,
          }),
        );
        const response = mapSendResponseResponse(result);
        return toolOk("send_response", response, { sessionId });
      } catch (error) {
        return toolError(error);
      }
    },
  );

  registerTool<SummonAgentParams>(
    "summon_agent",
    {
      description: summonAgentDescription,
      inputSchema: summonAgentSchema,
    },
    async (params) => {
      try {
        const settings = await loadSummonSettings();
        const defaultAgent = resolveDefaultSummonAgent(settings.lastUsedAgent, SUPPORTED_SUMMON_AGENTS);
        const resolvedAgent = params.agent || defaultAgent;
        const result = await summonAgent(
          mapSummonAgentInput({
            agent: resolvedAgent,
            model: params.model,
          }),
        );
        const response = mapSummonAgentResponse(result);
        return toolOk("summon_agent", response);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  if (getOccultMcpToolNames(options.occultEnabled).length > 0) {
    registerOccultTools();
  }
}

function registerOccultTools(): void {
  registerTool<OccultCreateParams>(
    "occult_create_reading_v1",
    {
      description:
        "Create or idempotently replay an Occult v1 Tarot reading in a Council session. The caller must already be joined to the session.",
      inputSchema: occultCreateSchema,
    },
    async (params, extra) => {
      try {
        const runtime = requireOccultService();
        const resolvedName = requireOccultAgentName();
        const response = await runtime.execute({
          contractVersion: params.contract_version,
          agentName: resolvedName,
          plan: mapWireSpreadPlan(params.plan),
          signal: extra.signal,
        });
        return toolOk("occult_create_reading_v1", response);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  registerTool<OccultInspectParams>(
    "occult_get_reading_v1",
    {
      description: "Inspect sanitized Occult v1 reading progress. Pass after_sequence to receive only newer events.",
      inputSchema: occultInspectSchema,
    },
    async (params) => {
      try {
        const response = await requireOccultService().inspect({
          contractVersion: params.contract_version,
          agentName: requireOccultAgentName(),
          sessionId: params.session_id,
          readingId: params.reading_id,
          afterSequence: params.after_sequence,
        });
        return toolOk("occult_get_reading_v1", response);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  registerTool<OccultCancelParams>(
    "occult_cancel_reading_v1",
    {
      description: "Cancel a running Occult v1 reading in a Council session.",
      inputSchema: occultCancelSchema,
    },
    async (params) => {
      try {
        const response = await requireOccultService().cancel({
          contractVersion: params.contract_version,
          agentName: requireOccultAgentName(),
          sessionId: params.session_id,
          readingId: params.reading_id,
        });
        return toolOk("occult_cancel_reading_v1", response);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  registerTool<OccultResumeParams>(
    "occult_resume_reading_v1",
    {
      description:
        "Resume an interrupted or approval-paused Occult v1 reading using the same full spread plan and reading id.",
      inputSchema: occultResumeSchema,
    },
    async (params, extra) => {
      try {
        const response = await requireOccultService().execute({
          contractVersion: params.contract_version,
          agentName: requireOccultAgentName(),
          plan: mapWireSpreadPlan(params.plan),
          expectedReadingId: params.reading_id,
          signal: extra.signal,
        });
        return toolOk("occult_resume_reading_v1", response);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}

function requireOccultService(): OccultInterfaceService {
  if (!occultService) {
    throw new Error("Occult interfaces are disabled.");
  }
  return occultService;
}

function requireOccultAgentName(): string {
  if (!agentName) {
    throw new Error("Join the targeted Council session before using Occult tools.");
  }
  return agentName;
}

function formatSummonModelDescriptions(
  modelsByAgent: Record<string, { value: string; displayName: string; description: string }[]>,
): string {
  const segments = Object.entries(modelsByAgent)
    .filter(([, models]) => models.length > 0)
    .map(([agent, models]) => {
      const entries = models.map((model) => `${model.value}: ${model.description || model.displayName}`).join(", ");
      return `${agent}: ${entries}`;
    });

  return segments.join(" | ");
}

function toolOk<T extends Record<string, unknown>>(
  toolName: ToolName,
  payload: T,
  context: ToolContext = {},
): CallToolResult {
  const content = [
    {
      type: "text" as const,
      text: formatToolText(toolName, payload, context),
    },
  ];

  return {
    content,
    structuredContent: payload,
  };
}

function toolError(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : "Unknown error";
  const content = [
    {
      type: "text" as const,
      text: message,
    },
  ];

  return {
    content,
    isError: true,
  };
}

function formatToolText(toolName: ToolName, payload: unknown, context: ToolContext): string {
  if (responseFormat === "json") {
    return JSON.stringify(payload, null, 2);
  }

  switch (toolName) {
    case "start_council":
      return formatStartCouncil(payload as StartCouncilResponse);
    case "get_current_session_data":
      return formatGetCurrentSessionData(payload as GetCurrentSessionDataResponse, context);
    case "join_council":
      return formatJoinCouncil(payload as GetCurrentSessionDataResponse);
    case "close_council":
      return formatCloseCouncil(payload as CloseCouncilResponse);
    case "occult_cancel_reading_v1":
    case "occult_create_reading_v1":
    case "occult_get_reading_v1":
    case "occult_resume_reading_v1":
      return formatOccultReading(payload as OccultReadingDto);
    case "send_response":
      return formatSendResponse(payload as SendResponseResponse);
    case "summon_agent":
      return formatSummonAgent(payload as SummonAgentResponse);
    default: {
      const _exhaustive: never = toolName;
      return _exhaustive;
    }
  }
}

function formatOccultReading(reading: OccultReadingDto): string {
  const lines = [
    `Occult contract: ${OCCULT_CONTRACT_VERSION}`,
    `Reading: ${reading.reading_id}`,
    `Session: ${reading.session_id}`,
    `Spread: ${reading.spread_id}@${reading.spread_version}`,
    `State: ${reading.state}`,
    `Next sequence: ${reading.next_sequence}`,
  ];
  for (const node of reading.nodes) {
    const pairing = node.minor_arcana ? `${node.major_arcana} + ${node.minor_arcana}` : node.major_arcana;
    lines.push(`- ${node.node_id}: ${pairing} [${node.state}, attempt ${node.attempt}]`);
    if (node.error) {
      lines.push(`  Error ${node.error.code}: ${node.error.message}`);
    }
  }
  if (reading.approvals.some((approval) => approval.state === "pending")) {
    lines.push("Waiting for human approval.");
  }
  return lines.join("\n");
}

function formatStartCouncil(response: StartCouncilResponse): string {
  return [
    "Your request is received. Return anon for replies, and look again in a few seconds.",
    `Your assigned name is: ${response.agent_name}`,
  ].join("\n");
}

function formatJoinCouncil(response: GetCurrentSessionDataResponse): string {
  const request = response.request;
  const requestAuthor = request?.created_by ?? "none";
  const requestContent = request?.content ?? "none";

  return [
    `Welcome to this council session ${response.agent_name}.`,
    `Session: ${response.session_id}`,
    `We are gathered to weigh a matter set forth by ${requestAuthor}.`,
    "Request:",
    requestContent,
    "---",
    "What say you, and with haste?",
  ].join("\n");
}

function formatGetCurrentSessionData(response: GetCurrentSessionDataResponse, context: ToolContext): string {
  const request = response.request;
  const requestAuthor = request?.created_by ?? "none";
  const requestContent = request?.content ?? "none";
  const sessionStatus = response.state.session?.status;
  const conclusion = response.state.session?.conclusion;
  if (sessionStatus === "closed") {
    const conclusionAuthor = conclusion?.author ?? "none";
    const conclusionContent = conclusion?.content ?? "none";
    return [
      `Session: ${response.session_id}`,
      `The council was convened by ${requestAuthor}.`,
      `Request: ${requestContent}`,
      "---",
      `The council is ended, spoken by ${conclusionAuthor}.`,
      `Conclusion: ${conclusionContent}`,
    ].join("\n");
  }

  const cursorLabel = context.cursor ?? "start";
  const cursorToken = response.next_cursor ?? "none";
  const lines = [
    `Session: ${response.session_id}`,
    `The council was convened by ${requestAuthor}.`,
    `Request: ${requestContent}`,
    "---",
    `Messages (from ${cursorLabel}):`,
    "",
  ];

  response.feedback.forEach((entry) => {
    lines.push(entry.author);
    lines.push(`Response: ${entry.content}`);
    lines.push("---");
  });

  if (response.pending_participants.length > 0) {
    lines.push(`Awaiting response from: ${response.pending_participants.join(", ")}`);
    lines.push("");
  }

  lines.push("No further replies are heard for now. Return anon for more.");
  lines.push(`To hear only new replies, use the cursor: ${cursorToken}`);
  return lines.join("\n");
}

function formatCloseCouncil(response: CloseCouncilResponse): string {
  return [`The council is ended, and the matter is sealed.`, `Session: ${response.session_id}`].join("\n");
}

function formatSendResponse(response: SendResponseResponse): string {
  return [
    "Your reply is set down.",
    `Your assigned name is: ${response.agent_name}`,
    `Session: ${response.session_id}`,
  ].join("\n");
}

function formatSummonAgent(response: SummonAgentResponse): string {
  const lines = ["The summoned agent has responded.", `Agent: ${response.agent}`];
  if (response.model) {
    lines.push(`Model: ${response.model}`);
  }
  lines.push(`Response: ${response.feedback.content}`);
  return lines.join("\n");
}
