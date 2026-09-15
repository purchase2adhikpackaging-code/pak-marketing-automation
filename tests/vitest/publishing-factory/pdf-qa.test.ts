import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderPublication } from "@/modules/publishing-factory/renderer";
import { runPdfQa } from "@/modules/publishing-factory/pdf-qa";

describe("PDF QA", () => {
  it("accepts a searchable A4 publication with matching identity", async () => {
    const artifactRoot = await mkdtemp(join(tmpdir(), "pak-pdf-qa-"));
    const html = readFileSync("publishing/fixtures/manuscript-good.fixture.html", "utf8");
    const rendered = await renderPublication({
      bookId: "PAK-D01-S1-D01-101-TEXTBOOK",
      html,
      artifactRoot,
    });

    const findings = await runPdfQa({
      pdfPath: rendered.pdfPath,
      expectedTitle: "PAK-D01 — D01-101 Railway Fundamentals",
      expectedIdentityText: ["PAK-D01", "D01-101", "Railway Fundamentals"],
      requireBookmarks: false,
    });

    expect(findings.filter((finding) => finding.severity === "error")).toHaveLength(0);
  });

  it("reports identity text that is not present", async () => {
    const artifactRoot = await mkdtemp(join(tmpdir(), "pak-pdf-qa-"));
    const html = readFileSync("publishing/fixtures/manuscript-good.fixture.html", "utf8");
    const rendered = await renderPublication({
      bookId: "PAK-D01-S1-D01-101-TEXTBOOK",
      html,
      artifactRoot,
    });

    const findings = await runPdfQa({
      pdfPath: rendered.pdfPath,
      expectedTitle: "PAK-D01 — D01-101 Railway Fundamentals",
      expectedIdentityText: ["PAK-D99"],
      requireBookmarks: false,
    });

    expect(findings.some((finding) => finding.defectClass === "identity-text-missing")).toBe(true);
  });
});
