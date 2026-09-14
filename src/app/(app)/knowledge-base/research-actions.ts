"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { can } from "@/modules/auth/authorization";
import type { AppRole } from "@/modules/auth/roles";
import {
  KnowledgeResearchEdgeClient,
  type DismissResearchEdgeResult,
  type SearchResearchEdgeResult,
} from "@/modules/knowledge-research/edge-client";
import {
  researchCandidateInputSchema,
  researchSearchInputSchema,
  type ResearchCandidateInput,
  type ResearchSearchInput,
} from "@/modules/knowledge-research/schema";
import type { ResearchCandidate, ResearchRun } from "@/modules/knowledge-research/types";

type Actor = { id: string };
type Membership = { role: AppRole } | null;

export type SearchKnowledgeResearchActionResult =
  | { ok: true; run: ResearchRun; candidates: ResearchCandidate[] }
  | {
      ok: false;
      error: string;
      code?: "CREDENTIAL_REQUIRED" | "TEMPORARY_UNAVAILABLE";
    };

export type DismissKnowledgeResearchActionResult =
  | { ok: true; candidate: ResearchCandidate }
  | { ok: false; error: string };

export type KnowledgeResearchActionDependencies = {
  getActor(): Promise<Actor | null>;
  getMembership(actorId: string, organizationId: string): Promise<Membership>;
  getAccessToken(): Promise<string | null>;
  searchEdge(input: ResearchSearchInput, accessToken: string): Promise<SearchResearchEdgeResult>;
  dismissEdge(input: ResearchCandidateInput, accessToken: string): Promise<DismissResearchEdgeResult>;
};

async function authorizeResearch(
  organizationId: string,
  dependencies: Pick<KnowledgeResearchActionDependencies, "getActor" | "getMembership">,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await dependencies.getActor();
  if (!actor) {
    return { ok: false, error: "You must be signed in to use Knowledge Research." };
  }

  const membership = await dependencies.getMembership(actor.id, organizationId);
  if (!membership || !can(membership.role, "knowledge:manage")) {
    return {
      ok: false,
      error: "You do not have permission to manage Knowledge Research for this organization.",
    };
  }

  return { ok: true };
}

function mapSearchEdgeFailure(
  result: Extract<SearchResearchEdgeResult, { ok: false }>,
): SearchKnowledgeResearchActionResult {
  if (result.code === "CREDENTIAL_REQUIRED") {
    return {
      ok: false,
      code: "CREDENTIAL_REQUIRED",
      error: "This research route now requires credentials and has been disabled.",
    };
  }

  if (result.code === "UNAUTHORIZED") {
    return { ok: false, error: "Your session expired. Sign in and try again." };
  }

  if (result.code === "FORBIDDEN") {
    return {
      ok: false,
      error: "You do not have permission to manage Knowledge Research for this organization.",
    };
  }

  return {
    ok: false,
    code: "TEMPORARY_UNAVAILABLE",
    error: "Research provider is temporarily unavailable.",
  };
}

export async function executeSearchKnowledgeResearchAction(
  input: unknown,
  dependencies: KnowledgeResearchActionDependencies,
): Promise<SearchKnowledgeResearchActionResult> {
  const parsed = researchSearchInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the research topic and try again." };
  }

  const authorization = await authorizeResearch(parsed.data.organizationId, dependencies);
  if (!authorization.ok) return authorization;

  const accessToken = await dependencies.getAccessToken();
  if (!accessToken) {
    return { ok: false, error: "Your session expired. Sign in and try again." };
  }

  const result = await dependencies.searchEdge(parsed.data, accessToken);
  return result.ok ? result : mapSearchEdgeFailure(result);
}

export async function executeDismissKnowledgeResearchCandidateAction(
  input: unknown,
  dependencies: KnowledgeResearchActionDependencies,
): Promise<DismissKnowledgeResearchActionResult> {
  const parsed = researchCandidateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the research source and try again." };
  }

  const authorization = await authorizeResearch(parsed.data.organizationId, dependencies);
  if (!authorization.ok) return authorization;

  const accessToken = await dependencies.getAccessToken();
  if (!accessToken) {
    return { ok: false, error: "Your session expired. Sign in and try again." };
  }

  const result = await dependencies.dismissEdge(parsed.data, accessToken);
  if (result.ok) return result;

  if (result.code === "UNAUTHORIZED") {
    return { ok: false, error: "Your session expired. Sign in and try again." };
  }
  if (result.code === "FORBIDDEN") {
    return {
      ok: false,
      error: "You do not have permission to manage Knowledge Research for this organization.",
    };
  }
  if (result.code === "NOT_FOUND") {
    return { ok: false, error: "This research source is no longer available." };
  }
  if (result.code === "CONFLICT") {
    return { ok: false, error: "This research source changed before the action completed." };
  }

  return { ok: false, error: "Research provider is temporarily unavailable." };
}

async function createProductionDependencies(): Promise<KnowledgeResearchActionDependencies> {
  const supabase = await createServerSupabaseClient();
  const edgeClient = new KnowledgeResearchEdgeClient();

  return {
    async getActor() {
      const { data, error } = await supabase.auth.getUser();
      return error || !data.user ? null : { id: data.user.id };
    },
    async getMembership(actorId, organizationId) {
      const { data, error } = await supabase
        .from("organization_memberships")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", actorId)
        .maybeSingle();
      if (error || !data) return null;
      return { role: data.role as AppRole };
    },
    async getAccessToken() {
      const { data, error } = await supabase.auth.getSession();
      return error || !data.session?.access_token ? null : data.session.access_token;
    },
    searchEdge(input, accessToken) {
      return edgeClient.search(input, accessToken);
    },
    dismissEdge(input, accessToken) {
      return edgeClient.dismiss(input, accessToken);
    },
  };
}

export async function searchKnowledgeResearchAction(
  input: unknown,
): Promise<SearchKnowledgeResearchActionResult> {
  return executeSearchKnowledgeResearchAction(input, await createProductionDependencies());
}

export async function dismissKnowledgeResearchCandidateAction(
  input: unknown,
): Promise<DismissKnowledgeResearchActionResult> {
  return executeDismissKnowledgeResearchCandidateAction(input, await createProductionDependencies());
}
