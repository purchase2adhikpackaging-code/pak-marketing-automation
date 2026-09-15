import { runD01QaPreflight } from "@/modules/publishing-production/d01-qa-preflight";
import { handleD01QaPreflightRequest } from "@/modules/publishing-production/d01-qa-preflight-route";
import { createPublishingWorkerBrokerClient } from "@/modules/publishing-production/worker-broker-client";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handle(request: Request): Promise<Response> {
  return handleD01QaPreflightRequest(request, {
    authorize: (credential) => createPublishingWorkerBrokerClient({ credential }).authorize(),
    run: runD01QaPreflight,
  });
}

export const POST = handle;
