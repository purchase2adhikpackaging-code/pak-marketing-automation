import { z } from "zod";

export const createKnowledgeRecordSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(1).max(50000),
  sourceType: z.enum(["MANUAL", "DOCUMENT", "URL"]),
  sourceLabel: z.string().trim().max(300).optional(),
  sourceReference: z.string().trim().max(2000).optional(),
});

export const updateKnowledgeRecordSchema = createKnowledgeRecordSchema.extend({
  id: z.string().uuid(),
  expectedRevision: z.number().int().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
});

export type CreateKnowledgeRecordRequest = z.infer<typeof createKnowledgeRecordSchema>;
export type UpdateKnowledgeRecordRequest = z.infer<typeof updateKnowledgeRecordSchema>;
