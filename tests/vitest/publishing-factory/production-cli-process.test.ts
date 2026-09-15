import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const cliPath = "src/modules/publishing-factory/production-cli.ts";

function stateRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function run(args: string[], root = stateRoot("pak-production-cli-")) {
  return spawnSync("npx", ["tsx", cliPath, ...args, "--state-root", root], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      AI_TEXT_PROVIDER: "fake",
    },
    timeout: 30_000,
  });
}

function parseJson(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout.trim()) as Record<string, unknown>;
}

describe("production publishing CLI process", () => {
  it("plans one governed D01 subject through the real tsx process", () => {
    const result = run([
      "book-plan",
      "--programme",
      "PAK-D01",
      "--subject",
      "D01-102",
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const output = parseJson(result.stdout);
    expect(output.bookId).toBe("PAK-D01-S1-D01-102-TEXTBOOK");
    expect(output.subjectCode).toBe("D01-102");
    expect(output.programmeCode).toBe("PAK-D01");
  });

  it("writes a fake-provider book through PDF QA and emits machine-readable result JSON", () => {
    const root = stateRoot("pak-production-write-");
    const result = run(
      [
        "book-write",
        "--programme",
        "PAK-D01",
        "--subject",
        "D01-102",
        "--provider",
        "fake",
      ],
      root,
    );

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const output = parseJson(result.stdout);
    expect(output.status).toBe("QA_PASSED");
    expect(output.qaPassed).toBe(true);
    expect(typeof output.pdfPath).toBe("string");
    expect(existsSync(String(output.pdfPath))).toBe(true);
  }, 30_000);

  it("uses four workers by default and completes an isolated fake-provider queue", () => {
    const result = run([
      "workers",
      "--programme",
      "PAK-D01",
      "--subject",
      "D01-102",
      "--provider",
      "fake",
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const output = parseJson(result.stdout);
    expect(output.concurrency).toBe(4);
    expect(output.completed).toBe(1);
    expect(output.blocked).toBe(0);
  }, 30_000);

  it("fails closed when an explicit worker concurrency is zero", () => {
    const result = run([
      "workers",
      "--programme",
      "PAK-D01",
      "--subject",
      "D01-102",
      "--provider",
      "fake",
      "--concurrency",
      "0",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/concurrency.*1.*32|concurrency.*positive/i);
  });

  it("returns machine-readable production status for an empty durable queue", () => {
    const result = run(["production-status"]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const output = parseJson(result.stdout);
    expect(output.configuredConcurrency).toBe(4);
    expect(output.total).toBe(0);
    expect(output.queued).toBe(0);
    expect(output.running).toBe(0);
    expect(output.completed).toBe(0);
    expect(output.blocked).toBe(0);
  });

  it("refuses the OpenAI production path without organization context", () => {
    const result = run([
      "book-write",
      "--programme",
      "PAK-D01",
      "--subject",
      "D01-102",
      "--provider",
      "openai",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/organization/i);
    expect(result.stderr).not.toMatch(/api[_ -]?key/i);
  });
});
