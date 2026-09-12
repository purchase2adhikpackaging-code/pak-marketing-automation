import { after } from "next/server";
import { handlePublishingWorkerRequest } from "@/modules/publishing-production/node-worker-route";
import { runConfiguredPublishingWorker } from "@/modules/publishing-production/node-worker-runtime";
import { resolvePublishingWorkerSecret } from "@/modules/publishing-production/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handle(request: Request): Promise<Response> {
  let secret = process.env.CRON_SECRET?.trim() || process.env.PUBLISHING_WORKER_SECRET?.trim();
  if (!secret) {
    try {
      secret = await resolvePublishingWorkerSecret();
    } catch {
      secret = undefined;
    }
  }

  return handlePublishingWorkerRequest(request, {
    secret,
    run: runConfiguredPublishingWorker,
    scheduleNext({ concurrency }) {
      if (!secret) return;
      const url = new URL("/api/internal/publishing-worker", request.url);
      after(async () => {
        try {
          await fetch(url, {
            method: "POST",
            headers: {
              authorization: `Bearer ${secret}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ concurrency }),
            cache: "no-store",
          });
        } catch {
          // Supabase pg_cron recovery can reclaim expired leases after infrastructure interruption.
        }
      });
    },
  });
}

export const GET = handle;
export const POST = handle;
