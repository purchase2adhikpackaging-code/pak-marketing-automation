import { describe, expect, it } from "vitest";
import type { ProductionJob } from "@/modules/publishing-production/domain";
import { runNodePublishingWorker } from "@/modules/publishing-production/node-worker";

function job(id: string): ProductionJob {
  return {
    id,
    organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    productionRunId: "11111111-1111-4111-8111-111111111111",
    bookId: `BOOK-${id}`,
    programmeCode: "PAK-D01",
    subjectCode: "D01-102",
    academicPeriod: "S1",
    edition: "2026",
    revision: "0.1.0",
    status: "RUNNING",
    claimCount: 1,
    failureAttempts: 0,
    maxFailureAttempts: 3,
    leaseOwner: "worker-1",
    leaseExpiresAt: "2026-09-12T01:00:00Z",
    lastError: null,
    currentStage: null,
    checkpointRoot: null,
    qaStatus: null,
    pdfArtifactPath: null,
    manifestArtifactPath: null,
    providerName: null,
    providerModel: null,
    knowledgeHashes: [],
    createdAt: "2026-09-12T00:00:00Z",
    updatedAt: "2026-09-12T00:00:00Z",
    startedAt: null,
    completedAt: null,
  };
}

describe("runNodePublishingWorker", () => {
  it("claims at most four jobs by default and processes each only once", async () => {
    const processed: string[] = [];
    const claimed = Array.from({ length: 6 }, (_, index) => job(`22222222-2222-4222-8222-22222222222${index}`));
    const result = await runNodePublishingWorker({
      workerId: "worker-1",
      dependencies: {
        claimJobs: async ({ limit }) => claimed.slice(0, limit),
        processJob: async (current) => {
          processed.push(current.id);
          return { kind: "yield", checkpointRoot: `cp/${current.bookId}`, currentStage: "MANUSCRIPT_IN_PROGRESS" };
        },
        yieldJob: async () => undefined,
        completeJob: async () => undefined,
        failJob: async () => undefined,
      },
    });

    expect(processed).toHaveLength(4);
    expect(result.claimed).toBe(4);
    expect(result.yielded).toBe(4);
    expect(result.failed).toBe(0);
  });

  it("yields incomplete progress without calling fail", async () => {
    let yielded = 0;
    let failed = 0;
    await runNodePublishingWorker({
      workerId: "worker-1",
      concurrency: 1,
      dependencies: {
        claimJobs: async () => [job("22222222-2222-4222-8222-222222222222")],
        processJob: async () => ({ kind: "yield", checkpointRoot: "cp/book", currentStage: "MANUSCRIPT_IN_PROGRESS" }),
        yieldJob: async () => { yielded += 1; },
        completeJob: async () => undefined,
        failJob: async () => { failed += 1; },
      },
    });
    expect(yielded).toBe(1);
    expect(failed).toBe(0);
  });

  it("isolates an actual job failure and continues siblings", async () => {
    const completed: string[] = [];
    const failed: string[] = [];
    const jobs = [
      job("22222222-2222-4222-8222-222222222221"),
      job("22222222-2222-4222-8222-222222222222"),
    ];
    const result = await runNodePublishingWorker({
      workerId: "worker-1",
      concurrency: 2,
      dependencies: {
        claimJobs: async () => jobs,
        processJob: async (current) => {
          if (current.id.endsWith("1")) throw new Error("provider timeout");
          return {
            kind: "complete",
            qaStatus: "QA_PASSED",
            pdfArtifactPath: "book/textbook.pdf",
            manifestArtifactPath: "book/release-manifest.json",
            providerName: "fake",
            providerModel: "fake-v1",
            knowledgeHashes: [],
          };
        },
        yieldJob: async () => undefined,
        completeJob: async (input) => { completed.push(input.jobId); },
        failJob: async (input) => { failed.push(input.jobId); },
      },
    });
    expect(completed).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(result.completed).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("rejects invalid concurrency instead of silently clamping", async () => {
    await expect(runNodePublishingWorker({
      workerId: "worker-1",
      concurrency: 0,
      dependencies: {
        claimJobs: async () => [],
        processJob: async () => ({ kind: "yield", checkpointRoot: "x", currentStage: "x" }),
        yieldJob: async () => undefined,
        completeJob: async () => undefined,
        failJob: async () => undefined,
      },
    })).rejects.toThrow(/concurrency/i);
  });
});
