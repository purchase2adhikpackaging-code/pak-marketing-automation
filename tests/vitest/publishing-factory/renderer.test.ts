import { readFileSync, statSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderPublication } from "@/modules/publishing-factory/renderer";

const rendererSource = readFileSync(
  "src/modules/publishing-factory/renderer.ts",
  "utf8",
);
const browserHealthProbeSource = rendererSource.slice(
  rendererSource.indexOf("export async function verifyPublicationBrowserRuntime"),
  rendererSource.indexOf("export async function renderPublication"),
);

describe("publication renderer", () => {
  it("detects common Vercel/serverless runtime markers and production fallback before choosing Chromium", () => {
    expect(rendererSource).toContain("isServerlessRuntime");
    expect(rendererSource).toContain("process.env.VERCEL");
    expect(rendererSource).toContain("process.env.VERCEL_REGION");
    expect(rendererSource).toContain("process.env.AWS_LAMBDA_FUNCTION_NAME");
    expect(rendererSource).toContain('process.env.NODE_ENV === "production"');
    expect(rendererSource).toContain("serverlessChromium.executablePath()");
  });

  it("requires the browser health probe to exercise HTML-to-PDF rendering, not launch-only health", () => {
    expect(browserHealthProbeSource).toContain("browser.newPage");
    expect(browserHealthProbeSource).toContain("page.setContent");
    expect(browserHealthProbeSource).toContain("page.pdf");
    expect(browserHealthProbeSource).toContain("%PDF-");
  });

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
