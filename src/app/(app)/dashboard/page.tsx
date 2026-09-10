export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import type { IntegrationConnectionStatus } from "@/modules/integrations/types";
import { DashboardSummary, type DashboardWorkspace } from "./dashboard-summary";

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

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  let workspace: DashboardWorkspace | null = null;
  let error: string | undefined;

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      error = "Workspace summary is temporarily unavailable.";
    } else {
      const { data: membershipData, error: membershipError } = await supabase
        .from("organization_memberships")
        .select("organization_id, role, organizations(name)")
        .eq("user_id", authData.user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (membershipData) {
        const membership = membershipData as MembershipRow;
        const organizationId = membership.organization_id;

        const [contentTotal, contentGenerated, contentFailed, knowledgeTotal, knowledgeActive, openAI] =
          await Promise.all([
            supabase.from("content_items").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
            supabase.from("content_items").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "GENERATED"),
            supabase.from("content_items").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "FAILED"),
            supabase.from("knowledge_records").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
            supabase.from("knowledge_records").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "ACTIVE"),
            supabase
              .from("integration_connections")
              .select("status,last_verified_at")
              .eq("organization_id", organizationId)
              .eq("provider", "OPENAI")
              .maybeSingle(),
          ]);

        const queryError = [contentTotal, contentGenerated, contentFailed, knowledgeTotal, knowledgeActive, openAI]
          .map((result) => result.error)
          .find(Boolean);
        if (queryError) throw queryError;

        workspace = {
          organizationLabel: organizationName(membership),
          role: membership.role,
          content: {
            total: contentTotal.count ?? 0,
            generated: contentGenerated.count ?? 0,
            failed: contentFailed.count ?? 0,
          },
          knowledge: {
            total: knowledgeTotal.count ?? 0,
            active: knowledgeActive.count ?? 0,
          },
          openAI: openAI.data
            ? {
                status: openAI.data.status as IntegrationConnectionStatus,
                ...(openAI.data.last_verified_at ? { lastVerifiedAt: openAI.data.last_verified_at } : {}),
              }
            : { status: "NOT_CONFIGURED" },
        };
      }
    }
  } catch {
    error = "Workspace summary is temporarily unavailable.";
  }

  return (
    <section className="max-w-7xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Dashboard</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
        Operational status for the workflows that are implemented today: content generation, approved knowledge, and OpenAI integration readiness.
      </p>
      <DashboardSummary workspace={workspace} error={error} />
    </section>
  );
}
