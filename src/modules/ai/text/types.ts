export type TextGenerationRequest = {
  topic: string;
  knowledgeContext?: string;
  language: "EN" | "PL" | "HI";
  systemInstructions: string;
  idempotencyKey: string;
};

export type TextGenerationResult = {
  text: string;
  provider: string;
  model: string;
  metadata?: Record<string, unknown>;
};

export type TextProviderError = {
  code: string;
  message: string;
  retryable: boolean;
  raw?: unknown;
};
