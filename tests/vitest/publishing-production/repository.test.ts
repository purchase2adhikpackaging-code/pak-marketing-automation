import { describe, expect, it } from "vitest";
import {
  PublishingProductionRepository,
  type PublishingProductionTransport,
} from "@/modules/publishing-production/repository";

const governedBookJob = {
  bookId: "PAK-D01-S1-D01-102-TEXTBOOK",
  programmeCode: "PAK-D01",
  programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
  level: "diploma",
  academicPeriod: "S1",
  subjectCode: "D01-102",
  subjectTitle: "Applied Engineering Mathematics & Physics for Railways",
  publicationType: "textbook",
  edition: "2026",
  revision: "0.1.0",
  curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
  status: "PLANNED",
  repairAttempts: {},
} as const;

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    production_run_id: "11111111-1111-4111-8111-111111111111",
    book_id: governedBookJob.bookId,
    programme_code: governedBookJob.programmeCode,
    subject_code: governedBookJob.subjectCode,
    academic_period: governedBookJob.academicPeriod,
    edition: governedBookJob.edition,
    revision: governedBookJob.revision,
    book_job_payload: governedBookJob,
    curriculum_text: "D01-102 governed curriculum text",
    status: "RUNNING",
    claim_count: 7,
    failure_attempts: 1,
    max_failure_attempts: 3,
    lease_owner: "worker-1",
    lease_expires_at: "2026-09-12T00:05:00Z",
    current_stage: "MANUSCRIPT_IN_PROGRESS",
    created_at: "2026-09-12T00:00:00Z",
    updated_at: "2026-09-12T00:00:00Z",
    ...overrides,
  };
}

function transport(): PublishingProductionTransport & { calls: Array<{ kind: string; payload: unknown }> } {
  const calls: Array<{ kind: string; payload: unknown }> = [];
  return {
    calls,
    async insertRun(payload) {
      calls.push({ kind: "insertRun", payload });
      return {
        id: "11111111-1111-4111-8111-111111111111",
        organization_id: payload.organization_id,
        created_by: payload.created_by,
        scope_type: payload.scope_type,
        scope_value: payload.scope_value,
        status: "QUEUED",
        requested_concurrency: payload.requested_concurrency,
        planned_count: payload.planned_count,
        queued_count: payload.planned_count,
        running_count: 0,
        qa_passed_count: 0,
        blocked_count: 0,
        cancelled_count: 0,
        released_count: 0,
        idempotency_key: payload.idempotency_key,
        created_at: "2026-09-12T00:00:00Z",
        updated_at: "2026-09-12T00:00:00Z",
      };
    },
    async listRuns(organizationId) {
      calls.push({ kind: "listRuns", payload: organizationId });
      return [];
    },
    async getRun(organizationId, runId) {
      calls.push({ kind: "getRun", payload: { organizationId, runId } });
      return null;
    },
    async rpc(name, args) {
      calls.push({ kind: `rpc:${name}`, payload: args });
      if (name === "claim_publishing_jobs") return [jobRow()];
      if (name === "yield_publishing_job") {
        return jobRow({
          status: "QUEUED",
          lease_owner: null,
          lease_expires_at: null,
          checkpoint_root: args.p_checkpoint_root,
          current_stage: args.p_current_stage,
        });
      }
      if (name === "fail_publishing_job") {
        return jobRow({
          status: "QUEUED",
          lease_owner: null,
          lease_expires_at: null,
          failure_attempts: 2,
          last_error: args.p_error,
        });
      }
      return null;
    },
    async listPublications(organizationId) {
      calls.push({ kind: "listPublications", payload: organizationId });
      return [];
    },
  };
}

const orgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actorId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("PublishingProductionRepository", () => {
  it("creates idempotent organization-scoped runs with stable identity", async () => {
    const client = transport();
    const repo = new PublishingProductionRepository(client);
    const run = await repo.createRun({
      organizationId: orgId,
      createdBy: actorId,
      role: "ADMIN",
      scope: { type: "SUBJECT", programmeCode: "PAK-D01", subjectCode: "D01-102" },
      requestedConcurrency: 4,
      plannedCount: 1,
    });

    expect(run.organizationId).toBe(orgId);
    const call = client.calls.find((entry) => entry.kind === "insertRun");
    expect(call).toBeTruthy();
    expect(JSON.stringify(call?.payload)).toContain("PAK-D01");
    expect(JSON.stringify(call?.payload)).toContain("D01-102");
    expect((call?.payload as { idempotency_key?: string }).idempotency_key).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed when an editor attempts a portfolio run", async () => {
    const repo = new PublishingProductionRepository(transport());
    await expect(repo.createRun({
      organizationId: orgId,
      createdBy: actorId,
      role: "EDITOR",
      scope: { type: "PORTFOLIO" },
      requestedConcurrency: 4,
      plannedCount: 10,
    })).rejects.toThrow(/portfolio|permission/i);
  });

  it("clamps no values silently and rejects invalid concurrency", async () => {
    const repo = new PublishingProductionRepository(transport());
    await expect(repo.createRun({
      organizationId: orgId,
      createdBy: actorId,
      role: "ADMIN",
      scope: { type: "PILOT", programmeCode: "PAK-D01", limit: 3 },
      requestedConcurrency: 0,
      plannedCount: 3,
    })).rejects.toThrow(/concurrency/i);
  });

  it("preserves independent claim and failure counters", async () => {
    const client = transport();
    const repo = new PublishingProductionRepository(client);
    const jobs = await repo.claimJobs({ workerId: "worker-1", limit: 4, leaseSeconds: 300 });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.claimCount).toBe(7);
    expect(jobs[0]?.failureAttempts).toBe(1);
    expect(jobs[0]?.bookJobPayload.bookId).toBe(governedBookJob.bookId);
    expect(client.calls.find((entry) => entry.kind === "rpc:claim_publishing_jobs")?.payload).toEqual({
      p_worker_id: "worker-1",
      p_limit: 4,
      p_lease_seconds: 300,
    });
  });

  it("yields successful checkpoint progress without consuming a failure", async () => {
    const client = transport();
    const repo = new PublishingProductionRepository(client);
    const job = await repo.yieldJob({
      jobId: "22222222-2222-4222-8222-222222222222",
      workerId: "worker-1",
      checkpointRoot: "publishing/org/book/checkpoints",
      currentStage: "MANUSCRIPT_IN_PROGRESS",
    });
    expect(job.status).toBe("QUEUED");
    expect(job.failureAttempts).toBe(1);
    expect(job.claimCount).toBe(7);
    expect(job.checkpointRoot).toContain("checkpoints");
  });

  it("maps actual failures independently from claim count", async () => {
    const repo = new PublishingProductionRepository(transport());
    const job = await repo.failJob(
      "22222222-2222-4222-8222-222222222222",
      "worker-1",
      "provider timeout",
    );
    expect(job.claimCount).toBe(7);
    expect(job.failureAttempts).toBe(2);
    expect(job.lastError).toMatch(/provider timeout/i);
  });

  it("always filters run and publication reads by organization", async () => {
    const client = transport();
    const repo = new PublishingProductionRepository(client);
    await repo.listRuns(orgId);
    await repo.getRun(orgId, "11111111-1111-4111-8111-111111111111");
    await repo.listPublications(orgId);
    expect(client.calls.filter((entry) => entry.kind === "listRuns")[0]?.payload).toBe(orgId);
    expect(client.calls.filter((entry) => entry.kind === "listPublications")[0]?.payload).toBe(orgId);
    expect(client.calls.find((entry) => entry.kind === "getRun")?.payload).toEqual({
      organizationId: orgId,
      runId: "11111111-1111-4111-8111-111111111111",
    });
  });
});
