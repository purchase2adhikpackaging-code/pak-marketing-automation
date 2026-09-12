export type MediaAssetType = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
export type MediaAssetSource = "UPLOAD" | "GENERATED" | "IMPORT";
export type MediaAssetStatus = "ACTIVE" | "ARCHIVED" | "FAILED";

export type MediaCursor = { createdAt: string; id: string };

export type MediaListQuery = {
  organizationId: string;
  assetType?: MediaAssetType;
  source?: MediaAssetSource;
  status?: MediaAssetStatus;
  search?: string;
  cursor?: MediaCursor;
  limit?: number;
};

export type NormalizedMediaListQuery = {
  organizationId: string;
  status: MediaAssetStatus;
  limit: number;
  assetType?: MediaAssetType;
  source?: MediaAssetSource;
  search?: string;
  cursor?: MediaCursor;
};

export type MediaAssetRow = {
  id: string;
  organization_id: string;
  asset_type: MediaAssetType;
  storage_bucket: string;
  storage_path: string;
  source: MediaAssetSource;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | string | null;
  checksum: string | null;
  generating_job_id: string | null;
  status: MediaAssetStatus;
  display_name: string | null;
  size_bytes: number | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SafeMediaAsset = {
  id: string;
  organizationId: string;
  assetType: MediaAssetType;
  source: MediaAssetSource;
  mimeType: string;
  status: MediaAssetStatus;
  displayName: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  sizeBytes?: number;
  checksum?: string;
  generatingJobId?: string;
  createdBy?: string;
  archivedAt?: string;
  archivedBy?: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type MediaListPage = {
  items: SafeMediaAsset[];
  nextCursor?: MediaCursor;
};

export function normalizeMediaListQuery(input: MediaListQuery): NormalizedMediaListQuery {
  const limit = Number.isFinite(input.limit)
    ? Math.max(1, Math.min(50, Math.floor(input.limit ?? 24)))
    : 24;
  const search = input.search?.trim().slice(0, 100);

  return {
    organizationId: input.organizationId,
    status: input.status ?? "ACTIVE",
    limit,
    ...(input.assetType ? { assetType: input.assetType } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(search ? { search } : {}),
    ...(input.cursor ? { cursor: input.cursor } : {}),
  };
}

export function toSafeMediaAsset(row: MediaAssetRow): SafeMediaAsset {
  const duration = row.duration_seconds === null ? undefined : Number(row.duration_seconds);
  return {
    id: row.id,
    organizationId: row.organization_id,
    assetType: row.asset_type,
    source: row.source,
    mimeType: row.mime_type,
    status: row.status,
    displayName: row.display_name?.trim() || `Media ${row.id.slice(0, 8)}`,
    ...(row.width !== null ? { width: row.width } : {}),
    ...(row.height !== null ? { height: row.height } : {}),
    ...(duration !== undefined && Number.isFinite(duration) ? { durationSeconds: duration } : {}),
    ...(row.size_bytes !== null ? { sizeBytes: row.size_bytes } : {}),
    ...(row.checksum ? { checksum: row.checksum } : {}),
    ...(row.generating_job_id ? { generatingJobId: row.generating_job_id } : {}),
    ...(row.created_by ? { createdBy: row.created_by } : {}),
    ...(row.archived_at ? { archivedAt: row.archived_at } : {}),
    ...(row.archived_by ? { archivedBy: row.archived_by } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata ?? {},
  };
}
