import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizeParagraph,
  paragraphSimilarity,
  runContentQa,
} from "@/modules/publishing-factory/content-qa";

const identity = {
  programmeCode: "PAK-D01",
  subjectCode: "D01-101",
  subjectTitle: "Railway Fundamentals",
} as const;

describe("deterministic manuscript content QA", () => {
  it("normalizes whitespace and punctuation consistently", () => {
    expect(normalizeParagraph("  Railway   systems — are integrated. ")).toBe(
      "railway systems are integrated",
    );
  });

  it("scores identical normalized paragraphs as 1", () => {
    expect(paragraphSimilarity("Same paragraph here", "Same paragraph here")).toBe(1);
  });

  it("detects duplicate substantive paragraphs", () => {
    const manuscript = readFileSync(
      "publishing/fixtures/manuscript-duplicate.fixture.md",
      "utf8",
    );
    const findings = runContentQa({ manuscript, expectedIdentity: identity });
    expect(findings.some((f) => f.defectClass === "duplicate-paragraph")).toBe(true);
  });

  it("detects unresolved production placeholders", () => {
    const manuscript = readFileSync(
      "publishing/fixtures/manuscript-placeholder.fixture.md",
      "utf8",
    );
    const findings = runContentQa({ manuscript, expectedIdentity: identity });
    const classes = findings.map((finding) => finding.defectClass);
    expect(classes).toContain("production-placeholder");
  });

  it("detects programme identity mismatch", () => {
    const manuscript = "# PAK-D02 — D01-101 Railway Fundamentals\n\nSubstantive teaching content.";
    const findings = runContentQa({ manuscript, expectedIdentity: identity });
    expect(findings.some((f) => f.defectClass === "identity-mismatch")).toBe(true);
  });

  it("detects instructor-only content in a student publication", () => {
    const manuscript = [
      "# PAK-D01 — D01-101 Railway Fundamentals",
      "",
      "## Instructor Answer Key",
      "",
      "The correct answer is reserved for staff.",
    ].join("\n");
    const findings = runContentQa({ manuscript, expectedIdentity: identity });
    expect(findings.some((f) => f.defectClass === "instructor-content-leakage")).toBe(true);
  });

  it("does not flag an ordinary clean manuscript", () => {
    const manuscript = [
      "# PAK-D01 — D01-101 Railway Fundamentals",
      "",
      "Railway systems combine infrastructure, rolling stock, signalling, energy, operations and maintenance through controlled technical interfaces.",
      "",
      "A technician must distinguish observation, measurement, interpretation and authority before making a maintenance decision.",
    ].join("\n");
    const findings = runContentQa({ manuscript, expectedIdentity: identity });
    expect(findings.filter((f) => f.severity === "error")).toHaveLength(0);
  });
});
