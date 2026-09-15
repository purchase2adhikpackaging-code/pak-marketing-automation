import { describe, expect, it } from "vitest";
import { APP_NAVIGATION, APP_NAVIGATION_GROUPS, isNavigationItemActive } from "./navigation";

describe("APP_NAVIGATION_GROUPS", () => {
  it("groups implemented workflows ahead of administration and roadmap modules", () => {
    expect(APP_NAVIGATION_GROUPS.map((group) => group.label)).toEqual([
      "Operational",
      "Administration",
      "Roadmap",
    ]);
    expect(APP_NAVIGATION_GROUPS.find((group) => group.label === "Operational")?.items.map((item) => item.href)).toEqual([
      "/dashboard",
      "/content-studio",
      "/scene-planning",
      "/media-library",
      "/knowledge-base",
      "/approval-center",
    ]);
    expect(APP_NAVIGATION_GROUPS.find((group) => group.label === "Administration")?.items.map((item) => item.href)).toEqual(["/settings"]);
    expect(APP_NAVIGATION_GROUPS.find((group) => group.label === "Roadmap")?.items.map((item) => item.href)).toEqual([
      "/publishing",
      "/content-calendar",
      "/analytics",
      "/ai-representative",
      "/podcast",
      "/campus-locations",
      "/student-testimonials",
      "/manual-generation",
    ]);
  });

  it("derives the flat navigation from the grouped contract without duplicate routes", () => {
    expect(APP_NAVIGATION).toEqual(APP_NAVIGATION_GROUPS.flatMap((group) => group.items));
    expect(new Set(APP_NAVIGATION.map((item) => item.href)).size).toBe(APP_NAVIGATION.length);
  });

  it("uses absolute application routes", () => {
    for (const item of APP_NAVIGATION) {
      expect(item.href.startsWith("/")).toBe(true);
    }
  });

  it("matches exact routes and nested child routes without prefix collisions", () => {
    expect(isNavigationItemActive("/content-studio", "/content-studio")).toBe(true);
    expect(isNavigationItemActive("/scene-planning/project-1", "/scene-planning")).toBe(true);
    expect(isNavigationItemActive("/settings/integrations", "/settings")).toBe(true);
    expect(isNavigationItemActive("/approval-center/request-1", "/approval-center")).toBe(true);
    expect(isNavigationItemActive("/content-studio-old", "/content-studio")).toBe(false);
    expect(isNavigationItemActive("/dashboard", "/settings")).toBe(false);
  });
});