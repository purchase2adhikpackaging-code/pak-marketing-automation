export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import { brandKitRepository } from "@/modules/brand-kit/repository";
import { SupabaseMediaRepository } from "@/modules/media/repository";
import { BrandKitClient, type BrandKitWorkspace } from "./brand-kit-client";

type MembershipRow = {
  organization_id: string;
  role: AppRole;
  organizations: { name: string | null } | { name: string | null }[] | null;
};

function organizationName(row: MembershipRow): string {
  const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  return organization?.name?.trim() || "PAK Organization";
}

export default async function BrandKitPage() {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  let organizations: BrandKitWorkspace[] = [];

  if (authData.user) {
    const { data } = await supabase
      .from("organization_memberships")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", authData.user.id);

    const mediaRepository = new SupabaseMediaRepository();
    organizations = await Promise.all(
      ((data ?? []) as MembershipRow[]).map(async (membership) => {
        const [brandKit, imagePage] = await Promise.all([
          brandKitRepository.get(membership.organization_id),
          mediaRepository.list({
            organizationId: membership.organization_id,
            assetType: "IMAGE",
            status: "ACTIVE",
            limit: 50,
          }),
        ]);

        return {
          id: membership.organization_id,
          label: organizationName(membership),
          role: membership.role,
          brandKit,
          imageAssets: imagePage.items.map((asset) => ({
            id: asset.id,
            displayName: asset.displayName,
            mimeType: asset.mimeType,
          })),
        };
      }),
    );
  }

  return (
    <section className="max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Settings · Institutional identity</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Brand Kit</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
        Assign official Media Library assets and maintain the colors, typography, voice and visual rules applied automatically to PAK generation workflows.
      </p>
      <BrandKitClient organizations={organizations} />
    </section>
  );
}