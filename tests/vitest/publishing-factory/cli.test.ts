import { describe, expect, it } from "vitest";
import { runCli, type PublishingCliIo } from "@/modules/publishing-factory/cli";

function captureIo(): { io: PublishingCliIo; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      cwd: process.cwd(),
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    },
  };
}

describe("publishing factory CLI", () => {
  it("reports the governed 34-programme registry", async () => {
    const capture = captureIo();
    const exitCode = await runCli(["registry"], capture.io);
    expect(exitCode).toBe(0);
    const output = JSON.parse(capture.stdout.join("\n")) as {
      total: number;
      certificate: number;
      diploma: number;
      bachelors: number;
      postgraduateDiploma: number;
      masters: number;
    };
    expect(output).toEqual({
      total: 34,
      certificate: 12,
      diploma: 5,
      bachelors: 5,
      postgraduateDiploma: 6,
      masters: 6,
    });
    expect(capture.stderr).toHaveLength(0);
  });

  it("enumerates 24 governed D01 textbook jobs", async () => {
    const capture = captureIo();
    const exitCode = await runCli(
      ["enumerate", "--programme", "PAK-D01"],
      capture.io,
    );
    expect(exitCode).toBe(0);
    const output = JSON.parse(capture.stdout.join("\n")) as {
      programmeCode: string;
      count: number;
      bookIds: string[];
    };
    expect(output.programmeCode).toBe("PAK-D01");
    expect(output.count).toBe(24);
    expect(output.bookIds).toHaveLength(24);
    expect(output.bookIds[0]).toBe("PAK-D01-S1-D01-101-TEXTBOOK");
  });

  it("fails closed for an unknown command", async () => {
    const capture = captureIo();
    const exitCode = await runCli(["unknown-command"], capture.io);
    expect(exitCode).toBe(2);
    expect(capture.stderr.join("\n")).toMatch(/unknown publishing command/i);
  });
});
