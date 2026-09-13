export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getE2EFixtureRole } from "@/modules/auth/e2e-fixture-server";
import type { AppRole } from "@/modules/auth/roles";
import { organizationProfileRepository } from "@/modules/organization-profile/repository";
import {
  E2E_FIXTURE_ORGANIZATION_ID,
  E2E_FIXTURE_ORGANIZATION_LABEL,
  E2E_FIXTURE_PROFILE,
} from "@/modules/testing/e2e-organization-fixtures";
import { OrganizationProfileClient, type OrganizationProfileWorkspace } from "./profile-client";

type MembershipRow = {
  organization_id: string;
  role: AppRole;
  organizations: { name: string | null } | { name: string | null }[] | null;
};

function organizationName(row: MembershipRow): string {
  const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  return organization?.name?.trim() || "PAK Organization";
}

export default async function OrganizationProfilePage() {
  const fixtureRole = await getE2EFixtureRole();
  let organizations: OrganizationProfileWorkspace[] = fixtureRole
    ? [{
        id: E2E_FIXTURE_ORGANIZATION_ID,
        label: E2E_FIXTURE_ORGANIZATION_LABEL,
        role: fixtureRole,
        profile: E2E_FIXTURE_PROFILE,
      }]
    : [];

  if (!fixtureRole) {
    const supabase = await createServerSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      const { data } = await supabase
        .from("organization_memberships")
        .select("organization_id, role, organizations(name)")
        .eq("user_id", authData.user.id);

      organizations = await Promise.all(
        ((data ?? []) as MembershipRow[]).map(async (membership) => ({
          id: membership.organization_id,
          label: organizationName(membership),
          role: membership.role,
          profile: await organizationProfileRepository.get(membership.organization_id),
        })),
      );
    }
  }

  return (
    <section className="max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Settings · Institutional identity</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Organization Profile</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
        Maintain the authoritative PAK identity and contact information automatically applied to generation workflows.
      </p>
      <OrganizationProfileClient organizations={organizations} />
    </section>
  );
}
