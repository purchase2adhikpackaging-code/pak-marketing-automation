const SAFE_ERROR_CODE_RE = /^[A-Z0-9_]{1,96}$/;

type WorkerLogError = {
  code: string;
  retryable: boolean;
};

export function safeWorkerLogError(error: unknown): WorkerLogError {
  if (!error || typeof error !== "object") {
    return { code: "WORKER_INTERNAL", retryable: true };
  }

  const record = error as Record<string, unknown>;
  const code = typeof record.code === "string" && SAFE_ERROR_CODE_RE.test(record.code)
    ? record.code
    : "WORKER_INTERNAL";
  const retryable = typeof record.retryable === "boolean" ? record.retryable : true;

  return { code, retryable };
}
