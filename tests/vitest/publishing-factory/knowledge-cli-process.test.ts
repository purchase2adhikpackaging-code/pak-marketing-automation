import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runScript(script: string, args: string[] = []) {
  return spawnSync("npm", ["run", script, ...(args.length ? ["--", ...args] : [])], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
}

function parseJsonStdout(stdout: string): unknown {
  const start = stdout.indexOf("{");
  if (start < 0) throw new Error(`No JSON object found in stdout:\n${stdout}`);
  return JSON.parse(stdout.slice(start)) as unknown;
}

describe("canonical knowledge CLI real process", () => {
  it("validates all governed knowledge packs", () => {
    const result = runScript("publishing:knowledge-validate");
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const output = parseJsonStdout(result.stdout) as {
      valid: boolean;
      packCount: number;
      sourceCount: number;
      findings: string[];
    };
    expect(output.valid).toBe(true);
    expect(output.packCount).toBe(24);
    expect(output.sourceCount).toBeGreaterThan(0);
    expect(output.findings).toEqual([]);
  }, 20_000);

  it("lists the 24 packs with deterministic SHA-256 identities", () => {
    const result = runScript("publishing:knowledge-list");
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const output = parseJsonStdout(result.stdout) as {
      count: number;
      packs: Array<{ packId: string; sha256: string }>;
    };
    expect(output.count).toBe(24);
    expect(output.packs).toHaveLength(24);
    expect(output.packs[0]?.packId).toBe("railway-systems");
    expect(output.packs.every((pack) => /^[a-f0-9]{64}$/.test(pack.sha256))).toBe(true);
  }, 20_000);

  it("assembles a level-specific manuscript context from governed packs", () => {
    const result = runScript("publishing:knowledge-context", [
      "--level",
      "diploma",
      "--packs",
      "railway-systems,rolling-stock",
    ]);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const output = parseJsonStdout(result.stdout) as {
      level: string;
      selectedPacks: Array<{ packId: string; sha256: string }>;
    };
    expect(output.level).toBe("diploma");
    expect(output.selectedPacks.map((pack) => pack.packId)).toEqual([
      "railway-systems",
      "rolling-stock",
    ]);
    expect(output.selectedPacks.every((pack) => /^[a-f0-9]{64}$/.test(pack.sha256))).toBe(true);
  }, 20_000);
});
