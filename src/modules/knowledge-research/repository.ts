import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseKnowledgeRepository } from "@/modules/knowledge-base/repository";
import type { KnowledgeRecord } from "@/modules/knowledge-base/types";
import type {
  ResearchCandidate,
  ResearchCandidateStatus,
  ResearchProvider,
  ResearchRun,
  ResearchRunStatus,
} from "./types";

export interface KnowledgeResearchRepository {
  listRuns(organizationId: string): Promise<ResearchRun[]>;
  listCandidates(runId: string, organizationId: string): Promise<ResearchCandidate[]>;
  getCandidate(candidateId: string, organizationId: string): Promise<ResearchCandidate | null>;
  getKnowledgeRecord(recordId: string, organizationId: string): Promise<KnowledgeRecord | null>;
}

export interface KnowledgeResearchPersistence {
  listRuns(organizationId: string): Promise<unknown[]>;
  listCandidates(runId: string, organizationId: string): Promise<unknown[]>;
  getCandidate(candidateId: string, organizationId: string): Promise<unknown | null>;
  getKnowledgeRecord(recordId: string, organizationId: string): Promise<KnowledgeRecord | null>;
}

type ResearchRunRow = {
  id: string;
  organization_id: string;
  query: string;
  provider: ResearchProvider;
  status: ResearchRunStatus;
  result_count: number;
  failure_code: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
};

type ResearchCandidateRow = {
  id: string;
  organization_id: string;
  research_run_id: string;
  provider: ResearchProvider;
  title: string;
  canonical_url: string;
  source_host: string;
  excerpt: string;
  retrieved_at: string;
  review_status: ResearchCandidateStatus;
  knowledge_record_id: string | null;
  created_at: string;
};

const RUN_COLUMNS = [
  "id",
  "organization_id",
  "query",
  "provider",
  "status",
  "result_count",
  "failure_code",
  "created_by",
  "created_at",
  "completed_at",
].join(",");

const CANDIDATE_COLUMNS = [
  "id",
  "organization_id",
  "research_run_id",
  "provider",
  "title",
  "canonical_url",
  "source_host",
  "excerpt",
  "retrieved_at",
  "review_status",
  "knowledge_record_id",
  "created_at",
].join(",");

function asResearchRunRow(value: unknown): ResearchRunRow {
  return value as ResearchRunRow;
}

function asResearchCandidateRow(value: unknown): ResearchCandidateRow {
  return value as ResearchCandidateRow;
}

function mapRun(row: ResearchRunRow): ResearchRun {
  return {
    id: row.id,
    organizationId: row.organization_id,
    query: row.query,
    provider: row.provider,
    status: row.status,
    resultCount: row.result_count,
    ...(row.failure_code ? { failureCode: row.failure_code } : {}),
    ...(row.created_by ? { createdBy: row.created_by } : {}),
    createdAt: row.created_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
  };
}

function mapCandidate(row: ResearchCandidateRow): ResearchCandidate {
  return {
    id: row.id,
    organizationId: row.organization_id,
    researchRunId: row.research_run_id,
    provider: row.provider,
    title: row.title,
    canonicalUrl: row.canonical_url,
    sourceHost: row.source_host,
    excerpt: row.excerpt,
    retrievedAt: row.retrieved_at,
    reviewStatus: row.review_status,
    ...(row.knowledge_record_id ? { knowledgeRecordId: row.knowledge_record_id } : {}),
    createdAt: row.created_at,
  };
}

export class KnowledgeResearchRepositoryImpl implements KnowledgeResearchRepository {
  constructor(private readonly persistence: KnowledgeResearchPersistence) {}

  async listRuns(organizationId: string): Promise<ResearchRun[]> {
    const rows = await this.persistence.listRuns(organizationId);
    return rows.map((row) => mapRun(asResearchRunRow(row)));
  }

  async listCandidates(runId: string, organizationId: string): Promise<ResearchCandidate[]> {
    const rows = await this.persistence.listCandidates(runId, organizationId);
    return rows.map((row) => mapCandidate(asResearchCandidateRow(row)));
  }

  async getCandidate(candidateId: string, organizationId: string): Promise<ResearchCandidate | null> {
    const row = await this.persistence.getCandidate(candidateId, organizationId);
    return row ? mapCandidate(asResearchCandidateRow(row)) : null;
  }

  getKnowledgeRecord(recordId: string, organizationId: string): Promise<KnowledgeRecord | null> {
    return this.persistence.getKnowledgeRecord(recordId, organizationId);
  }
}

class SupabaseKnowledgeResearchPersistence implements KnowledgeResearchPersistence {
  async listRuns(organizationId: string): Promise<unknown[]> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("research_runs")
      .select(RUN_COLUMNS)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to load research runs.");
    return data ?? [];
  }

  async listCandidates(runId: string, organizationId: string): Promise<unknown[]> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("research_candidates")
      .select(CANDIDATE_COLUMNS)
      .eq("research_run_id", runId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to load research candidates.");
    return data ?? [];
  }

  async getCandidate(candidateId: string, organizationId: string): Promise<unknown | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("research_candidates")
      .select(CANDIDATE_COLUMNS)
      .eq("id", candidateId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to load research candidate.");
    return data ?? null;
  }

  async getKnowledgeRecord(recordId: string, organizationId: string): Promise<KnowledgeRecord | null> {
    const records = await new SupabaseKnowledgeRepository().getByIds(organizationId, [recordId]);
    return records[0] ?? null;
  }
}

export class SupabaseKnowledgeResearchRepository extends KnowledgeResearchRepositoryImpl {
  constructor() {
    super(new SupabaseKnowledgeResearchPersistence());
  }
}
