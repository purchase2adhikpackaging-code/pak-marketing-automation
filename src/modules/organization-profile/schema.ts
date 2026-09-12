import { z } from "zod";

const optionalTrimmed = (max: number) => z.string().trim().max(max).optional();
const optionalUrl = z.string().url().max(2000).optional();

const socialLinksSchema = z
  .record(z.string().trim().min(1).max(50), z.string().url().max(2000))
  .superRefine((value, ctx) => {
    if (Object.keys(value).length > 20) {
      ctx.addIssue({ code: "custom", message: "A maximum of 20 social links is allowed." });
    }
  });

const legalIdentifiersSchema = z
  .record(z.string().trim().min(1).max(80), z.string().trim().min(1).max(300))
  .superRefine((value, ctx) => {
    if (Object.keys(value).length > 30) {
      ctx.addIssue({ code: "custom", message: "A maximum of 30 legal identifiers is allowed." });
    }
  });

export const organizationProfileUpdateSchema = z.object({
  officialName: z.string().trim().min(2).max(200),
  shortName: optionalTrimmed(80),
  about: optionalTrimmed(12000),
  address: optionalTrimmed(2000),
  primaryEmail: z.string().email().max(320).optional(),
  primaryPhone: optionalTrimmed(80),
  website: optionalUrl,
  socialLinks: socialLinksSchema.default({}),
  defaultLanguage: z.string().trim().min(2).max(20),
  timezone: z.string().trim().min(3).max(100),
  legalIdentifiers: legalIdentifiersSchema.default({}),
  expectedRevision: z.number().int().min(1),
}).strict();

export type OrganizationProfileUpdate = z.infer<typeof organizationProfileUpdateSchema>;
