import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

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
const WORKER_SECRET_READ_ATTEMPTS = 3;
const WORKER_SECRET_RETRY_DELAY_MS = 75;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readPublishingWorkerSecret(admin: SupabaseClient): Promise<string | null> {
  for (let attempt = 1; attempt <= WORKER_SECRET_READ_ATTEMPTS; attempt += 1) {
    const { data, error } = await admin.rpc("read_publishing_worker_dispatch_secret");
    if (!error && typeof data === "string" && data.trim()) return data.trim();
    if (attempt < WORKER_SECRET_READ_ATTEMPTS) {
      await sleep(WORKER_SECRET_RETRY_DELAY_MS * attempt);
    }
  }
  return null;
}

async function auditInternalGeneration(
  admin: SupabaseClient,
  organizationId: string,
  productionJobId: string | undefined,
  stage: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await admin.from("integration_audit_events").insert({
      organization_id: organizationId,
      connection_id: null,
      actor_user_id: null,
      event_type: "PUBLISHING_GENERATION_DIAGNOSTIC",
      metadata: {
        stage,
        productionJobId: productionJobId ?? null,
        ...metadata,
      },
    });
  } catch {
    // Diagnostics must never change generation behavior.
  }
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
    typeof body.input !== "string" ||
    !body.input.trim()
  ) {
    return json(400, { error: "INVALID_REQUEST" });
  }

  const internalHeader = req.headers.get("x-publishing-worker-secret") ?? "";
  let internalRequest = false;
  let actorUserId: string | null = null;

  if (internalHeader) {
    const publishingWorkerSecret = await readPublishingWorkerSecret(admin);
    if (!publishingWorkerSecret) return json(503, { error: "WORKER_AUTH_UNAVAILABLE" });
    if (internalHeader !== publishingWorkerSecret) return json(401, { error: "UNAUTHORIZED" });
    internalRequest = true;
    await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "AUTH_OK", {
      instructionChars: body.instructions.length,
      inputChars: body.input.length,
    });
  } else {
    const authorization = req.headers.get("authorization") ?? "";
    const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
    if (!token) return json(401, { error: "UNAUTHORIZED" });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) return json(401, { error: "UNAUTHORIZED" });
    actorUserId = user.id;
  }

  if (
    body.instructions.length > MAX_INSTRUCTIONS_CHARS ||
    body.input.length > MAX_INPUT_CHARS
  ) {
    if (internalRequest) {
      await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "REQUEST_TOO_LARGE", {
        instructionChars: body.instructions.length,
        inputChars: body.input.length,
      });
    }
    return json(400, { error: "INVALID_REQUEST" });
  }

  if (internalRequest) {
    if (!body.productionJobId || !UUID_RE.test(body.productionJobId)) {
      await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "INVALID_PRODUCTION_JOB");
      return json(400, { error: "INVALID_PRODUCTION_JOB" });
    }

    const { data: job, error: jobError } = await admin
      .from("publishing_production_jobs")
      .select("id,organization_id,production_run_id,status")
      .eq("id", body.productionJobId)
      .eq("organization_id", body.organizationId)
      .maybeSingle();
    if (jobError) {
      await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "PRODUCTION_JOB_UNAVAILABLE");
      return json(500, { error: "PRODUCTION_JOB_UNAVAILABLE" });
    }
    if (!job || job.status !== "RUNNING") {
      await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "PRODUCTION_JOB_NOT_RUNNING", {
        jobStatus: job?.status ?? null,
      });
      return json(409, { error: "PRODUCTION_JOB_NOT_RUNNING" });
    }

    const { data: run, error: runError } = await admin
      .from("publishing_production_runs")
      .select("created_by,status,organization_id")
      .eq("id", job.production_run_id)
      .eq("organization_id", body.organizationId)
      .maybeSingle();
    if (runError) {
      await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "PRODUCTION_RUN_UNAVAILABLE");
      return json(500, { error: "PRODUCTION_RUN_UNAVAILABLE" });
    }
    if (!run || !["QUEUED", "RUNNING"].includes(String(run.status))) {
      await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "PRODUCTION_RUN_INACTIVE", {
        runStatus: run?.status ?? null,
      });
      return json(409, { error: "PRODUCTION_RUN_INACTIVE" });
    }
    actorUserId = String(run.created_by);
    await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "JOB_OK");
  }

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", body.organizationId)
    .eq("user_id", actorUserId)
    .maybeSingle();
  if (membershipError) {
    if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "AUTHORIZATION_UNAVAILABLE");
    return json(500, { error: "AUTHORIZATION_UNAVAILABLE" });
  }
  if (!membership || !["OWNER", "ADMIN", "EDITOR"].includes(String(membership.role))) {
    if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "FORBIDDEN");
    return json(403, { error: "FORBIDDEN" });
  }

  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .select("status,config")
    .eq("organization_id", body.organizationId)
    .eq("provider", "OPENAI")
    .maybeSingle();
  if (connectionError) {
    if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "INTEGRATION_UNAVAILABLE");
    return json(500, { error: "INTEGRATION_UNAVAILABLE" });
  }
  if (!connection || connection.status === "NOT_CONFIGURED") {
    if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "OPENAI_NOT_CONFIGURED");
    return json(409, { error: "OPENAI_NOT_CONFIGURED" });
  }
  if (connection.status === "DISABLED") return json(409, { error: "OPENAI_DISABLED" });
  if (connection.status === "INVALID") return json(409, { error: "OPENAI_INVALID" });

  const config = connection.config && typeof connection.config === "object" ? connection.config as Record<string, unknown> : {};
  const configuredModel = typeof config.defaultModel === "string" && config.defaultModel.trim() ? config.defaultModel.trim() : null;
  const requestedModel = typeof body.model === "string" && body.model.trim() ? body.model.trim() : null;
  const model = requestedModel ?? configuredModel ?? "gpt-5.6-luna";
  if (!ALLOWED_MODELS.has(model)) {
    if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "MODEL_NOT_ALLOWED", { model });
    return json(400, { error: "MODEL_NOT_ALLOWED" });
  }

  if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "PRE_QUOTA", { model });
  const requestLimit = internalRequest ? PUBLISHING_RATE_LIMIT_REQUESTS : INTERACTIVE_RATE_LIMIT_REQUESTS;
  const { data: quotaAllowed, error: quotaError } = await admin.rpc("consume_generation_quota", {
    _organization_id: body.organizationId,
    _actor_user_id: actorUserId,
    _window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    _request_limit: requestLimit,
  });
  if (quotaError) {
    if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "QUOTA_UNAVAILABLE");
    return json(500, { error: "QUOTA_UNAVAILABLE" });
  }
  if (quotaAllowed !== true) {
    if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "GENERATION_RATE_LIMITED");
    return json(429, { error: "GENERATION_RATE_LIMITED" });
  }
  if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "QUOTA_OK");

  const { data: apiKey, error: secretError } = await admin.rpc("read_integration_vault_secret", {
    _organization_id: body.organizationId,
    _provider: "OPENAI",
    _secret_name: "API_KEY",
  });
  if (secretError || typeof apiKey !== "string" || !apiKey) {
    if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "OPENAI_VAULT_UNAVAILABLE");
    return json(409, { error: "OPENAI_NOT_CONFIGURED" });
  }
  if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "OPENAI_VAULT_OK");

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
    if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "PROVIDER_UNAVAILABLE");
    return json(502, { error: "PROVIDER_UNAVAILABLE" });
  }

  if (!providerResponse.ok) {
    if (internalRequest) {
      await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "PROVIDER_HTTP_ERROR", {
        providerStatus: providerResponse.status,
      });
    }
    if (providerResponse.status === 401 || providerResponse.status === 403) return json(502, { error: "AUTH_INVALID" });
    if (providerResponse.status === 429) return json(502, { error: "RATE_LIMITED" });
    return json(502, { error: "PROVIDER_ERROR" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await providerResponse.json();
  } catch {
    if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "PROVIDER_RESPONSE_INVALID");
    return json(502, { error: "PROVIDER_RESPONSE_INVALID" });
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    if (internalRequest) await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "EMPTY_PROVIDER_OUTPUT");
    return json(502, { error: "EMPTY_PROVIDER_OUTPUT" });
  }

  if (internalRequest) {
    await auditInternalGeneration(admin, body.organizationId, body.productionJobId, "PROVIDER_OK", {
      model: typeof payload.model === "string" ? payload.model : model,
    });
  }
  return json(200, {
    output_text: outputText,
    model: typeof payload.model === "string" ? payload.model : model,
  });
});
