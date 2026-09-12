export const ASSEMBLY_BLOCK_REASONS = [
  "PLAN_NOT_APPROVED",
  "SOURCE_STALE",
  "QC_BLOCKER_PRESENT",
  "NO_SHOTS",
  "SHOT_MEDIA_MISSING",
  "MEDIA_NOT_ACTIVE",
  "UNSUPPORTED_ASPECT_RATIO",
  "ASSEMBLY_ALREADY_RUNNING",
] as const;

export type AssemblyBlockReason = (typeof ASSEMBLY_BLOCK_REASONS)[number];

export type FinalAssemblyMediaReadiness = {
  mediaAssetId: string;
  assetType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | string;
  status: "ACTIVE" | "ARCHIVED" | "FAILED" | string;
  checksum?: string | null;
};

export type FinalAssemblyShotReadiness = {
  shotId: string;
  media: FinalAssemblyMediaReadiness | null;
};

export type FinalAssemblyReadinessInput = {
  planStatus: string;
  sourceFresh: boolean;
  hasBlocker: boolean;
  aspectRatio: string;
  assemblyAlreadyRunning: boolean;
  shots: readonly FinalAssemblyShotReadiness[];
};

export type FinalAssemblyReadiness = {
  ready: boolean;
  reasons: AssemblyBlockReason[];
};

const SHA256_CHECKSUM = /^sha256:[0-9a-f]{64}$/;

export function computeFinalAssemblyReadiness(input: FinalAssemblyReadinessInput): FinalAssemblyReadiness {
  const reasons = new Set<AssemblyBlockReason>();

  if (input.planStatus !== "APPROVED") reasons.add("PLAN_NOT_APPROVED");
  if (!input.sourceFresh) reasons.add("SOURCE_STALE");
  if (input.hasBlocker) reasons.add("QC_BLOCKER_PRESENT");
  if (input.shots.length === 0) reasons.add("NO_SHOTS");

  for (const shot of input.shots) {
    if (!shot.media) {
      reasons.add("SHOT_MEDIA_MISSING");
      continue;
    }

    if (
      shot.media.assetType !== "VIDEO" ||
      shot.media.status !== "ACTIVE" ||
      !shot.media.checksum ||
      !SHA256_CHECKSUM.test(shot.media.checksum)
    ) {
      reasons.add("MEDIA_NOT_ACTIVE");
    }
  }

  if (input.aspectRatio !== "16:9" && input.aspectRatio !== "9:16") {
    reasons.add("UNSUPPORTED_ASPECT_RATIO");
  }

  if (input.assemblyAlreadyRunning) reasons.add("ASSEMBLY_ALREADY_RUNNING");

  const orderedReasons = ASSEMBLY_BLOCK_REASONS.filter((reason) => reasons.has(reason));
  return {
    ready: orderedReasons.length === 0,
    reasons: orderedReasons,
  };
}
