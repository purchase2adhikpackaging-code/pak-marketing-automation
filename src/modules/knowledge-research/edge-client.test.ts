import { describe, expect, it, vi } from "vitest";

import {
  KnowledgeResearchEdgeClient,
  type ResearchEdgeFetch,
} from "./edge-client";

const orgId = "11111111-1111-4111-8111-111111111111";
const candidateId = "22222222-2222-4222-8222-222222222222";
const token = "user-access-token";
const baseUrl = "https://example.supabase.co";
const now = "2026-09-14T01:30:00.000Z";

const run = {
  id: "33333333-3333-4333-8333-333333333333",
  organizationId: orgId,
  query: "Poland railway recruitment trends",
  provider: "EXA_MCP" as const,
  status: "COMPLETED" as const,
  resultCount: 1,
  createdAt: now,
  completedAt: now,
};

const candidate = {
  id: candidateId,
  organizationId: orgId,
  researchRunId: run.id,
  provider: "EXA_MCP" as const,
  title: "Railway recruitment outlook",
  canonicalUrl: "https://example.com/rail",
  sourceHost: "example.com",
  excerpt: "Public source excerpt.",
  retrievedAt: now,
  reviewStatus: "SUGGESTED" as const,
  createdAt: now,
};

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("KnowledgeResearchEdgeClient", () => {
  it("derives the Edge endpoint from the existing Supabase URL and forwards only user auth + safe search intent", async () => {
    const fetchMock = vi.fn<ResearchEdgeFetch>().mockResolvedValue(response(200, { run, candidates: [candidate] }));
    const client = new KnowledgeResearchEdgeClient({ fetchImpl: fetchMock, supabaseUrl: baseUrl });

    await expect(client.search({ organizationId: orgId, query: run.query }, token)).resolves.toEqual({
      ok: true,
      run,
      candidates: [candidate],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://example.supabase.co/functions/v1/knowledge-research");
    expect(init?.headers).toMatchObject({
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      action: "search",
      organizationId: orgId,
      query: run.query,
    });
  });

  it("sends only candidate identity for dismiss", async () => {
    const dismissed = { ...candidate, reviewStatus: "DISMISSED" as const };
    const fetchMock = vi.fn<ResearchEdgeFetch>().mockResolvedValue(response(200, { candidate: dismissed }));
    const client = new KnowledgeResearchEdgeClient({ fetchImpl: fetchMock, supabaseUrl: baseUrl });

    await expect(client.dismiss({ organizationId: orgId, candidateId }, token)).resolves.toEqual({
      ok: true,
      candidate: dismissed,
    });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      action: "dismiss",
      organizationId: orgId,
      candidateId,
    });
  });

  it.each([
    [401, { error: "UNAUTHORIZED" }, "UNAUTHORIZED"],
    [403, { error: "FORBIDDEN" }, "FORBIDDEN"],
    [503, { error: "CREDENTIAL_REQUIRED", code: "CREDENTIAL_REQUIRED" }, "CREDENTIAL_REQUIRED"],
    [429, { error: "RATE_LIMITED" }, "TEMPORARY_UNAVAILABLE"],
    [502, { error: "RESEARCH_UNAVAILABLE" }, "TEMPORARY_UNAVAILABLE"],
  ] as const)("maps HTTP %s to safe error %s", async (status, body, expectedCode) => {
    const fetchMock = vi.fn<ResearchEdgeFetch>().mockResolvedValue(response(status, body));
    const client = new KnowledgeResearchEdgeClient({ fetchImpl: fetchMock, supabaseUrl: baseUrl });

    await expect(client.search({ organizationId: orgId, query: run.query }, token)).resolves.toMatchObject({
      ok: false,
      code: expectedCode,
    });
  });

  it("fails closed on malformed provider-gateway responses", async () => {
    const fetchMock = vi.fn<ResearchEdgeFetch>().mockResolvedValue(response(200, { providerPayload: "unexpected" }));
    const client = new KnowledgeResearchEdgeClient({ fetchImpl: fetchMock, supabaseUrl: baseUrl });

    await expect(client.search({ organizationId: orgId, query: run.query }, token)).resolves.toMatchObject({
      ok: false,
      code: "TEMPORARY_UNAVAILABLE",
    });
  });

  it("maps network failures without exposing the underlying exception", async () => {
    const fetchMock = vi.fn<ResearchEdgeFetch>().mockRejectedValue(new Error("socket secret detail"));
    const client = new KnowledgeResearchEdgeClient({ fetchImpl: fetchMock, supabaseUrl: baseUrl });

    await expect(client.search({ organizationId: orgId, query: run.query }, token)).resolves.toEqual({
      ok: false,
      code: "TEMPORARY_UNAVAILABLE",
      error: "Research provider is temporarily unavailable.",
    });
  });
});
