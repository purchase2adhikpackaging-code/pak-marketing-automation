import type { VideoProviderError } from "../providers/types";

export type VideoGenerationRetryDecision =
  | { retry: false }
  | { retry: true; delaySeconds: number };

const MAX_EXPENSIVE_ATTEMPTS = 4;
const BASE_DELAY_SECONDS = 15;
const MAX_DELAY_SECONDS = 300;

export function classifyRetry(
  error: Pick<VideoProviderError, "code" | "retryable">,
  attemptNumber: number,
): VideoGenerationRetryDecision {
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) return { retry: false };
  if (!error.retryable) return { retry: false };
  if (error.code === "LTX_SUBMISSION_UNKNOWN") return { retry: false };
  if (attemptNumber >= MAX_EXPENSIVE_ATTEMPTS) return { retry: false };

  const delaySeconds = Math.min(
    MAX_DELAY_SECONDS,
    BASE_DELAY_SECONDS * 2 ** (attemptNumber - 1),
  );
  return { retry: true, delaySeconds };
}
