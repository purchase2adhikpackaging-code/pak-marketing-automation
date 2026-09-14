import { verifyPublicationBrowserRuntime } from "@/modules/publishing-factory/renderer";
import { createPublishingWorkerBrokerClient } from "@/modules/publishing-production/worker-broker-client";

export const runtime = "nodejs";
export const maxDuration = 60;

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function bearerCredential(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const credential = authorization.slice(7).trim();
  return credential || null;
}

async function handle(request: Request): Promise<Response> {
  if (!new Set(["GET", "POST"]).has(request.method)) {
    return json(405, { error: "METHOD_NOT_ALLOWED" });
  }

  const credential = bearerCredential(request);
  if (!credential) return json(401, { error: "UNAUTHORIZED" });

  try {
    const authorized = await createPublishingWorkerBrokerClient({ credential }).authorize();
    if (!authorized) return json(401, { error: "UNAUTHORIZED" });
  } catch {
    return json(503, { error: "WORKER_AUTH_UNAVAILABLE" });
  }

  try {
    await verifyPublicationBrowserRuntime();
    return json(200, { ok: true, browser: "chromium" });
  } catch {
    return json(503, { error: "BROWSER_RUNTIME_UNAVAILABLE" });
  }
}

export const GET = handle;
export const POST = handle;
