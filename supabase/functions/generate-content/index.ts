import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type RequestBody = {
  organizationId?: string;
  productionJobId?: string;
  model?: string;
  instructions?: string;
  input?: string;
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_MODELS = new Set(["gpt-5.6-luna", "gpt-5.6-terra"]);
const MAX_INSTRUCTIONS_CHARS = 12_000;
const MAX_INPUT_CHARS = 60_000;
const MAX_OUTPUT_TOKENS = 4_000;
const RATE_LIMIT_WINDOW_SECONDS = 600;
const INTERACTIVE_RATE_LIMIT_REQUESTS = 20;
const PUBLISHING_RATE_LIMIT_REQUESTS = 120;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function extractOutputText(payload: Record<string, unknown>): string | null {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const value = part as { type?: unknown; text?: unknown };
      if (value.type === "output_text" && typeof value.text === "string" && value.text.trim()) return value.text.trim();
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publishingWorkerSecret = Deno.env.get("PUBLISHING_WORKER_SECRET");
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "SERVER_MISCONFIGURED" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "INVALID_REQUEST" });
  }

  if (
    !body.organizationId ||
    !UUID_RE.test(body.organizationId) ||
    typeof body.instructions !== "string" ||
    !body.instructions.trim() ||
    body.instructions.length > MAX_INSTRUCTIONS_CHARS ||
    typeof body.input !== "string" ||
    !body.input.trim() ||
    body.input.length > MAX_INPUT_CHARS
  ) {
    return json(400, { error: "INVALID_REQUEST" });
  }

  const internalHeader = req.headers.get("x-publishing-worker-secret") ?? "";
  const internalRequest = Boolean(
    publishingWorkerSecret && internalHeader && internalHeader === publishingWorkerSecret,
  );

  let actorUserId: string | null = null;

  if (internalRequest) {
    if (!body.productionJobId || !UUID_RE.test(body.productionJobId)) {
      return json(400, { error: "INVALID_PRODUCTION_JOB" });
    }

    const { data: job, error: jobError } = await admin
      .from("publishing_production_jobs")
      .select("id,organization_id,production_run_id,status")
      .eq("id", body.productionJobId)
      .eq("organization_id", body.organizationId)
      .maybeSingle();
    if (jobError) return json(500, { error: "PRODUCTION_JOB_UNAVAILABLE" });
    if (!job || job.status !== "RUNNING") return json(409, { error: "PRODUCTION_JOB_NOT_RUNNING" });

    const { data: run, error: runError } = await admin
      .from("publishing_production_runs")
      .select("created_by,status,organization_id")
      .eq("id", job.production_run_id)
      .eq("organization_id", body.organizationId)
      .maybeSingle();
    if (runError) return json(500, { error: "PRODUCTION_RUN_UNAVAILABLE" });
    if (!run || !["QUEUED", "RUNNING"].includes(String(run.status))) {
      return json(409, { error: "PRODUCTION_RUN_INACTIVE" });
    }
    actorUserId = String(run.created_by);
  } else {
    const authorization = req.headers.get("authorization") ?? "";
    const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
    if (!token) return json(401, { error: "UNAUTHORIZED" });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) return json(401, { error: "UNAUTHORIZED" });
    actorUserId = user.id;
  }

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", body.organizationId)
    .eq("user_id", actorUserId)
    .maybeSingle();
  if (membershipError) return json(500, { error: "AUTHORIZATION_UNAVAILABLE" });
  if (!membership || !["OWNER", "ADMIN", "EDITOR"].includes(String(membership.role))) return json(403, { error: "FORBIDDEN" });

  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .select("status,config")
    .eq("organization_id", body.organizationId)
    .eq("provider", "OPENAI")
    .maybeSingle();
  if (connectionError) return json(500, { error: "INTEGRATION_UNAVAILABLE" });
  if (!connection || connection.status === "NOT_CONFIGURED") return json(409, { error: "OPENAI_NOT_CONFIGURED" });
  if (connection.status === "DISABLED") return json(409, { error: "OPENAI_DISABLED" });
  if (connection.status === "INVALID") return json(409, { error: "OPENAI_INVALID" });

  const config = connection.config && typeof connection.config === "object" ? connection.config as Record<string, unknown> : {};
  const configuredModel = typeof config.defaultModel === "string" && config.defaultModel.trim() ? config.defaultModel.trim() : null;
  const requestedModel = typeof body.model === "string" && body.model.trim() ? body.model.trim() : null;
  const model = requestedModel ?? configuredModel ?? "gpt-5.6-luna";
  if (!ALLOWED_MODELS.has(model)) return json(400, { error: "MODEL_NOT_ALLOWED" });

  const requestLimit = internalRequest ? PUBLISHING_RATE_LIMIT_REQUESTS : INTERACTIVE_RATE_LIMIT_REQUESTS;
  const { data: quotaAllowed, error: quotaError } = await admin.rpc("consume_generation_quota", {
    _organization_id: body.organizationId,
    _actor_user_id: actorUserId,
    _window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    _request_limit: requestLimit,
  });
  if (quotaError) return json(500, { error: "QUOTA_UNAVAILABLE" });
  if (quotaAllowed !== true) return json(429, { error: "GENERATION_RATE_LIMITED" });

  const { data: apiKey, error: secretError } = await admin.rpc("read_integration_vault_secret", {
    _organization_id: body.organizationId,
    _provider: "OPENAI",
    _secret_name: "API_KEY",
  });
  if (secretError || typeof apiKey !== "string" || !apiKey) return json(409, { error: "OPENAI_NOT_CONFIGURED" });

  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: body.instructions,
        input: body.input,
        max_output_tokens: MAX_OUTPUT_TOKENS,
      }),
    });
  } catch {
    return json(502, { error: "PROVIDER_UNAVAILABLE" });
  }

  if (!providerResponse.ok) {
    if (providerResponse.status === 401 || providerResponse.status === 403) return json(502, { error: "AUTH_INVALID" });
    if (providerResponse.status === 429) return json(502, { error: "RATE_LIMITED" });
    return json(502, { error: "PROVIDER_ERROR" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await providerResponse.json();
  } catch {
    return json(502, { error: "PROVIDER_RESPONSE_INVALID" });
  }

  const outputText = extractOutputText(payload);
  if (!outputText) return json(502, { error: "EMPTY_PROVIDER_OUTPUT" });

  return json(200, {
    output_text: outputText,
    model: typeof payload.model === "string" ? payload.model : model,
  });
});
