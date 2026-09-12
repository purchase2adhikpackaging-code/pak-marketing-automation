export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import { SupabaseApprovalRepository } from "@/modules/approval/repository";
import { ApprovalCenterClient, type ApprovalCenterOrganization } from "./approval-center-client";

const REVIEW_ROLES: AppRole[] = ["OWNER", "ADMIN", "EDITOR", "REVIEWER"];

type MembershipRow = {
  organization_id: string;
  role: AppRole;
  organizations: { name: string | null } | { name: string | null }[] | null;
};

function organizationName(row: MembershipRow): string {
  const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  return organization?.name?.trim() || "PAK Organization";
}

export default async function ApprovalCenterPage() {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  let organizations: ApprovalCenterOrganization[] = [];

  if (authData.user) {
    const { data } = await supabase
      .from("organization_memberships")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", authData.user.id);

    const memberships = ((data ?? []) as MembershipRow[]).filter((row) => REVIEW_ROLES.includes(row.role));
    const repository = new SupabaseApprovalRepository();
    organizations = await Promise.all(memberships.map(async (membership) => ({
      id: membership.organization_id,
      label: organizationName(membership),
      role: membership.role,
      initialPage: await repository.list({ organizationId: membership.organization_id, status: "PENDING", limit: 50 }),
      sceneReviewRequired: await repository.countScenePlanReviewRequired(membership.organization_id),
    })));
  }

  return (
    <section className="max-w-7xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Approval Center</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
        Review exact content revisions and media checksums with an immutable decision history. Scene Planning review remains a separate domain-authoritative workflow.
      </p>
      <ApprovalCenterClient organizations={organizations} />
    </section>
  );
}
