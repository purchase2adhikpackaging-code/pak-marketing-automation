import { describe, expect, it } from "vitest";

import type { KnowledgeRecord } from "@/modules/knowledge-base/types";
import {
  KnowledgeResearchRepositoryImpl,
  type KnowledgeResearchPersistence,
} from "./repository";

const orgId = "11111111-1111-4111-8111-111111111111";
const otherOrgId = "99999999-9999-4999-8999-999999999999";
const runId = "22222222-2222-4222-8222-222222222222";
const candidateId = "33333333-3333-4333-8333-333333333333";
const recordId = "44444444-4444-4444-8444-444444444444";
const now = "2026-09-14T00:00:00.000Z";

const runRow = {
  id: runId,
  organization_id: orgId,
  query: "Poland railway recruitment trends 2026",
  provider: "EXA_MCP",
  status: "COMPLETED",
  result_count: 1,
  failure_code: null,
  created_by: "55555555-5555-4555-8555-555555555555",
  created_at: now,
  completed_at: now,
};

const candidateRow = {
  id: candidateId,
  organization_id: orgId,
  research_run_id: runId,
  provider: "EXA_MCP",
  title: "Rail recruitment outlook",
  canonical_url: "https://example.com/rail-outlook",
  source_host: "example.com",
  excerpt: "Public source excerpt.",
  retrieved_at: now,
  review_status: "SUGGESTED",
  knowledge_record_id: null,
  created_at: now,
};

const knowledgeRecord: KnowledgeRecord = {
  id: recordId,
  organizationId: orgId,
  title: "Rail outlook",
  content: "Draft source content.",
  status: "DRAFT",
  sourceType: "URL",
  revision: 1,
  createdAt: now,
  updatedAt: now,
};

class MemoryResearchPersistence implements KnowledgeResearchPersistence {
  calls: Array<{ method: string; args: string[] }> = [];

  async listRuns(organizationId: string): Promise<unknown[]> {
    this.calls.push({ method: "listRuns", args: [organizationId] });
    return organizationId === orgId ? [runRow] : [];
  }

  async listCandidates(researchRunId: string, organizationId: string): Promise<unknown[]> {
    this.calls.push({ method: "listCandidates", args: [researchRunId, organizationId] });
    return researchRunId === runId && organizationId === orgId ? [candidateRow] : [];
  }

  async getCandidate(id: string, organizationId: string): Promise<unknown | null> {
    this.calls.push({ method: "getCandidate", args: [id, organizationId] });
    return id === candidateId && organizationId === orgId ? candidateRow : null;
  }

  async getKnowledgeRecord(id: string, organizationId: string): Promise<KnowledgeRecord | null> {
    this.calls.push({ method: "getKnowledgeRecord", args: [id, organizationId] });
    return id === recordId && organizationId === orgId ? knowledgeRecord : null;
  }
}

describe("KnowledgeResearchRepositoryImpl", () => {
  it("maps run rows and scopes listRuns by organization", async () => {
    const persistence = new MemoryResearchPersistence();
    const repository = new KnowledgeResearchRepositoryImpl(persistence);

    await expect(repository.listRuns(orgId)).resolves.toEqual([
      {
        id: runId,
        organizationId: orgId,
        query: runRow.query,
        provider: "EXA_MCP",
        status: "COMPLETED",
        resultCount: 1,
        createdBy: runRow.created_by,
        createdAt: now,
        completedAt: now,
      },
    ]);
    expect(persistence.calls).toEqual([{ method: "listRuns", args: [orgId] }]);
  });

  it("maps candidate rows and scopes listCandidates by run and organization", async () => {
    const persistence = new MemoryResearchPersistence();
    const repository = new KnowledgeResearchRepositoryImpl(persistence);

    await expect(repository.listCandidates(runId, orgId)).resolves.toEqual([
      {
        id: candidateId,
        organizationId: orgId,
        researchRunId: runId,
        provider: "EXA_MCP",
        title: candidateRow.title,
        canonicalUrl: candidateRow.canonical_url,
        sourceHost: candidateRow.source_host,
        excerpt: candidateRow.excerpt,
        retrievedAt: now,
        reviewStatus: "SUGGESTED",
        createdAt: now,
      },
    ]);
    expect(persistence.calls).toEqual([
      { method: "listCandidates", args: [runId, orgId] },
    ]);
  });

  it("scopes candidate lookup by candidate and organization", async () => {
    const persistence = new MemoryResearchPersistence();
    const repository = new KnowledgeResearchRepositoryImpl(persistence);

    await expect(repository.getCandidate(candidateId, orgId)).resolves.toMatchObject({
      id: candidateId,
      organizationId: orgId,
    });
    await expect(repository.getCandidate(candidateId, otherOrgId)).resolves.toBeNull();
    expect(persistence.calls).toEqual([
      { method: "getCandidate", args: [candidateId, orgId] },
      { method: "getCandidate", args: [candidateId, otherOrgId] },
    ]);
  });

  it("scopes linked Knowledge lookup by record and organization", async () => {
    const persistence = new MemoryResearchPersistence();
    const repository = new KnowledgeResearchRepositoryImpl(persistence);

    await expect(repository.getKnowledgeRecord(recordId, orgId)).resolves.toEqual(knowledgeRecord);
    await expect(repository.getKnowledgeRecord(recordId, otherOrgId)).resolves.toBeNull();
    expect(persistence.calls).toEqual([
      { method: "getKnowledgeRecord", args: [recordId, orgId] },
      { method: "getKnowledgeRecord", args: [recordId, otherOrgId] },
    ]);
  });
});
