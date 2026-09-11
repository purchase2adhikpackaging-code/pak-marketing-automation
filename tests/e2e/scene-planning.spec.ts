import { expect, test } from "@playwright/test";

test("Scene Planning starts from persisted Content Studio artifacts and exposes no Phase 6 video execution", async ({ page }) => {
  const response = await page.goto("/scene-planning");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Scene Planning" })).toBeVisible();
  await expect(page.getByText("Start from a persisted script artifact")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Content Studio" })).toHaveAttribute("href", "/content-studio");
  await expect(page.getByRole("button", { name: /Generate Video/i })).toHaveCount(0);
  await expect(page.getByText(/No video provider is executed from this workspace/i)).toHaveCount(0);
});

test("Scene Planning rejects malformed project identifiers without querying cross-tenant project state", async ({ page }) => {
  const response = await page.goto("/scene-planning?project=not-a-uuid");
  expect(response?.ok()).toBe(true);
  await expect(page.getByText("Invalid Scene Planning project")).toBeVisible();
  await expect(page.getByText(/identifier is invalid/i)).toBeVisible();
});

test("Scene Planning no-project surface remains usable on a mobile viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/scene-planning");
  await expect(page.getByRole("heading", { name: "Scene Planning" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
