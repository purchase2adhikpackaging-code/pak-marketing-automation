import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { KnowledgeRecord, KnowledgeSourceType, KnowledgeStatus } from "./types";

export type CreateKnowledgeInput = {
  organizationId: string;
  title: string;
  content: string;
  sourceType: KnowledgeSourceType;
  sourceLabel?: string;
  sourceReference?: string;
  actorUserId: string;
};

export type UpdateKnowledgeInput = {
  id: string;
  organizationId: string;
  expectedRevision: number;
  title: string;
  content: string;
  status: KnowledgeStatus;
  sourceType: KnowledgeSourceType;
  sourceLabel?: string;
  sourceReference?: string;
  actorUserId: string;
};

export type KnowledgePersistencePatch = {
  title?: string;
  content?: string;
  status?: KnowledgeStatus;
  sourceType?: KnowledgeSourceType;
  sourceLabel?: string;
  sourceReference?: string;
  revision?: number;
  updatedBy?: string;
  updatedAt?: string;
};

export interface KnowledgePersistence {
  list(organizationId: string, mode: "selectable" | "manageable"): Promise<KnowledgeRecord[]>;
  getByIds(organizationId: string, ids: string[]): Promise<KnowledgeRecord[]>;
  insert(row: KnowledgeRecord): Promise<KnowledgeRecord>;
  compareAndSet(
    id: string,
    organizationId: string,
    expectedRevision: number,
    patch: KnowledgePersistencePatch,
  ): Promise<KnowledgeRecord | null>;
  delete(id: string, organizationId: string): Promise<boolean>;
}

export interface KnowledgeRepository {
  listSelectable(organizationId: string): Promise<KnowledgeRecord[]>;
  listManageable(organizationId: string): Promise<KnowledgeRecord[]>;
  getByIds(organizationId: string, ids: string[]): Promise<KnowledgeRecord[]>;
  create(input: CreateKnowledgeInput): Promise<KnowledgeRecord>;
  update(input: UpdateKnowledgeInput): Promise<KnowledgeRecord>;
  archive(
    id: string,
    organizationId: string,
    expectedRevision: number,
    actorUserId: string,
  ): Promise<KnowledgeRecord>;
  delete(id: string, organizationId: string): Promise<void>;
}

function conflict(): AppError {
  return new AppError("CONFLICT", "Knowledge record changed before the update completed.");
}

export class KnowledgeBaseRepository implements KnowledgeRepository {
  constructor(private readonly persistence: KnowledgePersistence) {}

  listSelectable(organizationId: string): Promise<KnowledgeRecord[]> {
    return this.persistence.list(organizationId, "selectable");
  }

  listManageable(organizationId: string): Promise<KnowledgeRecord[]> {
    return this.persistence.list(organizationId, "manageable");
  }

