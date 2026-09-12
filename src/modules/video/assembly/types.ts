export const VIDEO_ASSEMBLY_STATES = [
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type VideoAssemblyState = (typeof VIDEO_ASSEMBLY_STATES)[number];

export const FINAL_RENDER_PROFILES = ["PAK_MASTER_1080P_V1"] as const;

export type FinalRenderProfile = (typeof FINAL_RENDER_PROFILES)[number];

export type FinalAssemblyAspectRatio = "16:9" | "9:16";

export type VideoAssemblySummary = {
  id: string;
  organizationId: string;
  planVersionId: string;
  jobId: string;
  state: VideoAssemblyState;
  renderProfile: FinalRenderProfile;
  readinessHash: string;
  sourceIntegrityHash: string;
  aspectRatio: FinalAssemblyAspectRatio;
  componentCount: number;
  expectedDurationSeconds: number;
  finalMediaAssetId?: string;
  failureCode?: string;
  failureMessage?: string;
  retryable?: boolean;
};
