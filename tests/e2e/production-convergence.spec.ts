import { expect, test } from "@playwright/test";

test("production navigation prioritizes operational work before roadmap modules", async ({ page }) => {
  await page.goto("/dashboard");

  const primaryNavigation = page.getByRole("navigation", { name: "Primary" });
  const groupLabels = await primaryNavigation.locator("section > p").allTextContents();

  expect(groupLabels).toEqual(["Operational", "Administration", "Roadmap"]);
  await expect(primaryNavigation.getByRole("link", { name: "Scene Planning", exact: true })).toBeVisible();
  await expect(primaryNavigation.getByRole("link", { name: "Approval Center", exact: true })).toBeVisible();
});

test("dashboard exposes the current production command center and provider readiness", async ({ page }) => {
  await page.goto("/dashboard");

  const main = page.locator("main");
  await expect(main.getByRole("heading", { name: "Continue production" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Integrations" })).toBeVisible();
  await expect(main.getByText("OpenAI", { exact: true })).toBeVisible();
  await expect(main.getByText("LTX", { exact: true })).toBeVisible();
});

test("implemented operational surfaces expose authoritative context and knowledge ingestion", async ({ page }) => {
  await page.goto("/content-studio");
  await expect(page.getByRole("heading", { name: "Authoritative context" })).toBeVisible();

  await page.goto("/knowledge-base");
  await expect(page.getByRole("heading", { name: "Add manually" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ingest document or URL" })).toBeVisible();
});

test("roadmap surfaces remain truthful readiness pages", async ({ page }) => {
  await page.goto("/analytics");

  const main = page.locator("main");
  await expect(main.getByLabel("Readiness: Planned")).toBeVisible();
  await expect(main.getByRole("heading", { name: "Current availability" })).toBeVisible();
  await expect(main.getByRole("button")).toHaveCount(0);
});
