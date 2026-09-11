import { z } from "zod";

export const FINAL_ASSEMBLY_MANIFEST_SCHEMA_VERSION = "final-assembly-render-v1" as const;
export const FINAL_ASSEMBLY_MAX_COMPONENTS = 200;
export const FINAL_ASSEMBLY_SIGNED_URL_TTL_SECONDS = 900;

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const uuidSchema = z.string().uuid();

const finalAssemblyComponentSchema = z.object({
  ordinal: z.number().int().min(1),
  shotId: uuidSchema,
  mediaAssetId: uuidSchema,
  signedDownloadUrl: z.string().url(),
  checksum: sha256Schema,
  durationSeconds: z.number().positive().max(600),
}).strict();

const finalAssemblyManifestSchema = z.object({
  schemaVersion: z.literal(FINAL_ASSEMBLY_MANIFEST_SCHEMA_VERSION),
  assemblyId: uuidSchema,
  jobId: uuidSchema,
  organizationId: uuidSchema,
  renderProfile: z.literal("PAK_MASTER_1080P_V1"),
  aspectRatio: z.enum(["16:9", "9:16"]),
  expiresAt: z.string().datetime({ offset: true }),
  output: z.object({
    signedUploadUrl: z.string().url(),
    bucket: z.literal("generated-media"),
    path: z.string().min(1).max(1024),
  }).strict(),
  components: z.array(finalAssemblyComponentSchema).min(1).max(FINAL_ASSEMBLY_MAX_COMPONENTS),
}).strict();

export type FinalAssemblyRenderManifest = z.infer<typeof finalAssemblyManifestSchema>;

export function parseFinalAssemblyRenderManifest(input: unknown): FinalAssemblyRenderManifest {
  return finalAssemblyManifestSchema.parse(input);
}
