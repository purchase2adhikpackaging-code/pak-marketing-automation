import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Provider = "OPENAI" | "META" | "LTX";
type Action = "save" | "test" | "remove" | "update_config" | "set_disabled";

type RequestBody = {
  action?: Action;
  organizationId?: string;
  provider?: Provider;
  secretName?: string;
  secretValue?: string;
  config?: Record<string, unknown>;
  disabled?: boolean;
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_NAME_RE = /^[A-Z][A-Z0-9_]{1,63}$/;
const SENSITIVE_CONFIG_KEY_RE = /(api.?key|secret|token|password|credential|private.?key)/i;
const PROVIDERS = new Set<Provider>(["OPENAI", "META", "LTX"]);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function maskedHint(secret: string) {
  return `••••${secret.slice(-4)}`;
}

function containsSensitiveConfigKey(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== "object") return false;
  if (depth > 8) return true;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_CONFIG_KEY_RE.test(key)) return true;
    if (containsSensitiveConfigKey(nested, depth + 1)) return true;
  }

  return false;
}

function safeConnection(row: Record<string, unknown>) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    provider: row.provider,
    ...(row.display_name ? { displayName: row.display_name } : {}),
    status: row.status,
    config: row.config ?? {},
    secretVersion: row.secret_version,
    ...(row.masked_hint ? { maskedHint: row.masked_hint } : {}),
    ...(row.last_verified_at ? { lastVerifiedAt: row.last_verified_at } : {}),
    ...(row.last_error_code ? { lastErrorCode: row.last_error_code } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseBody(input: RequestBody): { ok: true; value: Required<Pick<RequestBody, "action" | "organizationId" | "provider">> & RequestBody } | { ok: false } {
  if (!input || typeof input !== "object") return { ok: false };
  if (!input.action || !["save", "test", "remove", "update_config", "set_disabled"].includes(input.action)) return { ok: false };
  if (!input.organizationId || !UUID_RE.test(input.organizationId)) return { ok: false };
  if (!input.provider || !PROVIDERS.has(input.provider)) return { ok: false };
  if (["save", "remove"].includes(input.action) && (!input.secretName || !SECRET_NAME_RE.test(input.secretName))) return { ok: false };
  if (input.action === "save" && (typeof input.secretValue !== "string" || input.secretValue.trim().length < 8)) return { ok: false };
  if (
    input.action === "update_config" &&
    (!input.config || typeof input.config !== "object" || Array.isArray(input.config) || containsSensitiveConfigKey(input.config))
  ) return { ok: false };
  if (input.action === "set_disabled" && typeof input.disabled !== "boolean") return { ok: false };
  return { ok: true, value: input as Required<Pick<RequestBody, "action" | "organizationId" | "provider">> & RequestBody };
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

  let raw: RequestBody;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "INVALID_REQUEST" });
  }

  const parsed = parseBody(raw);
  if (!parsed.ok) return json(400, { error: "INVALID_REQUEST" });
  const input = parsed.value;

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", input.organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) return json(500, { error: "AUTHORIZATION_UNAVAILABLE" });
  if (!membership || !["OWNER", "ADMIN"].includes(String(membership.role))) return json(403, { error: "FORBIDDEN" });

  const getConnection = async () => {
    const { data, error } = await admin
      .from("integration_connections")
      .select("id,organization_id,provider,display_name,status,config,secret_version,masked_hint,last_verified_at,last_error_code,created_at,updated_at")
      .eq("organization_id", input.organizationId)
      .eq("provider", input.provider)
      .maybeSingle();
    if (error || !data) return null;
    return safeConnection(data as Record<string, unknown>);
  };

  if (input.action === "save") {
    const { error } = await admin.rpc("save_integration_vault_secret", {
      _organization_id: input.organizationId,
      _provider: input.provider,
      _actor_user_id: user.id,
      _secret_name: input.secretName,
      _secret_value: input.secretValue,
      _masked_hint: maskedHint(input.secretValue!),
    });
    if (error) return json(500, { error: "SAVE_FAILED" });
    const connection = await getConnection();
    return connection ? json(200, { connection }) : json(500, { error: "SAVE_FAILED" });
  }

  if (input.action === "remove") {
    const { data: removed, error } = await admin.rpc("remove_integration_vault_secret", {
      _organization_id: input.organizationId,
      _provider: input.provider,
      _actor_user_id: user.id,
      _secret_name: input.secretName,
    });
    if (error) return json(500, { error: "REMOVE_FAILED" });
    if (removed !== true) return json(404, { error: "NOT_CONFIGURED" });
    const connection = await getConnection();
    return connection ? json(200, { connection }) : json(500, { error: "REMOVE_FAILED" });
  }

  if (input.action === "update_config") {
    const { data: connectionId, error } = await admin.rpc("update_integration_connection_config", {
      _organization_id: input.organizationId,
      _provider: input.provider,
      _actor_user_id: user.id,
      _config: input.config,
    });
    if (error) return json(500, { error: "UPDATE_FAILED" });
    if (typeof connectionId !== "string" || !connectionId) return json(404, { error: "NOT_CONFIGURED" });
    const connection = await getConnection();
    return connection ? json(200, { connection }) : json(500, { error: "UPDATE_FAILED" });
  }

  if (input.action === "set_disabled") {
    const { data: connectionId, error } = await admin.rpc("set_integration_connection_disabled", {
      _organization_id: input.organizationId,
      _provider: input.provider,
      _actor_user_id: user.id,
      _disabled: input.disabled,
    });
    if (error) return json(500, { error: "UPDATE_FAILED" });
    if (typeof connectionId !== "string" || !connectionId) return json(404, { error: "NOT_CONFIGURED" });
    const connection = await getConnection();
    return connection ? json(200, { connection }) : json(500, { error: "UPDATE_FAILED" });
  }

  if (input.provider !== "OPENAI") return json(400, { error: "TEST_NOT_IMPLEMENTED" });

  const { data: apiKey, error: secretError } = await admin.rpc("read_integration_vault_secret", {
    _organization_id: input.organizationId,
    _provider: "OPENAI",
    _secret_name: "API_KEY",
  });
  if (secretError || typeof apiKey !== "string" || !apiKey) return json(404, { error: "NOT_CONFIGURED" });

  const providerResponse = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  const ok = providerResponse.ok;
  const now = new Date().toISOString();
  const { data: connectionRow } = await admin
    .from("integration_connections")
    .update({
      status: ok ? "CONFIGURED" : "INVALID",
      last_verified_at: now,
      last_error_code: ok ? null : "AUTH_INVALID",
      updated_by: user.id,
      updated_at: now,
    })
    .eq("organization_id", input.organizationId)
    .eq("provider", "OPENAI")
    .select("id")
    .maybeSingle();

  if (connectionRow) {
    await admin.from("integration_audit_events").insert({
      organization_id: input.organizationId,
      connection_id: connectionRow.id,
      actor_user_id: user.id,
      event_type: ok ? "TEST_SUCCEEDED" : "TEST_FAILED",
      metadata: ok ? {} : { error_code: "AUTH_INVALID" },
    });
  }

  if (!ok) return json(422, { error: "AUTH_INVALID" });
  const connection = await getConnection();
  return connection ? json(200, { connection }) : json(500, { error: "TEST_FAILED" });
});