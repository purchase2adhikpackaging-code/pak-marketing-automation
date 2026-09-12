import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { BrandKitUpdate } from "./schema";
import type { BrandAssetRole, OrganizationBrandKit } from "./types";

export type UpdateBrandKitInput = BrandKitUpdate & {
  organizationId: string;
};

export interface BrandKitPersistence {
  get(organizationId: string): Promise<OrganizationBrandKit | null>;
  saveAtomic(input: UpdateBrandKitInput): Promise<OrganizationBrandKit | null>;
}

export class BrandKitRepository {
  constructor(private readonly persistence: BrandKitPersistence) {}

  async get(organizationId: string): Promise<OrganizationBrandKit> {
    const kit = await this.persistence.get(organizationId);
    if (!kit) throw new AppError("NOT_FOUND", "Brand Kit is unavailable.");
    return kit;
  }

  async update(input: UpdateBrandKitInput): Promise<OrganizationBrandKit> {
    const updated = await this.persistence.saveAtomic(input);
    if (!updated) throw new AppError("CONFLICT", "Brand Kit changed before the update completed.");
    return updated;
  }
}

type BrandKitRow = {
  organization_id: string;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  typography_rules: string | null;
  brand_voice: string | null;
  logo_usage_rules: string | null;
  visual_constraints: string | null;
  revision: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type BrandAssetRow = {
  role: BrandAssetRole;
  media_asset_id: string;
  sort_order: number;
};

const BRAND_COLUMNS = [
  "organization_id",
  "primary_color",
  "secondary_color",
  "accent_color",
  "typography_rules",
  "brand_voice",
  "logo_usage_rules",
  "visual_constraints",
  "revision",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
].join(",");

function mapBrandKit(row: BrandKitRow, assets: BrandAssetRow[]): OrganizationBrandKit {
  const byRole = new Map<BrandAssetRole, string>();
  const approvedImageryAssetIds: string[] = [];
  for (const asset of assets) {
    if (asset.role === "APPROVED_IMAGERY") approvedImageryAssetIds.push(asset.media_asset_id);
    else byRole.set(asset.role, asset.media_asset_id);
  }
  return {
    organizationId: row.organization_id,
    ...(row.primary_color ? { primaryColor: row.primary_color } : {}),
    ...(row.secondary_color ? { secondaryColor: row.secondary_color } : {}),
    ...(row.accent_color ? { accentColor: row.accent_color } : {}),
    ...(row.typography_rules ? { typographyRules: row.typography_rules } : {}),
    ...(row.brand_voice ? { brandVoice: row.brand_voice } : {}),
    ...(row.logo_usage_rules ? { logoUsageRules: row.logo_usage_rules } : {}),
    ...(row.visual_constraints ? { visualConstraints: row.visual_constraints } : {}),
    ...(byRole.get("PRIMARY_LOGO") ? { primaryLogoAssetId: byRole.get("PRIMARY_LOGO") } : {}),
    ...(byRole.get("LIGHT_LOGO") ? { lightLogoAssetId: byRole.get("LIGHT_LOGO") } : {}),
    ...(byRole.get("DARK_LOGO") ? { darkLogoAssetId: byRole.get("DARK_LOGO") } : {}),
    ...(byRole.get("BRAND_MARK") ? { brandMarkAssetId: byRole.get("BRAND_MARK") } : {}),
    ...(byRole.get("FAVICON") ? { faviconAssetId: byRole.get("FAVICON") } : {}),
    approvedImageryAssetIds,
    revision: row.revision,
    ...(row.updated_by ? { updatedBy: row.updated_by } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class SupabaseBrandKitPersistence implements BrandKitPersistence {
  async get(organizationId: string): Promise<OrganizationBrandKit | null> {
    const supabase = await createServerSupabaseClient();
    const [kitResult, assetResult] = await Promise.all([
      supabase
        .from("organization_brand_kits")
        .select(BRAND_COLUMNS)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("brand_kit_media_assets")
        .select("role,media_asset_id,sort_order")
        .eq("organization_id", organizationId)
        .order("sort_order", { ascending: true })
        .order("media_asset_id", { ascending: true }),
    ]);
    if (kitResult.error || assetResult.error) {
      throw new AppError("INTERNAL_ERROR", "Unable to load Brand Kit.");
    }
    if (!kitResult.data) return null;
    return mapBrandKit(
      kitResult.data as unknown as BrandKitRow,
      (assetResult.data ?? []) as unknown as BrandAssetRow[],
    );
  }

  async saveAtomic(input: UpdateBrandKitInput): Promise<OrganizationBrandKit | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("save_organization_brand_kit", {
      _organization_id: input.organizationId,
      _expected_revision: input.expectedRevision,
      _primary_color: input.primaryColor ?? null,
      _secondary_color: input.secondaryColor ?? null,
      _accent_color: input.accentColor ?? null,
      _typography_rules: input.typographyRules ?? null,
      _brand_voice: input.brandVoice ?? null,
      _logo_usage_rules: input.logoUsageRules ?? null,
      _visual_constraints: input.visualConstraints ?? null,
      _primary_logo_asset_id: input.primaryLogoAssetId ?? null,
      _light_logo_asset_id: input.lightLogoAssetId ?? null,
      _dark_logo_asset_id: input.darkLogoAssetId ?? null,
      _brand_mark_asset_id: input.brandMarkAssetId ?? null,
      _favicon_asset_id: input.faviconAssetId ?? null,
      _approved_imagery_asset_ids: input.approvedImageryAssetIds,
    });
    if (error) throw new AppError("INTERNAL_ERROR", "Unable to save Brand Kit.");
    if (data === null) return null;
    if (typeof data !== "number") {
      throw new AppError("INTERNAL_ERROR", "Brand Kit save returned an invalid revision.");
    }
    return this.get(input.organizationId);
  }
}

export const brandKitRepository = new BrandKitRepository(new SupabaseBrandKitPersistence());
