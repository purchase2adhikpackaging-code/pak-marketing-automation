import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ProductionQueue,
  resolveWorkerConcurrency,
  runWorkerPool,
  type ProductionQueueJob,
} from "@/modules/publishing-factory/worker-queue";

const input = (suffix: number) => ({
  bookId: `PAK-D01-S1-D01-${100 + suffix}-TEXTBOOK`,
  edition: "2026",
  revision: "0.1.0",
  payload: { subjectCode: `D01-${100 + suffix}` },
});

function snapshotPath(): string {
  const root = mkdtempSync(join(tmpdir(), "pak-worker-queue-"));
  return join(root, "queue.json");
}

describe("bounded resumable publishing worker queue", () => {
  it("deduplicates enqueue by bookId + edition + revision", async () => {
    const queue = new ProductionQueue({ snapshotPath: snapshotPath() });
    const first = await queue.enqueue(input(1));
    const duplicate = await queue.enqueue(input(1));

    expect(duplicate.id).toBe(first.id);
    expect(duplicate.idempotencyKey).toBe(first.idempotencyKey);
    expect(await queue.list()).toHaveLength(1);
  });

  it("runs at most four jobs concurrently when concurrency is four", async () => {
    const queue = new ProductionQueue({ snapshotPath: snapshotPath() });
    for (let index = 1; index <= 8; index += 1) {
      await queue.enqueue(input(index));
    }

    let active = 0;
    let maxActive = 0;
    const completed: string[] = [];

    await runWorkerPool({
      queue,
      concurrency: 4,
      worker: async (job) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        completed.push(job.id);
        active -= 1;
      },
    });

    expect(maxActive).toBe(4);
    expect(completed).toHaveLength(8);
    expect((await queue.list()).every((job) => job.status === "COMPLETED")).toBe(true);
  });

  it("reclaims an abandoned job after its lease expires", async () => {
    let nowMs = Date.parse("2026-09-11T16:00:00.000Z");
    const queue = new ProductionQueue({
      snapshotPath: snapshotPath(),
      leaseDurationMs: 1_000,
      now: () => new Date(nowMs),
    });
    const enqueued = await queue.enqueue(input(1));

    const firstClaim = await queue.claim("worker-a");
    expect(firstClaim?.id).toBe(enqueued.id);
    expect(firstClaim?.leaseOwner).toBe("worker-a");

    nowMs += 1_001;
    const reclaimed = await queue.claim("worker-b");
    expect(reclaimed?.id).toBe(enqueued.id);
    expect(reclaimed?.leaseOwner).toBe("worker-b");
  });

  it("never reclaims completed work", async () => {
    let nowMs = Date.parse("2026-09-11T16:00:00.000Z");
    const queue = new ProductionQueue({
      snapshotPath: snapshotPath(),
      leaseDurationMs: 1_000,
      now: () => new Date(nowMs),
    });
    await queue.enqueue(input(1));
    const claimed = await queue.claim("worker-a");
    expect(claimed).toBeTruthy();
    await queue.complete(claimed!.id, "worker-a", { artifact: "book.pdf" });

    nowMs += 10_000;
    expect(await queue.claim("worker-b")).toBeNull();
    expect((await queue.list())[0]?.status).toBe("COMPLETED");
  });

  it("blocks a repeatedly failing job after exactly three attempts", async () => {
    const queue = new ProductionQueue({
      snapshotPath: snapshotPath(),
      maxAttempts: 3,
    });
    const enqueued = await queue.enqueue(input(1));

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const claimed = await queue.claim(`worker-${attempt}`);
      expect(claimed?.id).toBe(enqueued.id);
      expect(claimed?.attemptCount).toBe(attempt);
      await queue.fail(claimed!.id, `worker-${attempt}`, `failure-${attempt}`);
    }

    const final = (await queue.list()).find((job) => job.id === enqueued.id);
    expect(final?.attemptCount).toBe(3);
    expect(final?.status).toBe("BLOCKED");
    expect(await queue.claim("worker-4")).toBeNull();
  });

  it("returns immediately on an empty queue without cycling workers", async () => {
    const queue = new ProductionQueue({ snapshotPath: snapshotPath() });
    let calls = 0;

    const result = await runWorkerPool({
      queue,
      concurrency: 4,
      worker: async () => {
        calls += 1;
      },
    });

    expect(calls).toBe(0);
    expect(result.claimed).toBe(0);
    expect(result.completed).toBe(0);
  });

  it("reloads durable JSON queue state after process-style reconstruction", async () => {
    const path = snapshotPath();
    const first = new ProductionQueue({ snapshotPath: path });
    const enqueued = await first.enqueue(input(1));

    const restarted = new ProductionQueue({ snapshotPath: path });
    const jobs = await restarted.list();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.id).toBe(enqueued.id);
    expect(jobs[0]?.status).toBe("QUEUED");
  });

  it("resolves default concurrency to four and clamps environment values to 1..32", () => {
    expect(resolveWorkerConcurrency(undefined)).toBe(4);
    expect(resolveWorkerConcurrency("8")).toBe(8);
    expect(resolveWorkerConcurrency("0")).toBe(1);
    expect(resolveWorkerConcurrency("99")).toBe(32);
    expect(resolveWorkerConcurrency("not-a-number")).toBe(4);
  });

  it("exposes queue jobs with bounded-attempt and lease metadata", async () => {
    const queue = new ProductionQueue({ snapshotPath: snapshotPath(), maxAttempts: 3 });
    const job: ProductionQueueJob = await queue.enqueue(input(1));

    expect(job.maxAttempts).toBe(3);
    expect(job.attemptCount).toBe(0);
    expect(job.leaseOwner).toBeNull();
    expect(job.leaseExpiresAt).toBeNull();
    expect(job.status).toBe("QUEUED");
  });
});
