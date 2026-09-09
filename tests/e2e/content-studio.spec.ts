import { expect, test } from "@playwright/test";

test("Content Studio renders generation controls without requiring a live AI provider", async ({ page }) => {
  await page.goto("/content-studio");

  await expect(page.getByRole("heading", { name: "Content Studio" })).toBeVisible();
  await expect(page.getByLabel("Topic")).toBeVisible();
  await expect(page.getByLabel("Knowledge context")).toBeVisible();
  await expect(page.getByLabel("Language")).toBeVisible();
  await expect(page.getByRole("button", { name: /generate script/i })).toBeVisible();
});
