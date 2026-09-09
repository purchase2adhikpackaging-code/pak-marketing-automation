import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  ContentItem,
  ContentLanguage,
  ContentItemStatus,
  CreateDraftInput,
  MarkFailedInput,
  MarkGeneratedInput,
} from "./types";

export interface ContentItemRepository {
  createDraft(input: CreateDraftInput): Promise<ContentItem>;
  markGenerating(id: string, organizationId: string): Promise<void>;
  markGenerated(input: MarkGeneratedInput): Promise<ContentItem>;
  markFailed(input: MarkFailedInput): Promise<ContentItem>;
}

type ContentItemRow = {
  id: string;
  organization_id: string;
  topic: string;
  knowledge_context: string | null;
  language: ContentLanguage;
  status: ContentItemStatus;
  generated_script: string | null;
  provider: string | null;
  provider_model: string | null;
  provider_metadata: Record<string, unknown> | null;
  failure_metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const CONTENT_ITEM_COLUMNS = [
  "id",
  "organization_id",
  "topic",
  "knowledge_context",
  "language",
  "status",
  "generated_script",
  "provider",
  "provider_model",
  "provider_metadata",
  "failure_metadata",
  "created_by",
  "created_at",
  "updated_at",
].join(",");

function mapContentItem(row: ContentItemRow): ContentItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    topic: row.topic,
    ...(row.knowledge_context ? { knowledgeContext: row.knowledge_context } : {}),
    language: row.language,
    status: row.status,
    ...(row.generated_script ? { generatedScript: row.generated_script } : {}),
    ...(row.provider ? { provider: row.provider } : {}),
    ...(row.provider_model ? { providerModel: row.provider_model } : {}),
    ...(row.provider_metadata ? { providerMetadata: row.provider_metadata } : {}),
    ...(row.failure_metadata ? { failureMetadata: row.failure_metadata } : {}),
    ...(row.created_by ? { createdBy: row.created_by } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function persistenceError(operation: string): AppError {
  return new AppError("INTERNAL_ERROR", `Unable to ${operation} content item.`);
}

export class SupabaseContentItemRepository implements ContentItemRepository {
  async createDraft(input: CreateDraftInput): Promise<ContentItem> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("content_items")
      .insert({
        organization_id: input.organizationId,
        topic: input.topic,
        knowledge_context: input.knowledgeContext ?? null,
        language: input.language,
        status: "DRAFT",
        created_by: input.createdBy ?? null,
      })
      .select(CONTENT_ITEM_COLUMNS)
      .single();

    if (error || !data) {
      throw persistenceError("create");
    }

    return mapContentItem(data as ContentItemRow);
  }

  async markGenerating(id: string, organizationId: string): Promise<void> {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("content_items")
      .update({ status: "GENERATING", failure_metadata: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      throw persistenceError("mark as generating");
    }
  }

  async markGenerated(input: MarkGeneratedInput): Promise<ContentItem> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("content_items")
      .update({
        status: "GENERATED",
        generated_script: input.generatedScript,
        provider: input.provider,
        provider_model: input.providerModel,
        provider_metadata: input.providerMetadata ?? null,
        failure_metadata: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .select(CONTENT_ITEM_COLUMNS)
      .single();

    if (error || !data) {
      throw persistenceError("mark as generated");
    }

    return mapContentItem(data as ContentItemRow);
  }

  async markFailed(input: MarkFailedInput): Promise<ContentItem> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("content_items")
      .update({
        status: "FAILED",
        failure_metadata: input.failureMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .select(CONTENT_ITEM_COLUMNS)
      .single();

    if (error || !data) {
      throw persistenceError("mark as failed");
    }

    return mapContentItem(data as ContentItemRow);
  }
}
