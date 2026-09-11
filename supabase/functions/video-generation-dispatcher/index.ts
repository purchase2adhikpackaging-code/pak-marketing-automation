import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 20;

type DispatchAction = "SUBMIT" | "RECONCILE" | "RETRY";
type DispatchClaim = {
  organization_id: string;
  job_id: string;
  attempt_id: string;
  action: DispatchAction;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function safeBatchSize(): number {
  const configured = Number(Deno.env.get("DISPATCH_BATCH_SIZE") ?? DEFAULT_BATCH_SIZE);
  if (!Number.isFinite(configured)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(configured)));
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

async function callWorker(
  supabaseUrl: string,
  functionName: "video-generation" | "video-generation-retry",
  dispatchSecret: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-pak-dispatch-token": dispatchSecret,
    },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json(500, { error: "SERVER_MISCONFIGURED" });

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dispatchToken = req.headers.get("x-pak-dispatch-token") ?? "";
  const { data: dispatchSecret, error: secretError } = await admin.rpc("read_video_generation_dispatch_secret");
  if (secretError || typeof dispatchSecret !== "string" || !dispatchSecret) {
    return json(500, { error: "DISPATCH_AUTH_UNAVAILABLE" });
  }
  if (!dispatchToken || !safeEqual(dispatchToken, dispatchSecret)) {
    return json(401, { error: "UNAUTHORIZED" });
  }

  const workerId = `video-dispatch:${crypto.randomUUID()}`;
  const batchSize = safeBatchSize();
  const { data: claimedData, error: claimError } = await admin.rpc("claim_due_video_generation_dispatch", {
    _worker_id: workerId,
    _batch_size: batchSize,
    _lease_seconds: 120,
  });
  if (claimError) return json(500, { error: "DISPATCH_CLAIM_FAILED" });

  const claims = Array.isArray(claimedData) ? (claimedData as DispatchClaim[]) : [];
  let completed = 0;
  let failed = 0;

  for (const claim of claims) {
    try {
      let response: Response;
      if (claim.action === "RECONCILE") {
        response = await callWorker(supabaseUrl, "video-generation", dispatchSecret, {
          operation: "reconcile",
          organizationId: claim.organization_id,
          jobId: claim.job_id,
          attemptId: claim.attempt_id,
        });
      } else if (claim.action === "RETRY") {
        const retryResponse = await callWorker(supabaseUrl, "video-generation-retry", dispatchSecret, {
          operation: "retry",
          organizationId: claim.organization_id,
          jobId: claim.job_id,
          attemptId: claim.attempt_id,
        });
        if (!retryResponse.ok) {
          response = retryResponse;
        } else {
          const retried = await retryResponse.json().catch(() => null) as { attemptId?: unknown } | null;
          if (!retried || typeof retried.attemptId !== "string") {
            response = new Response(null, { status: 502 });
          } else {
            response = await callWorker(supabaseUrl, "video-generation", dispatchSecret, {
              operation: "submit",
              organizationId: claim.organization_id,
              jobId: claim.job_id,
              attemptId: retried.attemptId,
            });
          }
        }
      } else {
        response = await callWorker(supabaseUrl, "video-generation", dispatchSecret, {
          operation: "submit",
          organizationId: claim.organization_id,
          jobId: claim.job_id,
          attemptId: claim.attempt_id,
        });
      }

      if (response.ok) completed += 1;
      else failed += 1;
    } catch {
      failed += 1;
    } finally {
      await admin
        .from("jobs")
        .update({
          lease_owner: null,
          lease_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", claim.job_id)
        .eq("organization_id", claim.organization_id)
        .eq("lease_owner", workerId);
    }
  }

  return json(200, {
    claimed: claims.length,
    completed,
    failed,
  });
});
