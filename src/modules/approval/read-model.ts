import type { ApprovalEventType, ApprovalStatus, ApprovalTargetType } from "./types";

export type ApprovalListQuery = {
  organizationId: string;
  status?: ApprovalStatus;
  targetType?: ApprovalTargetType;
  limit?: number;
};

export type NormalizedApprovalListQuery = {
  organizationId: string;
  status: ApprovalStatus;
  limit: number;
  targetType?: ApprovalTargetType;
};

export type ApprovalRequestRow = {
  id: string;
  organization_id: string;
  target_type: ApprovalTargetType;
  target_id: string;
  target_revision: number | null;
  target_checksum: string | null;
  target_fingerprint: string;
  target_snapshot: Record<string, unknown>;
  publication_intent: Record<string, unknown>;
  status: ApprovalStatus;
  requested_by: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  superseded_at: string | null;
  superseded_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ApprovalEventRow = {
  id: string;
  organization_id: string;
  approval_request_id: string;
  actor_kind: "USER" | "SYSTEM";
  actor_user_id: string | null;
  event_type: ApprovalEventType;
  comment: string | null;
  target_revision: number | null;
  target_checksum: string | null;
  created_at: string;
};

export type ContentApprovalTarget = {
  type: "CONTENT_ARTIFACT";
  artifactId: string;
  contentItemId: string;
  language: string;
  isSource: boolean;
  status: string;
  revision: number;
  sourceRevision?: number;
  scriptText: string;
  topic: string;
  knowledgeContext?: string;
  provider?: string;
  providerModel?: string;
  generatedAt?: string;
};

export type MediaApprovalTarget = {
  type: "MEDIA_ASSET";
  mediaAssetId: string;
  assetType: string;
  displayName: string;
  source?: string;
  mimeType: string;
  checksum: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  sizeBytes?: number;
  sceneId?: string;
  generatingJobId?: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
};

export type ApprovalTargetSnapshot = ContentApprovalTarget | MediaApprovalTarget;

export type ApprovalQueueItem = {
  id: string;
  organizationId: string;
  targetType: ApprovalTargetType;
  targetId: string;
  targetRevision?: number;
  targetChecksum?: string;
  targetFingerprint: string;
  target: ApprovalTargetSnapshot;
  publicationIntent: Record<string, unknown>;
  status: ApprovalStatus;
  requestedBy?: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  supersededAt?: string;
  supersededReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalEvent = {
  id: string;
  organizationId: string;
  requestId: string;
  actorKind: "USER" | "SYSTEM";
  actorUserId?: string;
  eventType: ApprovalEventType;
  comment?: string;
  targetRevision?: number;
  targetChecksum?: string;
  createdAt: string;
};

export type ApprovalKnowledgeSource = {
  id: string;
  knowledgeRecordId?: string;
  knowledgeRevision: number;
  title: string;
  content: string;
  sourceType: string;
  sourceLabel?: string;
  sourceReference?: string;
  createdAt: string;
};

export type ApprovalDetail = ApprovalQueueItem & {
  events: ApprovalEvent[];
  knowledgeSources: ApprovalKnowledgeSource[];
};

export type ApprovalListPage = { items: ApprovalQueueItem[] };

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function safeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const blocked = new Set(["signedUrl", "signed_url", "storagePath", "storage_path", "storageBucket", "storage_bucket", "uploadToken", "upload_token"]);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !blocked.has(key)));
}

export function normalizeApprovalListQuery(input: ApprovalListQuery): NormalizedApprovalListQuery {
  const limit = Number.isFinite(input.limit)
    ? Math.max(1, Math.min(50, Math.floor(input.limit ?? 25)))
    : 25;
  return {
    organizationId: input.organizationId,
    status: input.status ?? "PENDING",
    limit,
    ...(input.targetType ? { targetType: input.targetType } : {}),
  };
}

