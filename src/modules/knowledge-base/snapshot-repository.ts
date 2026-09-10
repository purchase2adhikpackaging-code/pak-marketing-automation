import "server-only";

import { AppError } from "@/lib/errors/app-error";
import type { KnowledgeSourceType } from "./types";

export type KnowledgeSnapshotInput = {
  organizationId: string;
  contentItemId: string;
  knowledgeRecordId: string;
  knowledgeRevision: number;
  titleSnapshot: string;
  contentSnapshot: string;
  sourceTypeSnapshot: KnowledgeSourceType;
  sourceLabelSnapshot?: string | undefined;
  sourceReferenceSnapshot?: string | undefined;
};

export interface KnowledgeSnapshotPersistence {
  insertIgnoringConflicts(inputs: KnowledgeSnapshotInput[]): Promise<void>;
}

export class KnowledgeSnapshotStore {
  constructor(private readonly persistence: KnowledgeSnapshotPersistence) {}

  async insertMany(inputs: KnowledgeSnapshotInput[]): Promise<void> {
    if (inputs.length === 0) return;

    try {
      await this.persistence.insertIgnoringConflicts(inputs);
    } catch {
      throw new AppError("INTERNAL_ERROR", "Knowledge provenance could not be persisted.");
    }
  }
}

type SupabaseClient = {
  from(table: string): {
    upsert(
      values: Record<string, unknown>[],
      options: { onConflict: string; ignoreDuplicates: boolean },
    ): PromiseLike<{ error: { message?: string } | null }>;
  };
};

export class SupabaseKnowledgeSnapshotPersistence implements KnowledgeSnapshotPersistence {
  constructor(private readonly supabase: SupabaseClient) {}

  async insertIgnoringConflicts(inputs: KnowledgeSnapshotInput[]): Promise<void> {
    const rows = inputs.map((input) => ({
      organization_id: input.organizationId,
      content_item_id: input.contentItemId,
      knowledge_record_id: input.knowledgeRecordId,
      knowledge_revision: input.knowledgeRevision,
      title_snapshot: input.titleSnapshot,
      content_snapshot: input.contentSnapshot,
      source_type_snapshot: input.sourceTypeSnapshot,
      source_label_snapshot: input.sourceLabelSnapshot ?? null,
      source_reference_snapshot: input.sourceReferenceSnapshot ?? null,
    }));

    const { error } = await this.supabase.from("content_item_knowledge_sources").upsert(rows, {
      onConflict: "content_item_id,knowledge_record_id",
      ignoreDuplicates: true,
    });

    if (error) {
      throw new Error(error.message ?? "Knowledge snapshot insert failed");
    }
  }
}