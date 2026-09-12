import { describe, expect, it } from "vitest";
import type { AppRole } from "@/modules/auth/roles";
import type { BookJob } from "@/modules/publishing-factory/domain";
import type { ProductionJob } from "@/modules/publishing-production/domain";
import { runNodePublishingWorker } from "@/modules/publishing-production/node-worker";
import {
  executeStartProductionRunAction,
  type ProductionActionDependencies,
} from "@/app/(app)/publishing/production/actions";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actorId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const runId = "11111111-1111-4111-8111-111111111111";

function book(subjectCode: string): BookJob {
  return {
    bookId: `PAK-D01-S1-${subjectCode}-TEXTBOOK`,
    programmeCode: "PAK-D01",
    programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
    level: "diploma",
    academicPeriod: "S1",
    subjectCode,
    subjectTitle: subjectCode === "D01-101" ? "Railway Systems & Rolling Stock Fundamentals" : "Applied Engineering Mathematics & Physics for Railways",
    publicationType: "textbook",
    edition: "2026",
    revision: "0.1.0",
    curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
    status: "PLANNED",
    repairAttempts: {},
  };
}

function productionJob(job: BookJob, index: number): ProductionJob {
  return {
    id: `22222222-2222-4222-8222-22222222222${index}`,
    organizationId,
    productionRunId: runId,
    bookId: job.bookId,
    programmeCode: job.programmeCode,
    subjectCode: job.subjectCode,
    academicPeriod: job.academicPeriod,
    edition: job.edition,
    revision: job.revision,
    bookJobPayload: job,
    curriculumText: `${job.subjectCode} governed curriculum`,
    status: "QUEUED",
    claimCount: 0,
    failureAttempts: 0,
    maxFailureAttempts: 3,
    leaseOwner: null,
    leaseExpiresAt: null,
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

describe("publishing production runner end-to-end orchestration", () => {
  it("resumes a passing book while a failing sibling blocks at exactly three failures", async () => {
    const plannedBooks = [book("D01-101"), book("D01-102")];
    const durable = new Map<string, ProductionJob>();
    const events: string[] = [];

    const actionDependencies: ProductionActionDependencies = {
      getActorMembership: async () => ({ actorId, role: "ADMIN" as AppRole }),
      plan: async () => ({
        jobs: plannedBooks.map((job) => ({ job, curriculumText: `${job.subjectCode} governed curriculum` })),
        exclusions: [],
      }),
      createRun: async () => ({ id: runId }),
      enqueueJobs: async ({ jobs }) => {
        jobs.forEach(({ job }, index) => durable.set(job.bookId, productionJob(job, index)));
      },
      kick: async () => { events.push("kick"); },
      controlRun: async () => undefined,
    };

    const started = await executeStartProductionRunAction({
      organizationId,
      scope: { type: "PILOT", programmeCode: "PAK-D01", limit: 2 },
      concurrency: 4,
    }, actionDependencies);

    expect(started).toMatchObject({ ok: true, plannedCount: 2, runId });
    expect(durable).toHaveLength(2);
    expect(events).toEqual(["kick"]);

    const successfulBookId = plannedBooks[0]!.bookId;
    const failingBookId = plannedBooks[1]!.bookId;
    let successfulProcessCalls = 0;

    const workerDependencies = {
      async claimJobs({ workerId, limit }: { workerId: string; limit: number; leaseSeconds: number }) {
        const claimed: ProductionJob[] = [];
        for (const current of durable.values()) {
          if (claimed.length >= limit) break;
          if (current.status !== "QUEUED") continue;
          const next: ProductionJob = {
            ...current,
            status: "RUNNING",
            claimCount: current.claimCount + 1,
            leaseOwner: workerId,
            leaseExpiresAt: "2026-09-12T00:05:00Z",
          };
          durable.set(next.bookId, next);
          claimed.push(next);
        }
        return claimed;
      },
      async processJob(current: ProductionJob) {
        if (current.bookId === failingBookId) throw new Error("deterministic provider failure");
        successfulProcessCalls += 1;
        if (successfulProcessCalls === 1) {
          return {
            kind: "yield" as const,
            checkpointRoot: `${organizationId}/PAK-D01/S1/D01-101/2026/0.1.0/checkpoints/`,
            currentStage: "MANUSCRIPT_IN_PROGRESS",
          };
        }
        return {
          kind: "complete" as const,
          qaStatus: "QA_PASSED" as const,
          pdfArtifactPath: `${organizationId}/PAK-D01/S1/D01-101/2026/0.1.0/textbook.pdf`,
          manifestArtifactPath: `${organizationId}/PAK-D01/S1/D01-101/2026/0.1.0/release-manifest.json`,
          providerName: "fake",
          providerModel: "fake-v1",
          knowledgeHashes: [],
        };
      },
      async yieldJob(input: { jobId: string; workerId: string; checkpointRoot: string; currentStage: string }) {
        const current = [...durable.values()].find((candidate) => candidate.id === input.jobId)!;
        durable.set(current.bookId, {
          ...current,
          status: "QUEUED",
          leaseOwner: null,
          leaseExpiresAt: null,
          checkpointRoot: input.checkpointRoot,
          currentStage: input.currentStage,
        });
      },
      async completeJob(input: { jobId: string; workerId: string; qaStatus: "QA_PASSED"; pdfArtifactPath: string; manifestArtifactPath: string }) {
        const current = [...durable.values()].find((candidate) => candidate.id === input.jobId)!;
        durable.set(current.bookId, {
          ...current,
          status: "QA_PASSED",
          qaStatus: "QA_PASSED",
          pdfArtifactPath: input.pdfArtifactPath,
          manifestArtifactPath: input.manifestArtifactPath,
          leaseOwner: null,
          leaseExpiresAt: null,
        });
      },
      async failJob(input: { jobId: string; workerId: string; error: string }) {
        const current = [...durable.values()].find((candidate) => candidate.id === input.jobId)!;
        const failures = current.failureAttempts + 1;
        durable.set(current.bookId, {
          ...current,
          status: failures >= 3 ? "BLOCKED" : "QUEUED",
          failureAttempts: failures,
          lastError: input.error,
          leaseOwner: null,
          leaseExpiresAt: null,
        });
      },
    };

    for (let invocation = 0; invocation < 4; invocation += 1) {
      await runNodePublishingWorker({
        workerId: `worker-${invocation}`,
        dependencies: workerDependencies,
      });
    }

    const passed = durable.get(successfulBookId)!;
    const blocked = durable.get(failingBookId)!;

    expect(passed.status).toBe("QA_PASSED");
    expect(passed.qaStatus).toBe("QA_PASSED");
    expect(passed.checkpointRoot).toContain("checkpoints");
    expect(passed.claimCount).toBe(2);
    expect(successfulProcessCalls).toBe(2);

    expect(blocked.status).toBe("BLOCKED");
    expect(blocked.failureAttempts).toBe(3);
    expect(blocked.claimCount).toBe(3);
    expect(blocked.lastError).toMatch(/provider failure/i);

    const finalSweep = await runNodePublishingWorker({
      workerId: "worker-final",
      dependencies: workerDependencies,
    });
    expect(finalSweep.claimed).toBe(0);
    expect(durable.get(failingBookId)?.failureAttempts).toBe(3);
  });
});
