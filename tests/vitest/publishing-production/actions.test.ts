import { describe, expect, it } from "vitest";
import type { AppRole } from "@/modules/auth/roles";
import type { BookJob } from "@/modules/publishing-factory/domain";
import {
  executeStartProductionRunAction,
  executeProductionRunControlAction,
  type ProductionActionDependencies,
} from "@/app/(app)/publishing/production/actions";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actorId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const job: BookJob = {
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
};

function dependencies(role: AppRole | null): ProductionActionDependencies & { events: string[] } {
  const events: string[] = [];
  return {
    events,
    getActorMembership: async () => role ? { actorId, role } : null,
    isRecoveryConfigured: async () => true,
    plan: async () => ({ jobs: [{ job, curriculumText: "governed D01 curriculum" }], exclusions: [] }),
    createRun: async () => {
      events.push("create");
      return { id: "11111111-1111-4111-8111-111111111111" };
    },
    enqueueJobs: async () => { events.push("enqueue"); },
    kick: async () => { events.push("kick"); },
    controlRun: async (_runId, state) => { events.push(state); },
  };
}

describe("publishing production actions", () => {
  it("denies unauthenticated or non-member start requests", async () => {
    const result = await executeStartProductionRunAction({
      organizationId,
      scope: { type: "PILOT", programmeCode: "PAK-D01", limit: 2 },
      concurrency: 4,
    }, dependencies(null));
    expect(result.ok).toBe(false);
  });

  it("allows an admin to persist and enqueue a pilot then kicks asynchronously", async () => {
    const deps = dependencies("ADMIN");
    const result = await executeStartProductionRunAction({
      organizationId,
      scope: { type: "PILOT", programmeCode: "PAK-D01", limit: 2 },
      concurrency: 4,
    }, deps);
    expect(result).toMatchObject({ ok: true, plannedCount: 1 });
    expect(deps.events).toEqual(["create", "enqueue", "kick"]);
  });

  it("refuses new and resumed work while the durable recovery dispatcher is absent", async () => {
    const startDeps = dependencies("ADMIN");
    startDeps.isRecoveryConfigured = async () => false;
    const start = await executeStartProductionRunAction({
      organizationId,
      scope: { type: "SUBJECT", programmeCode: "PAK-D01", subjectCode: "D01-102" },
      concurrency: 1,
    }, startDeps);
    expect(start).toMatchObject({ ok: false, error: expect.stringMatching(/dispatcher|recovery/i) });
    expect(startDeps.events).toEqual([]);

    const resumeDeps = dependencies("ADMIN");
    resumeDeps.isRecoveryConfigured = async () => false;
    const resume = await executeProductionRunControlAction({
      organizationId,
      runId: "11111111-1111-4111-8111-111111111111",
      state: "RUNNING",
    }, resumeDeps);
    expect(resume).toMatchObject({ ok: false, error: expect.stringMatching(/dispatcher|recovery/i) });
    expect(resumeDeps.events).toEqual([]);
  });

  it("denies editor portfolio production but allows lower scopes", async () => {
    const denied = await executeStartProductionRunAction({
      organizationId,
      scope: { type: "PORTFOLIO" },
      concurrency: 4,
    }, dependencies("EDITOR"));
    expect(denied.ok).toBe(false);

    const allowed = await executeStartProductionRunAction({
      organizationId,
      scope: { type: "SUBJECT", programmeCode: "PAK-D01", subjectCode: "D01-102" },
      concurrency: 4,
    }, dependencies("EDITOR"));
    expect(allowed.ok).toBe(true);
  });

  it("fails closed when planning yields no runnable books", async () => {
    const deps = dependencies("ADMIN");
    deps.plan = async () => ({ jobs: [], exclusions: [{ programmeCode: "PAK-B03", reason: "ARCHITECTURE_REQUIRED" }] });
    const result = await executeStartProductionRunAction({
      organizationId,
      scope: { type: "PROGRAMME", programmeCode: "PAK-B03" },
      concurrency: 4,
    }, deps);
    expect(result.ok).toBe(false);
    expect(deps.events).toEqual([]);
  });

  it("authorizes pause/resume/cancel only for permitted members", async () => {
    const deps = dependencies("ADMIN");
    const result = await executeProductionRunControlAction({
      organizationId,
      runId: "11111111-1111-4111-8111-111111111111",
      state: "PAUSED",
    }, deps);
    expect(result.ok).toBe(true);
    expect(deps.events).toContain("PAUSED");
  });
});
