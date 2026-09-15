import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type Placement =
  | "front-cover"
  | "back-cover"
  | "chapter-opener"
  | "technical-diagram"
  | "practical-photo"
  | "case-study-photo";

type RequestBody = {
  organizationId?: string;
  productionJobId?: string;
  requirementId?: string;
  placement?: Placement;
  chapterId?: string;
  subjectPrompt?: string;
  caption?: string;
  altText?: string;
  realistic?: boolean;
  labelsRequired?: boolean;
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLACEMENTS = new Set<Placement>([
  "front-cover",
  "back-cover",
  "chapter-opener",
  "technical-diagram",
  "practical-photo",
  "case-study-photo",
]);
const IMAGE_MODEL = "gpt-image-2.5-sunburst";
const VERIFIER_MODEL = "gpt-5.6-sol";
const MAX_PROMPT_CHARS = 4_000;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function readPublishingWorkerSecret(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin.rpc("read_publishing_worker_dispatch_secret");
  return !error && typeof data === "string" && data.trim() ? data.trim() : null;
}

function imageGeometry(placement: Placement): { requestedSize: string; width: number; height: number } {
  if (placement === "front-cover" || placement === "back-cover") {
    return { requestedSize: "1600x2400", width: 1600, height: 2400 };
  }
  return { requestedSize: "1600x1200", width: 1600, height: 1200 };
}

function extractOutputText(payload: Record<string, unknown>): string | null {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const candidate = part as { type?: unknown; text?: unknown };
      if (candidate.type === "output_text" && typeof candidate.text === "string") return candidate.text.trim();
    }
  }
  return null;
}

function extractImageBase64(payload: Record<string, unknown>): string | null {
  const data = Array.isArray(payload.data) ? payload.data : [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const b64 = (entry as { b64_json?: unknown }).b64_json;
    if (typeof b64 === "string" && b64.length > 1000) return b64;
  }
  return null;
}

