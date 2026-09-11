import { expect, test } from "@playwright/test";

const modules = [
  ["Dashboard", "/dashboard"],
  ["Content Studio", "/content-studio"],
  ["Scene Planning", "/scene-planning"],
  ["AI Representative", "/ai-representative"],
  ["Campus / Locations", "/campus-locations"],
  ["Podcast", "/podcast"],
  ["Manual Generation", "/manual-generation"],
  ["Student Testimonials", "/student-testimonials"],
  ["Media Library", "/media-library"],
  ["Knowledge Base", "/knowledge-base"],
  ["Content Calendar", "/content-calendar"],
  ["Approval Center", "/approval-center"],
  ["Publishing", "/publishing"],
  ["Analytics", "/analytics"],
  ["Settings", "/settings"],
] as const;

test("approved navigation routes render their module shells", async ({ page }) => {
  for (const [label, href] of modules) {
    const response = await page.goto(href);
    expect(response?.ok(), `${href} should return a successful response`).toBe(true);
    await expect(page).toHaveURL(new RegExp(`${href.replace("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: label })).toBeVisible();
  }
});

test("marks the current primary navigation destination", async ({ page }) => {
  await page.goto("/scene-planning");

  await expect(page.getByRole("link", { name: "Scene Planning", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Content Studio", exact: true })).not.toHaveAttribute("aria-current", "page");
});

test("uses a compact disclosure menu on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  const toggle = page.getByRole("button", { name: "Open navigation" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("link", { name: "Settings", exact: true })).not.toBeVisible();

  await toggle.click();
  await expect(page.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Scene Planning", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Scene Planning", exact: true }).click();
  await expect(page).toHaveURL(/\/scene-planning$/);
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
});
