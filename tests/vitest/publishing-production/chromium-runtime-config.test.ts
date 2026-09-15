import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const nextConfigSource = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

describe("publishing serverless runtime packaging", () => {
  it("keeps Chromium and PDF.js external to the Next.js server bundle", () => {
    expect(nextConfigSource).toContain("serverExternalPackages");
    expect(nextConfigSource).toContain('"@sparticuz/chromium"');
    expect(nextConfigSource).toContain('"pdfjs-dist"');
  });

  it("traces Chromium assets into publishing routes that launch Chromium", () => {
    expect(nextConfigSource).toContain('"/api/internal/publishing-worker"');
    expect(nextConfigSource).toContain('"/api/internal/publishing-browser-health"');
    expect(nextConfigSource).toContain('"/api/internal/publishing-d01-qa-preflight"');
    expect(nextConfigSource).toContain('"./node_modules/@sparticuz/chromium/**/*"');
  });

  it("traces the PDF.js legacy worker into the production worker and D01 QA preflight routes", () => {
    expect(nextConfigSource).toContain('"./node_modules/pdfjs-dist/legacy/build/**/*"');
    expect(nextConfigSource).toMatch(/"\/api\/internal\/publishing-worker"[\s\S]*\.\.\.pdfJsAssets/);
    expect(nextConfigSource).toMatch(/"\/api\/internal\/publishing-d01-qa-preflight"[\s\S]*\.\.\.pdfJsAssets/);
  });
});
