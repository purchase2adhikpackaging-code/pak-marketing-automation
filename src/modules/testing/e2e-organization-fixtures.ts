import "server-only";

import type { OrganizationBrandKit } from "@/modules/brand-kit/types";
import type { KnowledgeRecord } from "@/modules/knowledge-base/types";
import type { OrganizationProfile } from "@/modules/organization-profile/types";

export const E2E_FIXTURE_ORGANIZATION_ID = "90000000-0000-4000-8000-000000000001";
export const E2E_FIXTURE_ACTOR_ID = "90000000-0000-4000-8000-000000000002";
export const E2E_FIXTURE_UPLOAD_SESSION_ID = "90000000-0000-4000-8000-000000000003";
export const E2E_FIXTURE_MEDIA_ASSET_ID = "90000000-0000-4000-8000-000000000004";
export const E2E_FIXTURE_DOCUMENT_ID = "90000000-0000-4000-8000-000000000005";
export const E2E_FIXTURE_KNOWLEDGE_ID = "90000000-0000-4000-8000-000000000006";
export const E2E_FIXTURE_LOGO_ASSET_ID = "90000000-0000-4000-8000-000000000007";
export const E2E_FIXTURE_ORGANIZATION_LABEL = "PAK E2E Organization";

const fixtureTimestamp = "2026-09-13T00:00:00.000Z";

export const E2E_FIXTURE_PROFILE: OrganizationProfile = {
  organizationId: E2E_FIXTURE_ORGANIZATION_ID,
  officialName: "Polish Railway Academy",
  shortName: "PAK",
  about: "Official railway education and professional training institution.",
  address: "Warsaw, Poland",
  primaryEmail: "academy@example.invalid",
  primaryPhone: "+48 000 000 000",
  website: "https://example.invalid",
  socialLinks: {},
  defaultLanguage: "en",
  timezone: "Europe/Warsaw",
  legalIdentifiers: {},
  revision: 3,
  createdAt: fixtureTimestamp,
  updatedAt: fixtureTimestamp,
};

export const E2E_FIXTURE_BRAND_KIT: OrganizationBrandKit = {
  organizationId: E2E_FIXTURE_ORGANIZATION_ID,
  primaryColor: "#102A43",
  secondaryColor: "#FFFFFF",
  accentColor: "#C89B3C",
  typographyRules: "Use institutional sans serif typography.",
  brandVoice: "Authoritative, precise and educational.",
  logoUsageRules: "Use the official logo without distortion.",
  visualConstraints: "Use realistic European railway environments.",
  primaryLogoAssetId: E2E_FIXTURE_LOGO_ASSET_ID,
  approvedImageryAssetIds: [],
  revision: 4,
  createdAt: fixtureTimestamp,
  updatedAt: fixtureTimestamp,
};

export const E2E_FIXTURE_IMAGE_ASSETS = [
  {
    id: E2E_FIXTURE_LOGO_ASSET_ID,
    displayName: "Official PAK Logo",
    mimeType: "image/png",
  },
] as const;

export function createE2EKnowledgeDraft(sourceLabel?: string): KnowledgeRecord {
  const title = sourceLabel?.trim() || "PAK Safety Manual";
  return {
    id: E2E_FIXTURE_KNOWLEDGE_ID,
    organizationId: E2E_FIXTURE_ORGANIZATION_ID,
    title,
    content: "Deterministic extracted safety content for browser verification.",
    status: "DRAFT",
    sourceType: "DOCUMENT",
    sourceLabel: title,
    sourceReference: `media:${E2E_FIXTURE_MEDIA_ASSET_ID}`,
    isCore: false,
    revision: 1,
    createdBy: E2E_FIXTURE_ACTOR_ID,
    updatedBy: E2E_FIXTURE_ACTOR_ID,
    createdAt: fixtureTimestamp,
    updatedAt: fixtureTimestamp,
  };
}
