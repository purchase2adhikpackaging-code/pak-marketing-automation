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

test("Track B mobile navigation traverses all fourteen primary routes without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  for (const [label, href] of modules) {
    const openNavigation = page.getByRole("button", { name: "Open navigation" });
    await expect(openNavigation).toBeVisible();
    await expect(openNavigation).toHaveAttribute("aria-expanded", "false");
    await openNavigation.click();

    const closeNavigation = page.getByRole("button", { name: "Close navigation" });
    await expect(closeNavigation).toHaveAttribute("aria-expanded", "true");

    let primaryNavigation = page.getByRole("navigation", { name: "Primary" });
    await primaryNavigation.getByRole("link", { name: label, exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`${href.replace("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: label })).toBeVisible();

    const collapsedNavigation = page.getByRole("button", { name: "Open navigation" });
    await expect(collapsedNavigation).toHaveAttribute("aria-expanded", "false");

    await collapsedNavigation.click();
    primaryNavigation = page.getByRole("navigation", { name: "Primary" });
    const currentLinks = primaryNavigation.locator('a[aria-current="page"]');
    await expect(currentLinks).toHaveCount(1);
    await expect(currentLinks.first()).toHaveAttribute("href", href);

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content, `${href} overflows horizontally`).toBeLessThanOrEqual(widths.viewport);

    await page.getByRole("button", { name: "Close navigation" }).click();
    await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  }
});
