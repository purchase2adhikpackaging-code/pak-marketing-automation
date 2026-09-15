import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { brandKitRepository } from "@/modules/brand-kit/repository";
import type { OrganizationBrandKit } from "@/modules/brand-kit/types";
import type { KnowledgeSourceType, KnowledgeStatus } from "@/modules/knowledge-base/types";
import { organizationProfileRepository } from "@/modules/organization-profile/repository";
import type { OrganizationProfile } from "@/modules/organization-profile/types";
import type { GenerationContextKnowledgeRecord } from "./types";

export interface GenerationContextPersistence {
  getProfile(organizationId: string): Promise<OrganizationProfile | null>;
  getBrandKit(organizationId: string): Promise<OrganizationBrandKit | null>;
  listCoreKnowledge(organizationId: string): Promise<GenerationContextKnowledgeRecord[]>;
  getKnowledgeByIds(
    organizationId: string,
    ids: string[],
  ): Promise<GenerationContextKnowledgeRecord[]>;
}

export class GenerationContextRepository {
  constructor(private readonly persistence: GenerationContextPersistence) {}

  getProfile(organizationId: string): Promise<OrganizationProfile | null> {
    return this.persistence.getProfile(organizationId);
  }

  getBrandKit(organizationId: string): Promise<OrganizationBrandKit | null> {
    return this.persistence.getBrandKit(organizationId);
  }

  listCoreKnowledge(organizationId: string): Promise<GenerationContextKnowledgeRecord[]> {
    return this.persistence.listCoreKnowledge(organizationId);
  }

  getKnowledgeByIds(
    organizationId: string,
    ids: string[],
  ): Promise<GenerationContextKnowledgeRecord[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.persistence.getKnowledgeByIds(organizationId, ids);
  }
}

type KnowledgeRow = {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  status: KnowledgeStatus;
  source_type: KnowledgeSourceType;
  source_label: string | null;
  source_reference: string | null;
  is_core: boolean;
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
  "is_core",
  "revision",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
].join(",");

function mapKnowledge(row: KnowledgeRow): GenerationContextKnowledgeRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    content: row.content,
    status: row.status,
    sourceType: row.source_type,
    ...(row.source_label ? { sourceLabel: row.source_label } : {}),
    ...(row.source_reference ? { sourceReference: row.source_reference } : {}),
    isCore: row.is_core,
    revision: row.revision,
    ...(row.created_by ? { createdBy: row.created_by } : {}),
    ...(row.updated_by ? { updatedBy: row.updated_by } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function nullableProfile(organizationId: string): Promise<OrganizationProfile | null> {
  try {
    return await organizationProfileRepository.get(organizationId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

async function nullableBrandKit(organizationId: string): Promise<OrganizationBrandKit | null> {
  try {
    return await brandKitRepository.get(organizationId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

class SupabaseGenerationContextPersistence implements GenerationContextPersistence {
  getProfile(organizationId: string): Promise<OrganizationProfile | null> {
    return nullableProfile(organizationId);
  }

  getBrandKit(organizationId: string): Promise<OrganizationBrandKit | null> {
    return nullableBrandKit(organizationId);
  }

  async listCoreKnowledge(organizationId: string): Promise<GenerationContextKnowledgeRecord[]> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("knowledge_records")
      .select(KNOWLEDGE_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("status", "ACTIVE")
      .eq("is_core", true)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to load Core Knowledge.");
    return (data ?? []).map((row) => mapKnowledge(row as unknown as KnowledgeRow));
  }

  async getKnowledgeByIds(
    organizationId: string,
    ids: string[],
  ): Promise<GenerationContextKnowledgeRecord[]> {
    if (ids.length === 0) return [];
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("knowledge_records")
      .select(KNOWLEDGE_COLUMNS)
      .eq("organization_id", organizationId)
      .in("id", ids);

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to load selected Knowledge.");
    return (data ?? []).map((row) => mapKnowledge(row as unknown as KnowledgeRow));
  }
}

export const generationContextRepository = new GenerationContextRepository(
  new SupabaseGenerationContextPersistence(),
);
