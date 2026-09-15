export type OrganizationProfileSocialLinks = Record<string, string>;
export type OrganizationLegalIdentifiers = Record<string, string>;

export type OrganizationProfile = {
  organizationId: string;
  officialName: string;
  shortName?: string;
  about?: string;
  address?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  website?: string;
  socialLinks: OrganizationProfileSocialLinks;
  defaultLanguage: string;
  timezone: string;
  legalIdentifiers: OrganizationLegalIdentifiers;
  revision: number;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};