async function verifyGeneratedVisual(input: {
  apiKey: string;
  imageBase64: string;
  body: Required<Pick<RequestBody, "requirementId" | "placement" | "subjectPrompt" | "caption" | "altText" | "realistic" | "labelsRequired">>;
}): Promise<{ realismVerified: boolean; labelsPresent: boolean; reason: string }> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: VERIFIER_MODEL,
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Audit this generated image for a professional Polish Railway Academy textbook.",
              `Requirement: ${input.body.subjectPrompt}`,
              `Placement: ${input.body.placement}`,
              `Caption: ${input.body.caption}`,
              `Realism required: ${input.body.realistic}`,
              `Technical labels required: ${input.body.labelsRequired}`,
              "Reject obvious AI artefacts, fantasy railway hardware, illegible/gibberish labels, watermarks, stock-photo marks, and unrelated imagery.",
              "For technical diagrams with labels required, labelsPresent is true only when meaningful legible component callouts are visibly present.",
              "Return strict JSON only: {\"realismVerified\":boolean,\"labelsPresent\":boolean,\"reason\":string}.",
            ].join("\n"),
          },
          { type: "input_image", image_url: `data:image/jpeg;base64,${input.imageBase64}` },
        ],
      }],
      max_output_tokens: 500,
    }),
  });
  if (!response.ok) throw new Error(`Visual verifier failed with HTTP ${response.status}.`);
  const payload = await response.json() as Record<string, unknown>;
  const text = extractOutputText(payload);
  if (!text) throw new Error("Visual verifier returned no output.");
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  if (typeof parsed.realismVerified !== "boolean" || typeof parsed.labelsPresent !== "boolean") {
    throw new Error("Visual verifier returned an invalid contract.");
  }
  return {
    realismVerified: parsed.realismVerified,
    labelsPresent: parsed.labelsPresent,
    reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 500) : "",
  };
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

  const workerSecret = await readPublishingWorkerSecret(admin);
  const suppliedSecret = req.headers.get("x-publishing-worker-secret") ?? "";
  if (!workerSecret) return json(503, { error: "WORKER_AUTH_UNAVAILABLE" });
  if (!suppliedSecret || suppliedSecret !== workerSecret) return json(401, { error: "UNAUTHORIZED" });

  let body: RequestBody;
  try { body = await req.json(); } catch { return json(400, { error: "INVALID_REQUEST" }); }
  if (
    !body.organizationId || !UUID_RE.test(body.organizationId) ||
    !body.productionJobId || !UUID_RE.test(body.productionJobId) ||
    typeof body.requirementId !== "string" || !body.requirementId.trim() ||
    typeof body.placement !== "string" || !PLACEMENTS.has(body.placement as Placement) ||
    typeof body.subjectPrompt !== "string" || !body.subjectPrompt.trim() || body.subjectPrompt.length > MAX_PROMPT_CHARS ||
    typeof body.caption !== "string" || !body.caption.trim() ||
    typeof body.altText !== "string" || !body.altText.trim() ||
    typeof body.realistic !== "boolean" || typeof body.labelsRequired !== "boolean"
  ) return json(400, { error: "INVALID_REQUEST" });

  const placement = body.placement as Placement;
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
  if (!run || !["QUEUED", "RUNNING"].includes(String(run.status))) return json(409, { error: "PRODUCTION_RUN_INACTIVE" });

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", body.organizationId)
    .eq("user_id", String(run.created_by))
    .maybeSingle();
  if (membershipError) return json(500, { error: "AUTHORIZATION_UNAVAILABLE" });
  if (!membership || !["OWNER", "ADMIN", "EDITOR"].includes(String(membership.role))) return json(403, { error: "FORBIDDEN" });

  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .select("status")
    .eq("organization_id", body.organizationId)
    .eq("provider", "OPENAI")
    .maybeSingle();
  if (connectionError) return json(500, { error: "INTEGRATION_UNAVAILABLE" });
  if (!connection || connection.status !== "CONFIGURED") return json(409, { error: "OPENAI_NOT_CONFIGURED" });

  const { data: apiKey, error: secretError } = await admin.rpc("read_integration_vault_secret", {
    _organization_id: body.organizationId,
    _provider: "OPENAI",
    _secret_name: "API_KEY",
  });
  if (secretError || typeof apiKey !== "string" || !apiKey) return json(409, { error: "OPENAI_NOT_CONFIGURED" });

  const { data: quotaAllowed, error: quotaError } = await admin.rpc("consume_generation_quota", {
    _organization_id: body.organizationId,
    _actor_user_id: String(run.created_by),
    _window_seconds: 600,
    _request_limit: 120,
  });
  if (quotaError) return json(500, { error: "QUOTA_UNAVAILABLE" });
  if (quotaAllowed !== true) return json(429, { error: "GENERATION_RATE_LIMITED" });

  const { requestedSize, width, height } = imageGeometry(placement);
  const prompt = [
    body.subjectPrompt,
    "Professional railway textbook visual for Polish Railway Academy.",
    "Photorealistic and technically credible; authentic European railway equipment and environment.",
    "No logos, watermarks, signatures, decorative fake text, fantasy machinery, or irrelevant objects.",
    body.labelsRequired
      ? "Create a clean educational technical illustration with meaningful, legible English component labels and callout lines. Do not invent component names."
      : "Do not render text inside the image; typography and branding will be added by the textbook renderer.",
    placement === "front-cover" || placement === "back-cover"
      ? "Portrait A4-like composition with safe negative space for a premium navy/red academic text overlay; no embedded title text."
      : "Compose for a textbook figure with clear subject focus and educational value.",
  ].join("\n");

  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        size: requestedSize,
        quality: "high",
        output_format: "jpeg",
        output_compression: 90,
        background: "opaque",
        n: 1,
      }),
    });
  } catch {
    return json(502, { error: "PROVIDER_UNAVAILABLE" });
  }
  if (!providerResponse.ok) {
    return json(502, { error: "PROVIDER_ERROR", providerStatus: providerResponse.status });
  }
  const providerPayload = await providerResponse.json() as Record<string, unknown>;
  const imageBase64 = extractImageBase64(providerPayload);
  if (!imageBase64) return json(502, { error: "EMPTY_PROVIDER_OUTPUT" });

  let verification: { realismVerified: boolean; labelsPresent: boolean; reason: string };
  try {
    verification = await verifyGeneratedVisual({
      apiKey,
      imageBase64,
      body: {
        requirementId: body.requirementId,
        placement,
        subjectPrompt: body.subjectPrompt,
        caption: body.caption,
        altText: body.altText,
        realistic: body.realistic,
        labelsRequired: body.labelsRequired,
      },
    });
  } catch {
    return json(502, { error: "VISUAL_VERIFICATION_UNAVAILABLE" });
  }
  if (body.realistic && !verification.realismVerified) {
    return json(422, { error: "VISUAL_REALISM_REJECTED", reason: verification.reason });
  }
  if (body.labelsRequired && !verification.labelsPresent) {
    return json(422, { error: "VISUAL_LABELS_REJECTED", reason: verification.reason });
  }

  return json(200, {
    requirementId: body.requirementId,
    assetId: `${body.productionJobId}:${body.requirementId}:${IMAGE_MODEL}`,
    mimeType: "image/jpeg",
    width,
    height,
    imageBase64,
    sourceKind: "generated",
    provenance: `OpenAI ${IMAGE_MODEL}; generated for production job ${body.productionJobId}; verified by ${VERIFIER_MODEL}`,
    realismVerified: verification.realismVerified,
    labelsPresent: verification.labelsPresent,
    verificationReason: verification.reason,
    model: IMAGE_MODEL,
  });
});
