import { AppError } from "@/lib/errors/app-error";
import type { ScenePlanStatus } from "./schema";

export interface HandoffQcFinding {
  severity: "BLOCKER" | "WARNING" | "INFO";
  code: string;
  message: string;
}

export interface HandoffShotSnapshot extends Record<string, unknown> {
  ordinal: number;
  durationSeconds: number;
  creativeDirection: string;
  masterVisualPrompt: string;
}

export interface HandoffSceneSnapshot extends Record<string, unknown> {
  ordinal: number;
  durationSeconds: number;
  shots: HandoffShotSnapshot[];
}

export interface ApprovedPlanSnapshot {
  planVersionId: string;
  organizationId: string;
  videoProjectId: string;
  status: ScenePlanStatus;
  sourceIntegrityHash: string;
  canonicalNarration: string;
  language: string;
  aspectRatio: string;
  visualBibleSnapshot: Record<string, unknown>;
  qcFindings: HandoffQcFinding[];
  scenes: HandoffSceneSnapshot[];
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

export function buildApprovedVideoGenerationPackage(snapshot: ApprovedPlanSnapshot) {
  if (snapshot.status !== "APPROVED") {
    throw new AppError("CONFLICT", "Only APPROVED scene-plan versions may be handed to video generation.");
  }
  if (snapshot.qcFindings.some((finding) => finding.severity === "BLOCKER")) {
    throw new AppError("CONFLICT", "APPROVED plan cannot be handed off while BLOCKER QC findings remain.");
  }

  return deepFreeze({
    schemaVersion: "phase6-video-generation-handoff-v1" as const,
    planVersionId: snapshot.planVersionId,
    organizationId: snapshot.organizationId,
    videoProjectId: snapshot.videoProjectId,
    sourceIntegrityHash: snapshot.sourceIntegrityHash,
    aspectRatio: snapshot.aspectRatio,
    narration: {
      language: snapshot.language,
      text: snapshot.canonicalNarration,
      authority: "canonical-source-artifact" as const,
      providerMayRewrite: false as const,
    },
    visualBible: structuredClone(snapshot.visualBibleSnapshot),
    scenes: structuredClone(snapshot.scenes),
  });
}
