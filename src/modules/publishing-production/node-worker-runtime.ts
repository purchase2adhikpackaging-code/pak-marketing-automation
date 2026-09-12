import "server-only";

import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { OpenAITextGenerationProvider, type OpenAIResponsesTransport } from "@/modules/ai/text/openai-provider";
import { compileBook } from "@/modules/publishing-factory/book-compiler";
import { FileCheckpointStore } from "@/modules/publishing-factory/checkpoint-store";
import { loadKnowledgeRegistry } from "@/modules/publishing-factory/knowledge-registry";
import { publishQaPassedBook } from "./artifact-publisher";
import { PublishingProductionRepository, type PublishingProductionTransport } from "./repository";
import { runNodePublishingWorker, type NodePublishingWorkerDependencies, type WorkerProcessOutcome } from "./node-worker";
import { resolvePublishingWorkerSecret } from "./worker-auth";
import type { ProductionJob } from "./domain";

const BUCKET = "publishing-books";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Publishing worker environment variable ${name} is required.`);
  return value;
}

function safeSegment(value: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) throw new Error("Unsafe publishing storage identifier.");
  return value;
}

function checkpointPrefix(job: ProductionJob): string {
  return [
    safeSegment(job.organizationId),
    safeSegment(job.programmeCode),
    safeSegment(job.academicPeriod ?? "UNSPECIFIED"),
    safeSegment(job.subjectCode),
    safeSegment(job.edition),
    safeSegment(job.revision),
    "checkpoints",
  ].join("/") + "/";
}

function workerTransport(admin: SupabaseClient): PublishingProductionTransport {
  return {
    async insertRun() { throw new Error("Worker transport cannot create production runs."); },
    async insertJobs() { throw new Error("Worker transport cannot enqueue production jobs."); },
    async listRuns() { throw new Error("Worker transport cannot list production runs."); },
    async getRun() { throw new Error("Worker transport cannot read production runs."); },
    async listPublications() { throw new Error("Worker transport cannot list publications."); },
    async rpc(name, args) {
      const { data, error } = await admin.rpc(name, args);
      if (error) throw new Error(`Publishing RPC ${name} failed: ${error.message}`);
      return data;
    },
  };
}

function internalOpenAITransport(job: ProductionJob): OpenAIResponsesTransport {
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return {
    async create(input) {
      const workerSecret = process.env.PUBLISHING_WORKER_SECRET?.trim() || await resolvePublishingWorkerSecret();
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-content`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`,
          "x-publishing-worker-secret": workerSecret,
        },
        body: JSON.stringify({
          organizationId: job.organizationId,
          productionJobId: job.id,
          ...(input.model ? { model: input.model } : {}),
          instructions: input.instructions,
          input: input.input,
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Background OpenAI generation failed with HTTP ${response.status}.`);
      return await response.json() as { output_text?: string | null; model?: string | null };
    },
  };
}

async function listStorageFiles(admin: SupabaseClient, prefix: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(folder: string): Promise<void> {
    const { data, error } = await admin.storage.from(BUCKET).list(folder, { limit: 1000 });
    if (error) throw new Error(`Checkpoint listing failed: ${error.message}`);
    for (const item of data ?? []) {
      const path = folder ? `${folder}/${item.name}` : item.name;
      if (item.id) files.push(path);
      else await walk(path);
    }
  }
  await walk(prefix.replace(/\/$/, ""));
  return files;
}

async function restoreCheckpoints(admin: SupabaseClient, storagePrefix: string, localRoot: string): Promise<void> {
  const files = await listStorageFiles(admin, storagePrefix);
  const normalizedPrefix = storagePrefix.replace(/\/$/, "");
  for (const storagePath of files) {
    const { data, error } = await admin.storage.from(BUCKET).download(storagePath);
    if (error || !data) throw new Error(`Checkpoint download failed for ${storagePath}.`);
    const localRelative = storagePath.slice(normalizedPrefix.length).replace(/^\//, "");
    const localPath = join(localRoot, localRelative);
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, Buffer.from(await data.arrayBuffer()));
  }
}

