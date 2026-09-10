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
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ error: { message?: string } | null }>;
};

type SupabaseClientSource = SupabaseClient | Promise<SupabaseClient>;

export class SupabaseKnowledgeSnapshotPersistence implements KnowledgeSnapshotPersistence {
  constructor(private readonly supabaseSource: SupabaseClientSource) {}

  async insertIgnoringConflicts(inputs: KnowledgeSnapshotInput[]): Promise<void> {
    if (inputs.length === 0) return;

    const { organizationId, contentItemId } = inputs[0]!;
    if (inputs.some((input) => input.organizationId !== organizationId || input.contentItemId !== contentItemId)) {
      throw new Error("Knowledge snapshots must belong to the same organization and content item.");
    }

    const snapshots = inputs.map((input) => ({
      knowledge_record_id: input.knowledgeRecordId,
      knowledge_revision: input.knowledgeRevision,
      title_snapshot: input.titleSnapshot,
      content_snapshot: input.contentSnapshot,
      source_type_snapshot: input.sourceTypeSnapshot,
      source_label_snapshot: input.sourceLabelSnapshot ?? null,
      source_reference_snapshot: input.sourceReferenceSnapshot ?? null,
    }));

    const supabase = await this.supabaseSource;
    const { error } = await supabase.rpc("persist_content_knowledge_snapshots", {
      _organization_id: organizationId,
      _content_item_id: contentItemId,
      _snapshots: snapshots,
    });

    if (error) {
      throw new Error(error.message ?? "Knowledge snapshot insert failed");
    }
  }
}
