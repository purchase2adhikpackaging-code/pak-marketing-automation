import { expect, test } from "@playwright/test";

test("Media Library is an operational route rather than a readiness placeholder", async ({ page }) => {
  const response = await page.goto("/media-library");
  expect(response?.ok()).toBe(true);

  await expect(page.getByRole("heading", { name: "Media Library" })).toBeVisible();
  await expect(page.getByText(/Browse PAK-owned generated and uploaded media/i)).toBeVisible();
  await expect(page.getByText(/No organization membership is available for Media Library access/i)).toBeVisible();
  await expect(page.getByText(/foundation implementation is complete/i)).toHaveCount(0);

  const previewSources = await page.locator("video[src], audio[src], img[src]").count();
  expect(previewSources).toBe(0);
});

test("Scene Planning does not expose a final-render action without an authoritative project", async ({ page }) => {
  const response = await page.goto("/scene-planning");
  expect(response?.ok()).toBe(true);

  await expect(page.getByRole("heading", { name: "Scene Planning" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate final video" })).toHaveCount(0);
  await expect(page.getByText(/Final visual master completed/i)).toHaveCount(0);
});

test("Phase 8 Media Library remains usable on a mobile viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/media-library");

  await expect(page.getByRole("heading", { name: "Media Library" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