async function localFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(folder: string): Promise<void> {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  try { await walk(root); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return files;
}

async function persistCheckpoints(admin: SupabaseClient, localRoot: string, storagePrefix: string): Promise<void> {
  const files = await localFiles(localRoot);
  for (const localPath of files) {
    const rel = relative(localRoot, localPath).split("\\").join("/");
    const storagePath = `${storagePrefix}${rel}`;
    const { error } = await admin.storage.from(BUCKET).upload(storagePath, await readFile(localPath), {
      upsert: true,
      contentType: "application/json",
    });
    if (error) throw new Error(`Checkpoint upload failed for ${storagePath}: ${error.message}`);
  }
}

async function processProductionJob(admin: SupabaseClient, job: ProductionJob): Promise<WorkerProcessOutcome> {
  const temp = await mkdtemp(join(tmpdir(), "pak-publishing-worker-"));
  const checkpointRoot = join(temp, "checkpoints");
  const artifactRoot = join(temp, "artifacts");
  const storageCheckpointPrefix = checkpointPrefix(job);

  try {
    if (job.checkpointRoot) await restoreCheckpoints(admin, job.checkpointRoot, checkpointRoot);

    const provider = new OpenAITextGenerationProvider({
      transport: internalOpenAITransport(job),
    });
    const result = await compileBook({
      job: job.bookJobPayload,
      curriculumText: job.curriculumText,
      provider,
      registry: await loadKnowledgeRegistry(process.cwd()),
      checkpointStore: new FileCheckpointStore(checkpointRoot),
      artifactRoot,
      maxNewChapters: 1,
    });

    await persistCheckpoints(admin, checkpointRoot, storageCheckpointPrefix);

    if (result.incomplete) {
      return {
        kind: "yield",
        checkpointRoot: storageCheckpointPrefix,
        currentStage: "MANUSCRIPT_IN_PROGRESS",
      };
    }
    if (result.job.status === "BLOCKED") {
      throw new Error(result.blockedReason ?? "Book compiler blocked the job.");
    }
    if (result.job.status !== "QA_PASSED") {
      throw new Error(`Book compiler ended in non-releasable state ${result.job.status}.`);
    }

    const published = await publishQaPassedBook({
      organizationId: job.organizationId,
      job,
      compilerResult: result,
      readFile,
      storage: {
        async put(path, data, contentType) {
          const { error } = await admin.storage.from(BUCKET).upload(path, data, { upsert: true, contentType });
          if (error) throw new Error(`Publication upload failed for ${path}: ${error.message}`);
        },
      },
      publications: {
        async upsert(record) {
          const { data, error } = await admin
            .from("publishing_publications")
            .upsert(record, { onConflict: "organization_id,book_id,edition,revision" })
            .select("*")
            .single();
          if (error) throw new Error(`Publication registration failed: ${error.message}`);
          return data;
        },
      },
    });

    return {
      kind: "complete",
      qaStatus: "QA_PASSED",
      pdfArtifactPath: published.pdfPath,
      manifestArtifactPath: published.manifestPath,
      ...(result.manuscript?.provider.name ? { providerName: result.manuscript.provider.name } : {}),
      ...(result.manuscript?.provider.model ? { providerModel: result.manuscript.provider.model } : {}),
      knowledgeHashes: result.manuscript?.knowledgePacks ?? [],
    };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export function createConfiguredWorkerDependencies(): NodePublishingWorkerDependencies {
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const repository = new PublishingProductionRepository(workerTransport(admin));

  return {
    claimJobs: (input) => repository.claimJobs(input),
    processJob: (job) => processProductionJob(admin, job),
    yieldJob: (input) => repository.yieldJob(input),
    completeJob: (input) => repository.completeJob(input),
    failJob: ({ jobId, workerId, error }) => repository.failJob(jobId, workerId, error),
  };
}

export async function runConfiguredPublishingWorker(input: {
  workerId: string;
  concurrency?: number;
}) {
  return runNodePublishingWorker({
    workerId: input.workerId,
    ...(input.concurrency !== undefined ? { concurrency: input.concurrency } : {}),
    dependencies: createConfiguredWorkerDependencies(),
  });
}
