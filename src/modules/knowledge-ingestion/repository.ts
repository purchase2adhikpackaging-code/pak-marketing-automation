import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { KnowledgeRecord, KnowledgeSourceType, KnowledgeStatus } from "@/modules/knowledge-base/types";
import { MAX_SOURCE_BYTES } from "./extractors";
import type {
  KnowledgeDocument,
  KnowledgeDocumentExtractionStatus,
  KnowledgeDocumentFormat,
  KnowledgeDocumentSourceType,
} from "./types";

export type InternalMediaDocument = {
  id: string;
  organizationId: string;
  assetType: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  status: "ACTIVE" | "ARCHIVED" | "FAILED";
  mimeType: string;
  displayName: string;
  sizeBytes?: number;
  storageBucket: string;
  storagePath: string;
};

export type LoadedKnowledgeFileSource = Omit<
  InternalMediaDocument,
  "assetType" | "status" | "storageBucket" | "storagePath"
> & {
  bytes: Uint8Array;
};

export type KnowledgeDocumentPersistencePatch = {
  extractionStatus?: KnowledgeDocumentExtractionStatus;
  errorSummary?: string | null;
  extractionMetadata?: Record<string, unknown>;
  revision?: number;
};

export type FinalizeKnowledgeIngestionInput = {
  documentId: string;
  organizationId: string;
  expectedRevision: number;
  title: string;
  content: string;
  sourceType: KnowledgeSourceType;
  sourceReference: string;
  sourceFingerprint: string;
  extractionMetadata: Record<string, unknown>;
};

export type KnowledgeIngestionFinalization = {
  document: KnowledgeDocument;
  record: KnowledgeRecord;
};

export interface KnowledgeIngestionPersistence {
  findMediaDocument(
    organizationId: string,
    mediaAssetId: string,
  ): Promise<InternalMediaDocument | null>;
  downloadMediaDocument(storageBucket: string, storagePath: string): Promise<Uint8Array>;
  insertDocument(document: KnowledgeDocument): Promise<KnowledgeDocument>;
  compareAndSetDocument(
    id: string,
    organizationId: string,
    expectedRevision: number,
    patch: KnowledgeDocumentPersistencePatch,
  ): Promise<KnowledgeDocument | null>;
  finalizeExtraction(
    input: FinalizeKnowledgeIngestionInput & { status: "DRAFT" },
  ): Promise<KnowledgeIngestionFinalization>;
}

export type CreateFileDocumentInput = {
  organizationId: string;
  mediaAssetId: string;
  format: Exclude<KnowledgeDocumentFormat, "URL">;
  sourceLabel?: string;
  actorUserId: string;
};

export type CreateUrlDocumentInput = {
  organizationId: string;
  sourceUrl: string;
  sourceLabel?: string;
  actorUserId: string;
};

function conflict(message: string): AppError {
  return new AppError("CONFLICT", message);
}

function unavailable(): AppError {
  return new AppError("NOT_FOUND", "Knowledge source media asset is unavailable.");
}

export class KnowledgeIngestionRepository {
  constructor(private readonly persistence: KnowledgeIngestionPersistence) {}

  async loadFileSource(
    organizationId: string,
    mediaAssetId: string,
  ): Promise<LoadedKnowledgeFileSource> {
    const media = await this.persistence.findMediaDocument(organizationId, mediaAssetId);
    if (
      !media ||
      media.organizationId !== organizationId ||
      media.assetType !== "DOCUMENT" ||
      media.status !== "ACTIVE"
    ) {
      throw unavailable();
    }

    if (media.sizeBytes !== undefined && media.sizeBytes > MAX_SOURCE_BYTES) {
      throw new AppError("VALIDATION_ERROR", "Knowledge source media asset is too large.");
    }

    const bytes = await this.persistence.downloadMediaDocument(
      media.storageBucket,
      media.storagePath,
    );
    if (bytes.byteLength > MAX_SOURCE_BYTES) {
      throw new AppError("VALIDATION_ERROR", "Knowledge source media asset is too large.");
    }

    return {
      id: media.id,
      organizationId: media.organizationId,
      mimeType: media.mimeType,
      displayName: media.displayName,
      ...(media.sizeBytes !== undefined ? { sizeBytes: media.sizeBytes } : {}),
      bytes,
    };
  }

