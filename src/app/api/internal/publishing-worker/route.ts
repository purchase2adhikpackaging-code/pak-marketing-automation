import { after } from "next/server";
import { handlePublishingWorkerRequest } from "@/modules/publishing-production/node-worker-route";
import { runConfiguredPublishingWorker } from "@/modules/publishing-production/node-worker-runtime";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET ?? process.env.PUBLISHING_WORKER_SECRET;
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
          // A daily recovery cron can reclaim expired leases after an infrastructure-level interruption.
        }
      });
    },
  });
}

export const GET = handle;
export const POST = handle;
