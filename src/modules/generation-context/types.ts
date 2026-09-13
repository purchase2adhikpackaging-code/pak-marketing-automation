import { z } from "zod";

import type { OrganizationBrandKit } from "@/modules/brand-kit/types";
import type { KnowledgeRecord } from "@/modules/knowledge-base/types";
import type { OrganizationProfile } from "@/modules/organization-profile/types";

export const organizationGenerationContextRequestSchema = z.object({
  organizationId: z.string().uuid(),
  selectedKnowledgeRecordIds: z
    .array(z.string().uuid())
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, "Knowledge record IDs must be unique")
    .optional(),
  additionalContext: z.string().trim().max(12000).optional(),
}).strict();

export type OrganizationGenerationContextRequest = z.infer<typeof organizationGenerationContextRequestSchema>;

export type GenerationContextKnowledgeRecord = KnowledgeRecord & {
  isCore: boolean;
};

export type OrganizationGenerationContext = {
  organizationId: string;
  profile: OrganizationProfile | null;
  brandKit: OrganizationBrandKit | null;
  coreKnowledge: GenerationContextKnowledgeRecord[];
  selectedKnowledge: GenerationContextKnowledgeRecord[];
  additionalContext?: string;
  provenance: {
    profileRevision?: number;
    brandKitRevision?: number;
    knowledge: Array<{ id: string; revision: number; isCore: boolean }>;
  };
};
