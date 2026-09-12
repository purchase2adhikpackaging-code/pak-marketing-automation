import { z } from "zod";

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const optionalRule = (max: number) => z.string().trim().max(max).optional();
const optionalAssetId = z.string().uuid().optional();

const approvedImagerySchema = z
  .array(z.string().uuid())
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length, "Approved imagery asset IDs must be unique");

export const brandKitUpdateSchema = z.object({
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
  accentColor: hexColorSchema.optional(),
  typographyRules: optionalRule(4000),
  brandVoice: optionalRule(4000),
  logoUsageRules: optionalRule(4000),
  visualConstraints: optionalRule(6000),
  primaryLogoAssetId: optionalAssetId,
  lightLogoAssetId: optionalAssetId,
  darkLogoAssetId: optionalAssetId,
  brandMarkAssetId: optionalAssetId,
  faviconAssetId: optionalAssetId,
  approvedImageryAssetIds: approvedImagerySchema.default([]),
  expectedRevision: z.number().int().min(1),
}).strict();

export type BrandKitUpdate = z.infer<typeof brandKitUpdateSchema>;
