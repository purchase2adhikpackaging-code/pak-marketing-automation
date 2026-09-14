import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Client, StreamableHTTPClientTransport } from "npm:@modelcontextprotocol/client@2.0.0";
import {
  MAX_RESEARCH_RESULTS,
  RESEARCH_PROVIDER_TIMEOUT_MS,
  countExaStructuredResults,
  extractExaTextBlocks,
  normalizeExaToolResult,
} from "./normalize.ts";

type SearchIntent = {
  action: "search";
  organizationId: string;
  query: string;
};

type DismissIntent = {
  action: "dismiss";
  organizationId: string;
  candidateId: string;
};

type ResearchIntent = SearchIntent | DismissIntent;
type FailureCode =
  | "CREDENTIAL_REQUIRED"
  | "TEMPORARY_UNAVAILABLE"
  | "MALFORMED_RESPONSE"
  | "PROVIDER_TOOL_UNAVAILABLE"
  | "PERSISTENCE_FAILED";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGER_ROLES = ["OWNER", "ADMIN", "EDITOR"] as const;
const EXA_MCP_ENDPOINT = new URL("https://mcp.exa.ai/mcp");
const NO_RESULTS_MARKER = "No search results found";

class ResearchFailure extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
  }
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === [...expected].sort()[index]);
}

function parseIntent(raw: unknown): ResearchIntent | null {
  if (!isRecord(raw) || typeof raw.action !== "string") return null;

  if (raw.action === "search") {
    if (!exactKeys(raw, ["action", "organizationId", "query"])) return null;
    if (typeof raw.organizationId !== "string" || !UUID_RE.test(raw.organizationId)) return null;
    if (typeof raw.query !== "string") return null;
    const query = raw.query.trim();
    if (query.length < 3 || query.length > 300) return null;
    return { action: "search", organizationId: raw.organizationId, query };
  }

  if (raw.action === "dismiss") {
    if (!exactKeys(raw, ["action", "candidateId", "organizationId"])) return null;
    if (typeof raw.organizationId !== "string" || !UUID_RE.test(raw.organizationId)) return null;
    if (typeof raw.candidateId !== "string" || !UUID_RE.test(raw.candidateId)) return null;
    return { action: "dismiss", organizationId: raw.organizationId, candidateId: raw.candidateId };
  }

  return null;
}

