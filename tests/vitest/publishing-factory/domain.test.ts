import { describe, expect, it } from "vitest";
import {
  BookJobSchema,
  QaFindingSchema,
  QaReportSchema,
  ReleaseRecordSchema,
} from "@/modules/publishing-factory/domain";

describe("publishing domain", () => {
  it("accepts a valid book job", () => {
    const parsed = BookJobSchema.parse({
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
    });

    expect(parsed.bookId).toBe("PAK-D01-S1-D01-101-TEXTBOOK");
    expect(parsed.repairAttempts).toEqual({});
  });

  it("rejects a QA finding without a defect class", () => {
    expect(() =>
      QaFindingSchema.parse({
        id: "q1",
        gate: "layout",
        severity: "error",
        message: "overflow",
        detector: "layout-qa",
        repairable: true,
      }),
    ).toThrow();
  });

  it("accepts a coherent QA report", () => {
    const report = QaReportSchema.parse({
      bookId: "PAK-D01-S1-D01-101-TEXTBOOK",
      revision: "0.1.0",
      startedAt: "2026-09-11T14:00:00.000Z",
      completedAt: "2026-09-11T14:01:00.000Z",
      gateResults: {
        schema: "PASS",
        content: "PASS",
      },
      findings: [],
      passed: true,
    });

    expect(report.passed).toBe(true);
  });

  it("accepts a release record only with release metadata", () => {
    const release = ReleaseRecordSchema.parse({
      bookId: "PAK-D01-S1-D01-101-TEXTBOOK",
      sourceRevision: "abc123",
      buildRevision: "def456",
      pdfChecksum: "a".repeat(64),
      pageCount: 104,
      qaStatus: "QA_PASSED",
      qaReportPath: "artifacts/publishing/reports/d01-101.json",
      releasePath: "artifacts/publishing/textbooks/diploma/d01-101.pdf",
    });

    expect(release.pageCount).toBe(104);
  });
});
