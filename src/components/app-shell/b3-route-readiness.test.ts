import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTES = [
  "/media-library",
  "/manual-generation",
  "/ai-representative",
  "/campus-locations",
  "/podcast",
  "/student-testimonials",
  "/content-calendar",
  "/approval-center",
  "/analytics",
] as const;

function pageSource(route: (typeof ROUTES)[number]): string {
  return readFileSync(join(process.cwd(), "src", "app", "(app)", route.slice(1), "page.tsx"), "utf8");
}

describe("B3 route readiness wiring", () => {
  it("routes every still-unimplemented B3 page through its exact truthful readiness configuration", () => {
    for (const route of ROUTES) {
      const source = pageSource(route);
      expect(source, `${route} must render ModuleReadinessPage`).toContain("ModuleReadinessPage");
      expect(source, `${route} must use its exact B3 readiness registry entry`).toContain(
        `B3_MODULE_READINESS[\"${route}\"]`,
      );
    }
  });

  it("contains no domain mutation controls or placeholder destinations on still-unimplemented B3 route entry pages", () => {
    for (const route of ROUTES) {
      const source = pageSource(route);
      expect(source, `${route} contains a button`).not.toContain("<button");
      expect(source, `${route} contains a form action`).not.toMatch(/<form[^>]*\saction=/i);
      expect(source, `${route} contains an action prop`).not.toMatch(/\saction=/i);
      expect(source, `${route} contains a placeholder href`).not.toContain('href="#"');
    }
  });
});
