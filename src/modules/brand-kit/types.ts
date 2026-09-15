export type BrandAssetRole =
  | "PRIMARY_LOGO"
  | "LIGHT_LOGO"
  | "DARK_LOGO"
  | "BRAND_MARK"
  | "FAVICON"
  | "APPROVED_IMAGERY";

export type OrganizationBrandKit = {
  organizationId: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  typographyRules?: string;
  brandVoice?: string;
  logoUsageRules?: string;
  visualConstraints?: string;
  primaryLogoAssetId?: string;
  lightLogoAssetId?: string;
  darkLogoAssetId?: string;
  brandMarkAssetId?: string;
  faviconAssetId?: string;
  approvedImageryAssetIds: string[];
  revision: number;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};
