import { z } from "zod";

import {
  OCCULT_CONTRACT_VERSION,
  occultErrorSchema,
  type occultInvocationSchema,
  rejectOccultSecretFields,
  routeSummarySchema,
  validateOccultInvocation,
  validateRouteSummary,
} from "./contract";
import type { OccultError, OccultInvocation, RouteSummary } from "./contract";

const bridgeArtifactSchema = z.strictObject({
  artifact_id: z.string().min(1),
  name: z.string().min(1),
  media_type: z.string().min(1),
  uri: z.string().min(1),
});

const bridgeResponseSchema = z.strictObject({
  contract_version: z.literal(OCCULT_CONTRACT_VERSION),
  invocation_id: z.string().min(1).max(128),
  status: z.enum(["completed", "failed"]),
  summary: z.string(),
  route_summary: routeSummarySchema.nullable(),
  artifacts: z.array(bridgeArtifactSchema).default([]),
  error: occultErrorSchema.nullable(),
});

export type HermesBridgeArtifact = z.infer<typeof bridgeArtifactSchema>;

export type HermesBridgeResult = {
  invocation: OccultInvocation;
  summary: string;
  routeSummary: RouteSummary;
  artifacts: HermesBridgeArtifact[];
};

export type HermesBridgeInvokeOptions = {
  signal: AbortSignal;
};

export interface HermesOccultBridge {
  readonly contractVersion: typeof OCCULT_CONTRACT_VERSION;
  invoke(invocation: OccultInvocation, options: HermesBridgeInvokeOptions): Promise<HermesBridgeResult>;
}

export class HermesBridgeError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }

  toOccultError(): OccultError {
    return {
      contract_version: OCCULT_CONTRACT_VERSION,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      redacted: true,
    };
  }
}

export type HttpHermesBridgeOptions = {
  baseUrl: string;
  serviceToken?: string;
  fetch?: typeof globalThis.fetch;
};

export class HttpHermesOccultBridge implements HermesOccultBridge {
  readonly contractVersion = OCCULT_CONTRACT_VERSION;
  private readonly endpoint: URL;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(private readonly options: HttpHermesBridgeOptions) {
    this.endpoint = new URL("/v1/occult/invoke", requireHttpUrl(options.baseUrl));
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  async invoke(invocation: OccultInvocation, options: HermesBridgeInvokeOptions): Promise<HermesBridgeResult> {
    const payload = validateOccultInvocation(invocation);
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.options.serviceToken ? { authorization: `Bearer ${this.options.serviceToken}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: options.signal,
      });
    } catch (error) {
      if (options.signal.aborted) {
        throw new HermesBridgeError("Hermes invocation was cancelled or timed out.", "HERMES_TIMEOUT", true, {
          cause: error,
        });
      }
      throw new HermesBridgeError("Hermes bridge is unavailable.", "HERMES_UNAVAILABLE", true, { cause: error });
    }

    const body = await parseJsonResponse(response);
    const parsed = parseBridgeResponse(body);
    if (parsed.invocation_id !== payload.invocation_id) {
      throw new HermesBridgeError("Hermes returned a mismatched invocation id.", "HERMES_PROTOCOL_ERROR", false);
    }
    if (!response.ok || parsed.status === "failed") {
      const error =
        parsed.error ??
        ({
          contract_version: OCCULT_CONTRACT_VERSION,
          code: "HERMES_REJECTED",
          message: `Hermes rejected the invocation with HTTP ${response.status}.`,
          retryable: response.status >= 500,
          redacted: true,
        } satisfies OccultError);
      throw new HermesBridgeError(error.message, error.code, error.retryable);
    }
    if (!parsed.route_summary) {
      throw new HermesBridgeError("Hermes completed without a route summary.", "HERMES_PROTOCOL_ERROR", false);
    }
    if (parsed.route_summary.invocation_id !== payload.invocation_id) {
      throw new HermesBridgeError("Hermes returned a mismatched route summary.", "HERMES_PROTOCOL_ERROR", false);
    }

    return {
      invocation: payload,
      summary: parsed.summary,
      routeSummary: validateRouteSummary(parsed.route_summary),
      artifacts: parsed.artifacts,
    };
  }
}

export function parseBridgeResponse(payload: unknown): z.output<typeof bridgeResponseSchema> {
  rejectOccultSecretFields(payload);
  const result = bridgeResponseSchema.safeParse(payload);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.map(String).join(".") || "payload")),
    ].sort();
    throw new HermesBridgeError(
      `Hermes returned invalid bridge fields: ${fields.join(", ")}`,
      "HERMES_PROTOCOL_ERROR",
      false,
    );
  }
  if (result.data.status === "completed" && result.data.error) {
    throw new HermesBridgeError("Hermes completed response cannot include an error.", "HERMES_PROTOCOL_ERROR", false);
  }
  if (result.data.status === "failed" && !result.data.error) {
    throw new HermesBridgeError("Hermes failed response must include an error.", "HERMES_PROTOCOL_ERROR", false);
  }
  return result.data;
}

export function createOccultInvocation(input: z.input<typeof occultInvocationSchema>): OccultInvocation {
  return validateOccultInvocation(input);
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (!response.ok) {
      throw new HermesBridgeError(
        `Hermes bridge returned HTTP ${response.status}.`,
        "HERMES_UNAVAILABLE",
        response.status === 429 || response.status >= 500,
        { cause: error },
      );
    }
    throw new HermesBridgeError("Hermes returned a non-JSON response.", "HERMES_PROTOCOL_ERROR", false, {
      cause: error,
    });
  }
}

function requireHttpUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Hermes bridge URL must use http or https.");
  }
  return url;
}
