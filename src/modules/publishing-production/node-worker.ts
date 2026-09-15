import type { ProductionJob } from "./domain";

export type WorkerProcessOutcome =
  | {
      kind: "yield";
      checkpointRoot: string;
      currentStage: string;
    }
  | {
      kind: "complete";
      qaStatus: "QA_PASSED";
      pdfArtifactPath: string;
      manifestArtifactPath: string;
      providerName?: string;
      providerModel?: string;
      knowledgeHashes?: unknown[];
    };

export interface NodePublishingWorkerDependencies {
  claimJobs(input: { workerId: string; limit: number; leaseSeconds: number }): Promise<ProductionJob[]>;
  processJob(job: ProductionJob): Promise<WorkerProcessOutcome>;
  yieldJob(input: { jobId: string; workerId: string; checkpointRoot: string; currentStage: string }): Promise<unknown>;
  completeJob(input: {
    jobId: string;
    workerId: string;
    qaStatus: "QA_PASSED";
    pdfArtifactPath: string;
    manifestArtifactPath: string;
    providerName?: string;
    providerModel?: string;
    knowledgeHashes?: unknown[];
  }): Promise<unknown>;
  failJob(input: { jobId: string; workerId: string; error: string }): Promise<unknown>;
}

export interface NodePublishingWorkerResult {
  claimed: number;
  yielded: number;
  completed: number;
  failed: number;
}

export async function runNodePublishingWorker(input: {
  workerId: string;
  concurrency?: number;
  leaseSeconds?: number;
  dependencies: NodePublishingWorkerDependencies;
}): Promise<NodePublishingWorkerResult> {
  const concurrency = input.concurrency ?? 4;
  const leaseSeconds = input.leaseSeconds ?? 300;
  if (!input.workerId.trim()) throw new Error("Publishing worker id is required.");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    throw new Error("Publishing worker concurrency must be an integer from 1 to 32.");
  }
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 30) {
    throw new Error("Publishing worker lease must be at least 30 seconds.");
  }

  const jobs = await input.dependencies.claimJobs({
    workerId: input.workerId,
    limit: concurrency,
    leaseSeconds,
  });
  const result: NodePublishingWorkerResult = {
    claimed: jobs.length,
    yielded: 0,
    completed: 0,
    failed: 0,
  };

  await Promise.all(
    jobs.map(async (job) => {
      try {
        const outcome = await input.dependencies.processJob(job);
        if (outcome.kind === "yield") {
          await input.dependencies.yieldJob({
            jobId: job.id,
            workerId: input.workerId,
            checkpointRoot: outcome.checkpointRoot,
            currentStage: outcome.currentStage,
          });
          result.yielded += 1;
          return;
        }

        await input.dependencies.completeJob({
          jobId: job.id,
          workerId: input.workerId,
          qaStatus: outcome.qaStatus,
          pdfArtifactPath: outcome.pdfArtifactPath,
          manifestArtifactPath: outcome.manifestArtifactPath,
          ...(outcome.providerName ? { providerName: outcome.providerName } : {}),
          ...(outcome.providerModel ? { providerModel: outcome.providerModel } : {}),
          ...(outcome.knowledgeHashes ? { knowledgeHashes: outcome.knowledgeHashes } : {}),
        });
        result.completed += 1;
      } catch (error) {
        await input.dependencies.failJob({
          jobId: job.id,
          workerId: input.workerId,
          error: error instanceof Error ? error.message : String(error),
        });
        result.failed += 1;
      }
    }),
  );

  return result;
}
