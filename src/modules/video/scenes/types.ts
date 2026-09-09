export type SceneGenerationState = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "RETRYING" | "CANCELLED";
export type SceneQaState = "PENDING" | "PASSED" | "FAILED";

export type SceneContinuity = {
  characterIdentity?: string;
  clothing?: string;
  locationIdentity?: string;
  visualPalette?: string;
  lighting?: string;
  cameraLanguage?: string;
  temporalSetting?: string;
  objectContinuity?: string[];
  precedingSceneContext?: string;
  transitionType?: string;
};

export type VideoScene = {
  id: string;
  organizationId: string;
  contentItemId: string;
  order: number;
  required: boolean;
  script: string;
  visualPrompt: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  continuity: SceneContinuity;
  generationState: SceneGenerationState;
  qaState: SceneQaState;
  retryCount: number;
  provider?: string;
  providerOutputRef?: string;
};
