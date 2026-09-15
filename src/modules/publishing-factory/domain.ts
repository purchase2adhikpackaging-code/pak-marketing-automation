import { z } from "zod";

export const BookJobStatusSchema = z.enum([
  "PLANNED",
  "ARCHITECTURE_REQUIRED",
  "BLUEPRINT_READY",
  "KNOWLEDGE_READY",
  "MANUSCRIPT_READY",
  "VISUALS_READY",
  "TYPESET_READY",
  "PDF_BUILT",
  "QA_RUNNING",
  "QA_FAILED",
  "REPAIRING",
  "QA_PASSED",
  "RELEASED",
  "BLOCKED",
]);

export type BookJobStatus = z.infer<typeof BookJobStatusSchema>;

export const QualificationLevelSchema = z.enum([
  "certificate",
  "diploma",
  "bachelors",
  "postgraduate-diploma",
  "masters",
]);

export type QualificationLevel = z.infer<typeof QualificationLevelSchema>;

export const PublicationTypeSchema = z.enum(["textbook", "module-book"]);
export type PublicationType = z.infer<typeof PublicationTypeSchema>;

export const QaGateSchema = z.enum([
  "schema",
  "content",
  "references",
  "safety",
  "visual-assets",
  "layout",
  "pdf",
  "render-vision",
  "portfolio",
]);

export type QaGate = z.infer<typeof QaGateSchema>;

export const QaSeveritySchema = z.enum(["info", "warning", "error"]);
export type QaSeverity = z.infer<typeof QaSeveritySchema>;

export const QaGateResultSchema = z.enum(["PASS", "FAIL", "NOT_APPLICABLE"]);
export type QaGateResult = z.infer<typeof QaGateResultSchema>;

const OptionalArtifactPathSchema = z.string().min(1).optional();

export const BookJobSchema = z.object({
  bookId: z.string().min(1),
  programmeCode: z.string().regex(/^PAK-(?:C|D|B|PGD|M)\d{2}$/),
  programmeTitle: z.string().min(1),
  level: QualificationLevelSchema,
  academicPeriod: z.string().min(1),
  subjectCode: z.string().min(1),
  subjectTitle: z.string().min(1),
  publicationType: PublicationTypeSchema,
  edition: z.string().min(1),
  revision: z.string().min(1),
  curriculumSourcePaths: z.array(z.string().min(1)).min(1),
  chapterBlueprintPath: OptionalArtifactPathSchema,
  knowledgePackIds: z.array(z.string().min(1)).optional(),
  visualPlanPath: OptionalArtifactPathSchema,
  manuscriptPath: OptionalArtifactPathSchema,
  layoutSourcePath: OptionalArtifactPathSchema,
  pdfPath: OptionalArtifactPathSchema,
  qaReportPath: OptionalArtifactPathSchema,
  status: BookJobStatusSchema,
  failureReasons: z.array(z.string().min(1)).optional(),
  repairAttempts: z.record(z.string(), z.number().int().min(0)),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type BookJob = z.infer<typeof BookJobSchema>;

export const QaFindingSchema = z.object({
  id: z.string().min(1),
  gate: QaGateSchema,
  defectClass: z.string().min(1),
  severity: QaSeveritySchema,
  message: z.string().min(1),
  page: z.number().int().positive().optional(),
  componentId: z.string().min(1).optional(),
  detector: z.string().min(1),
  evidence: z.string().min(1).optional(),
  repairable: z.boolean(),
});

export type QaFinding = z.infer<typeof QaFindingSchema>;

export const QaReportSchema = z.object({
  bookId: z.string().min(1),
  revision: z.string().min(1),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  gateResults: z.partialRecord(QaGateSchema, QaGateResultSchema),
  findings: z.array(QaFindingSchema),
  passed: z.boolean(),
});

export type QaReport = z.infer<typeof QaReportSchema>;

export const ReleaseRecordSchema = z.object({
  bookId: z.string().min(1),
  sourceRevision: z.string().min(1),
  buildRevision: z.string().min(1),
  pdfChecksum: z.string().regex(/^[a-f0-9]{64}$/i),
  pageCount: z.number().int().positive(),
  qaStatus: z.enum(["QA_PASSED", "RELEASED"]),
  qaReportPath: z.string().min(1),
  releasePath: z.string().min(1),
});

export type ReleaseRecord = z.infer<typeof ReleaseRecordSchema>;

export function hasErrorFindings(findings: readonly QaFinding[]): boolean {
  return findings.some((finding) => finding.severity === "error");
}
