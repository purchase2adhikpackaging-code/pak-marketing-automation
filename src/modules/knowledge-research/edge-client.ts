import "server-only";

import { z } from "zod";

import { getPublicEnv } from "@/lib/env/public";
import type { ResearchCandidate, ResearchRun } from "./types";

export type ResearchEdgeFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type ResearchEdgeErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CREDENTIAL_REQUIRED"
  | "TEMPORARY_UNAVAILABLE"
  | "NOT_FOUND"
  | "CONFLICT";

export type SearchResearchEdgeResult =
  | { ok: true; run: ResearchRun; candidates: ResearchCandidate[] }
  | { ok: false; code: ResearchEdgeErrorCode; error: string };

export type DismissResearchEdgeResult =
  | { ok: true; candidate: ResearchCandidate }
  | { ok: false; code: ResearchEdgeErrorCode; error: string };

type EdgeClientOptions = {
  fetchImpl?: ResearchEdgeFetch;
  supabaseUrl?: string;
  timeoutMs?: number;
};

const researchRunSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  query: z.string(),
  provider: z.literal("EXA_MCP"),
  status: z.enum(["RUNNING", "COMPLETED", "PARTIAL", "FAILED"]),
  resultCount: z.number().int().min(0).max(8),
  failureCode: z.string().optional(),
  createdBy: z.string().uuid().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
}).strict();

const researchCandidateSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  researchRunId: z.string().uuid(),
  provider: z.literal("EXA_MCP"),
  title: z.string().min(1).max(500),
  canonicalUrl: z.string().url().max(2048),
  sourceHost: z.string().min(1).max(255),
  excerpt: z.string().min(1).max(4000),
  retrievedAt: z.string(),
  reviewStatus: z.enum(["SUGGESTED", "CONVERTED", "DISMISSED"]),
  knowledgeRecordId: z.string().uuid().optional(),
  createdAt: z.string(),
}).strict();

const searchResponseSchema = z.object({
  run: researchRunSchema,
  candidates: z.array(researchCandidateSchema).max(8),
}).strict();

const dismissResponseSchema = z.object({
  candidate: researchCandidateSchema,
}).strict();

const errorResponseSchema = z.object({
  error: z.string().optional(),
  code: z.string().optional(),
}).passthrough();

function safeError(code: ResearchEdgeErrorCode): string {
  switch (code) {
    case "CREDENTIAL_REQUIRED":
      return "Research route requires credentials.";
    case "UNAUTHORIZED":
      return "Research session is unauthorized.";
    case "FORBIDDEN":
      return "Research access is forbidden.";
    case "NOT_FOUND":
      return "Research source was not found.";
    case "CONFLICT":
      return "Research source changed before the action completed.";
    default:
      return "Research provider is temporarily unavailable.";
  }
}

function failureCode(status: number, payload: unknown): ResearchEdgeErrorCode {
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success && parsed.data.code === "CREDENTIAL_REQUIRED") return "CREDENTIAL_REQUIRED";
  if (parsed.success && parsed.data.error === "CREDENTIAL_REQUIRED") return "CREDENTIAL_REQUIRED";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  return "TEMPORARY_UNAVAILABLE";
}

export class KnowledgeResearchEdgeClient {
  private readonly fetchImpl: ResearchEdgeFetch;
  private readonly supabaseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: EdgeClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.supabaseUrl = options.supabaseUrl ?? getPublicEnv().NEXT_PUBLIC_SUPABASE_URL;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async search(
    input: { organizationId: string; query: string },
    accessToken: string,
  ): Promise<SearchResearchEdgeResult> {
    const result = await this.invoke(
      { action: "search", organizationId: input.organizationId, query: input.query },
      accessToken,
    );
    if (!result.ok) return result;

    const parsed = searchResponseSchema.safeParse(result.payload);
    if (!parsed.success) {
      return {
        ok: false,
        code: "TEMPORARY_UNAVAILABLE",
        error: safeError("TEMPORARY_UNAVAILABLE"),
      };
    }

    return { ok: true, run: parsed.data.run, candidates: parsed.data.candidates };
  }

  async dismiss(
    input: { organizationId: string; candidateId: string },
    accessToken: string,
  ): Promise<DismissResearchEdgeResult> {
    const result = await this.invoke(
      { action: "dismiss", organizationId: input.organizationId, candidateId: input.candidateId },
      accessToken,
    );
    if (!result.ok) return result;

    const parsed = dismissResponseSchema.safeParse(result.payload);
    if (!parsed.success) {
      return {
        ok: false,
        code: "TEMPORARY_UNAVAILABLE",
        error: safeError("TEMPORARY_UNAVAILABLE"),
      };
    }

    return { ok: true, candidate: parsed.data.candidate };
  }

  private async invoke(
    body: Record<string, string>,
    accessToken: string,
  ): Promise<
    | { ok: true; payload: unknown }
    | { ok: false; code: ResearchEdgeErrorCode; error: string }
  > {
    const endpoint = new URL("/functions/v1/knowledge-research", this.supabaseUrl).toString();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const code = failureCode(response.status, payload);
        return { ok: false, code, error: safeError(code) };
      }

      return { ok: true, payload };
    } catch {
      return {
        ok: false,
        code: "TEMPORARY_UNAVAILABLE",
        error: safeError("TEMPORARY_UNAVAILABLE"),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
