import { expect, test } from "@playwright/test";

test("Content Studio exposes a truthful recovery state when CI has no synthetic organization data", async ({ page }) => {
  await page.goto("/content-studio");

  await expect(page.getByRole("heading", { name: "Content Studio" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Knowledge Base", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Settings", exact: true })).toBeVisible();
  await expect(page.getByLabel("Topic")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Multilingual scripts" })).toHaveCount(0);
});
