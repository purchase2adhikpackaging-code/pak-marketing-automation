import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

export const ProductionQueueStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "BLOCKED",
]);
export type ProductionQueueStatus = z.infer<typeof ProductionQueueStatusSchema>;

const ProductionQueueJobSchema = z.object({
  id: z.string().min(1),
  idempotencyKey: z.string().min(1),
  bookId: z.string().min(1),
  edition: z.string().min(1),
  revision: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  status: ProductionQueueStatusSchema,
  attemptCount: z.number().int().min(0),
  maxAttempts: z.number().int().positive(),
  leaseOwner: z.string().min(1).nullable(),
  leaseExpiresAt: z.string().datetime().nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  lastError: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProductionQueueJob = z.infer<typeof ProductionQueueJobSchema>;

const QueueSnapshotSchema = z.object({
  version: z.literal(1),
  jobs: z.array(ProductionQueueJobSchema),
});

type QueueSnapshot = z.infer<typeof QueueSnapshotSchema>;

export interface ProductionQueueInput {
  bookId: string;
  edition: string;
  revision: string;
  payload?: Record<string, unknown>;
}

export interface ProductionQueueOptions {
  snapshotPath: string;
  leaseDurationMs?: number;
  maxAttempts?: number;
  now?: () => Date;
}

export interface WorkerPoolResult {
  claimed: number;
  completed: number;
  failed: number;
  blocked: number;
}

function cloneJob(job: ProductionQueueJob): ProductionQueueJob {
  return structuredClone(job);
}

function idempotencyKey(input: ProductionQueueInput): string {
  return `${input.bookId}:${input.edition}:${input.revision}`;
}

function deterministicJobId(key: string): string {
  return `publishing-${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
}

export function resolveWorkerConcurrency(
  value: string | undefined = process.env.PUBLISHING_WORKER_CONCURRENCY,
): number {
  if (value === undefined || value.trim() === "") return 4;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.max(1, Math.min(32, Math.trunc(parsed)));
}

export class ProductionQueue {
  private readonly snapshotPath: string;
  private readonly leaseDurationMs: number;
  private readonly maxAttempts: number;
  private readonly now: () => Date;
  private loaded = false;
  private jobs: ProductionQueueJob[] = [];
  private operationChain: Promise<void> = Promise.resolve();

  constructor(options: ProductionQueueOptions) {
    this.snapshotPath = options.snapshotPath;
    this.leaseDurationMs = options.leaseDurationMs ?? 5 * 60 * 1000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.now = options.now ?? (() => new Date());

    if (!Number.isInteger(this.leaseDurationMs) || this.leaseDurationMs <= 0) {
      throw new Error("leaseDurationMs must be a positive integer");
    }
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts <= 0) {
      throw new Error("maxAttempts must be a positive integer");
    }
  }

  async enqueue(input: ProductionQueueInput): Promise<ProductionQueueJob> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      const key = idempotencyKey(input);
      const existing = this.jobs.find((job) => job.idempotencyKey === key);
      if (existing) return cloneJob(existing);

      const timestamp = this.now().toISOString();
      const job: ProductionQueueJob = {
        id: deterministicJobId(key),
        idempotencyKey: key,
        bookId: input.bookId,
        edition: input.edition,
        revision: input.revision,
        payload: structuredClone(input.payload ?? {}),
        status: "QUEUED",
        attemptCount: 0,
        maxAttempts: this.maxAttempts,
        leaseOwner: null,
        leaseExpiresAt: null,
        result: null,
        lastError: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.jobs.push(job);
      await this.persist();
      return cloneJob(job);
    });
  }

  async claim(workerId: string): Promise<ProductionQueueJob | null> {
    if (!workerId.trim()) throw new Error("workerId is required");

    return this.serialized(async () => {
      await this.ensureLoaded();
      const now = this.now();
      let mutated = false;

      for (const job of this.jobs) {
        const expiredRunning =
          job.status === "RUNNING" &&
          job.leaseExpiresAt !== null &&
          Date.parse(job.leaseExpiresAt) <= now.getTime();
        const claimable = job.status === "QUEUED" || expiredRunning;
        if (!claimable) continue;

        if (job.attemptCount >= job.maxAttempts) {
          job.status = "BLOCKED";
          job.leaseOwner = null;
          job.leaseExpiresAt = null;
          job.updatedAt = now.toISOString();
          mutated = true;
          continue;
        }

        job.status = "RUNNING";
        job.attemptCount += 1;
        job.leaseOwner = workerId;
        job.leaseExpiresAt = new Date(now.getTime() + this.leaseDurationMs).toISOString();
        job.updatedAt = now.toISOString();
        await this.persist();
        return cloneJob(job);
      }

      if (mutated) await this.persist();
      return null;
    });
  }

  async heartbeat(jobId: string, workerId: string): Promise<ProductionQueueJob> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      const job = this.requireOwnedRunningJob(jobId, workerId);
      const now = this.now();
      job.leaseExpiresAt = new Date(now.getTime() + this.leaseDurationMs).toISOString();
      job.updatedAt = now.toISOString();
      await this.persist();
      return cloneJob(job);
    });
  }

  async complete(
    jobId: string,
    workerId: string,
    result: Record<string, unknown> = {},
  ): Promise<ProductionQueueJob> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      const job = this.requireOwnedRunningJob(jobId, workerId);
      job.status = "COMPLETED";
      job.result = structuredClone(result);
      job.lastError = null;
      job.leaseOwner = null;
      job.leaseExpiresAt = null;
      job.updatedAt = this.now().toISOString();
      await this.persist();
      return cloneJob(job);
    });
  }

  async fail(jobId: string, workerId: string, reason: string): Promise<ProductionQueueJob> {
    if (!reason.trim()) throw new Error("failure reason is required");

    return this.serialized(async () => {
      await this.ensureLoaded();
      const job = this.requireOwnedRunningJob(jobId, workerId);
      job.status = job.attemptCount >= job.maxAttempts ? "BLOCKED" : "QUEUED";
      job.lastError = reason;
      job.leaseOwner = null;
      job.leaseExpiresAt = null;
      job.updatedAt = this.now().toISOString();
      await this.persist();
      return cloneJob(job);
    });
  }

  async list(): Promise<ProductionQueueJob[]> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      return this.jobs.map(cloneJob);
    });
  }

  private requireOwnedRunningJob(jobId: string, workerId: string): ProductionQueueJob {
    const job = this.jobs.find((candidate) => candidate.id === jobId);
    if (!job) throw new Error(`Unknown production queue job: ${jobId}`);
    if (job.status !== "RUNNING") {
      throw new Error(`Production queue job ${jobId} is not RUNNING`);
    }
    if (job.leaseOwner !== workerId) {
      throw new Error(`Production queue job ${jobId} is leased by another worker`);
    }
    return job;
  }

  private async serialized<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.operationChain;
    let release!: () => void;
    this.operationChain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.snapshotPath, "utf8");
      const parsed = QueueSnapshotSchema.parse(JSON.parse(raw) as unknown);
      this.jobs = parsed.jobs.map(cloneJob);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw new Error(
          `Unable to load publishing queue snapshot: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      this.jobs = [];
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    const snapshot: QueueSnapshot = {
      version: 1,
      jobs: this.jobs.map(cloneJob),
    };
    await mkdir(dirname(this.snapshotPath), { recursive: true });
    const temporaryPath = `${this.snapshotPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.snapshotPath);
  }
}

export async function runWorkerPool(input: {
  queue: ProductionQueue;
  worker: (job: ProductionQueueJob) => Promise<void>;
  concurrency?: number;
}): Promise<WorkerPoolResult> {
  const concurrency = input.concurrency ?? resolveWorkerConcurrency();
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    throw new Error("Publishing worker concurrency must be an integer from 1 to 32");
  }

  const result: WorkerPoolResult = {
    claimed: 0,
    completed: 0,
    failed: 0,
    blocked: 0,
  };

  await Promise.all(
    Array.from({ length: concurrency }, (_, index) =>
      (async () => {
        const workerId = `publishing-worker-${index + 1}`;
        while (true) {
          const job = await input.queue.claim(workerId);
          if (!job) return;
          result.claimed += 1;
          try {
            await input.worker(job);
            await input.queue.complete(job.id, workerId);
            result.completed += 1;
          } catch (error) {
            const failed = await input.queue.fail(
              job.id,
              workerId,
              error instanceof Error ? error.message : String(error),
            );
            result.failed += 1;
            if (failed.status === "BLOCKED") result.blocked += 1;
          }
        }
      })(),
    ),
  );

  return result;
}
