import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Operation = "submit" | "reconcile";
type RequestBody = {
  operation?: Operation;
  organizationId?: string;
  jobId?: string;
  attemptId?: string;
};

type SafeProviderError = {
  code: string;
  message: string;
  retryable: boolean;
};

type GenerationInput = {
  planVersionId: string;
  sceneId: string;
  shotId: string;
  prompt: string;
  cameraMotion?: string;
  aspectRatio: "16:9" | "9:16";
  durationSeconds: number;
  generateAudio: false;
  provider: "LTX";
  providerModel: "ltx-2-3-pro";
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LTX_ENDPOINT = "https://api.ltx.io/v2/text-to-video";
const LTX_MODEL = "ltx-2-3-pro";
const LTX_FPS = 24;
const GENERATED_MEDIA_BUCKET = "generated-media";
const MAX_GENERATED_VIDEO_BYTES = 256 * 1024 * 1024;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function parseRequestBody(input: RequestBody): input is Required<RequestBody> {
  return (
    !!input &&
    (input.operation === "submit" || input.operation === "reconcile") &&
    typeof input.organizationId === "string" && UUID_RE.test(input.organizationId) &&
    typeof input.jobId === "string" && UUID_RE.test(input.jobId) &&
    typeof input.attemptId === "string" && UUID_RE.test(input.attemptId)
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseGenerationInput(value: unknown): GenerationInput | null {
  const input = asRecord(value);
  if (!input) return null;
  if (typeof input.planVersionId !== "string" || !UUID_RE.test(input.planVersionId)) return null;
  if (typeof input.sceneId !== "string" || !UUID_RE.test(input.sceneId)) return null;
  if (typeof input.shotId !== "string" || !UUID_RE.test(input.shotId)) return null;
  if (typeof input.prompt !== "string" || !input.prompt.trim()) return null;
  if (input.aspectRatio !== "16:9" && input.aspectRatio !== "9:16") return null;
  if (typeof input.durationSeconds !== "number" || !Number.isFinite(input.durationSeconds)) return null;
  if (input.durationSeconds < 4 || input.durationSeconds > 12) return null;
  if (input.generateAudio !== false || input.provider !== "LTX" || input.providerModel !== LTX_MODEL) return null;
  if (input.cameraMotion !== undefined && typeof input.cameraMotion !== "string") return null;

  return {
    planVersionId: input.planVersionId,
    sceneId: input.sceneId,
    shotId: input.shotId,
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    durationSeconds: input.durationSeconds,
    generateAudio: false,
    provider: "LTX",
    providerModel: LTX_MODEL,
    ...(typeof input.cameraMotion === "string" && input.cameraMotion.trim()
      ? { cameraMotion: input.cameraMotion.trim() }
      : {}),
  };
}

function normalizeDuration(seconds: number): 6 | 8 | 10 {
  const values = [6, 8, 10] as const;
  let selected: 6 | 8 | 10 = 6;
  let distance = Math.abs(seconds - selected);
  for (const value of values.slice(1)) {
    const nextDistance = Math.abs(seconds - value);
    if (nextDistance < distance || (nextDistance === distance && value > selected)) {
      selected = value;
      distance = nextDistance;
    }
  }
  return selected;
}

function resolutionFor(aspectRatio: GenerationInput["aspectRatio"]): "1920x1080" | "1080x1920" {
  return aspectRatio === "16:9" ? "1920x1080" : "1080x1920";
}

function cameraMotionFor(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    dolly_in: "dolly_in",
    push_in: "dolly_in",
    slow_push: "dolly_in",
    slow_push_in: "dolly_in",
    dolly_out: "dolly_out",
    pull_out: "dolly_out",
    pull_back: "dolly_out",
    dolly_left: "dolly_left",
    track_left: "dolly_left",
    dolly_right: "dolly_right",
    track_right: "dolly_right",
    jib_up: "jib_up",
    crane_up: "jib_up",
    jib_down: "jib_down",
    crane_down: "jib_down",
    static: "static",
    locked_off: "static",
    focus_shift: "focus_shift",
    rack_focus: "focus_shift",
  };
  return aliases[normalized];
}

function providerError(status: number, payload: unknown): SafeProviderError {
  const record = asRecord(payload);
  const nested = asRecord(record?.error);
  const providerType = typeof nested?.type === "string" ? nested.type : "";
  const providerMessage = typeof nested?.message === "string" ? nested.message : "LTX provider request failed.";
  const typed: Record<string, { code: string; retryable: boolean }> = {
    invalid_request_error: { code: "LTX_INVALID_REQUEST", retryable: false },
    authentication_error: { code: "LTX_AUTHENTICATION", retryable: false },
    insufficient_funds_error: { code: "LTX_INSUFFICIENT_FUNDS", retryable: false },
    not_found_error: { code: "LTX_NOT_FOUND", retryable: false },
    content_filtered_error: { code: "LTX_CONTENT_FILTERED", retryable: false },
    rate_limit_error: { code: "LTX_RATE_LIMITED", retryable: true },
    concurrency_limit_error: { code: "LTX_RATE_LIMITED", retryable: true },
    api_error: { code: "LTX_API_ERROR", retryable: true },
    service_unavailable: { code: "LTX_SERVICE_UNAVAILABLE", retryable: true },
    overloaded_error: { code: "LTX_OVERLOADED", retryable: true },
  };
  const mapped = typed[providerType];
  if (mapped) return { ...mapped, message: providerMessage };
  if (status === 429) return { code: "LTX_RATE_LIMITED", message: providerMessage, retryable: true };
  if (status === 503) return { code: "LTX_SERVICE_UNAVAILABLE", message: providerMessage, retryable: true };
  if (status === 529) return { code: "LTX_OVERLOADED", message: providerMessage, retryable: true };
  if (status >= 500) return { code: "LTX_API_ERROR", message: providerMessage, retryable: true };
  return { code: "LTX_RESPONSE_INVALID", message: providerMessage, retryable: false };
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function generatedObjectPath(input: GenerationInput, organizationId: string, attemptId: string): string {
  return `${organizationId}/generated-video/${input.planVersionId}-${input.shotId}-${attemptId}.mp4`;
}

async function readVideoBytes(response: Response): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (!response.ok) throw new Error("PROVIDER_RESULT_DOWNLOAD_FAILED");
  const mimeType = (response.headers.get("content-type") ?? "").split(";", 1)[0]!.trim().toLowerCase();
  if (!mimeType.startsWith("video/")) throw new Error("PROVIDER_RESULT_INVALID_MIME");
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_GENERATED_VIDEO_BYTES) {
    throw new Error("PROVIDER_RESULT_TOO_LARGE");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("PROVIDER_RESULT_EMPTY");

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    total += value.byteLength;
    if (total > MAX_GENERATED_VIDEO_BYTES) {
      await reader.cancel();
      throw new Error("PROVIDER_RESULT_TOO_LARGE");
    }
    chunks.push(value);
  }
  if (total === 0) throw new Error("PROVIDER_RESULT_EMPTY");

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, mimeType };
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function isDuplicateStorageError(error: unknown): boolean {
  const record = asRecord(error);
  const message = `${String(record?.message ?? "")} ${String(record?.statusCode ?? "")} ${String(record?.error ?? "")}`;
  return /already exists|duplicate|409/i.test(message);
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

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "INVALID_REQUEST" });
  }
  if (!parseRequestBody(body)) return json(400, { error: "INVALID_REQUEST" });

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", body.organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) return json(500, { error: "AUTHORIZATION_UNAVAILABLE" });
  if (!membership || !["OWNER", "ADMIN", "EDITOR"].includes(String(membership.role))) {
    return json(403, { error: "FORBIDDEN" });
  }

  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id,organization_id,job_type,resource_type,resource_id,state,attempt_count,max_attempts,input_payload")
    .eq("id", body.jobId)
    .eq("organization_id", body.organizationId)
    .maybeSingle();
  if (jobError) return json(500, { error: "JOB_UNAVAILABLE" });
  if (!job || job.job_type !== "VIDEO_SHOT_GENERATION" || job.resource_type !== "SCENE_PLAN_SHOT") {
    return json(404, { error: "JOB_NOT_FOUND" });
  }

  const { data: attempt, error: attemptError } = await admin
    .from("video_generation_attempts")
    .select("id,organization_id,job_id,plan_version_id,scene_id,shot_id,provider,provider_model,provider_job_id,state,attempt_number,effective_duration_seconds,media_asset_id")
    .eq("id", body.attemptId)
    .eq("organization_id", body.organizationId)
    .eq("job_id", body.jobId)
    .maybeSingle();
  if (attemptError) return json(500, { error: "ATTEMPT_UNAVAILABLE" });
  if (!attempt || attempt.provider !== "LTX" || attempt.provider_model !== LTX_MODEL) {
    return json(404, { error: "ATTEMPT_NOT_FOUND" });
  }
  if (attempt.state === "COMPLETED" && typeof attempt.media_asset_id === "string") {
    return json(200, {
      state: "COMPLETED",
      jobId: body.jobId,
      attemptId: body.attemptId,
      mediaAssetId: attempt.media_asset_id,
    });
  }

  const input = parseGenerationInput(job.input_payload);
  if (
    !input ||
    job.resource_id !== input.shotId ||
    attempt.plan_version_id !== input.planVersionId ||
    attempt.scene_id !== input.sceneId ||
    attempt.shot_id !== input.shotId
  ) {
    return json(409, { error: "GENERATION_INPUT_INVALID" });
  }

  const { data: connection, error: connectionError } = await admin
    .from("integration_connections")
    .select("status")
    .eq("organization_id", body.organizationId)
    .eq("provider", "LTX")
    .maybeSingle();
  if (connectionError) return json(500, { error: "INTEGRATION_UNAVAILABLE" });
  if (!connection || connection.status === "NOT_CONFIGURED") return json(409, { error: "LTX_NOT_CONFIGURED" });
  if (connection.status === "DISABLED") return json(409, { error: "LTX_DISABLED" });
  if (connection.status === "INVALID") return json(409, { error: "LTX_INVALID" });

  const { data: apiKey, error: secretError } = await admin.rpc("read_integration_vault_secret", {
    _organization_id: body.organizationId,
    _provider: "LTX",
    _secret_name: "API_KEY",
  });
  if (secretError || typeof apiKey !== "string" || !apiKey) return json(409, { error: "LTX_NOT_CONFIGURED" });

  if (body.operation === "submit") {
    if (attempt.state !== "QUEUED") return json(409, { error: "ATTEMPT_NOT_QUEUED" });
    const effectiveDuration = normalizeDuration(input.durationSeconds);
    const resolution = resolutionFor(input.aspectRatio);
    const cameraMotion = cameraMotionFor(input.cameraMotion);

    const { error: submittingError } = await admin
      .from("video_generation_attempts")
      .update({
        state: "SUBMITTING",
        effective_duration_seconds: effectiveDuration,
        resolution,
        fps: LTX_FPS,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.attemptId)
      .eq("organization_id", body.organizationId);
    if (submittingError) return json(500, { error: "STATE_UPDATE_FAILED" });

    await admin
      .from("jobs")
      .update({ state: "PROCESSING", updated_at: new Date().toISOString() })
      .eq("id", body.jobId)
      .eq("organization_id", body.organizationId);

    let response: Response;
    try {
      response = await fetch(LTX_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt: input.prompt,
          model: "ltx-2-3-pro",
          duration: effectiveDuration,
          resolution,
          fps: LTX_FPS,
          generate_audio: false,
          ...(cameraMotion ? { camera_motion: cameraMotion } : {}),
        }),
      });
    } catch {
      const now = new Date().toISOString();
      await admin
        .from("video_generation_attempts")
        .update({
          state: "SUBMISSION_UNKNOWN",
          error_code: "LTX_SUBMISSION_UNKNOWN",
          error_message: "LTX submission outcome is unknown after a transport failure.",
          retryable: false,
          terminal_at: now,
          updated_at: now,
        })
        .eq("id", body.attemptId)
        .eq("organization_id", body.organizationId);
      await admin
        .from("jobs")
        .update({
          state: "FAILED",
          failure_metadata: { code: "LTX_SUBMISSION_UNKNOWN", retryable: false },
          completed_at: now,
          updated_at: now,
        })
        .eq("id", body.jobId)
        .eq("organization_id", body.organizationId);
      return json(502, { error: "LTX_SUBMISSION_UNKNOWN" });
    }

    const payload = await safeJson(response);
    if (!response.ok) {
      const error = providerError(response.status, payload);
      const now = new Date().toISOString();
      await admin
        .from("video_generation_attempts")
        .update({
          state: "FAILED",
          error_code: error.code,
          error_message: error.message,
          retryable: error.retryable,
          terminal_at: now,
          updated_at: now,
        })
        .eq("id", body.attemptId)
        .eq("organization_id", body.organizationId);
      await admin
        .from("jobs")
        .update({
          state: "FAILED",
          failure_metadata: { code: error.code, retryable: error.retryable },
          completed_at: now,
          updated_at: now,
        })
        .eq("id", body.jobId)
        .eq("organization_id", body.organizationId);
      return json(error.retryable ? 503 : 422, { error: error.code });
    }

    const submitted = asRecord(payload);
    const providerJobId = typeof submitted?.id === "string" ? submitted.id.trim() : "";
    if (!providerJobId) {
      const now = new Date().toISOString();
      await admin
        .from("video_generation_attempts")
        .update({
          state: "SUBMISSION_UNKNOWN",
          error_code: "LTX_RESPONSE_INVALID",
          error_message: "LTX accepted submission without a usable job identifier.",
          retryable: false,
          terminal_at: now,
          updated_at: now,
        })
        .eq("id", body.attemptId)
        .eq("organization_id", body.organizationId);
      return json(502, { error: "LTX_RESPONSE_INVALID" });
    }

    const { error: submittedError } = await admin
      .from("video_generation_attempts")
      .update({
        state: "SUBMITTED",
        provider_job_id: providerJobId,
        submitted_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
        retryable: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.attemptId)
      .eq("organization_id", body.organizationId);
    if (submittedError) return json(500, { error: "STATE_UPDATE_FAILED" });
    return json(200, { state: "SUBMITTED", jobId: body.jobId, attemptId: body.attemptId });
  }

  if (typeof attempt.provider_job_id !== "string" || !attempt.provider_job_id.trim()) {
    return json(409, { error: "PROVIDER_JOB_ID_MISSING" });
  }
  if (!["SUBMITTED", "PROCESSING", "IMPORT_PENDING"].includes(String(attempt.state))) {
    return json(409, { error: "ATTEMPT_NOT_RECONCILABLE" });
  }

  let statusResponse: Response;
  try {
    statusResponse = await fetch(`${LTX_ENDPOINT}/${encodeURIComponent(attempt.provider_job_id)}`, {
      method: "GET",
      headers: { authorization: `Bearer ${apiKey}` },
    });
  } catch {
    return json(503, { error: "LTX_SERVICE_UNAVAILABLE" });
  }

  const statusPayload = await safeJson(statusResponse);
  if (!statusResponse.ok) {
    if (attempt.state === "IMPORT_PENDING" && statusResponse.status === 404) {
      const now = new Date().toISOString();
      await admin
        .from("video_generation_attempts")
        .update({
          state: "FAILED",
          error_code: "PROVIDER_RESULT_EXPIRED",
          error_message: "Provider result is no longer available for import.",
          retryable: false,
          terminal_at: now,
          updated_at: now,
        })
        .eq("id", body.attemptId)
        .eq("organization_id", body.organizationId);
      await admin
        .from("jobs")
        .update({
          state: "FAILED",
          failure_metadata: { code: "PROVIDER_RESULT_EXPIRED", retryable: false },
          completed_at: now,
          updated_at: now,
        })
        .eq("id", body.jobId)
        .eq("organization_id", body.organizationId);
      return json(422, { error: "PROVIDER_RESULT_EXPIRED" });
    }
    const error = providerError(statusResponse.status, statusPayload);
    return json(error.retryable ? 503 : 422, { error: error.code });
  }

  const statusRecord = asRecord(statusPayload);
  const providerStatus = typeof statusRecord?.status === "string" ? statusRecord.status : "";
  const now = new Date().toISOString();

  if (providerStatus === "pending") {
    await admin
      .from("video_generation_attempts")
      .update({ state: "SUBMITTED", last_polled_at: now, updated_at: now })
      .eq("id", body.attemptId)
      .eq("organization_id", body.organizationId);
    return json(200, { state: "SUBMITTED", jobId: body.jobId, attemptId: body.attemptId });
  }

  if (providerStatus === "processing") {
    await admin
      .from("video_generation_attempts")
      .update({ state: "PROCESSING", last_polled_at: now, updated_at: now })
      .eq("id", body.attemptId)
      .eq("organization_id", body.organizationId);
    return json(200, { state: "PROCESSING", jobId: body.jobId, attemptId: body.attemptId });
  }

  if (providerStatus === "failed") {
    const error = providerError(422, statusPayload);
    await admin
      .from("video_generation_attempts")
      .update({
        state: "FAILED",
        error_code: error.code,
        error_message: error.message,
        retryable: error.retryable,
        last_polled_at: now,
        terminal_at: now,
        updated_at: now,
      })
      .eq("id", body.attemptId)
      .eq("organization_id", body.organizationId);
    await admin
      .from("jobs")
      .update({
        state: "FAILED",
        failure_metadata: { code: error.code, retryable: error.retryable },
        completed_at: now,
        updated_at: now,
      })
      .eq("id", body.jobId)
      .eq("organization_id", body.organizationId);
    return json(200, {
      state: "FAILED",
      jobId: body.jobId,
      attemptId: body.attemptId,
      errorCode: error.code,
      retryable: error.retryable,
    });
  }

  if (providerStatus !== "completed") {
    return json(502, { error: "LTX_RESPONSE_INVALID" });
  }

  const result = asRecord(statusRecord?.result);
  const providerVideoUrl = typeof result?.video_url === "string" ? result.video_url.trim() : "";
  if (!providerVideoUrl) return json(502, { error: "LTX_RESPONSE_INVALID" });

  await admin
    .from("video_generation_attempts")
    .update({ state: "IMPORT_PENDING", last_polled_at: now, updated_at: now })
    .eq("id", body.attemptId)
    .eq("organization_id", body.organizationId);

  let videoResponse: Response;
  try {
    videoResponse = await fetch(providerVideoUrl, { method: "GET" });
  } catch {
    return json(503, { error: "PROVIDER_RESULT_DOWNLOAD_FAILED" });
  }

  let media: { bytes: Uint8Array; mimeType: string };
  try {
    media = await readVideoBytes(videoResponse);
  } catch (error) {
    const code = error instanceof Error ? error.message : "PROVIDER_RESULT_DOWNLOAD_FAILED";
    return json(code === "PROVIDER_RESULT_TOO_LARGE" ? 422 : 503, { error: code });
  }

  const objectPath = generatedObjectPath(input, body.organizationId, body.attemptId);
  const checksum = await sha256(media.bytes);
  const { error: uploadError } = await admin.storage
    .from(GENERATED_MEDIA_BUCKET)
    .upload(objectPath, media.bytes, {
      contentType: media.mimeType,
      upsert: false,
      cacheControl: "31536000",
    });
  if (uploadError && !isDuplicateStorageError(uploadError)) {
    return json(503, { error: "MEDIA_STORAGE_UPLOAD_FAILED" });
  }

  const effectiveDuration = typeof attempt.effective_duration_seconds === "number"
    ? attempt.effective_duration_seconds
    : normalizeDuration(input.durationSeconds);
  const { data: mediaAssetId, error: completionError } = await admin.rpc("complete_generated_video_import", {
    _organization_id: body.organizationId,
    _job_id: body.jobId,
    _attempt_id: body.attemptId,
    _storage_path: objectPath,
    _mime_type: media.mimeType,
    _duration_seconds: effectiveDuration,
    _checksum: checksum,
  });
  if (completionError || typeof mediaAssetId !== "string") {
    return json(503, { error: "MEDIA_IMPORT_FINALIZE_FAILED" });
  }

  return json(200, {
    state: "COMPLETED",
    jobId: body.jobId,
    attemptId: body.attemptId,
    mediaAssetId,
  });
});
