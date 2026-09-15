export const dynamic = "force-dynamic";

import Link from "next/link";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import { brandKitRepository } from "@/modules/brand-kit/repository";
import { SupabaseIntegrationMetadataStore } from "@/modules/integrations/repository";
import type {
  IntegrationConnectionStatus,
  SafeIntegrationConnection,
} from "@/modules/integrations/types";
import { organizationProfileRepository } from "@/modules/organization-profile/repository";
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

type SettingsReadinessSummary = {
  id: string;
  label: string;
  profileRevision: number | null;
  brandRevision: number | null;
  openAiStatus: IntegrationConnectionStatus;
  ltxStatus: IntegrationConnectionStatus;
};

function organizationName(row: MembershipRow): string {
  const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  return organization?.name?.trim() || "PAK Organization";
}

function safeConnection(connection: Awaited<ReturnType<SupabaseIntegrationMetadataStore["listConnections"]>>[number]): SafeIntegrationConnection {
  const { createdBy: _createdBy, updatedBy: _updatedBy, ...safe } = connection;
  return safe;
}

async function optionalRevision(load: () => Promise<{ revision: number }>): Promise<number | null> {
  try {
    return (await load()).revision;
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

function providerStatus(
  connections: SafeIntegrationConnection[],
  provider: "OPENAI" | "LTX",
): IntegrationConnectionStatus {
  return connections.find((connection) => connection.provider === provider)?.status ?? "NOT_CONFIGURED";
}

function readinessLabel(status: IntegrationConnectionStatus): string {
  return status === "NOT_CONFIGURED" ? "Not configured" : status;
}

function revisionLabel(revision: number | null): string {
  return revision === null ? "Not configured" : `Configured · Revision ${revision}`;
}

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  let organizations: IntegrationOrganizationWorkspace[] = [];
  let readinessSummaries: SettingsReadinessSummary[] = [];

  if (authData.user) {
    const { data } = await supabase
      .from("organization_memberships")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", authData.user.id);

    const memberships = (data ?? []) as MembershipRow[];
    const repository = new SupabaseIntegrationMetadataStore();

    const workspaceResults = await Promise.all(
      memberships.map(async (membership) => {
        const organizationId = membership.organization_id;
        const [connections, profileRevision, brandRevision] = await Promise.all([
          repository.listConnections(organizationId),
          optionalRevision(() => organizationProfileRepository.get(organizationId)),
          optionalRevision(() => brandKitRepository.get(organizationId)),
        ]);
        const safeConnections = connections.map(safeConnection);
        const label = organizationName(membership);

        return {
          workspace: {
            id: organizationId,
            label,
            role: membership.role,
            connections: safeConnections,
          } satisfies IntegrationOrganizationWorkspace,
          summary: {
            id: organizationId,
            label,
            profileRevision,
            brandRevision,
            openAiStatus: providerStatus(safeConnections, "OPENAI"),
            ltxStatus: providerStatus(safeConnections, "LTX"),
          } satisfies SettingsReadinessSummary,
        };
      }),
    );

    organizations = workspaceResults.map((result) => result.workspace);
    readinessSummaries = workspaceResults.map((result) => result.summary);
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

      {readinessSummaries.length > 0 ? (
        <div className="mt-8 space-y-4">
          <div className="border-b border-slate-800 pb-3 text-sm font-semibold text-white">Institutional readiness</div>
          {readinessSummaries.map((summary) => (
            <section
              key={summary.id}
              aria-label={`${summary.label} settings summary`}
              className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-white">{summary.label}</h3>
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Authoritative state</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <p className="text-sm font-medium text-slate-200">Organization Profile</p>
                  <p className="mt-2 text-xs text-slate-400">{revisionLabel(summary.profileRevision)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <p className="text-sm font-medium text-slate-200">Brand Kit</p>
                  <p className="mt-2 text-xs text-slate-400">{revisionLabel(summary.brandRevision)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <p className="text-sm font-medium text-slate-200">OpenAI</p>
                  <p className="mt-2 text-xs text-slate-400">{readinessLabel(summary.openAiStatus)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <p className="text-sm font-medium text-slate-200">LTX</p>
                  <p className="mt-2 text-xs text-slate-400">{readinessLabel(summary.ltxStatus)}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <p className="text-sm font-medium text-slate-200">Meta</p>
                  <p className="mt-2 text-xs text-slate-400">Planned · Phase 10</p>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : null}

      <div className="mt-8 border-b border-slate-800 pb-3 text-sm font-semibold text-white">Integrations</div>
      <IntegrationsManager organizations={organizations} />
    </section>
  );
}
