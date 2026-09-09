import { z } from "zod";

export const generateTranslationRequestSchema = z.object({
  organizationId: z.string().uuid(),
  contentItemId: z.string().uuid(),
  targetLanguage: z.enum(["EN", "PL", "HI"]),
});

export const regenerateSourceRequestSchema = z.object({
  organizationId: z.string().uuid(),
  contentItemId: z.string().uuid(),
});

export type GenerateTranslationRequest = z.infer<typeof generateTranslationRequestSchema>;
export type RegenerateSourceRequest = z.infer<typeof regenerateSourceRequestSchema>;
