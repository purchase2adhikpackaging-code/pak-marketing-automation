import { expect, test } from "@playwright/test";

test("Content Studio exposes a truthful recovery state when CI has no synthetic organization data", async ({ page }) => {
  await page.goto("/content-studio");

  await expect(page.getByRole("heading", { name: "Content Studio" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Knowledge Base", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Settings", exact: true })).toBeVisible();
  await expect(page.getByLabel("Topic")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Multilingual scripts" })).toHaveCount(0);
});

test("Content Studio has no horizontal workflow dependency at 390x844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/content-studio");

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});
