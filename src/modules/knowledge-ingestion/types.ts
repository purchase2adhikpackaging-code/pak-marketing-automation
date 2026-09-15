export type KnowledgeDocumentSourceType = "FILE" | "URL";
export type KnowledgeDocumentFormat = "PDF" | "DOCX" | "PPTX" | "TXT" | "URL";
export type KnowledgeDocumentExtractionStatus = "PENDING" | "PROCESSING" | "EXTRACTED" | "FAILED";

export type KnowledgeDocument = {
  id: string;
  organizationId: string;
  sourceType: KnowledgeDocumentSourceType;
  format: KnowledgeDocumentFormat;
  mediaAssetId?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceFingerprint?: string;
  extractionStatus: KnowledgeDocumentExtractionStatus;
  extractedText?: string;
  extractionMetadata: Record<string, unknown>;
  errorSummary?: string;
  revision: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};