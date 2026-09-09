import type { JobState } from "./types";

const ALLOWED_TRANSITIONS: Readonly<Record<JobState, readonly JobState[]>> = {
  QUEUED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: ["RETRYING", "CANCELLED"],
  RETRYING: ["QUEUED", "CANCELLED"],
  CANCELLED: [],
};

export function canTransitionJobState(from: JobState, to: JobState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertJobStateTransition(from: JobState, to: JobState): void {
  if (!canTransitionJobState(from, to)) {
    throw new Error(`Illegal job state transition: ${from} -> ${to}`);
  }
}
