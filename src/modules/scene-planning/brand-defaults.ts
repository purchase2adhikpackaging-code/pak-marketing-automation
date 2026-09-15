import type { OrganizationBrandKit } from "@/modules/brand-kit/types";

export type ScenePlanningInstitutionalBrand = {
  brandKitRevision: number;
  defaultPalette: Record<string, string>;
  typographyRules?: string;
  brandVoice?: string;
  logoUsageRules?: string;
  visualConstraints?: string;
  officialPrimaryLogoAssetId?: string;
  approvedImageryAssetIds: string[];
};

export type AppliedScenePlanningBrand = {
  visualBible: Record<string, unknown>;
  institutionalBrand: ScenePlanningInstitutionalBrand;
};

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length > 0;
}

function defaultPalette(brandKit: OrganizationBrandKit): Record<string, string> {
  return {
    ...(brandKit.primaryColor ? { primary: brandKit.primaryColor } : {}),
    ...(brandKit.secondaryColor ? { secondary: brandKit.secondaryColor } : {}),
    ...(brandKit.accentColor ? { accent: brandKit.accentColor } : {}),
  };
}

export function applyBrandKitDefaults(
  visualBible: Record<string, unknown>,
  brandKit: OrganizationBrandKit,
): AppliedScenePlanningBrand {
  const palette = defaultPalette(brandKit);
  const effectiveVisualBible: Record<string, unknown> = {
    ...visualBible,
    ...(!nonEmptyObject(visualBible.palette) && Object.keys(palette).length > 0 ? { palette } : {}),
    ...(!nonEmptyString(visualBible.typographyTreatment) && brandKit.typographyRules
      ? { typographyTreatment: brandKit.typographyRules }
      : {}),
    ...(!nonEmptyString(visualBible.logoTreatment) && brandKit.logoUsageRules
      ? { logoTreatment: brandKit.logoUsageRules }
      : {}),
  };

  return {
    visualBible: effectiveVisualBible,
    institutionalBrand: {
      brandKitRevision: brandKit.revision,
      defaultPalette: palette,
      ...(brandKit.typographyRules ? { typographyRules: brandKit.typographyRules } : {}),
      ...(brandKit.brandVoice ? { brandVoice: brandKit.brandVoice } : {}),
      ...(brandKit.logoUsageRules ? { logoUsageRules: brandKit.logoUsageRules } : {}),
      ...(brandKit.visualConstraints ? { visualConstraints: brandKit.visualConstraints } : {}),
      ...(brandKit.primaryLogoAssetId ? { officialPrimaryLogoAssetId: brandKit.primaryLogoAssetId } : {}),
      approvedImageryAssetIds: [...brandKit.approvedImageryAssetIds],
    },
  };
}
