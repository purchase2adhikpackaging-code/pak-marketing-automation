import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ScriptArtifact, ScriptArtifactStatus } from "./types";

export type StartArtifactGenerationInput = {
  id: string;
  organizationId: string;
  expectedRevision: number;
};

export type CompleteArtifactGenerationInput = {
  id: string;
  organizationId: string;
  expectedRevision: number;
  scriptText: string;
  provider: string;
  providerModel: string;
  providerMetadata?: Record<string, unknown>;
  sourceRevision?: number;
};

export type ArtifactPatch = Omit<Partial<ScriptArtifact>, "failureMetadata"> & {
  failureMetadata?: Record<string, unknown> | null;
};

export interface ScriptArtifactRepository {
  listForContent(organizationId: string, contentItemId: string): Promise<ScriptArtifact[]>;
  getSource(organizationId: string, contentItemId: string): Promise<ScriptArtifact | null>;
  getByLanguage(organizationId: string, contentItemId: string, language: "EN" | "PL" | "HI"): Promise<ScriptArtifact | null>;
  ensureSourceFromLegacy(organizationId: string, contentItemId: string, actorUserId: string): Promise<ScriptArtifact>;
  ensureTarget(organizationId: string, contentItemId: string, language: "EN" | "PL" | "HI", actorUserId: string): Promise<ScriptArtifact>;
  startGeneration(input: StartArtifactGenerationInput): Promise<ScriptArtifact>;
  completeGeneration(input: CompleteArtifactGenerationInput): Promise<ScriptArtifact>;
  failGeneration(id: string, organizationId: string, expectedRevision: number, failureMetadata: Record<string, unknown>): Promise<ScriptArtifact>;
  markTranslationsStale(organizationId: string, contentItemId: string, newerSourceRevision: number): Promise<void>;
}

export type LegacySource = {
  organizationId: string;
  contentItemId: string;
  language: "EN" | "PL" | "HI";
  scriptText: string;
  provider?: string;
  providerModel?: string;
  providerMetadata?: Record<string, unknown>;
  createdBy?: string;
};

export interface ArtifactPersistence {
  list(organizationId: string, contentItemId: string): Promise<ScriptArtifact[]>;
  insert(row: ScriptArtifact): Promise<ScriptArtifact>;
  compareAndSet(
    id: string,
    organizationId: string,
    expectedRevision: number,
    allowedStatuses: ScriptArtifactStatus[],
    patch: ArtifactPatch,
  ): Promise<ScriptArtifact | null>;
  markStale(organizationId: string, contentItemId: string, newerSourceRevision: number): Promise<void>;
  loadLegacySource?(organizationId: string, contentItemId: string): Promise<LegacySource | null>;
}

const STARTABLE_STATUSES: ScriptArtifactStatus[] = ["PENDING", "GENERATED", "STALE", "FAILED"];

function conflict(message: string): AppError {
  return new AppError("CONFLICT", message);
}

export class ArtifactRepository implements ScriptArtifactRepository {
  constructor(private readonly persistence: ArtifactPersistence) {}

  listForContent(organizationId: string, contentItemId: string): Promise<ScriptArtifact[]> {
    return this.persistence.list(organizationId, contentItemId);
  }

  async getSource(organizationId: string, contentItemId: string): Promise<ScriptArtifact | null> {
    const rows = await this.persistence.list(organizationId, contentItemId);
    return rows.find((row) => row.isSource) ?? null;
  }

  async getByLanguage(
    organizationId: string,
    contentItemId: string,
    language: "EN" | "PL" | "HI",
  ): Promise<ScriptArtifact | null> {
    const rows = await this.persistence.list(organizationId, contentItemId);
    return rows.find((row) => row.language === language) ?? null;
  }

