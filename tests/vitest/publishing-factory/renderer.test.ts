import { readFileSync, statSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderPublication } from "@/modules/publishing-factory/renderer";

describe("publication renderer", () => {
  it("renders a non-empty A4 PDF and page image inside the artifact root", async () => {
    const artifactRoot = await mkdtemp(join(tmpdir(), "pak-publishing-"));
    const html = readFileSync("publishing/fixtures/manuscript-good.fixture.html", "utf8");

    const result = await renderPublication({
      bookId: "PAK-D01-S1-D01-101-TEXTBOOK",
      html,
      artifactRoot,
    });

    expect(result.pdfPath.startsWith(artifactRoot)).toBe(true);
    expect(result.htmlPath.startsWith(artifactRoot)).toBe(true);
    expect(result.pageImagePaths.length).toBeGreaterThan(0);
    expect(result.pageImagePaths.every((path) => path.startsWith(artifactRoot))).toBe(true);
    expect(statSync(result.pdfPath).size).toBeGreaterThan(1000);
    expect(statSync(result.pageImagePaths[0]!).size).toBeGreaterThan(1000);
  });
});
