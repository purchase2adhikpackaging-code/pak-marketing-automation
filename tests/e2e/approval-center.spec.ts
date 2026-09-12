import { expect, test } from "@playwright/test";

test("Approval Center is operational with review workflow controls and domain approval affordance", async ({ page }) => {
  await page.goto("/approval-center");

  const main = page.locator("main");
  await expect(main.getByRole("heading", { name: "Approval Center" })).toBeVisible();
  await expect(main.getByLabel("Readiness: Planned")).toHaveCount(0);

  const workflow = main.getByLabel("Approval workflow status");
  await expect(workflow).toBeVisible();
  await expect(workflow.getByRole("button", { name: "Awaiting review" })).toBeVisible();
  await expect(workflow.getByRole("button", { name: "Changes requested" })).toBeVisible();
  await expect(workflow.getByRole("button", { name: "Approved" })).toBeVisible();
  await expect(workflow.getByRole("button", { name: "Rejected" })).toBeVisible();
  await expect(workflow.getByRole("button", { name: "Superseded" })).toBeVisible();

  await expect(main.getByText("Domain approval", { exact: true })).toBeVisible();
  await expect(main.getByRole("link", { name: "Open Scene Planning" })).toHaveAttribute("href", "/scene-planning");
});

test("Approval Center remains reachable in fixed primary navigation and has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/approval-center");

  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  await expect(openNavigation).toBeVisible();
  await openNavigation.click();
  const navigation = page.getByRole("navigation", { name: "Primary" });
  await expect(navigation.getByRole("link", { name: "Approval Center", exact: true })).toHaveAttribute("href", "/approval-center");
  await page.getByRole("button", { name: "Close navigation" }).click();

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});