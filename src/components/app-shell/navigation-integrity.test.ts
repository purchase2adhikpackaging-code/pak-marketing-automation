import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_NAVIGATION } from "./navigation";

const routeToPage = (href: string) =>
  join(process.cwd(), "src", "app", "(app)", href.slice(1), "page.tsx");

describe("application navigation integrity", () => {
  it("contains no placeholder, external, or query-only primary destinations", () => {
    for (const item of APP_NAVIGATION) {
      expect(item.href).toMatch(/^\/[a-z0-9-]+$/);
      expect(item.href).not.toBe("#");
    }
  });

  it("maps every primary navigation item to an existing App Router page", () => {
    for (const item of APP_NAVIGATION) {
      expect(existsSync(routeToPage(item.href)), `${item.href} is missing page.tsx`).toBe(true);
    }
  });
});
