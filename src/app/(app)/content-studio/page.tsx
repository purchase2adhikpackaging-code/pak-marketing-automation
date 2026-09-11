export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import { SupabaseKnowledgeRepository } from "@/modules/knowledge-base/repository";
import { ContentStudioForm } from "./content-studio-form";
import type { SelectableKnowledgeRecord } from "./knowledge-selector";

const GENERATION_ROLES: AppRole[] = ["OWNER", "ADMIN", "EDITOR"];

type MembershipRow = {
  organization_id: string;
  role: AppRole;
  organizations:
    | { name: string | null }
    | { name: string | null }[]
    | null;
};

type ContentStudioOrganization = {
  id: string;
  label: string;
  role: AppRole;
  knowledgeRecords: SelectableKnowledgeRecord[];
};

function organizationName(row: MembershipRow): string {
  const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  return organization?.name?.trim() || "PAK Organization";
}

export default async function ContentStudioPage() {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();

  let organizations: ContentStudioOrganization[] = [];

  if (authData.user) {
    const { data } = await supabase
      .from("organization_memberships")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", authData.user.id);

    const eligibleOrganizations = ((data ?? []) as MembershipRow[])
      .filter((membership) => GENERATION_ROLES.includes(membership.role))
      .map((membership) => ({
        id: membership.organization_id,
        label: organizationName(membership),
        role: membership.role,
      }));

    const knowledgeRepository = new SupabaseKnowledgeRepository();
    organizations = await Promise.all(
      eligibleOrganizations.map(async (organization) => {
        const records = await knowledgeRepository.listSelectable(organization.id);
        return {
          ...organization,
          knowledgeRecords: records.map((record) => ({
            id: record.id,
            title: record.title,
            sourceType: record.sourceType,
            ...(record.sourceLabel !== undefined ? { sourceLabel: record.sourceLabel } : {}),
            revision: record.revision,
          })),
        };
      }),
    );
  }

  return (
    <section className="max-w-7xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Content Studio</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
        Turn an approved topic and trusted Knowledge Base sources into a multilingual script draft. English, Polish, and Hindi are supported while source resolution, AI credentials, provenance, and authorization stay server-side.
      </p>

      <ContentStudioForm organizations={organizations} />
    </section>
  );
}
