import { describe, expect, it } from "vitest";
import { canTransition, transitionJob } from "@/modules/publishing-factory/state-machine";
import type { BookJob } from "@/modules/publishing-factory/domain";

const baseJob: BookJob = {
  bookId: "PAK-D01-S1-D01-101-TEXTBOOK",
  programmeCode: "PAK-D01",
  programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
  level: "diploma",
  academicPeriod: "S1",
  subjectCode: "D01-101",
  subjectTitle: "Railway Fundamentals",
  publicationType: "textbook",
  edition: "2026",
  revision: "0.1.0",
  curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
  status: "PLANNED",
  repairAttempts: {},
};

describe("publishing job state machine", () => {
  it("permits normal production progression", () => {
    expect(canTransition("PLANNED", "BLUEPRINT_READY")).toBe(true);
    expect(canTransition("PDF_BUILT", "QA_RUNNING")).toBe(true);
    expect(canTransition("QA_PASSED", "RELEASED")).toBe(true);
  });

  it("forbids release directly from PDF build", () => {
    expect(canTransition("PDF_BUILT", "RELEASED")).toBe(false);
  });

  it("permits failed QA to repair or block only", () => {
    expect(canTransition("QA_FAILED", "REPAIRING")).toBe(true);
    expect(canTransition("QA_FAILED", "BLOCKED")).toBe(true);
    expect(canTransition("QA_FAILED", "RELEASED")).toBe(false);
  });

  it("returns a new job when transitioning", () => {
    const next = transitionJob(baseJob, "BLUEPRINT_READY");
    expect(next.status).toBe("BLUEPRINT_READY");
    expect(baseJob.status).toBe("PLANNED");
  });

  it("throws on an illegal transition", () => {
    expect(() => transitionJob(baseJob, "RELEASED")).toThrow(/illegal publishing transition/i);
  });
});