  createFileDocument(input: CreateFileDocumentInput): Promise<KnowledgeDocument> {
    const timestamp = new Date().toISOString();
    return this.persistence.insertDocument({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      sourceType: "FILE",
      format: input.format,
      mediaAssetId: input.mediaAssetId,
      ...(input.sourceLabel !== undefined ? { sourceLabel: input.sourceLabel } : {}),
      extractionStatus: "PENDING",
      extractionMetadata: {},
      revision: 1,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  createUrlDocument(input: CreateUrlDocumentInput): Promise<KnowledgeDocument> {
    const timestamp = new Date().toISOString();
    return this.persistence.insertDocument({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      sourceType: "URL",
      format: "URL",
      sourceUrl: input.sourceUrl,
      ...(input.sourceLabel !== undefined ? { sourceLabel: input.sourceLabel } : {}),
      extractionStatus: "PENDING",
      extractionMetadata: {},
      revision: 1,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async markProcessing(
    id: string,
    organizationId: string,
    expectedRevision: number,
  ): Promise<KnowledgeDocument> {
    const updated = await this.persistence.compareAndSetDocument(
      id,
      organizationId,
      expectedRevision,
      {
        extractionStatus: "PROCESSING",
        errorSummary: null,
        revision: expectedRevision + 1,
      },
    );
    if (!updated) throw conflict("Knowledge document changed before extraction started.");
    return updated;
  }

  async markFailed(
    id: string,
    organizationId: string,
    expectedRevision: number,
    errorSummary: string,
  ): Promise<void> {
    const updated = await this.persistence.compareAndSetDocument(
      id,
      organizationId,
      expectedRevision,
      {
        extractionStatus: "FAILED",
        errorSummary: errorSummary.trim().slice(0, 1000),
        revision: expectedRevision + 1,
      },
    );
    if (!updated) throw conflict("Knowledge document changed before failure state could be recorded.");
  }

  finalize(input: FinalizeKnowledgeIngestionInput): Promise<KnowledgeIngestionFinalization> {
    return this.persistence.finalizeExtraction({ ...input, status: "DRAFT" });
  }
}

type MediaDocumentRow = {
  id: string;
  organization_id: string;
  asset_type: InternalMediaDocument["assetType"];
  status: InternalMediaDocument["status"];
  mime_type: string;
  display_name: string | null;
  size_bytes: number | null;
  storage_bucket: string;
  storage_path: string;
};

type KnowledgeDocumentRow = {
  id: string;
  organization_id: string;
  source_type: KnowledgeDocumentSourceType;
  format: KnowledgeDocumentFormat;
  media_asset_id: string | null;
  source_url: string | null;
  source_label: string | null;
  source_fingerprint: string | null;
  extraction_status: KnowledgeDocumentExtractionStatus;
  extracted_text: string | null;
  extraction_metadata: Record<string, unknown> | null;
  error_summary: string | null;
  revision: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type KnowledgeRecordRow = {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  status: KnowledgeStatus;
  source_type: KnowledgeSourceType;
  source_label: string | null;
  source_reference: string | null;
  revision: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const DOCUMENT_COLUMNS = [
  "id",
  "organization_id",
  "source_type",
  "format",
  "media_asset_id",
  "source_url",
  "source_label",
  "source_fingerprint",
  "extraction_status",
  "extracted_text",
  "extraction_metadata",
  "error_summary",
  "revision",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
].join(",");

function mapDocument(row: KnowledgeDocumentRow): KnowledgeDocument {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceType: row.source_type,
    format: row.format,
    ...(row.media_asset_id ? { mediaAssetId: row.media_asset_id } : {}),
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    ...(row.source_label ? { sourceLabel: row.source_label } : {}),
    ...(row.source_fingerprint ? { sourceFingerprint: row.source_fingerprint } : {}),
    extractionStatus: row.extraction_status,
    ...(row.extracted_text ? { extractedText: row.extracted_text } : {}),
    extractionMetadata: row.extraction_metadata ?? {},
    ...(row.error_summary ? { errorSummary: row.error_summary } : {}),
    revision: row.revision,
    ...(row.created_by ? { createdBy: row.created_by } : {}),
    ...(row.updated_by ? { updatedBy: row.updated_by } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRecord(row: KnowledgeRecordRow): KnowledgeRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    content: row.content,
    status: row.status,
    sourceType: row.source_type,
    ...(row.source_label ? { sourceLabel: row.source_label } : {}),
    ...(row.source_reference ? { sourceReference: row.source_reference } : {}),
    revision: row.revision,
    ...(row.created_by ? { createdBy: row.created_by } : {}),
    ...(row.updated_by ? { updatedBy: row.updated_by } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function documentPatchToDatabase(
  patch: KnowledgeDocumentPersistencePatch,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  if (patch.extractionStatus !== undefined) output.extraction_status = patch.extractionStatus;
  if (patch.errorSummary !== undefined) output.error_summary = patch.errorSummary;
  if (patch.extractionMetadata !== undefined) output.extraction_metadata = patch.extractionMetadata;
  if (patch.revision !== undefined) output.revision = patch.revision;
  return output;
}

class SupabaseKnowledgeIngestionPersistence implements KnowledgeIngestionPersistence {
  async findMediaDocument(
    organizationId: string,
    mediaAssetId: string,
  ): Promise<InternalMediaDocument | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("media_assets")
      .select("id,organization_id,asset_type,status,mime_type,display_name,size_bytes,storage_bucket,storage_path")
      .eq("organization_id", organizationId)
      .eq("id", mediaAssetId)
      .maybeSingle();

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to load the knowledge source media asset.");
    if (!data) return null;
    const row = data as MediaDocumentRow;
    return {
      id: row.id,
      organizationId: row.organization_id,
      assetType: row.asset_type,
      status: row.status,
      mimeType: row.mime_type,
      displayName: row.display_name?.trim() || `Document ${row.id.slice(0, 8)}`,
      ...(row.size_bytes !== null ? { sizeBytes: row.size_bytes } : {}),
      storageBucket: row.storage_bucket,
      storagePath: row.storage_path,
    };
  }

  async downloadMediaDocument(storageBucket: string, storagePath: string): Promise<Uint8Array> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.storage.from(storageBucket).download(storagePath);
    if (error || !data) {
      throw new AppError("INTERNAL_ERROR", "Unable to read the knowledge source document.");
    }
    return new Uint8Array(await data.arrayBuffer());
  }

  async insertDocument(document: KnowledgeDocument): Promise<KnowledgeDocument> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("knowledge_documents")
      .insert({
        id: document.id,
        organization_id: document.organizationId,
        source_type: document.sourceType,
        format: document.format,
        media_asset_id: document.mediaAssetId ?? null,
        source_url: document.sourceUrl ?? null,
        source_label: document.sourceLabel ?? null,
        source_fingerprint: document.sourceFingerprint ?? null,
        extraction_status: document.extractionStatus,
        extracted_text: document.extractedText ?? null,
        extraction_metadata: document.extractionMetadata,
        error_summary: document.errorSummary ?? null,
        revision: document.revision,
        created_by: document.createdBy ?? null,
        updated_by: document.updatedBy ?? null,
        created_at: document.createdAt,
        updated_at: document.updatedAt,
      })
      .select(DOCUMENT_COLUMNS)
      .single();

    if (error || !data) throw new AppError("INTERNAL_ERROR", "Unable to create the knowledge document.");
    return mapDocument(data as KnowledgeDocumentRow);
  }

  async compareAndSetDocument(
    id: string,
    organizationId: string,
    expectedRevision: number,
    patch: KnowledgeDocumentPersistencePatch,
  ): Promise<KnowledgeDocument | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("knowledge_documents")
      .update(documentPatchToDatabase(patch))
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("revision", expectedRevision)
      .select(DOCUMENT_COLUMNS)
      .maybeSingle();

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to update the knowledge document.");
    return data ? mapDocument(data as KnowledgeDocumentRow) : null;
  }

  async finalizeExtraction(
    input: FinalizeKnowledgeIngestionInput & { status: "DRAFT" },
  ): Promise<KnowledgeIngestionFinalization> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("finalize_knowledge_document_ingestion", {
      p_document_id: input.documentId,
      p_organization_id: input.organizationId,
      p_expected_revision: input.expectedRevision,
      p_title: input.title,
      p_content: input.content,
      p_source_type: input.sourceType,
      p_source_reference: input.sourceReference,
      p_source_fingerprint: input.sourceFingerprint,
      p_extraction_metadata: input.extractionMetadata,
    });

    if (error || !data || typeof data !== "object") {
      throw new AppError("INTERNAL_ERROR", "Unable to finalize knowledge ingestion.");
    }

    const payload = data as { document?: unknown; record?: unknown };
    if (!payload.document || !payload.record) {
      throw new AppError("INTERNAL_ERROR", "Knowledge ingestion finalization returned invalid data.");
    }

    return {
      document: mapDocument(payload.document as KnowledgeDocumentRow),
      record: mapRecord(payload.record as KnowledgeRecordRow),
    };
  }
}

export class SupabaseKnowledgeIngestionRepository extends KnowledgeIngestionRepository {
  constructor() {
    super(new SupabaseKnowledgeIngestionPersistence());
  }
}
