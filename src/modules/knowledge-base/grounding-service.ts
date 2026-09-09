import "server-only";

import { AppError } from "@/lib/errors/app-error";
import type { KnowledgeRepository } from "./repository";
import type { KnowledgeRecord, KnowledgeSourceType } from "./types";

export type ResolvedKnowledgeSource = {
  record: KnowledgeRecord;
  snapshot: {
    knowledgeRecordId: string;
    knowledgeRevision: number;
    titleSnapshot: string;
    contentSnapshot: string;
    sourceTypeSnapshot: KnowledgeSourceType;
    sourceLabelSnapshot?: string;
    sourceReferenceSnapshot?: string;
  };
};

export type ResolvedGrounding = {
  knowledgeContext?: string;
  sources: ResolvedKnowledgeSource[];
};

export async function resolveKnowledgeGrounding(
  input: {
    organizationId: string;
    knowledgeRecordIds?: string[];
    additionalContext?: string;
  },
  repository: Pick<KnowledgeRepository, "getByIds">,
): Promise<ResolvedGrounding> {
  const ids = input.knowledgeRecordIds ?? [];
  let rows: KnowledgeRecord[] = [];

  try {
    rows = ids.length > 0 ? await repository.getByIds(input.organizationId, ids) : [];
  } catch {
    throw new AppError("INTERNAL_ERROR", "Knowledge grounding is temporarily unavailable.");
  }

  if (rows.length !== ids.length) {
    throw new AppError("NOT_FOUND", "One or more selected knowledge records are unavailable.");
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  const orderedRows = ids.map((id) => byId.get(id));

  if (orderedRows.some((row) => !row)) {
    throw new AppError("NOT_FOUND", "One or more selected knowledge records are unavailable.");
  }

  const knowledgeRows = orderedRows as KnowledgeRecord[];
  if (knowledgeRows.some((row) => row.status !== "ACTIVE")) {
    throw new AppError("CONFLICT", "One or more selected knowledge records are no longer active.");
  }

  const sources: ResolvedKnowledgeSource[] = knowledgeRows.map((record) => ({
    record,
    snapshot: {
      knowledgeRecordId: record.id,
      knowledgeRevision: record.revision,
      titleSnapshot: record.title,
      contentSnapshot: record.content,
      sourceTypeSnapshot: record.sourceType,
      ...(record.sourceLabel !== undefined ? { sourceLabelSnapshot: record.sourceLabel } : {}),
      ...(record.sourceReference !== undefined ? { sourceReferenceSnapshot: record.sourceReference } : {}),
    },
  }));

  const sections = sources.map(
    (source, index) => `[Knowledge Source ${index + 1}: ${source.record.title}]\n${source.record.content}`,
  );

  const additionalContext = input.additionalContext?.trim();
  if (additionalContext) {
    sections.push(`[Additional user-provided context]\n${additionalContext}`);
  }

  return {
    ...(sections.length > 0 ? { knowledgeContext: sections.join("\n\n") } : {}),
    sources,
  };
}
