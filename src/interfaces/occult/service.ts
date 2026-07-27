import type { CouncilState } from "../../core/services/council/types";
import { OCCULT_CONTRACT_VERSION } from "../../core/occult/contract";
import type { HermesOccultBridge } from "../../core/occult/hermesBridge";
import { HttpHermesOccultBridge } from "../../core/occult/hermesBridge";
import { OccultReadingService } from "../../core/occult/readingState";
import type { OccultReading } from "../../core/occult/readingTypes";
import { TarotSpreadScheduler, validateTarotSpreadExecution } from "../../core/occult/spreadScheduler";
import type { CouncilStateStore } from "../../core/state/store";
import type {
  OccultCancelRequest,
  OccultErrorDto,
  OccultExecutionRequest,
  OccultInspectRequest,
  OccultInterfaceConfig,
  OccultReadingDto,
  OccultStatusResponse,
} from "./types";

export class OccultInterfaceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "OCCULT_CONFIGURATION_ERROR"
      | "OCCULT_DISABLED"
      | "OCCULT_FORBIDDEN"
      | "OCCULT_READING_MISMATCH"
      | "OCCULT_SESSION_CLOSED"
      | "OCCULT_SESSION_NOT_FOUND"
      | "OCCULT_VERSION_MISMATCH",
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export type OccultBridgeFactory = () => HermesOccultBridge;

export class OccultInterfaceService {
  private readonly readings: OccultReadingService;

  constructor(
    private readonly store: CouncilStateStore,
    private readonly config: OccultInterfaceConfig,
    private readonly bridgeFactory: OccultBridgeFactory = () => this.createHttpBridge(),
  ) {
    this.readings = new OccultReadingService(store);
  }

  async status(agentName: string, sessionId?: string): Promise<OccultStatusResponse> {
    if (!this.config.enabled) {
      return {
        contract_version: OCCULT_CONTRACT_VERSION,
        enabled: false,
        session_id: sessionId ?? null,
        readings: [],
      };
    }
    const state = await this.store.load();
    const resolvedSessionId = sessionId ?? state.activeSessionId;
    if (!resolvedSessionId) {
      return {
        contract_version: OCCULT_CONTRACT_VERSION,
        enabled: true,
        session_id: null,
        readings: [],
      };
    }
    assertAuthorized(state, resolvedSessionId, agentName);
    return {
      contract_version: OCCULT_CONTRACT_VERSION,
      enabled: true,
      session_id: resolvedSessionId,
      readings: state.occultReadings
        .filter((reading) => reading.councilSessionId === resolvedSessionId)
        .map((reading) => mapReading(reading)),
    };
  }

  async execute(request: OccultExecutionRequest): Promise<OccultReadingDto> {
    this.requireEnabled();
    requireContractVersion(request.contractVersion);
    const plan = validateTarotSpreadExecution(request.plan);
    const state = await this.store.load();
    const session = assertAuthorized(state, plan.councilSessionId, request.agentName);
    if (session.status !== "active") {
      throw new OccultInterfaceError("Occult readings require an active Council session.", "OCCULT_SESSION_CLOSED");
    }
    if (request.expectedReadingId) {
      const expected = state.occultReadings.find((reading) => reading.id === request.expectedReadingId);
      if (!expected || expected.councilSessionId !== plan.councilSessionId) {
        throw new OccultInterfaceError(
          "The requested Occult reading does not belong to this Council session.",
          "OCCULT_READING_MISMATCH",
        );
      }
    }

    const scheduler = new TarotSpreadScheduler(this.readings, this.bridgeFactory());
    const reading = await scheduler.execute(plan, request.signal);
    if (request.expectedReadingId && reading.id !== request.expectedReadingId) {
      throw new OccultInterfaceError(
        "The supplied spread plan does not resume the requested Occult reading.",
        "OCCULT_READING_MISMATCH",
      );
    }
    return mapReading(reading);
  }

  async inspect(request: OccultInspectRequest): Promise<OccultReadingDto> {
    this.requireEnabled();
    requireContractVersion(request.contractVersion);
    const state = await this.store.load();
    assertAuthorized(state, request.sessionId, request.agentName);
    const reading = requireReading(state, request.sessionId, request.readingId);
    return mapReading(reading, request.afterSequence);
  }

  async cancel(request: OccultCancelRequest): Promise<OccultReadingDto> {
    this.requireEnabled();
    requireContractVersion(request.contractVersion);
    const state = await this.store.load();
    assertAuthorized(state, request.sessionId, request.agentName);
    const reading = requireReading(state, request.sessionId, request.readingId);
    if (reading.state !== "running") {
      return mapReading(reading);
    }
    const cancelled = await this.readings.finishReading(
      reading.id,
      "cancelled",
      "Tarot spread cancelled through a Council interface.",
      {
        contract_version: OCCULT_CONTRACT_VERSION,
        code: "READING_CANCELLED",
        message: "Reading cancelled by an authorized Council participant.",
        retryable: false,
        redacted: true,
      },
    );
    return mapReading(cancelled);
  }

