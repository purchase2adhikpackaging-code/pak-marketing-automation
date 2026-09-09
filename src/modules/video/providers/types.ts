export type VideoGenerationState = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type VideoGenerationRequest = {
  organizationId: string;
  sceneId: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  continuity: Record<string, unknown>;
  idempotencyKey: string;
};

export type VideoGenerationHandle = {
  provider: string;
  externalId: string;
};

export type VideoGenerationStatus = {
  state: VideoGenerationState;
  progress?: number;
  error?: VideoProviderError;
};

export type VideoGenerationResult = {
  outputUrl: string;
  mimeType: string;
  durationSeconds?: number;
  raw?: unknown;
};

export type VideoProviderError = {
  code: string;
  message: string;
  retryable: boolean;
  raw?: unknown;
};
