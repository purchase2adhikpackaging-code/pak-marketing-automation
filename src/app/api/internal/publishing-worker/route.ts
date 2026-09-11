import { handlePublishingWorkerRequest } from "@/modules/publishing-production/node-worker-route";
import { runConfiguredPublishingWorker } from "@/modules/publishing-production/node-worker-runtime";

export const runtime = "nodejs";
export const maxDuration = 1800;

export async function POST(request: Request): Promise<Response> {
  return handlePublishingWorkerRequest(request, {
    secret: process.env.CRON_SECRET ?? process.env.PUBLISHING_WORKER_SECRET,
    run: runConfiguredPublishingWorker,
  });
}
