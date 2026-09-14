import { expect, test } from "@playwright/test";

test("production navigation prioritizes operational work before roadmap modules", async ({ page }) => {
  await page.goto("/dashboard");

  const primaryNavigation = page.getByRole("navigation", { name: "Primary" });
  const groupLabels = await primaryNavigation.locator("section > p").allTextContents();

  expect(groupLabels).toEqual(["Operational", "Administration", "Roadmap"]);
  await expect(primaryNavigation.getByRole("link", { name: "Scene Planning", exact: true })).toBeVisible();
  await expect(primaryNavigation.getByRole("link", { name: "Approval Center", exact: true })).toBeVisible();
});

test("dashboard remains truthful when the CI fixture has no synthetic organization data", async ({ page }) => {
  await page.goto("/dashboard");

  const main = page.locator("main");
  await expect(main.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    main.getByText("No organization workspace is available for this account.", { exact: true }),
  ).toBeVisible();
  await expect(main.getByRole("region", { name: "Implemented workflow health" })).toHaveCount(0);
});

test("implemented operational surfaces preserve truthful recovery states without synthetic organization data", async ({
  page,
}) => {
  await page.goto("/content-studio");
  await expect(page.getByRole("heading", { name: "Content Studio" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Knowledge Base", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Settings", exact: true })).toBeVisible();
  await expect(page.getByLabel("Topic")).toHaveCount(0);

  await page.goto("/knowledge-base");
  await expect(page.getByRole("heading", { name: "Knowledge Base" })).toBeVisible();
  await expect(page.getByText("No Knowledge Base organization is available for this account.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create draft" })).toHaveCount(0);
});

test("roadmap surfaces remain truthful readiness pages without fake domain controls", async ({ page }) => {
  await page.goto("/analytics");

  let main = page.locator("main");
  await expect(main.getByLabel("Readiness: Planned")).toBeVisible();
  await expect(main.getByRole("heading", { name: "Current availability" })).toBeVisible();
  await expect(main.getByRole("button")).toHaveCount(0);

  await page.goto("/manual-generation");
  main = page.locator("main");
  await expect(main.getByLabel("Readiness: Foundation only")).toBeVisible();
  await expect(main.getByRole("heading", { name: "Current availability" })).toBeVisible();
  await expect(main.getByRole("button")).toHaveCount(0);
});
