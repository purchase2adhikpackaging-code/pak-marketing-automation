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
import {
  createPublishingWorkerBrokerClient,
  type PublishingWorkerBrokerClient,
} from "./worker-broker-client";
import type { ProductionJob } from "./domain";

const BUCKET = "publishing-books";

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
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

function stringArg(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Publishing broker argument ${name} is required.`);
  return value;
}

function numberArg(args: Record<string, unknown>, name: string): number {
  const value = Number(args[name]);
  if (!Number.isFinite(value)) throw new Error(`Publishing broker argument ${name} is invalid.`);
  return value;
}

function brokerTransport(broker: PublishingWorkerBrokerClient): PublishingProductionTransport {
  return {
    async insertRun() { throw new Error("Worker transport cannot create production runs."); },
    async insertJobs() { throw new Error("Worker transport cannot enqueue production jobs."); },
    async listRuns() { throw new Error("Worker transport cannot list production runs."); },
    async getRun() { throw new Error("Worker transport cannot read production runs."); },
    async listPublications() { throw new Error("Worker transport cannot list publications."); },
    async rpc(name, args) {
      if (name === "claim_publishing_jobs") {
        return broker.claimJobs({
          workerId: stringArg(args, "p_worker_id"),
          limit: numberArg(args, "p_limit"),
          leaseSeconds: numberArg(args, "p_lease_seconds"),
        });
      }
      if (name === "yield_publishing_job") {
        return broker.yieldJob({
          jobId: stringArg(args, "p_job_id"),
          workerId: stringArg(args, "p_worker_id"),
          currentStage: stringArg(args, "p_current_stage"),
        });
      }
      if (name === "complete_publishing_job") {
        return broker.completeJob({
          jobId: stringArg(args, "p_job_id"),
          workerId: stringArg(args, "p_worker_id"),
          qaStatus: "QA_PASSED",
          pdfArtifactPath: stringArg(args, "p_pdf_artifact_path"),
          manifestArtifactPath: stringArg(args, "p_manifest_artifact_path"),
          ...(typeof args.p_provider_name === "string" ? { providerName: args.p_provider_name } : {}),
          ...(typeof args.p_provider_model === "string" ? { providerModel: args.p_provider_model } : {}),
          knowledgeHashes: Array.isArray(args.p_knowledge_hashes) ? args.p_knowledge_hashes : [],
        });
      }
      if (name === "fail_publishing_job") {
        return broker.failJob({
          jobId: stringArg(args, "p_job_id"),
          workerId: stringArg(args, "p_worker_id"),
          error: stringArg(args, "p_error"),
        });
      }
      throw new Error(`Publishing worker broker does not permit RPC ${name}.`);
    },
  };
}

function internalOpenAITransport(job: ProductionJob, credential: string): OpenAIResponsesTransport {
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return {
    async create(input) {
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-content`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`,
          "x-publishing-worker-secret": credential,
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

async function restoreCheckpoints(input: {
  broker: PublishingWorkerBrokerClient;
  job: ProductionJob;
  workerId: string;
  localRoot: string;
  storagePrefix: string;
}): Promise<void> {
  const files = await input.broker.listCheckpointFiles({ jobId: input.job.id, workerId: input.workerId });
  const normalizedPrefix = input.storagePrefix.replace(/\/$/, "");
  for (const storagePath of files) {
    const { signedUrl } = await input.broker.createCheckpointDownload({
      jobId: input.job.id,
      workerId: input.workerId,
      path: storagePath,
    });
    const response = await fetch(signedUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Checkpoint download failed for ${storagePath}.`);
    const localRelative = storagePath.slice(normalizedPrefix.length).replace(/^\//, "");
    const localPath = join(input.localRoot, localRelative);
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, Buffer.from(await response.arrayBuffer()));
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

async function uploadWithBroker(input: {
  publicClient: SupabaseClient;
  broker: PublishingWorkerBrokerClient;
  jobId: string;
  workerId: string;
  path: string;
  data: Uint8Array | string;
  contentType: string;
}): Promise<void> {
  const { token } = await input.broker.createStorageUpload({
    jobId: input.jobId,
    workerId: input.workerId,
    path: input.path,
  });
  const { error } = await input.publicClient.storage
    .from(BUCKET)
    .uploadToSignedUrl(input.path, token, input.data, { contentType: input.contentType });
  if (error) throw new Error(`Publishing signed upload failed for ${input.path}: ${error.message}`);
}

