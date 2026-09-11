import { describe, expect, it } from "vitest";
import {
  assertScenePlanTransition,
  clonePlanVersionForEdit,
  markPlanVersionStale,
} from "./workflow";

function approvedVersion() {
  return {
    id: "plan-v3",
    versionNumber: 3,
    parentVersionId: "plan-v2",
    status: "APPROVED" as const,
    sourceIntegrityHash: "sha256:a",
    approvedBy: "user-1",
    approvedAt: "2026-09-11T00:00:00Z",
    qcSummary: { blockerCount: 0, warningCount: 1 },
    scenes: [
      {
        ordinal: 1,
        shots: [{ ordinal: 1, humanModified: true, creativeDirection: "Human edited shot" }],
      },
    ],
  };
}

describe("Scene Planning workflow", () => {
  it("requires zero blockers and fresh source for review and approval", () => {
    expect(() =>
      assertScenePlanTransition("QC_REQUIRED", "REVIEW_REQUIRED", { blockerCount: 0, sourceFresh: true }),
    ).not.toThrow();
    expect(() =>
      assertScenePlanTransition("QC_REQUIRED", "REVIEW_REQUIRED", { blockerCount: 1, sourceFresh: true }),
    ).toThrow(/BLOCKER/);
    expect(() =>
      assertScenePlanTransition("QC_REQUIRED", "REVIEW_REQUIRED", { blockerCount: 0, sourceFresh: false }),
    ).toThrow(/stale/i);
    expect(() =>
      assertScenePlanTransition("REVIEW_REQUIRED", "APPROVED", { blockerCount: 0, sourceFresh: true }),
    ).not.toThrow();
  });

  it("refuses direct draft approval and approved editing", () => {
    expect(() =>
      assertScenePlanTransition("DRAFT", "APPROVED", { blockerCount: 0, sourceFresh: true }),
    ).toThrow(/transition/i);
    expect(() =>
      assertScenePlanTransition("APPROVED", "DRAFT", { blockerCount: 0, sourceFresh: true }),
    ).toThrow(/transition/i);
  });

  it("allows approved plans to become stale or superseded", () => {
    expect(() =>
      assertScenePlanTransition("APPROVED", "STALE", { blockerCount: 0, sourceFresh: false }),
    ).not.toThrow();
    expect(() =>
      assertScenePlanTransition("APPROVED", "SUPERSEDED", { blockerCount: 0, sourceFresh: true }),
    ).not.toThrow();
  });

  it("clones an approved version into the next draft using copy-on-write", () => {
    const source = approvedVersion();
    const clone = clonePlanVersionForEdit(source, "plan-v4");
    expect(clone.id).toBe("plan-v4");
    expect(clone.versionNumber).toBe(4);
    expect(clone.parentVersionId).toBe("plan-v3");
    expect(clone.status).toBe("DRAFT");
    expect(clone.approvedBy).toBeNull();
    expect(clone.approvedAt).toBeNull();
    expect(clone.scenes[0].shots[0].humanModified).toBe(true);
    expect(clone.scenes).not.toBe(source.scenes);
    expect(clone.scenes[0].shots[0]).not.toBe(source.scenes[0].shots[0]);
  });

  it("marks a plan stale without mutating creative payload", () => {
    const source = approvedVersion();
    const stale = markPlanVersionStale(source, "sha256:new");
    expect(stale.status).toBe("STALE");
    expect(stale.staleAgainstSourceIntegrityHash).toBe("sha256:new");
    expect(stale.scenes).toEqual(source.scenes);
    expect(stale.scenes).not.toBe(source.scenes);
  });
});
