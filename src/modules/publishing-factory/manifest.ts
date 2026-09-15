import type { BookJob, QaReport } from "./domain";
import { hasErrorFindings } from "./domain";

export interface ReleaseManifestEntry {
  bookId: string;
  title: string;
  status: BookJob["status"];
  qaPassed: boolean;
  qaReportRevision?: string;
}

export interface ReleaseManifestSummary {
  planned: number;
  generated: number;
  qaPassed: number;
  qaFailed: number;
  blocked: number;
  released: number;
  unresolved: number;
}

export interface ReleaseManifest {
  generatedAt: string;
  summary: ReleaseManifestSummary;
  books: ReleaseManifestEntry[];
}

const GENERATED_STATES = new Set<BookJob["status"]>([
  "PDF_BUILT",
  "QA_RUNNING",
  "QA_FAILED",
  "REPAIRING",
  "QA_PASSED",
  "RELEASED",
]);

export function canRelease(job: BookJob, report: QaReport | undefined): boolean {
  if (job.status !== "QA_PASSED" || !report) return false;
  if (report.bookId !== job.bookId || report.revision !== job.revision) return false;
  if (!report.passed || hasErrorFindings(report.findings)) return false;
  if (Object.values(report.gateResults).some((result) => result === "FAIL")) return false;
  return true;
}

export function buildReleaseManifest(
  jobs: readonly BookJob[],
  reports: ReadonlyMap<string, QaReport>,
): ReleaseManifest {
  const books = jobs.map<ReleaseManifestEntry>((job) => {
    const report = reports.get(job.bookId);
    const qaPassed =
      (job.status === "QA_PASSED" || job.status === "RELEASED") &&
      Boolean(report?.passed) &&
      !hasErrorFindings(report?.findings ?? []) &&
      !Object.values(report?.gateResults ?? {}).some((result) => result === "FAIL");

    return {
      bookId: job.bookId,
      title: job.subjectTitle,
      status: job.status,
      qaPassed,
      ...(report ? { qaReportRevision: report.revision } : {}),
    };
  });

  const planned = jobs.length;
  const released = jobs.filter((job) => job.status === "RELEASED").length;
  const summary: ReleaseManifestSummary = {
    planned,
    generated: jobs.filter((job) => GENERATED_STATES.has(job.status) || Boolean(job.pdfPath)).length,
    qaPassed: jobs.filter((job) => job.status === "QA_PASSED" || job.status === "RELEASED").length,
    qaFailed: jobs.filter((job) => job.status === "QA_FAILED").length,
    blocked: jobs.filter((job) => job.status === "BLOCKED").length,
    released,
    unresolved: planned - released,
  };

  return {
    generatedAt: new Date().toISOString(),
    summary,
    books,
  };
}

export function assertCompleteRelease(manifest: ReleaseManifest): void {
  const { planned, released, unresolved, qaFailed, blocked } = manifest.summary;
  if (
    planned === 0 ||
    released !== planned ||
    unresolved !== 0 ||
    qaFailed !== 0 ||
    blocked !== 0
  ) {
    throw new Error(
      `Release manifest is incomplete: planned=${planned}, released=${released}, unresolved=${unresolved}, qaFailed=${qaFailed}, blocked=${blocked}`,
    );
  }
}
