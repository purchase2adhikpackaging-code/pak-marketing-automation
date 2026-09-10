import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");

describe("root route", () => {
  it("redirects into the authenticated workspace", () => {
    expect(source).toContain('import { redirect } from "next/navigation"');
    expect(source).toMatch(/redirect\(["']\/dashboard["']\)/);
  });
});
