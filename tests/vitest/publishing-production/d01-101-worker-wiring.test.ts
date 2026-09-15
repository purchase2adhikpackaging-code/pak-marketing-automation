import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(resolve("src/app/api/internal/publishing-worker/route.ts"), "utf8");

describe("D01-101 publishing worker wiring", () => {
  it("processes the existing bounded queue without automatic portfolio bootstrap", () => {
    expect(routeSource).toContain("runConfiguredPublishingWorker");
    expect(routeSource).not.toContain("runConfiguredAutomaticPublishingWorker");
    expect(routeSource).not.toContain("auto-worker-runtime");
  });
});
