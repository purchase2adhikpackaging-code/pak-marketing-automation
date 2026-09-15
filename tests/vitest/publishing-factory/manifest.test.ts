import { describe, expect, it } from "vitest";
import type { BookJob, QaReport } from "@/modules/publishing-factory/domain";
import {
  assertCompleteRelease,
  buildReleaseManifest,
  canRelease,
} from "@/modules/publishing-factory/manifest";

function job(status: BookJob["status"], suffix: string): BookJob {
  return {
    bookId: `PAK-D01-S1-D01-10${suffix}-TEXTBOOK`,
    programmeCode: "PAK-D01",
    programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
    level: "diploma",
    academicPeriod: "S1",
    subjectCode: `D01-10${suffix}`,
    subjectTitle: `Subject ${suffix}`,
    publicationType: "textbook",
    edition: "2026",
    revision: "0.1.0",
    curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
    status,
    repairAttempts: {},
  };
}

function passingReport(bookId: string): QaReport {
  return {
    bookId,
    revision: "0.1.0",
    startedAt: "2026-09-11T14:00:00.000Z",
    completedAt: "2026-09-11T14:01:00.000Z",
    gateResults: { content: "PASS", layout: "PASS", pdf: "PASS" },
    findings: [],
    passed: true,
  };
}

describe("release manifest", () => {
  it("does not release a PDF-built job", () => {
    const candidate = job("PDF_BUILT", "1");
    expect(canRelease(candidate, passingReport(candidate.bookId))).toBe(false);
  });

  it("does not trust a passing flag when an error finding exists", () => {
    const candidate = job("QA_PASSED", "1");
    const report = passingReport(candidate.bookId);
    report.findings.push({
      id: "q1",
      gate: "layout",
      defectClass: "internal-box-overflow",
      severity: "error",
      message: "text outside box",
      detector: "test",
      repairable: true,
    });
    expect(canRelease(candidate, report)).toBe(false);
  });

  it("computes portfolio release arithmetic", () => {
    const jobs = [
      job("RELEASED", "1"),
      job("QA_PASSED", "2"),
      job("QA_FAILED", "3"),
      job("BLOCKED", "4"),
      job("PLANNED", "5"),
    ];
    const reports = new Map<string, QaReport>([
      [jobs[0]!.bookId, passingReport(jobs[0]!.bookId)],
      [jobs[1]!.bookId, passingReport(jobs[1]!.bookId)],
    ]);

    const manifest = buildReleaseManifest(jobs, reports);
    expect(manifest.summary).toEqual({
      planned: 5,
      generated: 3,
      qaPassed: 2,
      qaFailed: 1,
      blocked: 1,
      released: 1,
      unresolved: 4,
    });
    expect(() => assertCompleteRelease(manifest)).toThrow(/release manifest is incomplete/i);
  });

  it("accepts a fully released portfolio", () => {
    const released = [job("RELEASED", "1"), job("RELEASED", "2")];
    const reports = new Map(released.map((item) => [item.bookId, passingReport(item.bookId)]));
    const manifest = buildReleaseManifest(released, reports);
    expect(() => assertCompleteRelease(manifest)).not.toThrow();
  });
});
