import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import type { IntegrationConnectionStatus } from "@/modules/integrations/types";

export type DashboardOrganizationSummary = {
  organizationId: string;
  organizationName: string;
  role: AppRole;
  generatedContentCount: number;
  failedContentCount: number;
  activeKnowledgeCount: number;
  draftKnowledgeCount: number;
  openAiStatus: IntegrationConnectionStatus;
  lastContentUpdatedAt?: string;
};

export type DashboardWorkspace = {
  organizationLabel: string;
  role: AppRole;
  content: { total: number; generated: number; failed: number };
  knowledge: { total: number; active: number; draft: number };
  openAI: { status: IntegrationConnectionStatus; lastVerifiedAt?: string };
  lastContentUpdatedAt?: string;
};

type MembershipRow = {
  organization_id: string;
  role: AppRole;
  organizations:
    | { name: string | null }
    | { name: string | null }[]
    | null;
};

type DashboardSummaryInput = Omit<DashboardOrganizationSummary, "openAiStatus"> & {
  openAiStatus?: IntegrationConnectionStatus;
};

function organizationName(row: MembershipRow): string {
  const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  return organization?.name?.trim() || "PAK Organization";
}

export function buildDashboardOrganizationSummary(input: DashboardSummaryInput): DashboardOrganizationSummary {
  return {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    role: input.role,
    generatedContentCount: input.generatedContentCount,
    failedContentCount: input.failedContentCount,
    activeKnowledgeCount: input.activeKnowledgeCount,
    draftKnowledgeCount: input.draftKnowledgeCount,
    openAiStatus: input.openAiStatus ?? "NOT_CONFIGURED",
    ...(input.lastContentUpdatedAt ? { lastContentUpdatedAt: input.lastContentUpdatedAt } : {}),
  };
}

function queryFailure(): AppError {
  return new AppError("INTERNAL_ERROR", "Unable to load dashboard workspace summary.");
}

export async function loadDashboardWorkspace(): Promise<DashboardWorkspace | null> {
  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw queryFailure();
  if (!membershipData) return null;

  const membership = membershipData as MembershipRow;
  const organizationId = membership.organization_id;

  const [
    contentTotal,
    contentGenerated,
    contentFailed,
    latestContent,
    knowledgeTotal,
    knowledgeActive,
    knowledgeDraft,
    openAI,
  ] = await Promise.all([
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "GENERATED"),
    supabase
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "FAILED"),
    supabase
      .from("content_items")
      .select("updated_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("knowledge_records").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase
      .from("knowledge_records")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "ACTIVE"),
    supabase
      .from("knowledge_records")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "DRAFT"),
    supabase
      .from("integration_connections")
      .select("status,last_verified_at")
      .eq("organization_id", organizationId)
      .eq("provider", "OPENAI")
      .maybeSingle(),
  ]);

  const queryError = [
    contentTotal,
    contentGenerated,
    contentFailed,
    latestContent,
    knowledgeTotal,
    knowledgeActive,
    knowledgeDraft,
    openAI,
  ]
    .map((result) => result.error)
    .find(Boolean);

  if (queryError) throw queryFailure();

  const summary = buildDashboardOrganizationSummary({
    organizationId,
    organizationName: organizationName(membership),
    role: membership.role,
    generatedContentCount: contentGenerated.count ?? 0,
    failedContentCount: contentFailed.count ?? 0,
    activeKnowledgeCount: knowledgeActive.count ?? 0,
    draftKnowledgeCount: knowledgeDraft.count ?? 0,
    ...(openAI.data ? { openAiStatus: openAI.data.status as IntegrationConnectionStatus } : {}),
    ...(latestContent.data?.updated_at ? { lastContentUpdatedAt: latestContent.data.updated_at } : {}),
  });

  return {
    organizationLabel: summary.organizationName,
    role: summary.role,
    content: {
      total: contentTotal.count ?? 0,
      generated: summary.generatedContentCount,
      failed: summary.failedContentCount,
    },
    knowledge: {
      total: knowledgeTotal.count ?? 0,
      active: summary.activeKnowledgeCount,
      draft: summary.draftKnowledgeCount,
    },
    openAI: openAI.data
      ? {
          status: summary.openAiStatus,
          ...(openAI.data.last_verified_at ? { lastVerifiedAt: openAI.data.last_verified_at } : {}),
        }
      : { status: "NOT_CONFIGURED" },
    ...(summary.lastContentUpdatedAt ? { lastContentUpdatedAt: summary.lastContentUpdatedAt } : {}),
  };
}
