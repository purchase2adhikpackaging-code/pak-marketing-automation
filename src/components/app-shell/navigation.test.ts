import { describe, expect, it } from "vitest";
import { APP_NAVIGATION, isNavigationItemActive } from "./navigation";

const existingLabelsInOrder = [
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

const expectedLabels = [
  "Dashboard",
  "Content Studio",
  "Scene Planning",
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
  it("inserts Scene Planning exactly once immediately after Content Studio without reordering existing modules", () => {
    expect(APP_NAVIGATION.map((item) => item.label)).toEqual(expectedLabels);
    expect(APP_NAVIGATION.filter((item) => item.href === "/scene-planning")).toHaveLength(1);
    expect(APP_NAVIGATION.map((item) => item.label).filter((label) => label !== "Scene Planning")).toEqual(
      existingLabelsInOrder,
    );
  });

  it("contains every approved module exactly once", () => {
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
    expect(isNavigationItemActive("/content-studio-old", "/content-studio")).toBe(false);
    expect(isNavigationItemActive("/dashboard", "/settings")).toBe(false);
  });
});
