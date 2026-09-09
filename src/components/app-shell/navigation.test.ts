import { describe, expect, it } from "vitest";
import { APP_NAVIGATION } from "./navigation";

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
});
