import type { VideoGenerationAttemptState } from "./types";

const ALLOWED_TRANSITIONS: Record<VideoGenerationAttemptState, readonly VideoGenerationAttemptState[]> = {
  QUEUED: ["SUBMITTING", "CANCELLED"],
  SUBMITTING: ["SUBMITTED", "FAILED", "SUBMISSION_UNKNOWN", "CANCELLED"],
  SUBMITTED: ["PROCESSING", "IMPORT_PENDING", "FAILED", "CANCELLED"],
  PROCESSING: ["PROCESSING", "IMPORT_PENDING", "FAILED", "CANCELLED"],
  IMPORT_PENDING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  SUBMISSION_UNKNOWN: [],
};

export function canTransitionVideoGenerationAttempt(
  from: VideoGenerationAttemptState,
  to: VideoGenerationAttemptState,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
