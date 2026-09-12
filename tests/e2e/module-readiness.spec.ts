import { expect, test } from "@playwright/test";

const routes = [
  ["/manual-generation", "Manual Generation", "Foundation only"],
  ["/ai-representative", "AI Representative", "Planned"],
  ["/campus-locations", "Campus / Locations", "Planned"],
  ["/podcast", "Podcast", "Planned"],
  ["/student-testimonials", "Student Testimonials", "Planned"],
  ["/content-calendar", "Content Calendar", "Planned"],
  ["/approval-center", "Approval Center", "Planned"],
  ["/publishing", "Publishing", "Planned"],
  ["/analytics", "Analytics", "Planned"],
] as const;

test("B3 routes expose truthful readiness without fake domain controls", async ({ page }) => {
  for (const [route, title, status] of routes) {
    await page.goto(route);

    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: title })).toBeVisible();
    await expect(main.getByLabel(`Readiness: ${status}`)).toBeVisible();
    await expect(main.getByRole("heading", { name: "Current availability" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Available now" })).toBeVisible();
    await expect(main.getByRole("button")).toHaveCount(0);
  }
});

test("B3 routes have no horizontal workflow dependency at 390x844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [route] of routes) {
    await page.goto(route);

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));

    expect(widths.content, `${route} overflows horizontally`).toBeLessThanOrEqual(widths.viewport);
  }
});
