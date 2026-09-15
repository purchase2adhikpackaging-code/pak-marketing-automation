import type { BookJob, BookJobStatus } from "./domain";

const transitions: Record<BookJobStatus, ReadonlySet<BookJobStatus>> = {
  PLANNED: new Set(["ARCHITECTURE_REQUIRED", "BLUEPRINT_READY"]),
  ARCHITECTURE_REQUIRED: new Set(["BLUEPRINT_READY", "BLOCKED"]),
  BLUEPRINT_READY: new Set(["KNOWLEDGE_READY", "MANUSCRIPT_READY", "BLOCKED"]),
  KNOWLEDGE_READY: new Set(["MANUSCRIPT_READY", "BLOCKED"]),
  MANUSCRIPT_READY: new Set(["VISUALS_READY", "TYPESET_READY", "BLOCKED"]),
  VISUALS_READY: new Set(["TYPESET_READY", "BLOCKED"]),
  TYPESET_READY: new Set(["PDF_BUILT", "BLOCKED"]),
  PDF_BUILT: new Set(["QA_RUNNING", "BLOCKED"]),
  QA_RUNNING: new Set(["QA_FAILED", "QA_PASSED", "BLOCKED"]),
  QA_FAILED: new Set(["REPAIRING", "BLOCKED"]),
  REPAIRING: new Set(["MANUSCRIPT_READY", "VISUALS_READY", "TYPESET_READY", "PDF_BUILT", "BLOCKED"]),
  QA_PASSED: new Set(["RELEASED"]),
  RELEASED: new Set(),
  BLOCKED: new Set(),
};

export function canTransition(from: BookJobStatus, to: BookJobStatus): boolean {
  return transitions[from].has(to);
}

export function assertTransition(from: BookJobStatus, to: BookJobStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal publishing transition: ${from} -> ${to}`);
  }
}

export function transitionJob(job: BookJob, to: BookJobStatus): BookJob {
  assertTransition(job.status, to);
  return {
    ...job,
    status: to,
    updatedAt: new Date().toISOString(),
  };
}

export const publishingTransitions = transitions;