  private requireEnabled(): void {
    if (!this.config.enabled) {
      throw new OccultInterfaceError(
        "Occult interfaces are disabled. Set OCCULT_ENABLED=true to enable them.",
        "OCCULT_DISABLED",
      );
    }
  }

  private createHttpBridge(): HermesOccultBridge {
    if (!this.config.hermesBaseUrl) {
      throw new OccultInterfaceError(
        "OCCULT_HERMES_URL is required for reading creation or resume.",
        "OCCULT_CONFIGURATION_ERROR",
      );
    }
    return new HttpHermesOccultBridge({
      baseUrl: this.config.hermesBaseUrl,
      serviceToken: this.config.hermesServiceToken ?? undefined,
    });
  }
}

function requireContractVersion(version: string): void {
  if (version !== OCCULT_CONTRACT_VERSION) {
    throw new OccultInterfaceError(
      `Occult contract version mismatch: expected '${OCCULT_CONTRACT_VERSION}'.`,
      "OCCULT_VERSION_MISMATCH",
    );
  }
}

function assertAuthorized(state: CouncilState, sessionId: string, agentName: string) {
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) {
    throw new OccultInterfaceError("Council session not found.", "OCCULT_SESSION_NOT_FOUND");
  }
  const authorized = state.participants.some(
    (participant) => participant.sessionId === sessionId && participant.agentName === agentName,
  );
  if (!authorized) {
    throw new OccultInterfaceError(
      "Join the targeted Council session before accessing its Occult readings.",
      "OCCULT_FORBIDDEN",
    );
  }
  return session;
}

function requireReading(state: CouncilState, sessionId: string, readingId: string): OccultReading {
  const reading = state.occultReadings.find(
    (candidate) => candidate.id === readingId && candidate.councilSessionId === sessionId,
  );
  if (!reading) {
    throw new OccultInterfaceError(
      "The requested Occult reading does not belong to this Council session.",
      "OCCULT_READING_MISMATCH",
    );
  }
  return reading;
}

export function mapReading(reading: OccultReading, afterSequence = -1): OccultReadingDto {
  if (!Number.isInteger(afterSequence) || afterSequence < -1) {
    throw new Error("after_sequence must be an integer greater than or equal to -1.");
  }
  const routesByNode = new Map(
    reading.events
      .filter((event) => event.event_type === "route.selected")
      .flatMap((event) => {
        const nodeId = typeof event.data.node_id === "string" ? event.data.node_id : null;
        const invocationId = typeof event.data.invocation_id === "string" ? event.data.invocation_id : null;
        const route = invocationId
          ? reading.routeSummaries.find((summary) => summary.invocation_id === invocationId)
          : undefined;
        return nodeId && route ? [[nodeId, route] as const] : [];
      }),
  );
  const nodeErrors = new Map(
    reading.events
      .filter((event) => event.event_type === "node.failed" && event.error)
      .flatMap((event) => {
        const nodeId = typeof event.data.node_id === "string" ? event.data.node_id : null;
        return nodeId && event.error ? [[nodeId, mapError(event.error)] as const] : [];
      }),
  );

  return {
    contract_version: OCCULT_CONTRACT_VERSION,
    reading_id: reading.id,
    session_id: reading.councilSessionId,
    spread_id: reading.spreadId,
    spread_version: reading.spreadVersion,
    state: reading.state,
    created_at: reading.createdAt,
    updated_at: reading.updatedAt,
    next_sequence: reading.nextSequence,
    nodes: reading.nodes.map((node) => {
      const route = routesByNode.get(node.nodeId);
      return {
        node_id: node.nodeId,
        major_arcana: node.agentId,
        minor_arcana: route?.selected_card_id ?? null,
        provider_id: route?.provider_id ?? null,
        model_id: route?.model_id ?? null,
        state: node.state,
        attempt: node.attempt,
        started_at: node.startedAt,
        completed_at: node.completedAt,
        error: nodeErrors.get(node.nodeId) ?? null,
      };
    }),
    approvals: reading.approvals.map((approval) => ({
      approval_id: approval.approvalId,
      node_id: approval.nodeId,
      state: approval.state,
      requested_at: approval.requestedAt,
      resolved_at: approval.resolvedAt,
      resolved_by: approval.resolvedBy,
    })),
    events: reading.events
      .filter((event) => event.sequence > afterSequence)
      .map((event) => ({
        sequence: event.sequence,
        event_type: event.event_type,
        occurred_at: event.occurred_at,
        node_id: typeof event.data.node_id === "string" ? event.data.node_id : null,
        error: event.error ? mapError(event.error) : null,
      })),
    outcome_error: reading.outcome?.error ? mapError(reading.outcome.error) : null,
  };
}

function mapError(error: { code: string; message: string; retryable: boolean; redacted: true }): OccultErrorDto {
  return {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    redacted: true,
  };
}
