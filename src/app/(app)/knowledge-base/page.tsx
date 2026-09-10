export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { can } from "@/modules/auth/authorization";
import type { AppRole } from "@/modules/auth/roles";
import { SupabaseKnowledgeRepository } from "@/modules/knowledge-base/repository";
import { KnowledgeBaseManager, type KnowledgeOrganizationWorkspace } from "./knowledge-base-manager";

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

export default async function KnowledgeBasePage() {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  let organizations: KnowledgeOrganizationWorkspace[] = [];

  if (authData.user) {
    const { data } = await supabase
      .from("organization_memberships")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", authData.user.id);

    const memberships = ((data ?? []) as MembershipRow[]).filter((membership) =>
      can(membership.role, "knowledge:view"),
    );

    const repository = new SupabaseKnowledgeRepository();
    organizations = await Promise.all(
      memberships.map(async (membership) => ({
        id: membership.organization_id,
        label: organizationName(membership),
        role: membership.role,
        records: can(membership.role, "knowledge:manage")
          ? await repository.listManageable(membership.organization_id)
          : await repository.listSelectable(membership.organization_id),
      })),
    );
  }

  return (
    <section className="max-w-7xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Knowledge Base</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
        Maintain approved PAK source material with provenance and revision control. ACTIVE records can be selected as trusted grounding for Content Studio generation.
      </p>

      <KnowledgeBaseManager organizations={organizations} />
    </section>
  );
}
