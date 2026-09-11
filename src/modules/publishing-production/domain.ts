import { z } from "zod";

export const ProductionRunStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "COMPLETED_WITH_BLOCKED",
  "CANCELLED",
  "FAILED",
]);

export const ProductionJobStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "QA_PASSED",
  "BLOCKED",
  "CANCELLED",
]);

export const ProductionScopeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SUBJECT"),
    programmeCode: z.string().min(1),
    subjectCode: z.string().min(1),
  }),
  z.object({
    type: z.literal("PROGRAMME"),
    programmeCode: z.string().min(1),
  }),
  z.object({
    type: z.literal("PILOT"),
    programmeCode: z.string().min(1),
    limit: z.number().int().min(1).max(10),
  }),
  z.object({ type: z.literal("PORTFOLIO") }),
]);

export type ProductionScope = z.infer<typeof ProductionScopeSchema>;

const DateStringSchema = z.string().min(1);
const NullableDateStringSchema = DateStringSchema.nullish();

export const ProductionRunSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  createdBy: z.string().uuid(),
  scopeType: z.enum(["SUBJECT", "PROGRAMME", "PILOT", "PORTFOLIO"]),
  scopeValue: z.record(z.string(), z.unknown()),
  status: ProductionRunStatusSchema,
  requestedConcurrency: z.number().int().min(1).max(32),
  plannedCount: z.number().int().nonnegative(),
  queuedCount: z.number().int().nonnegative(),
  runningCount: z.number().int().nonnegative(),
  qaPassedCount: z.number().int().nonnegative(),
  blockedCount: z.number().int().nonnegative(),
  cancelledCount: z.number().int().nonnegative(),
  releasedCount: z.number().int().nonnegative(),
  idempotencyKey: z.string().length(64).nullish(),
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
  startedAt: NullableDateStringSchema,
  completedAt: NullableDateStringSchema,
});

export const ProductionJobSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  productionRunId: z.string().uuid(),
  bookId: z.string().min(1),
  programmeCode: z.string().min(1),
  subjectCode: z.string().min(1),
  academicPeriod: z.string().nullish(),
  edition: z.string().min(1),
  revision: z.string().min(1),
  status: ProductionJobStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.literal(3),
  leaseOwner: z.string().nullish(),
  leaseExpiresAt: NullableDateStringSchema,
  lastError: z.string().nullish(),
  checkpointRoot: z.string().nullish(),
  qaStatus: z.string().nullish(),
  pdfArtifactPath: z.string().nullish(),
  manifestArtifactPath: z.string().nullish(),
  providerName: z.string().nullish(),
  providerModel: z.string().nullish(),
  knowledgeHashes: z.array(z.unknown()).default([]),
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
  startedAt: NullableDateStringSchema,
  completedAt: NullableDateStringSchema,
});

export const PublicationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  productionRunId: z.string().uuid(),
  productionJobId: z.string().uuid(),
  bookId: z.string().min(1),
  programmeCode: z.string().min(1),
  subjectCode: z.string().min(1),
  academicPeriod: z.string().nullish(),
  edition: z.string().min(1),
  revision: z.string().min(1),
  status: z.literal("RELEASED"),
  pdfArtifactPath: z.string().min(1),
  manuscriptHtmlPath: z.string().min(1),
  manuscriptJsonPath: z.string().min(1),
  blueprintPath: z.string().min(1),
  qaReportPath: z.string().min(1),
  releaseManifestPath: z.string().min(1),
  providerName: z.string().nullish(),
  providerModel: z.string().nullish(),
  knowledgeHashes: z.array(z.unknown()).default([]),
  qaSummary: z.record(z.string(), z.unknown()),
  releasedAt: DateStringSchema,
  createdAt: DateStringSchema,
});

export type ProductionRun = z.infer<typeof ProductionRunSchema>;
export type ProductionJob = z.infer<typeof ProductionJobSchema>;
export type Publication = z.infer<typeof PublicationSchema>;
