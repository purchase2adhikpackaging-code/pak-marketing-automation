import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const BUCKET = "publishing-books";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_SEGMENT_RE = /^[A-Za-z0-9._-]+$/;
const MAX_WORKER_ID_CHARS = 200;
const MAX_STAGE_CHARS = 200;
const MAX_ERROR_CHARS = 4_000;
const SIGNED_DOWNLOAD_SECONDS = 300;
const MAX_LISTED_CHECKPOINT_FILES = 5_000;
const MAX_STORAGE_DEPTH = 16;

const ALLOWED_ACTIONS = new Set([
  "authorize",
  "claimJobs",
  "yieldJob",
  "completeJob",
  "failJob",
  "listCheckpointFiles",
  "createCheckpointDownload",
  "createStorageUpload",
  "upsertPublication",
]);

type BrokerBody = Record<string, unknown> & { action?: unknown };

type LeasedJob = {
  id: string;
  organization_id: string;
  production_run_id: string;
  book_id: string;
  programme_code: string;
  subject_code: string;
  academic_period: string | null;
  edition: string;
  revision: string;
  status: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
};

class BrokerHttpError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function constantTimeEqual(leftValue: string, rightValue: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(leftValue);
  const right = encoder.encode(rightValue);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function objectBody(value: unknown): BrokerBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BrokerHttpError(400, "INVALID_REQUEST");
  }
  return value as BrokerBody;
}

function requiredString(
  body: BrokerBody,
  key: string,
  options: { max?: number; uuid?: boolean } = {},
): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new BrokerHttpError(400, "INVALID_REQUEST");
  }
  const trimmed = value.trim();
  if (options.max !== undefined && trimmed.length > options.max) {
    throw new BrokerHttpError(400, "INVALID_REQUEST");
  }
  if (options.uuid && !UUID_RE.test(trimmed)) {
    throw new BrokerHttpError(400, "INVALID_REQUEST");
  }
  return trimmed;
}

