import { expect, test } from "@playwright/test";

test("Knowledge Base renders its authorized management or read surface without live providers", async ({ page }) => {
  await page.goto("/knowledge-base");

  await expect(page.getByRole("heading", { name: "Knowledge Base" })).toBeVisible();
  await expect(
    page.getByText("Maintain approved PAK source material with provenance and revision control.", {
      exact: false,
    }),
  ).toBeVisible();

  // CI is intentionally not provisioned with a live authenticated Supabase user.
  // The route must still render its safe empty authorization state without external providers.
  await expect(page.getByText("No Knowledge Base organization is available for this account.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create draft" })).toHaveCount(0);
});

test("Knowledge Base has no horizontal workflow dependency at 390x844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/knowledge-base");

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});
