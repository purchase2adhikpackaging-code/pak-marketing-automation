import { z } from "zod";

export const knowledgeDocumentSourceTypeSchema = z.enum(["FILE", "URL"]);
export const knowledgeDocumentFormatSchema = z.enum(["PDF", "DOCX", "PPTX", "TXT", "URL"]);
export const knowledgeDocumentExtractionStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "EXTRACTED",
  "FAILED",
]);

const organizationIdSchema = z.string().uuid();
const mediaAssetIdSchema = z.string().uuid();
const sourceLabelSchema = z.string().trim().min(1).max(300).optional();

export const createFileKnowledgeDocumentSchema = z.object({
  organizationId: organizationIdSchema,
  mediaAssetId: mediaAssetIdSchema,
  format: z.enum(["PDF", "DOCX", "PPTX", "TXT"]),
  sourceLabel: sourceLabelSchema,
}).strict();

export const createUrlKnowledgeDocumentSchema = z.object({
  organizationId: organizationIdSchema,
  sourceUrl: z.string().trim().url().max(2000),
  sourceLabel: sourceLabelSchema,
}).strict();

export type CreateFileKnowledgeDocumentRequest = z.infer<typeof createFileKnowledgeDocumentSchema>;
export type CreateUrlKnowledgeDocumentRequest = z.infer<typeof createUrlKnowledgeDocumentSchema>;