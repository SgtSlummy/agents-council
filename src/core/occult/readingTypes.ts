import type { OccultError, ReadingEvent, RouteSummary } from "./contract";

export type OccultReadingState = "cancelled" | "completed" | "failed" | "running";
export type OccultReadingNodeState = "cancelled" | "completed" | "failed" | "pending" | "running";
export type OccultApprovalState = "approved" | "pending" | "rejected";

export type OccultReadingNode = {
  nodeId: string;
  agentId: string;
  state: OccultReadingNodeState;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
};

export type OccultReadingApproval = {
  approvalId: string;
  nodeId: string;
  state: OccultApprovalState;
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

export type OccultReadingArtifact = {
  artifactId: string;
  nodeId: string;
  name: string;
  mediaType: string;
  uri: string;
  createdAt: string;
};

export type OccultReadingOutcome = {
  state: "cancelled" | "completed" | "failed";
  completedAt: string;
  summary: string | null;
  error: OccultError | null;
};

export type OccultReading = {
  id: string;
  councilSessionId: string;
  contractVersion: "1.0.0";
  spreadId: string;
  spreadVersion: string;
  idempotencyKey: string;
  idempotencyFingerprint: string;
  state: OccultReadingState;
  createdAt: string;
  updatedAt: string;
  nextSequence: number;
  nodes: OccultReadingNode[];
  events: ReadingEvent[];
  routeSummaries: RouteSummary[];
  approvals: OccultReadingApproval[];
  artifacts: OccultReadingArtifact[];
  outcome: OccultReadingOutcome | null;
};
