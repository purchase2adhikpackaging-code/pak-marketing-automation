import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import { ContentStudioForm } from "./content-studio-form";

const GENERATION_ROLES: AppRole[] = ["OWNER", "ADMIN", "EDITOR"];

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

export default async function ContentStudioPage() {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();

  let organizations: { id: string; label: string }[] = [];

  if (authData.user) {
    const { data } = await supabase
      .from("organization_memberships")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", authData.user.id);

    organizations = ((data ?? []) as MembershipRow[])
      .filter((membership) => GENERATION_ROLES.includes(membership.role))
      .map((membership) => ({
        id: membership.organization_id,
        label: organizationName(membership),
      }));
  }

  return (
    <section className="max-w-7xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Content Studio</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
        Turn an approved topic and factual knowledge context into a multilingual script draft. This first workflow supports English, Polish, and Hindi while keeping AI credentials and authorization server-side.
      </p>

      {organizations.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-amber-900/50 bg-amber-950/20 p-5 text-sm leading-6 text-amber-100">
          No organization with Content Studio generation permission is available for this account.
        </div>
      ) : null}

      <ContentStudioForm organizations={organizations} />
    </section>
  );
}
