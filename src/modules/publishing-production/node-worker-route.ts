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

export async function handlePublishingWorkerRequest(
  request: Request,
  dependencies: {
    secret: string | undefined;
    run(input: { workerId: string; concurrency?: number }): Promise<NodePublishingWorkerResult>;
  },
): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
  if (!dependencies.secret) return json(503, { error: "WORKER_NOT_CONFIGURED" });

  const authorization = request.headers.get("authorization") ?? "";
  if (authorization !== `Bearer ${dependencies.secret}`) {
    return json(401, { error: "UNAUTHORIZED" });
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    body = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return json(400, { error: "INVALID_REQUEST" });
  }

  if (hasForbiddenKey(body)) return json(400, { error: "CREDENTIAL_FIELDS_FORBIDDEN" });
  const concurrency = body.concurrency === undefined ? 4 : Number(body.concurrency);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    return json(400, { error: "INVALID_CONCURRENCY" });
  }

  const workerId = `vercel-${crypto.randomUUID()}`;
  try {
    const result = await dependencies.run({ workerId, concurrency });
    return json(200, { ok: true, ...result });
  } catch (error) {
    return json(500, {
      error: "WORKER_FAILED",
      message: error instanceof Error ? error.message : "Unknown publishing worker failure",
    });
  }
}
