import type { NodePublishingWorkerResult } from "./node-worker";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const FORBIDDEN_KEYS = /(?:api[_-]?key|service[_-]?role|openai[_-]?key|credential|secret[_-]?key)/i;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function hasForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, child]) => FORBIDDEN_KEYS.test(key) || hasForbiddenKey(child),
  );
}

function bearerCredential(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const credential = authorization.slice(7).trim();
  return credential || null;
}

export async function handlePublishingWorkerRequest(
  request: Request,
  dependencies: {
    authorize(credential: string): Promise<boolean>;
    run(input: { workerId: string; concurrency?: number; credential: string }): Promise<NodePublishingWorkerResult>;
    scheduleNext?(input: { concurrency: number; credential: string }): void;
  },
): Promise<Response> {
  if (!new Set(["GET", "POST"]).has(request.method)) return json(405, { error: "METHOD_NOT_ALLOWED" });

  const credential = bearerCredential(request);
  if (!credential) return json(401, { error: "UNAUTHORIZED" });

  try {
    if (!await dependencies.authorize(credential)) return json(401, { error: "UNAUTHORIZED" });
  } catch {
    return json(503, { error: "WORKER_AUTH_UNAVAILABLE" });
  }

  let body: Record<string, unknown> = {};
  if (request.method === "POST") {
    try {
      const text = await request.text();
      body = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return json(400, { error: "INVALID_REQUEST" });
    }
  }

  if (hasForbiddenKey(body)) return json(400, { error: "CREDENTIAL_FIELDS_FORBIDDEN" });
  const concurrency = body.concurrency === undefined ? 4 : Number(body.concurrency);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    return json(400, { error: "INVALID_CONCURRENCY" });
  }

  const workerId = `vercel-${crypto.randomUUID()}`;
  try {
    const result = await dependencies.run({ workerId, concurrency, credential });
    if (result.claimed > 0) dependencies.scheduleNext?.({ concurrency, credential });
    return json(200, { ok: true, ...result });
  } catch (error) {
    return json(500, {
      error: "WORKER_FAILED",
      message: error instanceof Error ? error.message : "Unknown publishing worker failure",
    });
  }
}
