import "server-only";

import { AppError } from "@/lib/errors/app-error";
import type { OrganizationBrandKit } from "@/modules/brand-kit/types";
import type { OrganizationProfile } from "@/modules/organization-profile/types";
import {
  organizationGenerationContextRequestSchema,
  type GenerationContextKnowledgeRecord,
  type OrganizationGenerationContext,
  type OrganizationGenerationContextRequest,
} from "./types";

export const MAX_GENERATION_KNOWLEDGE_CONTEXT_CHARACTERS = 12000;

export interface GenerationContextRepositoryPort {
  getProfile(organizationId: string): Promise<OrganizationProfile | null>;
  getBrandKit(organizationId: string): Promise<OrganizationBrandKit | null>;
  listCoreKnowledge(organizationId: string): Promise<GenerationContextKnowledgeRecord[]>;
  getKnowledgeByIds(
    organizationId: string,
    ids: string[],
  ): Promise<GenerationContextKnowledgeRecord[]>;
}

function uniqueFirst(ids: string[]): string[] {
  return [...new Set(ids)];
}

function assertIdentityOrganization(
  organizationId: string,
  profile: OrganizationProfile | null,
  brandKit: OrganizationBrandKit | null,
): void {
  if (profile && profile.organizationId !== organizationId) {
    throw new AppError("INTERNAL_ERROR", "Organization Profile resolution was inconsistent.");
  }
  if (brandKit && brandKit.organizationId !== organizationId) {
    throw new AppError("INTERNAL_ERROR", "Brand Kit resolution was inconsistent.");
  }
}

function normalizeCore(
  organizationId: string,
  rows: GenerationContextKnowledgeRecord[],
): GenerationContextKnowledgeRecord[] {
  const seen = new Set<string>();
  const normalized: GenerationContextKnowledgeRecord[] = [];

  for (const row of rows) {
    if (row.organizationId !== organizationId || row.status !== "ACTIVE" || row.isCore !== true) {
      throw new AppError("INTERNAL_ERROR", "Core Knowledge resolution was inconsistent.");
    }
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    normalized.push(row);
  }

  return normalized.sort((left, right) => {
    const created = left.createdAt.localeCompare(right.createdAt);
    return created !== 0 ? created : left.id.localeCompare(right.id);
  });
}

function normalizeSelected(
  organizationId: string,
  requestedIds: string[],
  rows: GenerationContextKnowledgeRecord[],
  coreIds: Set<string>,
): GenerationContextKnowledgeRecord[] {
  const eligibleRows = rows.filter((row) => row.organizationId === organizationId);
  const byId = new Map(eligibleRows.map((row) => [row.id, row]));

  for (const id of requestedIds) {
    const row = byId.get(id);
    if (!row) {
      throw new AppError("NOT_FOUND", "One or more selected Knowledge records are unavailable.");
    }
    if (row.status !== "ACTIVE") {
      throw new AppError("CONFLICT", "One or more selected Knowledge records are no longer active.");
    }
    if (row.isCore && !coreIds.has(row.id)) {
      throw new AppError("INTERNAL_ERROR", "Core Knowledge resolution was inconsistent.");
    }
  }

  return requestedIds
    .filter((id) => !coreIds.has(id))
    .map((id) => byId.get(id)!);
}

function composeKnowledgeContext(
  coreKnowledge: GenerationContextKnowledgeRecord[],
  selectedKnowledge: GenerationContextKnowledgeRecord[],
  additionalContext?: string,
): string | undefined {
  const sections = [
    ...coreKnowledge.map((record) => `[Core Knowledge: ${record.title}]\n${record.content}`),
    ...selectedKnowledge.map((record) => `[Selected Knowledge: ${record.title}]\n${record.content}`),
  ];

  if (additionalContext) {
    sections.push(`[Additional task context]\n${additionalContext}`);
  }

  if (sections.length === 0) return undefined;
  const composed = sections.join("\n\n");
  if (composed.length > MAX_GENERATION_KNOWLEDGE_CONTEXT_CHARACTERS) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Resolved organization Knowledge exceeds the maximum grounding context size.",
    );
  }
  return composed;
}

export async function resolveOrganizationGenerationContext(
  input: OrganizationGenerationContextRequest,
  repository: GenerationContextRepositoryPort,
): Promise<OrganizationGenerationContext> {
  const parsed = organizationGenerationContextRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Organization generation context request is invalid.");
  }

  const organizationId = parsed.data.organizationId;
  const selectedIds = uniqueFirst(parsed.data.selectedKnowledgeRecordIds ?? []);
  const additionalContext = parsed.data.additionalContext?.trim() || undefined;

  let profile: OrganizationProfile | null;
  let brandKit: OrganizationBrandKit | null;
  let coreRows: GenerationContextKnowledgeRecord[];
  let selectedRows: GenerationContextKnowledgeRecord[];

  try {
    [profile, brandKit, coreRows, selectedRows] = await Promise.all([
      repository.getProfile(organizationId),
      repository.getBrandKit(organizationId),
      repository.listCoreKnowledge(organizationId),
      repository.getKnowledgeByIds(organizationId, selectedIds),
    ]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("INTERNAL_ERROR", "Organization generation context is temporarily unavailable.");
  }

  assertIdentityOrganization(organizationId, profile, brandKit);
  const coreKnowledge = normalizeCore(organizationId, coreRows);
  const coreIds = new Set(coreKnowledge.map((record) => record.id));
  const selectedKnowledge = normalizeSelected(
    organizationId,
    selectedIds,
    selectedRows,
    coreIds,
  );
  const knowledgeContext = composeKnowledgeContext(
    coreKnowledge,
    selectedKnowledge,
    additionalContext,
  );

  const result: OrganizationGenerationContext = {
    organizationId,
    profile,
    brandKit,
    coreKnowledge,
    selectedKnowledge,
    provenance: {
      ...(profile ? { profileRevision: profile.revision } : {}),
      ...(brandKit ? { brandKitRevision: brandKit.revision } : {}),
      knowledge: [...coreKnowledge, ...selectedKnowledge].map((record) => ({
        id: record.id,
        revision: record.revision,
        isCore: coreIds.has(record.id),
      })),
    },
  };

  if (knowledgeContext !== undefined) result.knowledgeContext = knowledgeContext;
  if (additionalContext !== undefined) result.additionalContext = additionalContext;
  return result;
}
