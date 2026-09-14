import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(
  join(process.cwd(), "src/app/api/internal/publishing-browser-health/route.ts"),
  "utf8",
);
const rendererSource = readFileSync(
  join(process.cwd(), "src/modules/publishing-factory/renderer.ts"),
  "utf8",
);

describe("publishing browser health route", () => {
  it("requires the existing opaque worker authorization before launching Chromium", () => {
    expect(routeSource).toContain("createPublishingWorkerBrokerClient({ credential }).authorize()");
    expect(routeSource).toContain('return json(401, { error: "UNAUTHORIZED" })');
    expect(routeSource).toContain("verifyPublicationBrowserRuntime()");
  });

  it("does not claim, mutate, or schedule publishing work", () => {
    expect(routeSource).not.toContain("claimJobs");
    expect(routeSource).not.toContain("runConfiguredPublishingWorker");
    expect(routeSource).not.toContain("runConfiguredAutomaticPublishingWorker");
    expect(routeSource).not.toContain("scheduleNext");
  });

  it("reuses the renderer browser launcher and closes the browser immediately", () => {
    expect(rendererSource).toMatch(/verifyPublicationBrowserRuntime[\s\S]*launchBrowser\(\)[\s\S]*browser\.close\(\)/);
  });
});
