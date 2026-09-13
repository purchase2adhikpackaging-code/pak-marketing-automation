import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("publishing worker Vercel runtime contract", () => {
  it("keeps the worker maxDuration within the connected Hobby plan limit", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "app", "api", "internal", "publishing-worker", "route.ts"),
      "utf8",
    );
    const match = source.match(/export const maxDuration\s*=\s*(\d+)\s*;/);

    expect(match, "worker route must declare maxDuration").not.toBeNull();
    expect(Number(match?.[1])).toBeLessThanOrEqual(300);
  });
});
