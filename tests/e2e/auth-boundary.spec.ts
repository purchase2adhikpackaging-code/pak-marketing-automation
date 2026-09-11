import { expect, test } from "@playwright/test";

test("protected routes redirect unauthenticated users to sign in", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in to PAK" })).toBeVisible();
});
