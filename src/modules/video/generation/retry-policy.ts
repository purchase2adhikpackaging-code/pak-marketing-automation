import type { VideoProviderError } from "../providers/types";

export type VideoGenerationRetryDecision =
  | { retry: false }
  | { retry: true; delaySeconds: number };

const MAX_EXPENSIVE_ATTEMPTS = 4;
const RETRY_DELAYS_SECONDS = [5, 15, 45] as const;

export function classifyRetry(
  error: Pick<VideoProviderError, "code" | "retryable">,
  attemptNumber: number,
): VideoGenerationRetryDecision {
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) return { retry: false };
  if (!error.retryable) return { retry: false };
  if (error.code === "LTX_SUBMISSION_UNKNOWN") return { retry: false };
  if (attemptNumber >= MAX_EXPENSIVE_ATTEMPTS) return { retry: false };

  const delaySeconds = RETRY_DELAYS_SECONDS[attemptNumber - 1];
  if (delaySeconds === undefined) return { retry: false };
  return { retry: true, delaySeconds };
}
