import { describe, expect, it } from "vitest";
import type { BookJob, QaFinding } from "@/modules/publishing-factory/domain";
import {
  defectSignature,
  recordRepairAttempt,
  routeRepair,
  shouldBlockAfterAttempt,
} from "@/modules/publishing-factory/repair";

const job: BookJob = {
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
  status: "QA_FAILED",
  repairAttempts: {},
};

function finding(defectClass: string, gate: QaFinding["gate"] = "content"): QaFinding {
  return {
    id: `f-${defectClass}`,
    gate,
    defectClass,
    severity: "error",
    message: `${defectClass} detected in controlled publication`,
    detector: "test",
    repairable: true,
    page: 12,
    componentId: "component-1",
  };
}

describe("publishing repair policy", () => {
  it.each([
    ["duplicate-paragraph", "content", "manuscript"],
    ["internal-box-overflow", "layout", "typesetting"],
    ["low-effective-dpi", "visual-assets", "visual"],
    ["metadata-mismatch", "pdf", "export"],
    ["unsupported-safety-critical-value", "safety", "references"],
  ] as const)("routes %s to %s", (defectClass, gate, expectedStage) => {
    expect(routeRepair(finding(defectClass, gate))).toBe(expectedStage);
  });

  it("uses a stable defect signature", () => {
    const first = finding("internal-box-overflow", "layout");
    const second = { ...first, id: "different-runtime-id" };
    expect(defectSignature(first)).toBe(defectSignature(second));
  });

  it("blocks after the third repair attempt and refuses a fourth", () => {
    const issue = finding("internal-box-overflow", "layout");
    const after1 = recordRepairAttempt(job, issue);
    expect(shouldBlockAfterAttempt(after1, issue)).toBe(false);
    const after2 = recordRepairAttempt(after1, issue);
    expect(shouldBlockAfterAttempt(after2, issue)).toBe(false);
    const after3 = recordRepairAttempt(after2, issue);
    expect(shouldBlockAfterAttempt(after3, issue)).toBe(true);
    expect(() => recordRepairAttempt(after3, issue)).toThrow(/maximum automatic repair attempts/i);
  });
});