function optionalString(body: BrokerBody, key: string, max = 2_000): string | null {
  const value = body[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new BrokerHttpError(400, "INVALID_REQUEST");
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BrokerHttpError(400, "INVALID_REQUEST");
  return trimmed || null;
}

function integerInRange(body: BrokerBody, key: string, minimum: number, maximum: number, fallback?: number): number {
  const raw = body[key];
  if (raw === undefined && fallback !== undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new BrokerHttpError(400, "INVALID_REQUEST");
  }
  return value;
}

function safeSegment(value: string | null | undefined, fallback?: string): string {
  const candidate = value ?? fallback ?? "";
  if (!candidate || !SAFE_SEGMENT_RE.test(candidate)) {
    throw new BrokerHttpError(409, "INVALID_JOB_IDENTITY");
  }
  return candidate;
}

function canonicalJobPrefix(job: LeasedJob): string {
  return [
    safeSegment(job.organization_id),
    safeSegment(job.programme_code),
    safeSegment(job.academic_period, "UNSPECIFIED"),
    safeSegment(job.subject_code),
    safeSegment(job.edition),
    safeSegment(job.revision),
  ].join("/") + "/";
}

function normalizedStoragePath(path: string): string {
  if (
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new BrokerHttpError(400, "INVALID_STORAGE_PATH");
  }
  return path;
}

function validateCheckpointPath(job: LeasedJob, inputPath: string): string {
  const path = normalizedStoragePath(inputPath);
  const prefix = `${canonicalJobPrefix(job)}checkpoints/`;
  if (!path.startsWith(prefix) || !path.endsWith(".json")) {
    throw new BrokerHttpError(403, "STORAGE_PATH_FORBIDDEN");
  }
  return path;
}

const PUBLICATION_FILES = new Set([
  "textbook.pdf",
  "manuscript.html",
  "manuscript.json",
  "blueprint.json",
  "qa-report.json",
  "release-manifest.json",
]);

function validatePublicationPath(job: LeasedJob, inputPath: string): string {
  const path = normalizedStoragePath(inputPath);
  const prefix = canonicalJobPrefix(job);
  if (!path.startsWith(prefix)) throw new BrokerHttpError(403, "STORAGE_PATH_FORBIDDEN");
  const relative = path.slice(prefix.length);
  if (!PUBLICATION_FILES.has(relative)) {
    throw new BrokerHttpError(403, "STORAGE_PATH_FORBIDDEN");
  }
  return path;
}

async function loadLeasedJob(admin: SupabaseClient, jobId: string, workerId: string): Promise<LeasedJob> {
  const { data: job, error } = await admin
    .from("publishing_production_jobs")
    .select(
      "id,organization_id,production_run_id,book_id,programme_code,subject_code,academic_period,edition,revision,status,lease_owner,lease_expires_at",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new BrokerHttpError(500, "PRODUCTION_JOB_UNAVAILABLE");
  if (!job) throw new BrokerHttpError(404, "PRODUCTION_JOB_NOT_FOUND");
  const typed = job as LeasedJob;
  const leaseExpiresAt = typed.lease_expires_at ? Date.parse(typed.lease_expires_at) : Number.NaN;
  if (
    typed.status !== "RUNNING" ||
    typed.lease_owner !== workerId ||
    !Number.isFinite(leaseExpiresAt) ||
    leaseExpiresAt <= Date.now()
  ) {
    throw new BrokerHttpError(409, "PRODUCTION_JOB_LEASE_UNAVAILABLE");
  }
  return typed;
}

async function listCheckpointFiles(admin: SupabaseClient, job: LeasedJob): Promise<string[]> {
  const root = `${canonicalJobPrefix(job)}checkpoints`;
  const files: string[] = [];

  async function walk(folder: string, depth: number): Promise<void> {
    if (depth > MAX_STORAGE_DEPTH) throw new BrokerHttpError(409, "CHECKPOINT_TREE_TOO_DEEP");
    const { data, error } = await admin.storage.from(BUCKET).list(folder, {
      limit: 1_000,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new BrokerHttpError(500, "CHECKPOINT_LIST_UNAVAILABLE");
    for (const item of data ?? []) {
      const path = `${folder}/${item.name}`;
      if (item.id) {
        validateCheckpointPath(job, path);
        files.push(path);
        if (files.length > MAX_LISTED_CHECKPOINT_FILES) {
          throw new BrokerHttpError(409, "CHECKPOINT_FILE_LIMIT_EXCEEDED");
        }
      } else {
        await walk(path, depth + 1);
      }
    }
  }

  await walk(root, 0);
  return files;
}

async function rpc(admin: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new BrokerHttpError(409, "PUBLISHING_RPC_FAILED");
  return data;
}

function publicationPayload(body: BrokerBody): Record<string, unknown> {
  const value = body.publication;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BrokerHttpError(400, "INVALID_PUBLICATION");
  }
  return value as Record<string, unknown>;
}

function publicationPath(record: Record<string, unknown>, key: string, job: LeasedJob): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new BrokerHttpError(400, "INVALID_PUBLICATION");
  return validatePublicationPath(job, value.trim());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "SERVER_MISCONFIGURED" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: publishingWorkerSecretData, error: publishingWorkerSecretError } = await admin.rpc(
    "read_publishing_worker_dispatch_secret",
  );
  if (publishingWorkerSecretError || typeof publishingWorkerSecretData !== "string" || !publishingWorkerSecretData.trim()) {
    return json(503, { error: "WORKER_AUTH_UNAVAILABLE" });
  }
  const publishingWorkerSecret = publishingWorkerSecretData.trim();
  const presentedWorkerSecret = req.headers.get("x-publishing-worker-secret") ?? "";
  if (!presentedWorkerSecret || !constantTimeEqual(presentedWorkerSecret, publishingWorkerSecret)) {
    return json(401, { error: "UNAUTHORIZED" });
  }

  let body: BrokerBody;
  try {
    body = objectBody(await req.json());
  } catch (error) {
    const typed = error as BrokerHttpError;
    return json(typed.status ?? 400, { error: typed.code ?? "INVALID_REQUEST" });
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!ALLOWED_ACTIONS.has(action)) return json(400, { error: "INVALID_ACTION" });
  if (action === "authorize") return json(200, { ok: true });

  try {
    if (action === "claimJobs") {
      const workerId = requiredString(body, "workerId", { max: MAX_WORKER_ID_CHARS });
      const limit = integerInRange(body, "limit", 1, 32, 4);
      const leaseSeconds = integerInRange(body, "leaseSeconds", 30, 900, 300);
      const jobs = await rpc(admin, "claim_publishing_jobs", {
        p_worker_id: workerId,
        p_limit: limit,
        p_lease_seconds: leaseSeconds,
      });
      return json(200, { jobs: Array.isArray(jobs) ? jobs : [] });
    }

    const jobId = requiredString(body, "jobId", { uuid: true });
    const workerId = requiredString(body, "workerId", { max: MAX_WORKER_ID_CHARS });

    if (action === "yieldJob") {
      const job = await loadLeasedJob(admin, jobId, workerId);
      const currentStage = requiredString(body, "currentStage", { max: MAX_STAGE_CHARS });
      const checkpointRoot = `${canonicalJobPrefix(job)}checkpoints/`;
      const result = await rpc(admin, "yield_publishing_job", {
        p_job_id: jobId,
        p_worker_id: workerId,
        p_checkpoint_root: checkpointRoot,
        p_current_stage: currentStage,
      });
      return json(200, { job: result });
    }

    if (action === "completeJob") {
      const job = await loadLeasedJob(admin, jobId, workerId);
      const qaStatus = requiredString(body, "qaStatus", { max: 40 });
      if (qaStatus !== "QA_PASSED") throw new BrokerHttpError(400, "INVALID_QA_STATUS");
      const pdfArtifactPath = validatePublicationPath(job, requiredString(body, "pdfArtifactPath"));
      const manifestArtifactPath = validatePublicationPath(job, requiredString(body, "manifestArtifactPath"));
      if (!pdfArtifactPath.endsWith("/textbook.pdf") || !manifestArtifactPath.endsWith("/release-manifest.json")) {
        throw new BrokerHttpError(400, "INVALID_PUBLICATION");
      }
      const knowledgeHashes = Array.isArray(body.knowledgeHashes) ? body.knowledgeHashes : [];
      const result = await rpc(admin, "complete_publishing_job", {
        p_job_id: jobId,
        p_worker_id: workerId,
        p_qa_status: qaStatus,
        p_pdf_artifact_path: pdfArtifactPath,
        p_manifest_artifact_path: manifestArtifactPath,
        p_provider_name: optionalString(body, "providerName"),
        p_provider_model: optionalString(body, "providerModel"),
        p_knowledge_hashes: knowledgeHashes,
      });
      return json(200, { job: result });
    }

    if (action === "failJob") {
      const errorMessage = requiredString(body, "error", { max: MAX_ERROR_CHARS });
      const result = await rpc(admin, "fail_publishing_job", {
        p_job_id: jobId,
        p_worker_id: workerId,
        p_error: errorMessage,
      });
      return json(200, { job: result });
    }

    const job = await loadLeasedJob(admin, jobId, workerId);

    if (action === "listCheckpointFiles") {
      return json(200, { paths: await listCheckpointFiles(admin, job) });
    }

    if (action === "createCheckpointDownload") {
      const path = validateCheckpointPath(job, requiredString(body, "path"));
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_DOWNLOAD_SECONDS);
      if (error || !data?.signedUrl) throw new BrokerHttpError(500, "CHECKPOINT_DOWNLOAD_UNAVAILABLE");
      return json(200, { path, signedUrl: data.signedUrl, expiresIn: SIGNED_DOWNLOAD_SECONDS });
    }

    if (action === "createStorageUpload") {
      const requestedPath = requiredString(body, "path");
      let path: string;
      try {
        path = validateCheckpointPath(job, requestedPath);
      } catch (error) {
        if (!(error instanceof BrokerHttpError) || error.code !== "STORAGE_PATH_FORBIDDEN") throw error;
        path = validatePublicationPath(job, requestedPath);
      }
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
      if (error || !data?.token) throw new BrokerHttpError(500, "STORAGE_UPLOAD_UNAVAILABLE");
      return json(200, { path, token: data.token });
    }

    if (action === "upsertPublication") {
      const publication = publicationPayload(body);
      const pdfArtifactPath = publicationPath(publication, "pdfArtifactPath", job);
      const manuscriptHtmlPath = publicationPath(publication, "manuscriptHtmlPath", job);
      const manuscriptJsonPath = publicationPath(publication, "manuscriptJsonPath", job);
      const blueprintPath = publicationPath(publication, "blueprintPath", job);
      const qaReportPath = publicationPath(publication, "qaReportPath", job);
      const releaseManifestPath = publicationPath(publication, "releaseManifestPath", job);
      const requiredSuffixes: Array<[string, string]> = [
        [pdfArtifactPath, "/textbook.pdf"],
        [manuscriptHtmlPath, "/manuscript.html"],
        [manuscriptJsonPath, "/manuscript.json"],
        [blueprintPath, "/blueprint.json"],
        [qaReportPath, "/qa-report.json"],
        [releaseManifestPath, "/release-manifest.json"],
      ];
      if (requiredSuffixes.some(([path, suffix]) => !path.endsWith(suffix))) {
        throw new BrokerHttpError(400, "INVALID_PUBLICATION");
      }
      const qaSummary = publication.qaSummary && typeof publication.qaSummary === "object" && !Array.isArray(publication.qaSummary)
        ? publication.qaSummary
        : {};
      if ((qaSummary as { passed?: unknown }).passed !== true) {
        throw new BrokerHttpError(400, "QA_NOT_PASSED");
      }
      const knowledgeHashes = Array.isArray(publication.knowledgeHashes) ? publication.knowledgeHashes : [];
      const record = {
        organization_id: job.organization_id,
        production_run_id: job.production_run_id,
        production_job_id: job.id,
        book_id: job.book_id,
        programme_code: job.programme_code,
        subject_code: job.subject_code,
        academic_period: job.academic_period,
        edition: job.edition,
        revision: job.revision,
        status: "RELEASED",
        pdf_artifact_path: pdfArtifactPath,
        manuscript_html_path: manuscriptHtmlPath,
        manuscript_json_path: manuscriptJsonPath,
        blueprint_path: blueprintPath,
        qa_report_path: qaReportPath,
        release_manifest_path: releaseManifestPath,
        provider_name: typeof publication.providerName === "string" ? publication.providerName.slice(0, 200) : null,
        provider_model: typeof publication.providerModel === "string" ? publication.providerModel.slice(0, 200) : null,
        knowledge_hashes: knowledgeHashes,
        qa_summary: qaSummary,
        released_at: new Date().toISOString(),
      };
      const { data, error } = await admin
        .from("publishing_publications")
        .upsert(record, { onConflict: "organization_id,book_id,edition,revision" })
        .select("*")
        .single();
      if (error || !data) throw new BrokerHttpError(500, "PUBLICATION_REGISTRATION_FAILED");
      return json(200, { publication: data });
    }

    return json(400, { error: "INVALID_ACTION" });
  } catch (error) {
    if (error instanceof BrokerHttpError) return json(error.status, { error: error.code });
    return json(500, { error: "BROKER_OPERATION_FAILED" });
  }
});
