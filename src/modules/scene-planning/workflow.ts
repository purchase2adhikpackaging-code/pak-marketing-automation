import { AppError } from "@/lib/errors/app-error";

export type ScenePlanWorkflowStatus =
  | "DRAFT"
  | "PLANNING"
  | "QC_REQUIRED"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "FAILED"
  | "STALE"
  | "SUPERSEDED";

export type ScenePlanTransitionContext = {
  blockerCount: number;
  sourceFresh: boolean;
};

const ALLOWED_TRANSITIONS: Record<ScenePlanWorkflowStatus, readonly ScenePlanWorkflowStatus[]> = {
  DRAFT: ["PLANNING", "QC_REQUIRED", "STALE"],
  PLANNING: ["QC_REQUIRED", "FAILED", "STALE"],
  QC_REQUIRED: ["DRAFT", "REVIEW_REQUIRED", "FAILED", "STALE"],
  REVIEW_REQUIRED: ["DRAFT", "APPROVED", "STALE"],
  APPROVED: ["STALE", "SUPERSEDED"],
  FAILED: ["DRAFT", "STALE"],
  STALE: ["DRAFT", "SUPERSEDED"],
  SUPERSEDED: [],
};

export function assertScenePlanTransition(
  from: ScenePlanWorkflowStatus,
  to: ScenePlanWorkflowStatus,
  context: ScenePlanTransitionContext,
): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new AppError("CONFLICT", `Scene plan transition ${from} -> ${to} is not allowed.`);
  }

  if ((to === "REVIEW_REQUIRED" || to === "APPROVED") && context.blockerCount > 0) {
    throw new AppError("CONFLICT", "Scene plan cannot advance while BLOCKER findings remain.");
  }

  if ((to === "REVIEW_REQUIRED" || to === "APPROVED") && !context.sourceFresh) {
    throw new AppError("CONFLICT", "Scene plan cannot advance because its source artifact is stale.");
  }

  if (to === "STALE" && context.sourceFresh) {
    throw new AppError("CONFLICT", "A fresh scene plan cannot be marked stale without a source change.");
  }
}

export type CloneablePlanVersion = {
  id: string;
  versionNumber: number;
  parentVersionId: string | null;
  status: ScenePlanWorkflowStatus;
  sourceIntegrityHash: string;
  approvedBy: string | null;
  approvedAt: string | null;
  qcSummary: Record<string, unknown>;
  scenes: Array<{
    ordinal: number;
    shots: Array<Record<string, unknown> & { ordinal: number }>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type StalePlanVersion = CloneablePlanVersion & {
  staleAgainstSourceIntegrityHash: string;
};

export function clonePlanVersionForEdit<T extends CloneablePlanVersion>(source: T, newId: string): T {
  if (!newId.trim()) {
    throw new AppError("VALIDATION_ERROR", "A new scene plan version identifier is required.");
  }

  const clone = structuredClone(source);
  return {
    ...clone,
    id: newId,
    versionNumber: source.versionNumber + 1,
    parentVersionId: source.id,
    status: "DRAFT",
    approvedBy: null,
    approvedAt: null,
  } as T;
}

export function markPlanVersionStale<T extends CloneablePlanVersion>(
  source: T,
  currentSourceIntegrityHash: string,
): T & StalePlanVersion {
  if (!currentSourceIntegrityHash.trim()) {
    throw new AppError("VALIDATION_ERROR", "Current source integrity hash is required.");
  }

  const stale = structuredClone(source);
  return {
    ...stale,
    status: "STALE",
    staleAgainstSourceIntegrityHash: currentSourceIntegrityHash,
  } as T & StalePlanVersion;
}
