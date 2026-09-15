import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BookJob } from "@/modules/publishing-factory/domain";
import { runDeterministicBook } from "@/modules/publishing-factory/orchestrator";

function baseJob(): BookJob {
  return {
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
    status: "TYPESET_READY",
    repairAttempts: {},
  };
}

describe("deterministic book orchestrator", () => {
  it("moves a clean publication to QA_PASSED without releasing it", async () => {
    const artifactRoot = await mkdtemp(join(tmpdir(), "pak-orchestrator-good-"));
    const html = readFileSync("publishing/fixtures/manuscript-good.fixture.html", "utf8");

    const result = await runDeterministicBook({
      job: baseJob(),
      html,
      artifactRoot,
      expectedTitle: "PAK-D01 — D01-101 Railway Fundamentals",
      requireBookmarks: false,
    });

    expect(result.job.status).toBe("QA_PASSED");
    expect(result.job.status).not.toBe("RELEASED");
    expect(result.report.passed).toBe(true);
    expect(result.report.findings.filter((finding) => finding.severity === "error")).toHaveLength(0);
    expect(result.render?.pdfPath).toBeTruthy();
  });

  it("fails QA when text escapes an internal rectangle", async () => {
    const artifactRoot = await mkdtemp(join(tmpdir(), "pak-orchestrator-bad-"));
    const html = readFileSync("publishing/fixtures/manuscript-overflow.fixture.html", "utf8");

    const result = await runDeterministicBook({
      job: baseJob(),
      html,
      artifactRoot,
      expectedTitle: "PAK-D01 — D01-101 Railway Fundamentals",
      requireBookmarks: false,
    });

    expect(result.job.status).toBe("QA_FAILED");
    expect(result.job.status).not.toBe("RELEASED");
    expect(result.report.passed).toBe(false);
    expect(result.report.findings.some((finding) => finding.defectClass === "internal-box-overflow")).toBe(true);
  });
});
