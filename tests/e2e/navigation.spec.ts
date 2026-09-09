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

test("approved navigation routes render their module shells", async ({ page }) => {
  for (const [label, href] of modules) {
    await page.goto(href);
    await expect(page.getByRole("heading", { name: label })).toBeVisible();
  }
});
