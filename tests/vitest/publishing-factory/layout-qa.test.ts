import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "@playwright/test";
import { runDomLayoutQa } from "@/modules/publishing-factory/layout-qa";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

async function qaFixture(path: string) {
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.setContent(readFileSync(path, "utf8"), { waitUntil: "load" });
  const findings = await runDomLayoutQa(page);
  await page.close();
  return findings;
}

describe("DOM layout QA", () => {
  it("passes the clean fixture", async () => {
    const findings = await qaFixture("publishing/fixtures/manuscript-good.fixture.html");
    expect(findings.filter((finding) => finding.severity === "error")).toHaveLength(0);
  });

  it("detects text that escapes an internal rectangle", async () => {
    const findings = await qaFixture("publishing/fixtures/manuscript-overflow.fixture.html");
    expect(findings.some((finding) => finding.defectClass === "internal-box-overflow")).toBe(true);
  });
});
