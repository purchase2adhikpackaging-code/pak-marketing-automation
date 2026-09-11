import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type RequestBody = {
  operation?: "retry";
  organizationId?: string;
  jobId?: string;
  attemptId?: string;
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function valid(body: RequestBody): body is Required<RequestBody> {
  return body.operation === "retry"
    && typeof body.organizationId === "string" && UUID_RE.test(body.organizationId)
    && typeof body.jobId === "string" && UUID_RE.test(body.jobId)
    && typeof body.attemptId === "string" && UUID_RE.test(body.attemptId);
}

function safeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
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

  const dispatchToken = req.headers.get("x-pak-dispatch-token") ?? "";
  let internalDispatch = false;
  let userId: string | null = null;

  if (dispatchToken) {
    const { data: dispatchSecret, error: dispatchSecretError } = await admin.rpc("read_video_generation_dispatch_secret");
    if (dispatchSecretError || typeof dispatchSecret !== "string" || !dispatchSecret) {
      return json(500, { error: "DISPATCH_AUTH_UNAVAILABLE" });
    }
    if (!safeEqual(dispatchToken, dispatchSecret)) return json(401, { error: "UNAUTHORIZED" });
    internalDispatch = true;
  } else {
    const authorization = req.headers.get("authorization") ?? "";
    const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
    if (!token) return json(401, { error: "UNAUTHORIZED" });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) return json(401, { error: "UNAUTHORIZED" });
    userId = user.id;
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "INVALID_REQUEST" });
  }
  if (!valid(body)) return json(400, { error: "INVALID_REQUEST" });

  if (!internalDispatch) {
    const { data: membership, error: membershipError } = await admin
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", body.organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (membershipError) return json(500, { error: "AUTHORIZATION_UNAVAILABLE" });
    if (!membership || !["OWNER", "ADMIN", "EDITOR"].includes(String(membership.role))) {
      return json(403, { error: "FORBIDDEN" });
    }
  }

  const { data: attempt, error: attemptError } = await admin
    .from("video_generation_attempts")
    .select("id,state,retryable,attempt_number,job_id,organization_id")
    .eq("id", body.attemptId)
    .eq("job_id", body.jobId)
    .eq("organization_id", body.organizationId)
    .maybeSingle();
  if (attemptError) return json(500, { error: "ATTEMPT_UNAVAILABLE" });
  if (!attempt) return json(404, { error: "ATTEMPT_NOT_FOUND" });
  if (attempt.state !== "FAILED" || attempt.retryable !== true) {
    return json(409, { error: "ATTEMPT_NOT_RETRYABLE" });
  }
  if (Number(attempt.attempt_number) >= 4) return json(409, { error: "RETRY_LIMIT_REACHED" });

  const { data: newAttemptId, error: retryError } = await admin.rpc("schedule_video_generation_retry", {
    _organization_id: body.organizationId,
    _job_id: body.jobId,
    _failed_attempt_id: body.attemptId,
  });
  if (retryError || typeof newAttemptId !== "string") return json(409, { error: "RETRY_SCHEDULE_FAILED" });

  return json(200, {
    state: "QUEUED",
    jobId: body.jobId,
    attemptId: newAttemptId,
  });
});
