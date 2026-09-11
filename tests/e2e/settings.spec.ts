import { expect, test } from "@playwright/test";

test("Settings renders an actionable safe state when CI has no synthetic organization membership", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("No organization membership is available for Integration Settings.")).toBeVisible();
  await expect(page.getByText("Ask an organization Owner or Admin to add this account before configuring providers.")).toBeVisible();
  await expect(page.getByLabel("OpenAI API key")).toHaveCount(0);
});

test("Settings has no horizontal workflow dependency at 390x844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});
