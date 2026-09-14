import { z } from "zod";

import { MAX_RESEARCH_QUERY_CHARS } from "./types";

export const researchSearchInputSchema = z
  .object({
    organizationId: z.string().uuid(),
    query: z.string().trim().min(3).max(MAX_RESEARCH_QUERY_CHARS),
  })
  .strict();

export const researchCandidateInputSchema = z
  .object({
    organizationId: z.string().uuid(),
    candidateId: z.string().uuid(),
  })
  .strict();

export type ResearchSearchInput = z.infer<typeof researchSearchInputSchema>;
export type ResearchCandidateInput = z.infer<typeof researchCandidateInputSchema>;
