export type ScriptArtifactStatus = "PENDING" | "GENERATING" | "GENERATED" | "STALE" | "FAILED";

export type ScriptArtifact = {
  id: string;
  organizationId: string;
  contentItemId: string;
  language: "EN" | "PL" | "HI";
  isSource: boolean;
  status: ScriptArtifactStatus;
  scriptText?: string;
  revision: number;
  sourceRevision?: number;
  provider?: string;
  providerModel?: string;
  providerMetadata?: Record<string, unknown>;
  failureMetadata?: Record<string, unknown>;
  createdBy?: string;
  generatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type GenerateTranslationRequest = {
  organizationId: string;
  contentItemId: string;
  targetLanguage: "EN" | "PL" | "HI";
};

export type RegenerateSourceRequest = {
  organizationId: string;
  contentItemId: string;
};
