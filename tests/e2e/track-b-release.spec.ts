import { expect, test } from "@playwright/test";

const modules = [
  ["Dashboard", "/dashboard"],
  ["Content Studio", "/content-studio"],
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

test("Track B desktop navigation traverses all fourteen primary routes", async ({ page }) => {
  await page.goto("/dashboard");

  for (const [label, href] of modules) {
    const primaryNavigation = page.getByRole("navigation", { name: "Primary" });
    await primaryNavigation.getByRole("link", { name: label, exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`${href.replace("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: label })).toBeVisible();

    const currentLinks = primaryNavigation.locator('a[aria-current="page"]');
    await expect(currentLinks).toHaveCount(1);
    await expect(currentLinks.first()).toHaveAttribute("href", href);
  }
});

test("Track B traversal preserves truthful future and foundation-only boundaries", async ({ page }) => {
  await page.goto("/dashboard");
  const primaryNavigation = page.getByRole("navigation", { name: "Primary" });

  await primaryNavigation.getByRole("link", { name: "Media Library", exact: true }).click();
  await expect(page.getByLabel("Readiness: Foundation only")).toBeVisible();

  await primaryNavigation.getByRole("link", { name: "Manual Generation", exact: true }).click();
  await expect(page.getByLabel("Readiness: Foundation only")).toBeVisible();

  await primaryNavigation.getByRole("link", { name: "Analytics", exact: true }).click();
  const main = page.locator("main");
  await expect(main.getByLabel("Readiness: Planned")).toBeVisible();
  await expect(main.getByRole("heading", { name: "Current availability" })).toBeVisible();
  await expect(main.getByRole("button")).toHaveCount(0);
});
