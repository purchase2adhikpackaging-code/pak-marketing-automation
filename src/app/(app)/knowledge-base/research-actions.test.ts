import { describe, expect, it, vi } from "vitest";

import type { AppRole } from "@/modules/auth/roles";
import type { ResearchCandidate, ResearchRun } from "@/modules/knowledge-research/types";
import {
  executeDismissKnowledgeResearchCandidateAction,
  executeSearchKnowledgeResearchAction,
  type KnowledgeResearchActionDependencies,
} from "./research-actions";

const orgId = "11111111-1111-4111-8111-111111111111";
const candidateId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";
const token = "current-user-token";
const now = "2026-09-14T01:35:00.000Z";

const run: ResearchRun = {
  id: "44444444-4444-4444-8444-444444444444",
  organizationId: orgId,
  query: "Poland railway recruitment trends",
  provider: "EXA_MCP",
  status: "COMPLETED",
  resultCount: 1,
  createdAt: now,
  completedAt: now,
};

const candidate: ResearchCandidate = {
  id: candidateId,
  organizationId: orgId,
  researchRunId: run.id,
  provider: "EXA_MCP",
  title: "Rail recruitment outlook",
  canonicalUrl: "https://example.com/rail",
  sourceHost: "example.com",
  excerpt: "Public source excerpt.",
  retrievedAt: now,
  reviewStatus: "SUGGESTED",
  createdAt: now,
};

function dependencies(role: AppRole | null = "EDITOR"): KnowledgeResearchActionDependencies {
  return {
    getActor: vi.fn(async () => (role ? { id: actorId } : null)),
    getMembership: vi.fn(async () => (role ? { role } : null)),
    getAccessToken: vi.fn(async () => token),
    searchEdge: vi.fn(async () => ({ ok: true as const, run, candidates: [candidate] })),
    dismissEdge: vi.fn(async () => ({
      ok: true as const,
      candidate: { ...candidate, reviewStatus: "DISMISSED" as const },
    })),
  };
}

describe("Knowledge Research actions", () => {
  it("rejects unauthenticated research", async () => {
    const deps = dependencies(null);

    await expect(
      executeSearchKnowledgeResearchAction({ organizationId: orgId, query: run.query }, deps),
    ).resolves.toEqual({ ok: false, error: "You must be signed in to use Knowledge Research." });
    expect(deps.searchEdge).not.toHaveBeenCalled();
  });

  it.each(["REVIEWER", "ANALYST"] as const)("denies %s research access", async (role) => {
    const deps = dependencies(role);

    await expect(
      executeSearchKnowledgeResearchAction({ organizationId: orgId, query: run.query }, deps),
    ).resolves.toEqual({
      ok: false,
      error: "You do not have permission to manage Knowledge Research for this organization.",
    });
    expect(deps.searchEdge).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "ADMIN", "EDITOR"] as const)("allows %s and forwards the current user token", async (role) => {
    const deps = dependencies(role);

    await expect(
      executeSearchKnowledgeResearchAction({ organizationId: orgId, query: run.query }, deps),
    ).resolves.toEqual({ ok: true, run, candidates: [candidate] });
    expect(deps.searchEdge).toHaveBeenCalledWith(
      { organizationId: orgId, query: run.query },
      token,
    );
  });

  it("rejects extra browser-authoritative search fields before calling the Edge boundary", async () => {
    const deps = dependencies("OWNER");

    await expect(
      executeSearchKnowledgeResearchAction(
        {
          organizationId: orgId,
          query: run.query,
          provider: "EXA_MCP",
          sourceUrl: "https://attacker.example",
        },
        deps,
      ),
    ).resolves.toEqual({ ok: false, error: "Please check the research topic and try again." });
    expect(deps.searchEdge).not.toHaveBeenCalled();
  });

  it("rejects candidate field forgery before dismiss", async () => {
    const deps = dependencies("ADMIN");

    await expect(
      executeDismissKnowledgeResearchCandidateAction(
        { organizationId: orgId, candidateId, sourceUrl: "https://attacker.example" },
        deps,
      ),
    ).resolves.toEqual({ ok: false, error: "Please check the research source and try again." });
    expect(deps.dismissEdge).not.toHaveBeenCalled();
  });

  it("uses the same knowledge:manage authorization for dismiss", async () => {
    const deps = dependencies("EDITOR");

    await expect(
      executeDismissKnowledgeResearchCandidateAction({ organizationId: orgId, candidateId }, deps),
    ).resolves.toEqual({
      ok: true,
      candidate: { ...candidate, reviewStatus: "DISMISSED" },
    });
    expect(deps.dismissEdge).toHaveBeenCalledWith({ organizationId: orgId, candidateId }, token);
  });

  it("fails closed when the current session has no access token", async () => {
    const deps = dependencies("OWNER");
    deps.getAccessToken = vi.fn(async () => null);

    await expect(
      executeSearchKnowledgeResearchAction({ organizationId: orgId, query: run.query }, deps),
    ).resolves.toEqual({ ok: false, error: "Your session expired. Sign in and try again." });
    expect(deps.searchEdge).not.toHaveBeenCalled();
  });

  it("maps provider credential drift without asking for a key", async () => {
    const deps = dependencies("OWNER");
    deps.searchEdge = vi.fn(async () => ({
      ok: false as const,
      code: "CREDENTIAL_REQUIRED" as const,
      error: "Research route requires credentials.",
    }));

    await expect(
      executeSearchKnowledgeResearchAction({ organizationId: orgId, query: run.query }, deps),
    ).resolves.toEqual({
      ok: false,
      code: "CREDENTIAL_REQUIRED",
      error: "This research route now requires credentials and has been disabled.",
    });
  });
});
