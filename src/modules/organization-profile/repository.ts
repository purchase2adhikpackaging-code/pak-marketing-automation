import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { OrganizationProfileUpdate } from "./schema";
import type { OrganizationProfile } from "./types";

export type UpdateOrganizationProfileInput = OrganizationProfileUpdate & {
  organizationId: string;
};

export type OrganizationProfilePatch = {
  officialName: string;
  shortName?: string;
  about?: string;
  address?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  website?: string;
  socialLinks: Record<string, string>;
  defaultLanguage: string;
  timezone: string;
  legalIdentifiers: Record<string, string>;
  revision: number;
};

export interface OrganizationProfilePersistence {
  get(organizationId: string): Promise<OrganizationProfile | null>;
  compareAndSet(
    organizationId: string,
    expectedRevision: number,
    patch: OrganizationProfilePatch,
  ): Promise<OrganizationProfile | null>;
}

export class OrganizationProfileRepository {
  constructor(private readonly persistence: OrganizationProfilePersistence) {}

  async get(organizationId: string): Promise<OrganizationProfile> {
    const profile = await this.persistence.get(organizationId);
    if (!profile) throw new AppError("NOT_FOUND", "Organization Profile is unavailable.");
    return profile;
  }

  async update(input: UpdateOrganizationProfileInput): Promise<OrganizationProfile> {
    const updated = await this.persistence.compareAndSet(
      input.organizationId,
      input.expectedRevision,
      {
        officialName: input.officialName,
        ...(input.shortName !== undefined ? { shortName: input.shortName } : {}),
        ...(input.about !== undefined ? { about: input.about } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.primaryEmail !== undefined ? { primaryEmail: input.primaryEmail } : {}),
        ...(input.primaryPhone !== undefined ? { primaryPhone: input.primaryPhone } : {}),
        ...(input.website !== undefined ? { website: input.website } : {}),
        socialLinks: input.socialLinks,
        defaultLanguage: input.defaultLanguage,
        timezone: input.timezone,
        legalIdentifiers: input.legalIdentifiers,
        revision: input.expectedRevision + 1,
      },
    );
    if (!updated) throw new AppError("CONFLICT", "Organization Profile changed before the update completed.");
    return updated;
  }
}

type OrganizationProfileRow = {
  organization_id: string;
  official_name: string;
  short_name: string | null;
  about: string | null;
  address: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  website: string | null;
  social_links: Record<string, string>;
  default_language: string;
  timezone: string;
  legal_identifiers: Record<string, string>;
  revision: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const PROFILE_COLUMNS = [
  "organization_id",
  "official_name",
  "short_name",
  "about",
  "address",
  "primary_email",
  "primary_phone",
  "website",
  "social_links",
  "default_language",
  "timezone",
  "legal_identifiers",
  "revision",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
].join(",");

function mapProfile(row: OrganizationProfileRow): OrganizationProfile {
  return {
    organizationId: row.organization_id,
    officialName: row.official_name,
    ...(row.short_name ? { shortName: row.short_name } : {}),
    ...(row.about ? { about: row.about } : {}),
    ...(row.address ? { address: row.address } : {}),
    ...(row.primary_email ? { primaryEmail: row.primary_email } : {}),
    ...(row.primary_phone ? { primaryPhone: row.primary_phone } : {}),
    ...(row.website ? { website: row.website } : {}),
    socialLinks: row.social_links ?? {},
    defaultLanguage: row.default_language,
    timezone: row.timezone,
    legalIdentifiers: row.legal_identifiers ?? {},
    revision: row.revision,
    ...(row.updated_by ? { updatedBy: row.updated_by } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDatabasePatch(patch: OrganizationProfilePatch): Record<string, unknown> {
  return {
    official_name: patch.officialName,
    short_name: patch.shortName ?? null,
    about: patch.about ?? null,
    address: patch.address ?? null,
    primary_email: patch.primaryEmail ?? null,
    primary_phone: patch.primaryPhone ?? null,
    website: patch.website ?? null,
    social_links: patch.socialLinks,
    default_language: patch.defaultLanguage,
    timezone: patch.timezone,
    legal_identifiers: patch.legalIdentifiers,
    revision: patch.revision,
  };
}

class SupabaseOrganizationProfilePersistence implements OrganizationProfilePersistence {
  async get(organizationId: string): Promise<OrganizationProfile | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("organization_profiles")
      .select(PROFILE_COLUMNS)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "Unable to load Organization Profile.");
    return data ? mapProfile(data as unknown as OrganizationProfileRow) : null;
  }

  async compareAndSet(
    organizationId: string,
    expectedRevision: number,
    patch: OrganizationProfilePatch,
  ): Promise<OrganizationProfile | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("organization_profiles")
      .update(toDatabasePatch(patch))
      .eq("organization_id", organizationId)
      .eq("revision", expectedRevision)
      .select(PROFILE_COLUMNS)
      .maybeSingle();
    if (error) throw new AppError("INTERNAL_ERROR", "Unable to save Organization Profile.");
    return data ? mapProfile(data as unknown as OrganizationProfileRow) : null;
  }
}

export const organizationProfileRepository = new OrganizationProfileRepository(
  new SupabaseOrganizationProfilePersistence(),
);
