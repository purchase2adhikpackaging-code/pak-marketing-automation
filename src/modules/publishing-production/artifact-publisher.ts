import { createHash } from "node:crypto";
import type { CompileBookResult } from "@/modules/publishing-factory/book-compiler";
import type { ProductionJob } from "./domain";

export interface PublicationStorage {
  put(path: string, data: Uint8Array | string, contentType: string): Promise<void>;
}

export interface PublicationRepository {
  upsert(record: Record<string, unknown>): Promise<unknown>;
}

function safeSegment(value: string, label: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(`Invalid ${label} for publishing storage path.`);
  }
  return value;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function checksum(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function publishQaPassedBook(input: {
  organizationId: string;
  job: ProductionJob;
  compilerResult: CompileBookResult;
  readFile(path: string): Promise<Uint8Array>;
  storage: PublicationStorage;
  publications: PublicationRepository;
}): Promise<{ prefix: string; pdfPath: string; manifestPath: string }> {
  const { job, compilerResult } = input;
  if (input.organizationId !== job.organizationId) {
    throw new Error("Publishing organization does not match the production job organization.");
  }
  if (
    compilerResult.job.status !== "QA_PASSED" ||
    compilerResult.report?.passed !== true ||
    compilerResult.report.gateResults["visual-assets"] !== "PASS" ||
    !compilerResult.render?.pdfPath ||
    !compilerResult.manuscript ||
    !compilerResult.html ||
    !compilerResult.visualPlan ||
    !compilerResult.visualAssets
  ) {
    throw new Error("Only a fully QA-passed visual-compliant compiled book may be published.");
  }

  const organization = safeSegment(input.organizationId, "organization id");
  const programme = safeSegment(job.programmeCode, "programme code");
  const academicPeriod = safeSegment(job.academicPeriod ?? "UNSPECIFIED", "academic period");
  const subject = safeSegment(job.subjectCode, "subject code");
  const edition = safeSegment(job.edition, "edition");
  const revision = safeSegment(job.revision, "revision");
  const prefix = `${organization}/${programme}/${academicPeriod}/${subject}/${edition}/${revision}/`;

  const pdf = await input.readFile(compilerResult.render.pdfPath);
  const pdfPath = `${prefix}textbook.pdf`;
  const manuscriptHtmlPath = `${prefix}manuscript.html`;
  const manuscriptJsonPath = `${prefix}manuscript.json`;
  const blueprintPath = `${prefix}blueprint.json`;
  const qaReportPath = `${prefix}qa-report.json`;
  const releaseManifestPath = `${prefix}release-manifest.json`;
  const visualPlanPath = `${prefix}visual-plan.json`;
  const visualManifestPath = `${prefix}visual-assets.json`;

  const frontCoverCount = compilerResult.visualAssets.visuals.filter((visual) => visual.placement === "front-cover").length;
  const backCoverCount = compilerResult.visualAssets.visuals.filter((visual) => visual.placement === "back-cover").length;
  const chapterIds = new Set(
    compilerResult.visualPlan.requirements
      .map((visual) => visual.chapterId)
      .filter((chapterId): chapterId is string => Boolean(chapterId)),
  );
  const coveredChapterIds = [...chapterIds].filter((chapterId) =>
    compilerResult.visualAssets!.visuals.some((visual) => visual.chapterId === chapterId),
  );
  const visualReleaseSummary = {
    assetCount: compilerResult.visualAssets.visuals.length,
    frontCoverPresent: frontCoverCount === 1,
    backCoverPresent: backCoverCount === 1,
    chapterCount: chapterIds.size,
    chapterVisualCoverage: coveredChapterIds.length,
    allRealismVerified: compilerResult.visualAssets.visuals.every((visual) => !visual.realistic || visual.realismVerified),
    allRequiredLabelsVerified: compilerResult.visualAssets.visuals.every((visual) => !visual.labelsRequired || visual.labelsPresent),
    sourceKinds: [...new Set(compilerResult.visualAssets.visuals.map((visual) => visual.sourceKind))].sort(),
    provenance: [...new Set(compilerResult.visualAssets.visuals.map((visual) => visual.provenance))].sort(),
  };

  const releaseManifest = {
    bookId: job.bookId,
    edition: job.edition,
    revision: job.revision,
    pdfSha256: checksum(pdf),
    qaStatus: "QA_PASSED",
    provider: compilerResult.manuscript.provider,
    knowledgePacks: compilerResult.manuscript.knowledgePacks,
    visuals: visualReleaseSummary,
    productionRunId: job.productionRunId,
    productionJobId: job.id,
  };

  const safeVisualManifest = {
    bookId: compilerResult.visualAssets.bookId,
    visuals: compilerResult.visualAssets.visuals.map(({ dataUri: _dataUri, ...visual }) => visual),
  };

  await Promise.all([
    input.storage.put(pdfPath, pdf, "application/pdf"),
    input.storage.put(manuscriptHtmlPath, compilerResult.html, "text/html; charset=utf-8"),
    input.storage.put(manuscriptJsonPath, json(compilerResult.manuscript), "application/json"),
    input.storage.put(blueprintPath, json(compilerResult.blueprint), "application/json"),
    input.storage.put(qaReportPath, json(compilerResult.report), "application/json"),
    input.storage.put(releaseManifestPath, json(releaseManifest), "application/json"),
    input.storage.put(visualPlanPath, json(compilerResult.visualPlan), "application/json"),
    input.storage.put(visualManifestPath, json(safeVisualManifest), "application/json"),
  ]);

  await input.publications.upsert({
    organization_id: job.organizationId,
    production_run_id: job.productionRunId,
    production_job_id: job.id,
    book_id: job.bookId,
    programme_code: job.programmeCode,
    subject_code: job.subjectCode,
    academic_period: job.academicPeriod,
    edition: job.edition,
    revision: job.revision,
    status: "RELEASED",
    pdf_artifact_path: pdfPath,
    manuscript_html_path: manuscriptHtmlPath,
    manuscript_json_path: manuscriptJsonPath,
    blueprint_path: blueprintPath,
    qa_report_path: qaReportPath,
    release_manifest_path: releaseManifestPath,
    provider_name: compilerResult.manuscript.provider.name,
    provider_model: compilerResult.manuscript.provider.model,
    knowledge_hashes: compilerResult.manuscript.knowledgePacks,
    qa_summary: {
      passed: true,
      findings: compilerResult.report.findings.length,
      gateResults: compilerResult.report.gateResults,
      visuals: visualReleaseSummary,
    },
  });

  return { prefix, pdfPath, manifestPath: releaseManifestPath };
}