async function persistCheckpoints(input: {
  publicClient: SupabaseClient;
  broker: PublishingWorkerBrokerClient;
  job: ProductionJob;
  workerId: string;
  localRoot: string;
  storagePrefix: string;
}): Promise<void> {
  const files = await localFiles(input.localRoot);
  for (const localPath of files) {
    const rel = relative(input.localRoot, localPath).split("\\").join("/");
    const storagePath = `${input.storagePrefix}${rel}`;
    await uploadWithBroker({
      publicClient: input.publicClient,
      broker: input.broker,
      jobId: input.job.id,
      workerId: input.workerId,
      path: storagePath,
      data: await readFile(localPath),
      contentType: "application/json",
    });
  }
}

function publicationFromRecord(record: Record<string, unknown>): Record<string, unknown> {
  return {
    pdfArtifactPath: record.pdf_artifact_path,
    manuscriptHtmlPath: record.manuscript_html_path,
    manuscriptJsonPath: record.manuscript_json_path,
    blueprintPath: record.blueprint_path,
    qaReportPath: record.qa_report_path,
    releaseManifestPath: record.release_manifest_path,
    providerName: record.provider_name,
    providerModel: record.provider_model,
    knowledgeHashes: record.knowledge_hashes,
    qaSummary: record.qa_summary,
  };
}

async function processProductionJob(input: {
  broker: PublishingWorkerBrokerClient;
  publicClient: SupabaseClient;
  credential: string;
  workerId: string;
  job: ProductionJob;
}): Promise<WorkerProcessOutcome> {
  const { broker, publicClient, credential, workerId, job } = input;
  const temp = await mkdtemp(join(tmpdir(), "pak-publishing-worker-"));
  const checkpointRoot = join(temp, "checkpoints");
  const artifactRoot = join(temp, "artifacts");
  const storageCheckpointPrefix = checkpointPrefix(job);

  try {
    if (job.checkpointRoot) {
      await restoreCheckpoints({ broker, job, workerId, localRoot: checkpointRoot, storagePrefix: storageCheckpointPrefix });
    }

    const provider = new OpenAITextGenerationProvider({
      transport: internalOpenAITransport(job, credential),
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

    await persistCheckpoints({
      publicClient,
      broker,
      job,
      workerId,
      localRoot: checkpointRoot,
      storagePrefix: storageCheckpointPrefix,
    });

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
          await uploadWithBroker({
            publicClient,
            broker,
            jobId: job.id,
            workerId,
            path,
            data,
            contentType,
          });
        },
      },
      publications: {
        async upsert(record) {
          return broker.upsertPublication({
            jobId: job.id,
            workerId,
            publication: publicationFromRecord(record),
          });
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

export function createConfiguredWorkerDependencies(input: {
  credential: string;
  workerId: string;
}): NodePublishingWorkerDependencies {
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const broker = createPublishingWorkerBrokerClient({ credential: input.credential });
  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const repository = new PublishingProductionRepository(brokerTransport(broker));

  return {
    claimJobs: (claim) => repository.claimJobs(claim),
    processJob: (job) => processProductionJob({
      broker,
      publicClient,
      credential: input.credential,
      workerId: input.workerId,
      job,
    }),
    yieldJob: (yieldInput) => repository.yieldJob(yieldInput),
    completeJob: (completeInput) => repository.completeJob(completeInput),
    failJob: ({ jobId, workerId, error }) => repository.failJob(jobId, workerId, error),
  };
}

export async function runConfiguredPublishingWorker(input: {
  workerId: string;
  credential: string;
  concurrency?: number;
}) {
  return runNodePublishingWorker({
    workerId: input.workerId,
    ...(input.concurrency !== undefined ? { concurrency: input.concurrency } : {}),
    dependencies: createConfiguredWorkerDependencies({
      credential: input.credential,
      workerId: input.workerId,
    }),
  });
}
