import { expect, test } from "@playwright/test";

const fixtureHeaders = (fixture: "owner" | "reviewer") => ({
  "x-pak-e2e-auth-bypass": "allow",
  "x-pak-e2e-fixture": fixture,
});

test("OWNER can edit authoritative Organization Profile and Brand Kit fixtures", async ({ page }) => {
  await page.setExtraHTTPHeaders(fixtureHeaders("owner"));

  await page.goto("/settings/organization-profile");
  await expect(page.getByRole("heading", { name: "Organization Profile" })).toBeVisible();
  await expect(page.getByLabel("Official name")).toHaveValue("Polish Railway Academy");
  await expect(page.getByLabel("Official name")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Save Organization Profile" })).toBeVisible();

  await page.goto("/settings/brand-kit");
  await expect(page.getByRole("heading", { name: "Brand Kit" })).toBeVisible();
  await expect(page.getByLabel("Primary color")).toHaveValue("#102A43");
  await expect(page.getByLabel("Primary color")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Save Brand Kit" })).toBeVisible();
});

test("REVIEWER can inspect authoritative identity but cannot mutate it", async ({ page }) => {
  await page.setExtraHTTPHeaders(fixtureHeaders("reviewer"));

  await page.goto("/settings/organization-profile");
  await expect(page.getByLabel("Official name")).toHaveValue("Polish Railway Academy");
  await expect(page.getByLabel("Official name")).toBeDisabled();
  await expect(page.getByText("Owner or Admin access is required to edit Organization Profile.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Organization Profile" })).toHaveCount(0);

  await page.goto("/settings/brand-kit");
  await expect(page.getByLabel("Primary color")).toHaveValue("#102A43");
  await expect(page.getByLabel("Primary color")).toBeDisabled();
  await expect(page.getByText("Owner or Admin access is required to edit Brand Kit.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Brand Kit" })).toHaveCount(0);
});

test("OWNER document upload creates a reviewable DRAFT Knowledge record without auto-activation", async ({ page }) => {
  await page.setExtraHTTPHeaders(fixtureHeaders("owner"));
  await page.route("https://e2e-upload.invalid/**", async (route) => {
    await route.fulfill({ status: 200, body: "" });
  });

  await page.goto("/knowledge-base");
  await expect(page.getByRole("heading", { name: "Knowledge Base" })).toBeVisible();
  await page.getByRole("button", { name: "Upload media" }).click();
  await page.getByLabel("File").setInputFiles({
    name: "PAK-Safety.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 deterministic E2E fixture"),
  });
  await page.getByRole("button", { name: "Start upload" }).click();

  await expect(page.getByText("Draft created for review. Activate it only after verifying the extracted content.")).toBeVisible();
  const record = page.getByRole("article").filter({ hasText: "PAK Safety Manual" });
  await expect(record).toContainText("DRAFT");
  await expect(record).not.toContainText("ACTIVE");
  await expect(record.getByRole("button", { name: /Activate PAK Safety Manual/ })).toBeVisible();
});
