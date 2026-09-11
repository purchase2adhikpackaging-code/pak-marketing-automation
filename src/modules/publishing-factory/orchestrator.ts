import { chromium } from "@playwright/test";
import type { BookJob, QaFinding, QaGateResult, QaReport } from "./domain";
import { hasErrorFindings } from "./domain";
import { runContentQa } from "./content-qa";
import { runDomLayoutQa } from "./layout-qa";
import { runPdfQa } from "./pdf-qa";
import { renderPublication, type RenderPublicationResult } from "./renderer";
import { transitionJob } from "./state-machine";

export interface DeterministicBookInput {
  job: BookJob;
  html: string;
  artifactRoot: string;
  expectedTitle: string;
  requireBookmarks: boolean;
}

export interface DeterministicBookResult {
  job: BookJob;
  report: QaReport;
  render?: RenderPublicationResult;
}

function gateResult(findings: readonly QaFinding[], gate: QaFinding["gate"]): QaGateResult {
  return findings.some((finding) => finding.gate === gate && finding.severity === "error")
    ? "FAIL"
    : "PASS";
}

async function runLayoutQa(html: string): Promise<QaFinding[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    try {
      await page.setContent(html, { waitUntil: "load" });
      return await runDomLayoutQa(page);
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

export async function runDeterministicBook(
  input: DeterministicBookInput,
): Promise<DeterministicBookResult> {
  if (input.job.status !== "TYPESET_READY") {
    throw new Error(
      `Deterministic publication QA requires TYPESET_READY, received ${input.job.status}`,
    );
  }

  const startedAt = new Date().toISOString();
  const contentFindings = runContentQa({
    manuscript: input.html,
    expectedIdentity: {
      programmeCode: input.job.programmeCode,
      subjectCode: input.job.subjectCode,
      subjectTitle: input.job.subjectTitle,
    },
  });
  const layoutFindings = await runLayoutQa(input.html);

  let render: RenderPublicationResult;
  try {
    render = await renderPublication({
      bookId: input.job.bookId,
      html: input.html,
      artifactRoot: input.artifactRoot,
    });
  } catch (error) {
    const finding: QaFinding = {
      id: "render-failure-1",
      gate: "pdf",
      defectClass: "render-failure",
      severity: "error",
      message: `Publication renderer failed: ${error instanceof Error ? error.message : String(error)}`,
      detector: "publication-renderer",
      repairable: true,
    };
    const findings = [...contentFindings, ...layoutFindings, finding];
    const blockedJob = transitionJob(input.job, "BLOCKED");
    return {
      job: blockedJob,
      report: {
        bookId: input.job.bookId,
        revision: input.job.revision,
        startedAt,
        completedAt: new Date().toISOString(),
        gateResults: {
          content: gateResult(findings, "content"),
          layout: gateResult(findings, "layout"),
          pdf: "FAIL",
        },
        findings,
        passed: false,
      },
    };
  }

  let currentJob = transitionJob(
    {
      ...input.job,
      pdfPath: render.pdfPath,
      layoutSourcePath: render.htmlPath,
    },
    "PDF_BUILT",
  );
  currentJob = transitionJob(currentJob, "QA_RUNNING");

  const pdfFindings = await runPdfQa({
    pdfPath: render.pdfPath,
    expectedTitle: input.expectedTitle,
    expectedIdentityText: [
      input.job.programmeCode,
      input.job.subjectCode,
      input.job.subjectTitle,
    ],
    requireBookmarks: input.requireBookmarks,
  });

  const findings = [...contentFindings, ...layoutFindings, ...pdfFindings];
  const passed = !hasErrorFindings(findings);
  currentJob = transitionJob(currentJob, passed ? "QA_PASSED" : "QA_FAILED");

  const report: QaReport = {
    bookId: input.job.bookId,
    revision: input.job.revision,
    startedAt,
    completedAt: new Date().toISOString(),
    gateResults: {
      content: gateResult(findings, "content"),
      layout: gateResult(findings, "layout"),
      pdf: gateResult(findings, "pdf"),
    },
    findings,
    passed,
  };

  return {
    job: currentJob,
    report,
    render,
  };
}
