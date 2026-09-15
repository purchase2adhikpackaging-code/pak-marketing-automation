import { z } from "zod";
import { QualificationLevelSchema } from "./domain";

export const KnowledgeAuthoritySchema = z.enum([
  "eu-law",
  "era",
  "national-authority",
  "infrastructure-manager",
  "manufacturer",
  "academic",
  "industry",
]);

export const KnowledgeSourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  authority: KnowledgeAuthoritySchema,
  url: z.string().url().optional(),
  documentId: z.string().min(1).optional(),
  editionOrVersion: z.string().min(1).optional(),
  effectiveOrPublishedDate: z.string().min(1).optional(),
  accessedDate: z.string().min(1),
  scopeNote: z.string().min(1),
});
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

export const KnowledgeClaimSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
  safetyCritical: z.boolean(),
  numeric: z.boolean(),
  applicabilityNote: z.string().min(1).optional(),
});
export type KnowledgeClaim = z.infer<typeof KnowledgeClaimSchema>;

const LevelGuidanceEntrySchema = z.object({
  depth: z.string().min(1),
  maths: z.string().min(1),
  practical: z.string().min(1),
  assessment: z.string().min(1),
});

export const KnowledgeLevelGuidanceSchema = z.object({
  certificate: LevelGuidanceEntrySchema,
  diploma: LevelGuidanceEntrySchema,
  bachelors: LevelGuidanceEntrySchema,
  "postgraduate-diploma": LevelGuidanceEntrySchema,
  masters: LevelGuidanceEntrySchema,
});

export const KnowledgePackSchema = z.object({
  id: z.string().min(1),
  domain: z.string().min(1),
  title: z.string().min(1),
  revision: z.string().min(1),
  status: z.enum(["draft", "approved", "archived"]),
  canonicalTerminology: z
    .array(
      z.object({
        term: z.string().min(1),
        definition: z.string().min(1),
        sourceIds: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
  claims: z.array(KnowledgeClaimSchema).min(1),
  equations: z.array(
    z.object({
      id: z.string().min(1),
      expression: z.string().min(1),
      variables: z.record(z.string(), z.string().min(1)),
      sourceIds: z.array(z.string().min(1)).min(1),
      limitation: z.string().min(1),
    }),
  ),
  visualSpecs: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum([
        "block-diagram",
        "schematic",
        "cutaway",
        "process-flow",
        "table",
        "chart",
      ]),
      purpose: z.string().min(1),
      labels: z.array(z.string().min(1)).min(1),
      trainingOnly: z.boolean(),
    }),
  ),
  prohibitedUnsupportedClaims: z.array(z.string().min(1)).min(1),
  levelGuidance: KnowledgeLevelGuidanceSchema,
  sourceIds: z.array(z.string().min(1)).min(1),
});
export type KnowledgePack = z.infer<typeof KnowledgePackSchema>;

export const KnowledgePackRegistryEntrySchema = z.object({
  packId: z.string().min(1),
  path: z.string().min(1),
  revision: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  status: z.enum(["draft", "approved", "archived"]),
});

export const KnowledgePackRegistrySchema = z.object({
  version: z.string().min(1),
  packs: z.array(KnowledgePackRegistryEntrySchema).min(1),
});

export type KnowledgePackRegistry = z.infer<typeof KnowledgePackRegistrySchema>;
export type KnowledgePackRegistryEntry = z.infer<
  typeof KnowledgePackRegistryEntrySchema
>;
export type KnowledgeLevel = z.infer<typeof QualificationLevelSchema>;
