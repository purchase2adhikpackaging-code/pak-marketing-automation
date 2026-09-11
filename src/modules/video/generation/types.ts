export const VIDEO_GENERATION_ATTEMPT_STATES = [
  "QUEUED",
  "SUBMITTING",
  "SUBMITTED",
  "PROCESSING",
  "IMPORT_PENDING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "SUBMISSION_UNKNOWN",
] as const;

export type VideoGenerationAttemptState = (typeof VIDEO_GENERATION_ATTEMPT_STATES)[number];

export type VideoGenerationAttempt = {
  id: string;
  organizationId: string;
  jobId: string;
  planVersionId: string;
  sceneId: string;
  shotId: string;
  mediaAssetId: string | null;
  attemptNumber: number;
  provider: string;
  providerModel: string;
  providerJobId: string | null;
  state: VideoGenerationAttemptState;
  requestedDurationSeconds: number;
  effectiveDurationSeconds: number | null;
  resolution: string | null;
  fps: number | null;
  generateAudio: boolean;
  promptHash: string;
  errorCode: string | null;
  errorMessage: string | null;
  retryable: boolean | null;
  submittedAt: string | null;
  lastPolledAt: string | null;
  terminalAt: string | null;
  importedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};
