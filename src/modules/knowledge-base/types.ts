export type KnowledgeStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type KnowledgeSourceType = "MANUAL" | "DOCUMENT" | "URL";

export type KnowledgeRecord = {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  status: KnowledgeStatus;
  sourceType: KnowledgeSourceType;
  sourceLabel?: string;
  sourceReference?: string;
  /** Database-authoritative Core Knowledge flag. Production repository reads always populate it. */
  isCore?: boolean;
  revision: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};
