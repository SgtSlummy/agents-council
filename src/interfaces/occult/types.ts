import type { OccultReadingState } from "../../core/occult/readingTypes";
import type { TarotSpreadExecution } from "../../core/occult/spreadScheduler";

export type OccultInterfaceConfig = {
  enabled: boolean;
  hermesBaseUrl: string | null;
  hermesServiceToken: string | null;
};

export type OccultReadingNodeDto = {
  node_id: string;
  major_arcana: string;
  minor_arcana: string | null;
  provider_id: string | null;
  model_id: string | null;
  state: "cancelled" | "completed" | "failed" | "pending" | "running";
  attempt: number;
  started_at: string | null;
  completed_at: string | null;
  error: OccultErrorDto | null;
};

export type OccultApprovalDto = {
  approval_id: string;
  node_id: string;
  state: "approved" | "pending" | "rejected";
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type OccultErrorDto = {
  code: string;
  message: string;
  retryable: boolean;
  redacted: true;
};

export type OccultEventDto = {
  sequence: number;
  event_type:
    | "node.completed"
    | "node.failed"
    | "node.started"
    | "reading.cancelled"
    | "reading.completed"
    | "reading.failed"
    | "reading.started"
    | "route.selected";
  occurred_at: string;
  node_id: string | null;
  error: OccultErrorDto | null;
};

export type OccultReadingDto = {
  contract_version: "1.0.0";
  reading_id: string;
  session_id: string;
  spread_id: string;
  spread_version: string;
  state: OccultReadingState;
  created_at: string;
  updated_at: string;
  next_sequence: number;
  nodes: OccultReadingNodeDto[];
  approvals: OccultApprovalDto[];
  events: OccultEventDto[];
  outcome_error: OccultErrorDto | null;
};

export type OccultStatusResponse = {
  contract_version: "1.0.0";
  enabled: boolean;
  session_id: string | null;
  readings: OccultReadingDto[];
};

export type OccultExecutionRequest = {
  contractVersion: string;
  agentName: string;
  plan: TarotSpreadExecution;
  expectedReadingId?: string;
  signal?: AbortSignal;
};

export type OccultInspectRequest = {
  contractVersion: string;
  agentName: string;
  sessionId: string;
  readingId: string;
  afterSequence?: number;
};

export type OccultCancelRequest = Omit<OccultInspectRequest, "afterSequence">;
