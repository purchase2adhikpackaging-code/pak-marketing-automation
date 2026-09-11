import type { VideoProviderError } from "../types";

type LtxErrorBody = {
  type?: unknown;
  error?: {
    type?: unknown;
    message?: unknown;
  } | unknown;
};

function isStructuredError(payload: unknown): payload is {
  type: "error";
  error: { type: string; message: string };
} {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as LtxErrorBody;
  return (
    candidate.type === "error" &&
    !!candidate.error &&
    typeof candidate.error === "object" &&
    typeof (candidate.error as { type?: unknown }).type === "string" &&
    typeof (candidate.error as { message?: unknown }).message === "string"
  );
}

const ERROR_MAP: Record<string, { code: string; retryable: boolean }> = {
  invalid_request_error: { code: "LTX_INVALID_REQUEST", retryable: false },
  authentication_error: { code: "LTX_AUTHENTICATION", retryable: false },
  insufficient_funds_error: { code: "LTX_INSUFFICIENT_FUNDS", retryable: false },
  not_found_error: { code: "LTX_NOT_FOUND", retryable: false },
  content_filtered_error: { code: "LTX_CONTENT_FILTERED", retryable: false },
  rate_limit_error: { code: "LTX_RATE_LIMITED", retryable: true },
  concurrency_limit_error: { code: "LTX_RATE_LIMITED", retryable: true },
  api_error: { code: "LTX_API_ERROR", retryable: true },
  service_unavailable: { code: "LTX_SERVICE_UNAVAILABLE", retryable: true },
  overloaded_error: { code: "LTX_OVERLOADED", retryable: true },
};

function fallbackForStatus(status: number): Pick<VideoProviderError, "code" | "retryable"> {
  if (status === 429) return { code: "LTX_RATE_LIMITED", retryable: true };
  if (status === 500) return { code: "LTX_API_ERROR", retryable: true };
  if (status === 503) return { code: "LTX_SERVICE_UNAVAILABLE", retryable: true };
  if (status === 529) return { code: "LTX_OVERLOADED", retryable: true };
  if (status >= 500) return { code: "LTX_API_ERROR", retryable: true };
  return { code: "LTX_RESPONSE_INVALID", retryable: false };
}

export function mapLtxError(status: number, payload: unknown): VideoProviderError {
  if (!isStructuredError(payload)) {
    return {
      code: "LTX_RESPONSE_INVALID",
      message: "LTX returned an invalid error response.",
      retryable: status >= 500 || status === 429,
    };
  }

  const mapped = ERROR_MAP[payload.error.type] ?? fallbackForStatus(status);
  return {
    code: mapped.code,
    message: payload.error.message,
    retryable: mapped.retryable,
  };
}

export class LtxProviderRequestError extends Error {
  readonly providerError: VideoProviderError;

  constructor(providerError: VideoProviderError) {
    super(providerError.message);
    this.name = "LtxProviderRequestError";
    this.providerError = providerError;
  }
}
