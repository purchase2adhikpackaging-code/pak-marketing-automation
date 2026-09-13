import { after } from "next/server";
import { handlePublishingWorkerRequest } from "@/modules/publishing-production/node-worker-route";
import { runConfiguredPublishingWorker } from "@/modules/publishing-production/node-worker-runtime";
import { createPublishingWorkerBrokerClient } from "@/modules/publishing-production/worker-broker-client";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handle(request: Request): Promise<Response> {
  return handlePublishingWorkerRequest(request, {
    async authorize(credential) {
      return createPublishingWorkerBrokerClient({ credential }).authorize();
    },
    run: ({ workerId, concurrency, credential }) => runConfiguredPublishingWorker({
      workerId,
      credential,
      ...(concurrency !== undefined ? { concurrency } : {}),
    }),
    scheduleNext({ concurrency, credential }) {
      const url = new URL("/api/internal/publishing-worker", request.url);
      after(async () => {
        try {
          await fetch(url, {
            method: "POST",
            headers: {
              authorization: `Bearer ${credential}`,
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
