import { z } from "zod";

export const contentGenerationRequestSchema = z.object({
  organizationId: z.string().uuid(),
  topic: z.string().trim().min(3).max(300),
  knowledgeContext: z.string().trim().max(12000).optional(),
  language: z.enum(["EN", "PL", "HI"]),
});

export type ContentGenerationRequest = z.infer<typeof contentGenerationRequestSchema>;