  async ensureSourceFromLegacy(organizationId: string, contentItemId: string, actorUserId: string): Promise<ScriptArtifact> {
    const existing = await this.getSource(organizationId, contentItemId);
    if (existing) return existing;

    const legacy = await this.persistence.loadLegacySource?.(organizationId, contentItemId);
    if (!legacy) {
      throw new AppError("NOT_FOUND", "Canonical source script is unavailable.");
    }

    const timestamp = new Date().toISOString();
    return this.persistence.insert({
      id: crypto.randomUUID(),
      organizationId,
      contentItemId,
      language: legacy.language,
      isSource: true,
      status: "GENERATED",
      scriptText: legacy.scriptText,
      revision: 1,
      ...(legacy.provider ? { provider: legacy.provider } : {}),
      ...(legacy.providerModel ? { providerModel: legacy.providerModel } : {}),
      ...(legacy.providerMetadata ? { providerMetadata: legacy.providerMetadata } : {}),
      createdBy: legacy.createdBy ?? actorUserId,
      generatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async ensureTarget(
    organizationId: string,
    contentItemId: string,
    language: "EN" | "PL" | "HI",
    actorUserId: string,
  ): Promise<ScriptArtifact> {
    const existing = await this.getByLanguage(organizationId, contentItemId, language);
    if (existing) return existing;

    const timestamp = new Date().toISOString();
    return this.persistence.insert({
      id: crypto.randomUUID(),
      organizationId,
      contentItemId,
      language,
      isSource: false,
      status: "PENDING",
      revision: 1,
      createdBy: actorUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async startGeneration(input: StartArtifactGenerationInput): Promise<ScriptArtifact> {
    const result = await this.persistence.compareAndSet(
      input.id,
      input.organizationId,
      input.expectedRevision,
      STARTABLE_STATUSES,
      {
        status: "GENERATING",
        failureMetadata: null,
        updatedAt: new Date().toISOString(),
      },
    );

    if (!result) throw conflict("Script artifact changed before generation could start.");
    return result;
  }

  async completeGeneration(input: CompleteArtifactGenerationInput): Promise<ScriptArtifact> {
    const timestamp = new Date().toISOString();
    const result = await this.persistence.compareAndSet(
      input.id,
      input.organizationId,
      input.expectedRevision,
      ["GENERATING"],
      {
        status: "GENERATED",
        scriptText: input.scriptText,
        revision: input.expectedRevision + 1,
        provider: input.provider,
        providerModel: input.providerModel,
        ...(input.providerMetadata ? { providerMetadata: input.providerMetadata } : {}),
        ...(input.sourceRevision !== undefined ? { sourceRevision: input.sourceRevision } : {}),
        failureMetadata: null,
        generatedAt: timestamp,
        updatedAt: timestamp,
      },
    );

    if (!result) throw conflict("Script artifact changed before generation completed.");
    return result;
  }

  async failGeneration(
    id: string,
    organizationId: string,
    expectedRevision: number,
    failureMetadata: Record<string, unknown>,
  ): Promise<ScriptArtifact> {
    const result = await this.persistence.compareAndSet(id, organizationId, expectedRevision, ["GENERATING"], {
      status: "FAILED",
      failureMetadata,
      updatedAt: new Date().toISOString(),
    });

    if (!result) throw conflict("Script artifact changed before failure state could be recorded.");
    return result;
  }

  markTranslationsStale(organizationId: string, contentItemId: string, newerSourceRevision: number): Promise<void> {
    return this.persistence.markStale(organizationId, contentItemId, newerSourceRevision);
  }
}

type ScriptArtifactRow = {
  id: string;
  organization_id: string;
  content_item_id: string;
  language: "EN" | "PL" | "HI";
  is_source: boolean;
  status: ScriptArtifactStatus;
  script_text: string | null;
  revision: number;
  source_revision: number | null;
  provider: string | null;
  provider_model: string | null;
  provider_metadata: Record<string, unknown> | null;
  failure_metadata: Record<string, unknown> | null;
  created_by: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
};

const ARTIFACT_COLUMNS = [
  "id",
  "organization_id",
  "content_item_id",
  "language",
  "is_source",
  "status",
  "script_text",
  "revision",
  "source_revision",
  "provider",
  "provider_model",
  "provider_metadata",
  "failure_metadata",
  "created_by",
  "generated_at",
  "created_at",
  "updated_at",
].join(",");

function mapRow(row: ScriptArtifactRow): ScriptArtifact {
  return {
    id: row.id,
    organizationId: row.organization_id,
    contentItemId: row.content_item_id,
    language: row.language,
    isSource: row.is_source,
    status: row.status,
    ...(row.script_text ? { scriptText: row.script_text } : {}),
    revision: row.revision,
    ...(row.source_revision !== null ? { sourceRevision: row.source_revision } : {}),
    ...(row.provider ? { provider: row.provider } : {}),
    ...(row.provider_model ? { providerModel: row.provider_model } : {}),
    ...(row.provider_metadata ? { providerMetadata: row.provider_metadata } : {}),
    ...(row.failure_metadata ? { failureMetadata: row.failure_metadata } : {}),
    ...(row.created_by ? { createdBy: row.created_by } : {}),
    ...(row.generated_at ? { generatedAt: row.generated_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function asRow(value: unknown): ScriptArtifactRow {
  return value as ScriptArtifactRow;
}

function toDatabasePatch(patch: ArtifactPatch): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (patch.status !== undefined) db.status = patch.status;
  if (patch.scriptText !== undefined) db.script_text = patch.scriptText;
  if (patch.revision !== undefined) db.revision = patch.revision;
  if (patch.sourceRevision !== undefined) db.source_revision = patch.sourceRevision;
  if (patch.provider !== undefined) db.provider = patch.provider;
  if (patch.providerModel !== undefined) db.provider_model = patch.providerModel;
  if (patch.providerMetadata !== undefined) db.provider_metadata = patch.providerMetadata;
  if (patch.failureMetadata !== undefined) db.failure_metadata = patch.failureMetadata;
  if (patch.generatedAt !== undefined) db.generated_at = patch.generatedAt;
  if (patch.updatedAt !== undefined) db.updated_at = patch.updatedAt;
  return db;
}

class SupabaseArtifactPersistence implements ArtifactPersistence {
  async list(organizationId: string, contentItemId: string): Promise<ScriptArtifact[]> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("content_script_artifacts")
      .select(ARTIFACT_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("content_item_id", contentItemId)
      .order("language");

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to load script artifacts.");
    return (data ?? []).map((row) => mapRow(asRow(row)));
  }

  async insert(row: ScriptArtifact): Promise<ScriptArtifact> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("content_script_artifacts")
      .insert({
        id: row.id,
        organization_id: row.organizationId,
        content_item_id: row.contentItemId,
        language: row.language,
        is_source: row.isSource,
        status: row.status,
        script_text: row.scriptText ?? null,
        revision: row.revision,
        source_revision: row.sourceRevision ?? null,
        provider: row.provider ?? null,
        provider_model: row.providerModel ?? null,
        provider_metadata: row.providerMetadata ?? null,
        failure_metadata: row.failureMetadata ?? null,
        created_by: row.createdBy ?? null,
        generated_at: row.generatedAt ?? null,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      })
      .select(ARTIFACT_COLUMNS)
      .single();

    if (error || !data) throw new AppError("INTERNAL_ERROR", "Unable to create script artifact.");
    return mapRow(asRow(data));
  }

  async compareAndSet(
    id: string,
    organizationId: string,
    expectedRevision: number,
    allowedStatuses: ScriptArtifactStatus[],
    patch: ArtifactPatch,
  ): Promise<ScriptArtifact | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("content_script_artifacts")
      .update(toDatabasePatch(patch))
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("revision", expectedRevision)
      .in("status", allowedStatuses)
      .select(ARTIFACT_COLUMNS)
      .maybeSingle();

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to update script artifact.");
    return data ? mapRow(asRow(data)) : null;
  }

  async markStale(organizationId: string, contentItemId: string, newerSourceRevision: number): Promise<void> {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("content_script_artifacts")
      .update({ status: "STALE", updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("content_item_id", contentItemId)
      .eq("is_source", false)
      .eq("status", "GENERATED")
      .lt("source_revision", newerSourceRevision);

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to invalidate stale translations.");
  }

  async loadLegacySource(organizationId: string, contentItemId: string): Promise<LegacySource | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("content_items")
      .select("organization_id,id,language,generated_script,provider,provider_model,provider_metadata,created_by")
      .eq("organization_id", organizationId)
      .eq("id", contentItemId)
      .maybeSingle();

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to load canonical source script.");
    if (!data || !data.generated_script?.trim()) return null;

    return {
      organizationId: data.organization_id,
      contentItemId: data.id,
      language: data.language as "EN" | "PL" | "HI",
      scriptText: data.generated_script,
      ...(data.provider ? { provider: data.provider } : {}),
      ...(data.provider_model ? { providerModel: data.provider_model } : {}),
      ...(data.provider_metadata ? { providerMetadata: data.provider_metadata as Record<string, unknown> } : {}),
      ...(data.created_by ? { createdBy: data.created_by } : {}),
    };
  }
}

export class SupabaseScriptArtifactRepository extends ArtifactRepository {
  constructor() {
    super(new SupabaseArtifactPersistence());
  }
}
