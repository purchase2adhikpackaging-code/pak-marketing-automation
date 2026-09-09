export type ContentItemStatus = "DRAFT" | "GENERATING" | "GENERATED" | "FAILED";
export type ContentLanguage = "EN" | "PL" | "HI";

export type ContentItem = {
  id: string;
  organizationId: string;
  topic: string;
  knowledgeContext?: string;
  language: ContentLanguage;
  status: ContentItemStatus;
  generatedScript?: string;
  provider?: string;
  providerModel?: string;
  providerMetadata?: Record<string, unknown>;
  failureMetadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateDraftInput = {
  organizationId: string;
  topic: string;
  knowledgeContext?: string;
  language: ContentLanguage;
  createdBy?: string;
};

export type MarkGeneratedInput = {
  id: string;
  organizationId: string;
  generatedScript: string;
  provider: string;
  providerModel: string;
  providerMetadata?: Record<string, unknown>;
};

export type MarkFailedInput = {
  id: string;
  organizationId: string;
  failureMetadata: Record<string, unknown>;
};
