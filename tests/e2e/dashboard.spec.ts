import { expect, test } from "@playwright/test";

test("Dashboard renders a truthful safe state when CI has no synthetic organization data", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("No organization workspace is available for this account.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Implemented workflow health" })).toHaveCount(0);
});

test("Dashboard has no horizontal workflow dependency at 390x844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});
