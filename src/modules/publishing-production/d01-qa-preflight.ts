import "server-only";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BookJob } from "@/modules/publishing-factory/domain";
import type { BookManuscript } from "@/modules/publishing-factory/manuscript-domain";
import { renderBookHtml } from "@/modules/publishing-factory/manuscript-serializer";
import { runDeterministicBook } from "@/modules/publishing-factory/orchestrator";
import type { D01QaPreflightResult } from "./d01-qa-preflight-route";

function expectedTitle(job: BookJob): string {
  return `${job.programmeCode} — ${job.subjectCode} ${job.subjectTitle}`;
}

export async function runD01QaPreflight(input: {
  job: BookJob;
  manuscript: BookManuscript;
}): Promise<D01QaPreflightResult> {
  if (input.job.subjectCode !== "D01-101" || input.manuscript.subjectCode !== "D01-101") {
    throw new Error("D01 QA preflight is restricted to D01-101.");
  }

  const artifactRoot = await mkdtemp(join(tmpdir(), "pak-d01-qa-preflight-"));
  try {
    const job: BookJob = {
      ...input.job,
      status: "TYPESET_READY",
      pdfPath: undefined,
      layoutSourcePath: undefined,
      qaReportPath: undefined,
    };
    const html = renderBookHtml({ job, manuscript: input.manuscript });
    const result = await runDeterministicBook({
      job,
      html,
      artifactRoot,
      expectedTitle: expectedTitle(job),
      requireBookmarks: false,
    });

    return {
      passed: result.report.passed,
      gateResults: result.report.gateResults,
      findings: result.report.findings,
    };
  } finally {
    await rm(artifactRoot, { recursive: true, force: true });
  }
}