  async getByIds(organizationId: string, ids: string[]): Promise<KnowledgeRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.persistence.getByIds(organizationId, ids);
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  }

  create(input: CreateKnowledgeInput): Promise<KnowledgeRecord> {
    const timestamp = new Date().toISOString();
    return this.persistence.insert({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      title: input.title,
      content: input.content,
      status: "DRAFT",
      sourceType: input.sourceType,
      ...(input.sourceLabel !== undefined ? { sourceLabel: input.sourceLabel } : {}),
      ...(input.sourceReference !== undefined ? { sourceReference: input.sourceReference } : {}),
      revision: 1,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async update(input: UpdateKnowledgeInput): Promise<KnowledgeRecord> {
    const updated = await this.persistence.compareAndSet(
      input.id,
      input.organizationId,
      input.expectedRevision,
      {
        title: input.title,
        content: input.content,
        status: input.status,
        sourceType: input.sourceType,
        ...(input.sourceLabel !== undefined ? { sourceLabel: input.sourceLabel } : {}),
        ...(input.sourceReference !== undefined ? { sourceReference: input.sourceReference } : {}),
        revision: input.expectedRevision + 1,
        updatedBy: input.actorUserId,
        updatedAt: new Date().toISOString(),
      },
    );

    if (!updated) throw conflict();
    return updated;
  }

  async archive(
    id: string,
    organizationId: string,
    expectedRevision: number,
    actorUserId: string,
  ): Promise<KnowledgeRecord> {
    const updated = await this.persistence.compareAndSet(id, organizationId, expectedRevision, {
      status: "ARCHIVED",
      revision: expectedRevision + 1,
      updatedBy: actorUserId,
      updatedAt: new Date().toISOString(),
    });

    if (!updated) throw conflict();
    return updated;
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const deleted = await this.persistence.delete(id, organizationId);
    if (!deleted) {
      throw new AppError("NOT_FOUND", "Knowledge record is unavailable.");
    }
  }
}

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

const KNOWLEDGE_COLUMNS = [
  "id",
  "organization_id",
  "title",
  "content",
  "status",
  "source_type",
  "source_label",
  "source_reference",
  "revision",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
].join(",");

function asRow(value: unknown): KnowledgeRecordRow {
  return value as KnowledgeRecordRow;
}

function mapRow(row: KnowledgeRecordRow): KnowledgeRecord {
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

function toDatabasePatch(patch: KnowledgePersistencePatch): Record<string, unknown> {
  const databasePatch: Record<string, unknown> = {};
  if (patch.title !== undefined) databasePatch.title = patch.title;
  if (patch.content !== undefined) databasePatch.content = patch.content;
  if (patch.status !== undefined) databasePatch.status = patch.status;
  if (patch.sourceType !== undefined) databasePatch.source_type = patch.sourceType;
  if (patch.sourceLabel !== undefined) databasePatch.source_label = patch.sourceLabel || null;
  if (patch.sourceReference !== undefined) databasePatch.source_reference = patch.sourceReference || null;
  if (patch.revision !== undefined) databasePatch.revision = patch.revision;
  if (patch.updatedBy !== undefined) databasePatch.updated_by = patch.updatedBy;
  if (patch.updatedAt !== undefined) databasePatch.updated_at = patch.updatedAt;
  return databasePatch;
}

class SupabaseKnowledgePersistence implements KnowledgePersistence {
  async list(organizationId: string, mode: "selectable" | "manageable"): Promise<KnowledgeRecord[]> {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("knowledge_records")
      .select(KNOWLEDGE_COLUMNS)
      .eq("organization_id", organizationId);

    if (mode === "selectable") {
      query = query.eq("status", "ACTIVE");
    }

    const { data, error } = await query.order("updated_at", { ascending: false });
    if (error) throw new AppError("INTERNAL_ERROR", "Unable to load Knowledge Base records.");
    return (data ?? []).map((row) => mapRow(asRow(row)));
  }

  async getByIds(organizationId: string, ids: string[]): Promise<KnowledgeRecord[]> {
    if (ids.length === 0) return [];
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("knowledge_records")
      .select(KNOWLEDGE_COLUMNS)
      .eq("organization_id", organizationId)
      .in("id", ids);

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to load selected Knowledge Base records.");
    return (data ?? []).map((row) => mapRow(asRow(row)));
  }

  async insert(row: KnowledgeRecord): Promise<KnowledgeRecord> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("knowledge_records")
      .insert({
        id: row.id,
        organization_id: row.organizationId,
        title: row.title,
        content: row.content,
        status: row.status,
        source_type: row.sourceType,
        source_label: row.sourceLabel ?? null,
        source_reference: row.sourceReference ?? null,
        revision: row.revision,
        created_by: row.createdBy ?? null,
        updated_by: row.updatedBy ?? null,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      })
      .select(KNOWLEDGE_COLUMNS)
      .single();

    if (error || !data) throw new AppError("INTERNAL_ERROR", "Unable to create Knowledge Base record.");
    return mapRow(asRow(data));
  }

  async compareAndSet(
    id: string,
    organizationId: string,
    expectedRevision: number,
    patch: KnowledgePersistencePatch,
  ): Promise<KnowledgeRecord | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("knowledge_records")
      .update(toDatabasePatch(patch))
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("revision", expectedRevision)
      .select(KNOWLEDGE_COLUMNS)
      .maybeSingle();

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to update Knowledge Base record.");
    return data ? mapRow(asRow(data)) : null;
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("knowledge_records")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to delete Knowledge Base record.");
    return Boolean(data);
  }
}

export class SupabaseKnowledgeRepository extends KnowledgeBaseRepository {
  constructor() {
    super(new SupabaseKnowledgePersistence());
  }
}
