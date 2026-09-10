import { describe, expect, it } from "vitest";
import { APP_NAVIGATION, isNavigationItemActive } from "./navigation";

const expectedLabels = [
  "Dashboard",
  "Content Studio",
  "AI Representative",
  "Campus / Locations",
  "Podcast",
  "Manual Generation",
  "Student Testimonials",
  "Media Library",
  "Knowledge Base",
  "Content Calendar",
  "Approval Center",
  "Publishing",
  "Analytics",
  "Settings",
];

describe("APP_NAVIGATION", () => {
  it("contains every approved module exactly once", () => {
    expect(APP_NAVIGATION.map((item) => item.label)).toEqual(expectedLabels);
    expect(new Set(APP_NAVIGATION.map((item) => item.href)).size).toBe(APP_NAVIGATION.length);
  });

  it("uses absolute application routes", () => {
    for (const item of APP_NAVIGATION) {
      expect(item.href.startsWith("/")).toBe(true);
    }
  });

  it("matches exact routes and nested child routes without prefix collisions", () => {
    expect(isNavigationItemActive("/content-studio", "/content-studio")).toBe(true);
    expect(isNavigationItemActive("/settings/integrations", "/settings")).toBe(true);
    expect(isNavigationItemActive("/content-studio-old", "/content-studio")).toBe(false);
    expect(isNavigationItemActive("/dashboard", "/settings")).toBe(false);
  });
});