function stringValue(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function nullableString(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value ? value : undefined;
}

function safeRun(row: Record<string, unknown>) {
  return {
    id: stringValue(row, "id"),
    organizationId: stringValue(row, "organization_id"),
    query: stringValue(row, "query"),
    provider: "EXA_MCP",
    status: stringValue(row, "status"),
    resultCount: typeof row.result_count === "number" ? row.result_count : 0,
    ...(nullableString(row, "failure_code") ? { failureCode: nullableString(row, "failure_code") } : {}),
    ...(nullableString(row, "created_by") ? { createdBy: nullableString(row, "created_by") } : {}),
    createdAt: stringValue(row, "created_at"),
    ...(nullableString(row, "completed_at") ? { completedAt: nullableString(row, "completed_at") } : {}),
  };
}

function safeCandidate(row: Record<string, unknown>) {
  return {
    id: stringValue(row, "id"),
    organizationId: stringValue(row, "organization_id"),
    researchRunId: stringValue(row, "research_run_id"),
    provider: "EXA_MCP",
    title: stringValue(row, "title"),
    canonicalUrl: stringValue(row, "canonical_url"),
    sourceHost: stringValue(row, "source_host"),
    excerpt: stringValue(row, "excerpt"),
    retrievedAt: stringValue(row, "retrieved_at"),
    reviewStatus: stringValue(row, "review_status"),
    ...(nullableString(row, "knowledge_record_id")
      ? { knowledgeRecordId: nullableString(row, "knowledge_record_id") }
      : {}),
    createdAt: stringValue(row, "created_at"),
  };
}

function toolText(raw: unknown): string {
  return extractExaTextBlocks(raw).join("\n");
}

function classifyProviderFailure(error: unknown): FailureCode {
  if (error instanceof ResearchFailure) return error.code;
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (
    normalized.includes("unauthorized") ||
    normalized.includes("authentication required") ||
    normalized.includes("requires authentication") ||
    normalized.includes("api key") ||
    normalized.includes("oauth") ||
    /\b401\b|\b403\b/.test(normalized)
  ) {
    return "CREDENTIAL_REQUIRED";
  }

  return "TEMPORARY_UNAVAILABLE";
}

async function withProviderTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new ResearchFailure("TEMPORARY_UNAVAILABLE")),
      RESEARCH_PROVIDER_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function searchAnonymousExa(query: string) {
  const client = new Client(
    { name: "pak-knowledge-research", version: "1.0.0" },
    { versionNegotiation: { mode: "legacy" } },
  );
  const transport = new StreamableHTTPClientTransport(EXA_MCP_ENDPOINT);

  try {
    const toolResult = await withProviderTimeout(
      (async () => {
        await client.connect(transport);
        const tools = await client.listTools();
        if (!tools.tools.some((tool) => tool.name === "web_search_exa")) {
          throw new ResearchFailure("PROVIDER_TOOL_UNAVAILABLE");
        }

        return await client.callTool({
          name: "web_search_exa",
          arguments: { query, numResults: MAX_RESEARCH_RESULTS },
        });
      })(),
    );

    const text = toolText(toolResult);
    if ((toolResult as { isError?: boolean }).isError) {
      throw new Error(text || "provider tool error");
    }

    const textBlocks = extractExaTextBlocks(toolResult);
    if (textBlocks.length === 0) throw new ResearchFailure("MALFORMED_RESPONSE");

    const retrievedAt = new Date().toISOString();
    const hits = normalizeExaToolResult(toolResult, retrievedAt);
    const structuredCount = countExaStructuredResults(toolResult);
    const isExplicitNoResults = text.includes(NO_RESULTS_MARKER);

    if (hits.length === 0 && structuredCount === 0 && !isExplicitNoResults) {
      throw new ResearchFailure("MALFORMED_RESPONSE");
    }

    return {
      hits,
      status: structuredCount > hits.length ? "PARTIAL" as const : "COMPLETED" as const,
    };
  } catch (error) {
    throw new ResearchFailure(classifyProviderFailure(error));
  } finally {
    await client.close().catch(() => undefined);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "SERVER_MISCONFIGURED" });

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return json(401, { error: "UNAUTHORIZED" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) return json(401, { error: "UNAUTHORIZED" });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "INVALID_REQUEST" });
  }

  const input = parseIntent(raw);
  if (!input) return json(400, { error: "INVALID_REQUEST" });

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", input.organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) return json(500, { error: "AUTHORIZATION_UNAVAILABLE" });
  if (!membership || !["OWNER", "ADMIN", "EDITOR"].includes(String(membership.role))) {
    return json(403, { error: "FORBIDDEN" });
  }

  if (input.action === "dismiss") {
    const { data: existing, error: existingError } = await admin
      .from("research_candidates")
      .select("id,organization_id,research_run_id,provider,title,canonical_url,source_host,excerpt,retrieved_at,review_status,knowledge_record_id,created_at")
      .eq("id", input.candidateId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();

    if (existingError) return json(500, { error: "PERSISTENCE_FAILED" });
    if (!existing) return json(404, { error: "NOT_FOUND" });
    if (existing.review_status === "CONVERTED") return json(409, { error: "ALREADY_CONVERTED" });
    if (existing.review_status === "DISMISSED") {
      return json(200, { candidate: safeCandidate(existing as Record<string, unknown>) });
    }

    const { data: dismissed, error: dismissError } = await admin
      .from("research_candidates")
      .update({ review_status: "DISMISSED" })
      .eq("id", input.candidateId)
      .eq("organization_id", input.organizationId)
      .eq("review_status", "SUGGESTED")
      .select("id,organization_id,research_run_id,provider,title,canonical_url,source_host,excerpt,retrieved_at,review_status,knowledge_record_id,created_at")
      .maybeSingle();

    if (dismissError) return json(500, { error: "PERSISTENCE_FAILED" });
    if (dismissed) return json(200, { candidate: safeCandidate(dismissed as Record<string, unknown>) });

    const { data: current } = await admin
      .from("research_candidates")
      .select("id,organization_id,research_run_id,provider,title,canonical_url,source_host,excerpt,retrieved_at,review_status,knowledge_record_id,created_at")
      .eq("id", input.candidateId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();

    if (!current) return json(404, { error: "NOT_FOUND" });
    if (current.review_status === "DISMISSED") {
      return json(200, { candidate: safeCandidate(current as Record<string, unknown>) });
    }
    return json(409, { error: "CANDIDATE_STATE_CHANGED" });
  }

  const { data: run, error: runError } = await admin
    .from("research_runs")
    .insert({
      organization_id: input.organizationId,
      query: input.query,
      provider: "EXA_MCP",
      status: "RUNNING",
      result_count: 0,
      created_by: user.id,
    })
    .select("id,organization_id,query,provider,status,result_count,failure_code,created_by,created_at,completed_at")
    .single();

  if (runError || !run) return json(500, { error: "PERSISTENCE_FAILED" });

  const finishRun = async (
    status: "COMPLETED" | "PARTIAL" | "FAILED",
    resultCount: number,
    failureCode: FailureCode | null,
  ) => {
    const { data, error } = await admin
      .from("research_runs")
      .update({
        status,
        result_count: resultCount,
        failure_code: failureCode,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .eq("organization_id", input.organizationId)
      .select("id,organization_id,query,provider,status,result_count,failure_code,created_by,created_at,completed_at")
      .single();
    return error || !data ? null : data as Record<string, unknown>;
  };

  try {
    const result = await searchAnonymousExa(input.query);
    let candidateRows: Record<string, unknown>[] = [];

    if (result.hits.length > 0) {
      const { data: candidates, error: candidateError } = await admin
        .from("research_candidates")
        .insert(
          result.hits.map((hit) => ({
            organization_id: input.organizationId,
            research_run_id: run.id,
            provider: "EXA_MCP",
            title: hit.title,
            canonical_url: hit.canonicalUrl,
            source_host: hit.sourceHost,
            excerpt: hit.excerpt,
            retrieved_at: hit.retrievedAt,
            review_status: "SUGGESTED",
          })),
        )
        .select("id,organization_id,research_run_id,provider,title,canonical_url,source_host,excerpt,retrieved_at,review_status,knowledge_record_id,created_at");

      if (candidateError || !candidates) throw new ResearchFailure("PERSISTENCE_FAILED");
      candidateRows = candidates as Record<string, unknown>[];
    }

    const completedRun = await finishRun(result.status, candidateRows.length, null);
    if (!completedRun) return json(500, { error: "PERSISTENCE_FAILED" });

    return json(200, {
      run: safeRun(completedRun),
      candidates: candidateRows.map(safeCandidate),
    });
  } catch (error) {
    const code = classifyProviderFailure(error);
    await finishRun("FAILED", 0, code);
    return json(code === "CREDENTIAL_REQUIRED" ? 503 : 502, {
      error: code === "CREDENTIAL_REQUIRED" ? "CREDENTIAL_REQUIRED" : "RESEARCH_UNAVAILABLE",
      code,
    });
  }
});
