import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const orchestratorSource = readFileSync(
  join(process.cwd(), "src/modules/publishing-factory/orchestrator.ts"),
  "utf8",
);
const rendererSource = readFileSync(
  join(process.cwd(), "src/modules/publishing-factory/renderer.ts"),
  "utf8",
);

describe("publishing layout QA browser runtime", () => {
  it("uses the same serverless-aware Chromium launcher as publication rendering", () => {
    expect(orchestratorSource).not.toContain('from "@playwright/test"');
    expect(orchestratorSource).toContain("launchPublicationBrowser");
    expect(rendererSource).toContain("export async function launchPublicationBrowser");
  });
});
