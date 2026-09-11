import { describe, expect, it } from "vitest";
import {
  PublishingProductionRepository,
  type PublishingProductionTransport,
} from "@/modules/publishing-production/repository";

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
      if (name === "claim_publishing_jobs") {
        return [{
          id: "22222222-2222-4222-8222-222222222222",
          organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          production_run_id: "11111111-1111-4111-8111-111111111111",
          book_id: "PAK-D01-S1-D01-102-TEXTBOOK",
          programme_code: "PAK-D01",
          subject_code: "D01-102",
          academic_period: "S1",
          edition: "2026",
          revision: "0.1.0",
          status: "RUNNING",
          attempt_count: 2,
          max_attempts: 3,
          lease_owner: "worker-1",
          lease_expires_at: "2026-09-12T00:05:00Z",
          created_at: "2026-09-12T00:00:00Z",
          updated_at: "2026-09-12T00:00:00Z",
        }];
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

  it("claims only the requested bounded number and preserves attempt count", async () => {
    const client = transport();
    const repo = new PublishingProductionRepository(client);
    const jobs = await repo.claimJobs({ workerId: "worker-1", limit: 4, leaseSeconds: 300 });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.attemptCount).toBe(2);
    expect(client.calls.find((entry) => entry.kind === "rpc:claim_publishing_jobs")?.payload).toEqual({
      p_worker_id: "worker-1",
      p_limit: 4,
      p_lease_seconds: 300,
    });
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
