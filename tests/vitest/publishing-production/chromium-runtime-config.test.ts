import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const nextConfigSource = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

describe("publishing Chromium runtime packaging", () => {
  it("keeps @sparticuz/chromium external to the Next.js server bundle", () => {
    expect(nextConfigSource).toContain("serverExternalPackages");
    expect(nextConfigSource).toContain('"@sparticuz/chromium"');
  });

  it("traces Chromium assets into both publishing serverless routes", () => {
    expect(nextConfigSource).toContain('"/api/internal/publishing-worker"');
    expect(nextConfigSource).toContain('"/api/internal/publishing-browser-health"');
    expect(nextConfigSource).toContain('"./node_modules/@sparticuz/chromium/**/*"');
  });
});
