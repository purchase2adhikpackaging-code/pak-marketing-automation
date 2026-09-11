import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("publishing factory CLI process", () => {
  it("runs the deterministic good QA fixture through the real tsx CLI", () => {
    const result = spawnSync("npm", ["run", "publishing:qa-fixture"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/QA_PASSED/);
  }, 20_000);
});
