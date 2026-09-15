import type { QaFinding, QaGateResult } from "@/modules/publishing-factory/domain";
import { BookJobSchema } from "@/modules/publishing-factory/domain";
import { BookManuscriptSchema } from "@/modules/publishing-factory/manuscript-domain";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export interface D01QaPreflightResult {
  passed: boolean;
  gateResults: Partial<Record<string, QaGateResult>>;
  findings: QaFinding[];
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function bearerCredential(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const credential = authorization.slice(7).trim();
  return credential || null;
}

function identitiesMatch(job: ReturnType<typeof BookJobSchema.parse>, manuscript: ReturnType<typeof BookManuscriptSchema.parse>): boolean {
  return (
    job.bookId === manuscript.bookId &&
    job.programmeCode === manuscript.programmeCode &&
    job.subjectCode === manuscript.subjectCode &&
    job.subjectTitle === manuscript.subjectTitle &&
    job.level === manuscript.level &&
    job.edition === manuscript.edition &&
    job.revision === manuscript.revision
  );
}

export async function handleD01QaPreflightRequest(
  request: Request,
  dependencies: {
    authorize(credential: string): Promise<boolean>;
    run(input: {
      job: ReturnType<typeof BookJobSchema.parse>;
      manuscript: ReturnType<typeof BookManuscriptSchema.parse>;
    }): Promise<D01QaPreflightResult>;
  },
): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const credential = bearerCredential(request);
  if (!credential) return json(401, { error: "UNAUTHORIZED" });

  try {
    if (!await dependencies.authorize(credential)) return json(401, { error: "UNAUTHORIZED" });
  } catch {
    return json(503, { error: "WORKER_AUTH_UNAVAILABLE" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "INVALID_REQUEST" });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json(400, { error: "INVALID_REQUEST" });
  }

  const payload = body as Record<string, unknown>;
  const parsedJob = BookJobSchema.safeParse(payload.job);
  const parsedManuscript = BookManuscriptSchema.safeParse(payload.manuscript);
  if (!parsedJob.success || !parsedManuscript.success) {
    return json(400, { error: "INVALID_REQUEST" });
  }

  if (parsedJob.data.subjectCode !== "D01-101" || parsedManuscript.data.subjectCode !== "D01-101") {
    return json(400, { error: "D01_101_ONLY" });
  }
  if (!identitiesMatch(parsedJob.data, parsedManuscript.data)) {
    return json(400, { error: "IDENTITY_MISMATCH" });
  }

  try {
    const result = await dependencies.run({ job: parsedJob.data, manuscript: parsedManuscript.data });
    return json(200, { ok: true, ...result });
  } catch (error) {
    return json(500, {
      error: "QA_PREFLIGHT_FAILED",
      message: error instanceof Error ? error.message : "Unknown D01 QA preflight failure",
    });
  }
}