export function toApprovalTargetSnapshot(row: ApprovalRequestRow): ApprovalTargetSnapshot {
  const snapshot = row.target_snapshot ?? {};
  if (row.target_type === "CONTENT_ARTIFACT") {
    return {
      type: "CONTENT_ARTIFACT",
      artifactId: text(snapshot.artifactId, row.target_id),
      contentItemId: text(snapshot.contentItemId),
      language: text(snapshot.language),
      isSource: snapshot.isSource === true,
      status: text(snapshot.status),
      revision: optionalNumber(snapshot.revision) ?? row.target_revision ?? 1,
      ...(optionalNumber(snapshot.sourceRevision) !== undefined ? { sourceRevision: optionalNumber(snapshot.sourceRevision) } : {}),
      scriptText: text(snapshot.scriptText),
      topic: text(snapshot.topic, "Content artifact"),
      ...(optionalText(snapshot.knowledgeContext) ? { knowledgeContext: optionalText(snapshot.knowledgeContext) } : {}),
      ...(optionalText(snapshot.provider) ? { provider: optionalText(snapshot.provider) } : {}),
      ...(optionalText(snapshot.providerModel) ? { providerModel: optionalText(snapshot.providerModel) } : {}),
      ...(optionalText(snapshot.generatedAt) ? { generatedAt: optionalText(snapshot.generatedAt) } : {}),
    } as ContentApprovalTarget;
  }

  return {
    type: "MEDIA_ASSET",
    mediaAssetId: text(snapshot.mediaAssetId, row.target_id),
    assetType: text(snapshot.assetType, "MEDIA"),
    displayName: text(snapshot.displayName, `Media ${row.target_id.slice(0, 8)}`),
    ...(optionalText(snapshot.source) ? { source: optionalText(snapshot.source) } : {}),
    mimeType: text(snapshot.mimeType),
    checksum: text(snapshot.checksum, row.target_checksum ?? ""),
    ...(optionalNumber(snapshot.width) !== undefined ? { width: optionalNumber(snapshot.width) } : {}),
    ...(optionalNumber(snapshot.height) !== undefined ? { height: optionalNumber(snapshot.height) } : {}),
    ...(optionalNumber(snapshot.durationSeconds) !== undefined ? { durationSeconds: optionalNumber(snapshot.durationSeconds) } : {}),
    ...(optionalNumber(snapshot.sizeBytes) !== undefined ? { sizeBytes: optionalNumber(snapshot.sizeBytes) } : {}),
    ...(optionalText(snapshot.sceneId) ? { sceneId: optionalText(snapshot.sceneId) } : {}),
    ...(optionalText(snapshot.generatingJobId) ? { generatingJobId: optionalText(snapshot.generatingJobId) } : {}),
    metadata: safeMetadata(snapshot.metadata),
    ...(optionalText(snapshot.createdAt) ? { createdAt: optionalText(snapshot.createdAt) } : {}),
  } as MediaApprovalTarget;
}

export function toApprovalQueueItem(row: ApprovalRequestRow): ApprovalQueueItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    targetType: row.target_type,
    targetId: row.target_id,
    ...(row.target_revision !== null ? { targetRevision: row.target_revision } : {}),
    ...(row.target_checksum ? { targetChecksum: row.target_checksum } : {}),
    targetFingerprint: row.target_fingerprint,
    target: toApprovalTargetSnapshot(row),
    publicationIntent: safeMetadata(row.publication_intent),
    status: row.status,
    ...(row.requested_by ? { requestedBy: row.requested_by } : {}),
    requestedAt: row.requested_at,
    ...(row.decided_by ? { decidedBy: row.decided_by } : {}),
    ...(row.decided_at ? { decidedAt: row.decided_at } : {}),
    ...(row.superseded_at ? { supersededAt: row.superseded_at } : {}),
    ...(row.superseded_reason ? { supersededReason: row.superseded_reason } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toApprovalEvent(row: ApprovalEventRow): ApprovalEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    requestId: row.approval_request_id,
    actorKind: row.actor_kind,
    ...(row.actor_user_id ? { actorUserId: row.actor_user_id } : {}),
    eventType: row.event_type,
    ...(row.comment ? { comment: row.comment } : {}),
    ...(row.target_revision !== null ? { targetRevision: row.target_revision } : {}),
    ...(row.target_checksum ? { targetChecksum: row.target_checksum } : {}),
    createdAt: row.created_at,
  };
}
