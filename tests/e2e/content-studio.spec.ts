import { expect, test } from "@playwright/test";

test("Content Studio renders canonical generation controls without requiring a live AI provider", async ({ page }) => {
  await page.goto("/content-studio");

  await expect(page.getByRole("heading", { name: "Content Studio" })).toBeVisible();
  await expect(page.getByLabel("Topic")).toBeVisible();
  await expect(page.getByText("Approved Knowledge Base sources")).toBeVisible();
  await expect(page.getByLabel("Additional context")).toBeVisible();
  await expect(page.getByLabel("Canonical source language")).toBeVisible();
  await expect(page.getByRole("button", { name: /generate source script/i })).toBeVisible();

  await expect(page.getByRole("region", { name: "Multilingual scripts" })).toHaveCount(0);
});
