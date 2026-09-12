export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import { SupabaseMediaRepository } from "@/modules/media/repository";
import { MediaLibraryClient, type MediaOrganizationWorkspace } from "./media-library-client";

type MembershipRow = {
  organization_id: string;
  role: AppRole;
  organizations:
    | { name: string | null }
    | { name: string | null }[]
    | null;
};

function organizationName(row: MembershipRow): string {
  const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  return organization?.name?.trim() || "PAK Organization";
}

export default async function MediaLibraryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  let organizations: MediaOrganizationWorkspace[] = [];

  if (authData.user) {
    const { data } = await supabase
      .from("organization_memberships")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", authData.user.id);

    const repository = new SupabaseMediaRepository();
    organizations = await Promise.all(
      ((data ?? []) as MembershipRow[]).map(async (membership) => ({
        id: membership.organization_id,
        label: organizationName(membership),
        role: membership.role,
        initialPage: await repository.list({
          organizationId: membership.organization_id,
          status: "ACTIVE",
          limit: 24,
        }),
      })),
    );
  }

  return (
    <section className="max-w-7xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Media Library</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
        Browse PAK-owned generated and uploaded media, inspect lineage, create short-lived private previews, and manage reusable assets without exposing storage credentials.
      </p>

      <MediaLibraryClient organizations={organizations} />
    </section>
  );
}
