export const dynamic = "force-dynamic";

import Link from "next/link";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import { SupabaseIntegrationMetadataStore } from "@/modules/integrations/repository";
import type { SafeIntegrationConnection } from "@/modules/integrations/types";
import {
  IntegrationsManager,
  type IntegrationOrganizationWorkspace,
} from "./integrations/integrations-manager";

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

function safeConnection(connection: Awaited<ReturnType<SupabaseIntegrationMetadataStore["listConnections"]>>[number]): SafeIntegrationConnection {
  const { createdBy: _createdBy, updatedBy: _updatedBy, ...safe } = connection;
  return safe;
}

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  let organizations: IntegrationOrganizationWorkspace[] = [];

  if (authData.user) {
    const { data } = await supabase
      .from("organization_memberships")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", authData.user.id);

    const memberships = (data ?? []) as MembershipRow[];
    const repository = new SupabaseIntegrationMetadataStore();

    organizations = await Promise.all(
      memberships.map(async (membership) => ({
        id: membership.organization_id,
        label: organizationName(membership),
        role: membership.role,
        connections: (await repository.listConnections(membership.organization_id)).map(safeConnection),
      })),
    );
  }

  return (
    <section className="max-w-7xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Settings</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
        Manage authoritative institutional identity, official brand rules and organization-scoped provider connections.
      </p>

      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <Link href="/settings/organization-profile" className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition hover:border-slate-600">
          <h3 className="font-semibold text-white">Organization Profile</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">Official institute name, contacts, website, address, locale and institutional identifiers.</p>
        </Link>
        <Link href="/settings/brand-kit" className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition hover:border-slate-600">
          <h3 className="font-semibold text-white">Brand Kit</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">Official logos, approved imagery, colors, typography, voice and visual constraints.</p>
        </Link>
      </div>

      <div className="mt-8 border-b border-slate-800 pb-3 text-sm font-semibold text-white">Integrations</div>
      <IntegrationsManager organizations={organizations} />
    </section>
  );
}