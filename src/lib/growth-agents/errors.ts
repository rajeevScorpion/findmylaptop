import "server-only";

export const AGENT_ERROR_CODES = [
  "SOURCE_AUTH_ERROR",
  "SOURCE_RATE_LIMITED",
  "SOURCE_UNAVAILABLE",
  "PRODUCT_NORMALIZATION_FAILED",
  "COMPLIANCE_BLOCKED",
  "LLM_GENERATION_FAILED",
  "ADMIN_APPROVAL_REQUIRED",
  "AFFILIATE_RESOLUTION_FAILED",
  "CONFIGURATION_ERROR",
  "DATABASE_ERROR",
  "CONFLICT",
  "NOT_FOUND",
  "VALIDATION_ERROR",
] as const;

export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[number];

export type AgentErrorDetails = Readonly<Record<string, unknown>>;

export interface AgentErrorOptions {
  code: AgentErrorCode;
  message: string;
  retryable?: boolean;
  details?: AgentErrorDetails;
  cause?: unknown;
}

/**
 * A typed, server-side operational error. Details must remain free of secrets,
 * credentials, raw marketplace payloads, and private user content.
 */
export class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly retryable: boolean;
  readonly details?: AgentErrorDetails;
  readonly cause?: unknown;

  constructor(options: AgentErrorOptions) {
    super(options.message);
    this.name = "AgentError";
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    this.cause = options.cause;
  }
}

export function isAgentError(error: unknown): error is AgentError {
  return error instanceof AgentError;
}

export function toAgentError(
  error: unknown,
  fallback: Omit<AgentErrorOptions, "cause"> = {
    code: "DATABASE_ERROR",
    message: "The growth-agent operation failed.",
    retryable: true,
  }
): AgentError {
  if (isAgentError(error)) return error;
  return new AgentError({ ...fallback, cause: error });
}

export function getAgentErrorHttpStatus(error: AgentError): number {
  switch (error.code) {
    case "VALIDATION_ERROR":
      return 400;
    case "ADMIN_APPROVAL_REQUIRED":
    case "COMPLIANCE_BLOCKED":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
    case "CONFIGURATION_ERROR":
      return 409;
    case "SOURCE_RATE_LIMITED":
      return 429;
    case "SOURCE_AUTH_ERROR":
    case "SOURCE_UNAVAILABLE":
    case "PRODUCT_NORMALIZATION_FAILED":
    case "LLM_GENERATION_FAILED":
    case "AFFILIATE_RESOLUTION_FAILED":
      return 502;
    case "DATABASE_ERROR":
    default:
      return 500;
  }
}
