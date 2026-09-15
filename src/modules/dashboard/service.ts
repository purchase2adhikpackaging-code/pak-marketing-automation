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

export type DashboardNextAction = {
  label: string;
  href: string;
  reason: string;
};

export type DashboardWorkspace = {
  organizationId: string;
  organizationLabel: string;
  role: AppRole;
  identity: {
    profileRevision: number | null;
    brandKitRevision: number | null;
    activeCoreKnowledge: number;
  };
  content: { total: number; generated: number; failed: number };
  knowledge: { total: number; active: number; draft: number; coreActive: number };
  production: {
    projects: number;
    plansNeedingWork: number;
    approvedPlans: number;
    generation: { active: number; failed: number; completed: number };
    assembly: { active: number; failed: number; completed: number };
    actionableProjectId?: string;
  };
  media: { active: number; video: number; finalRenders: number };
  integrations: {
    openAI: { status: IntegrationConnectionStatus; lastVerifiedAt?: string };
    ltx: { status: IntegrationConnectionStatus; lastVerifiedAt?: string };
  };
  lastActivityAt?: string;
  nextAction: DashboardNextAction;
  /** Temporary compatibility for the pre-convergence Dashboard component; Task 3 removes this alias. */
  openAI: { status: IntegrationConnectionStatus; lastVerifiedAt?: string };
  /** Temporary compatibility for the pre-convergence Dashboard component; Task 3 removes this alias. */
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

type PlanRow = {
  id: string;
  video_project_id: string;
  version_number: number;
  status: string;
  updated_at: string;
};

type IntegrationRow = {
  provider: "OPENAI" | "LTX";
  status: IntegrationConnectionStatus;
  last_verified_at: string | null;
};

type ActiveProductionRow = {
  plan_version_id: string;
  updated_at: string;
};

const GENERATION_ACTIVE_STATES = [
  "QUEUED",
  "SUBMITTING",
  "SUBMITTED",
  "PROCESSING",
  "IMPORT_PENDING",
  "SUBMISSION_UNKNOWN",
] as const;

const ASSEMBLY_ACTIVE_STATES = ["QUEUED", "PROCESSING"] as const;
const PLAN_NEEDS_WORK_STATES = new Set([
  "DRAFT",
  "PLANNING",
  "QC_REQUIRED",
  "REVIEW_REQUIRED",
  "FAILED",
  "STALE",
]);

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

function scenePlanningHref(actionableProjectId?: string): string {
  return actionableProjectId
    ? `/scene-planning?project=${encodeURIComponent(actionableProjectId)}`
    : "/scene-planning";
}

export function resolveDashboardNextAction(input: {
  profileRevision: number | null;
  brandKitRevision: number | null;
  knowledgeDrafts: number;
  generatedContent: number;
  projects: number;
  plansNeedingWork: number;
  activeGeneration: number;
  assemblyActive: number;
  completedAssemblies: number;
  actionableProjectId?: string;
}): DashboardNextAction {
  if (input.profileRevision === null || input.brandKitRevision === null) {
    return {
      label: "Complete institutional setup",
      href: "/settings",
      reason: "Organization Profile and Brand Kit must be configured before production context is complete.",
    };
  }
  if (input.knowledgeDrafts > 0) {
    return {
      label: "Review Knowledge drafts",
      href: "/knowledge-base",
      reason: "Draft Knowledge requires human review before it can become trusted generation context.",
    };
  }
  if (input.generatedContent === 0) {
    return {
      label: "Create content",
      href: "/content-studio",
      reason: "No generated canonical content is available for downstream production yet.",
    };
  }
  if (input.projects === 0) {
    return {
      label: "Create a Scene Plan",
      href: "/content-studio",
      reason: "Generated content is available, but no Scene Planning project exists yet.",
    };
  }
  if (input.plansNeedingWork > 0) {
    return {
      label: "Continue Scene Planning",
      href: scenePlanningHref(input.actionableProjectId),
      reason: "A current Scene Plan still needs planning, quality review, approval, or refresh work.",
    };
  }
  if (input.activeGeneration > 0) {
    return {
      label: "Review generation progress",
      href: scenePlanningHref(input.actionableProjectId),
      reason: "Approved shots currently have video generation work in progress.",
    };
  }
  if (input.assemblyActive > 0) {
    return {
      label: "Continue final assembly",
      href: scenePlanningHref(input.actionableProjectId),
      reason: "A final assembly is queued or processing for a current production plan.",
    };
  }
  if (input.completedAssemblies > 0) {
    return {
      label: "Open completed media",
      href: "/media-library",
      reason: "A completed final render is available in the PAK-owned Media Library.",
    };
  }
  return {
    label: "Create or continue content",
    href: "/content-studio",
    reason: "Production prerequisites are ready. Continue with an implemented workflow.",
  };
}

function queryFailure(): AppError {
  return new AppError("INTERNAL_ERROR", "Unable to load dashboard workspace summary.");
}

function currentPlanRows(rows: PlanRow[]): PlanRow[] {
  const latestByProject = new Map<string, PlanRow>();
  for (const row of rows) {
    const current = latestByProject.get(row.video_project_id);
    if (!current || row.version_number > current.version_number) latestByProject.set(row.video_project_id, row);
  }
  return [...latestByProject.values()];
}

function safeIntegration(rows: IntegrationRow[], provider: IntegrationRow["provider"]): {
  status: IntegrationConnectionStatus;
  lastVerifiedAt?: string;
} {
  const row = rows.find((candidate) => candidate.provider === provider);
  if (!row) return { status: "NOT_CONFIGURED" };
  return {
    status: row.status,
    ...(row.last_verified_at ? { lastVerifiedAt: row.last_verified_at } : {}),
  };
}

function latestTimestamp(values: Array<string | null | undefined>): string | undefined {
  const timestamps = values.filter((value): value is string => Boolean(value));
  if (timestamps.length === 0) return undefined;
  return timestamps.reduce((latest, value) => (Date.parse(value) > Date.parse(latest) ? value : latest));
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
    knowledgeCoreActive,
    profile,
    brandKit,
    projectsTotal,
    latestProject,
    plans,
    generationActive,
    generationFailed,
    generationCompleted,
    latestGeneration,
    latestActiveGeneration,
    assemblyActive,
    assemblyFailed,
    assemblyCompleted,
    finalRenders,
    latestAssembly,
    latestActiveAssembly,
    mediaActive,
    mediaVideo,
    latestMedia,
    integrations,
  ] = await Promise.all([
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "GENERATED"),
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "FAILED"),
    supabase.from("content_items").select("updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("knowledge_records").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("knowledge_records").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "ACTIVE"),
    supabase.from("knowledge_records").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "DRAFT"),
    supabase.from("knowledge_records").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "ACTIVE").eq("is_core", true),
    supabase.from("organization_profiles").select("revision,updated_at").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("organization_brand_kits").select("revision,updated_at").eq("organization_id", organizationId).maybeSingle(),
    supabase.from("video_projects").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).neq("status", "ARCHIVED"),
    supabase.from("video_projects").select("id,updated_at").eq("organization_id", organizationId).neq("status", "ARCHIVED").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("scene_plan_versions").select("id,video_project_id,version_number,status,updated_at").eq("organization_id", organizationId),
    supabase.from("video_generation_attempts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("state", [...GENERATION_ACTIVE_STATES]),
    supabase.from("video_generation_attempts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("state", "FAILED"),
    supabase.from("video_generation_attempts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("state", "COMPLETED"),
    supabase.from("video_generation_attempts").select("updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("video_generation_attempts").select("plan_version_id,updated_at").eq("organization_id", organizationId).in("state", [...GENERATION_ACTIVE_STATES]).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("video_assemblies").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("state", [...ASSEMBLY_ACTIVE_STATES]),
    supabase.from("video_assemblies").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("state", "FAILED"),
    supabase.from("video_assemblies").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("state", "COMPLETED"),
    supabase.from("video_assemblies").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("state", "COMPLETED").not("final_media_asset_id", "is", null),
    supabase.from("video_assemblies").select("updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("video_assemblies").select("plan_version_id,updated_at").eq("organization_id", organizationId).in("state", [...ASSEMBLY_ACTIVE_STATES]).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("media_assets").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "ACTIVE"),
    supabase.from("media_assets").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "ACTIVE").eq("asset_type", "VIDEO"),
    supabase.from("media_assets").select("updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("integration_connections").select("provider,status,last_verified_at").eq("organization_id", organizationId).in("provider", ["OPENAI", "LTX"]),
  ]);

  const results = [
    contentTotal, contentGenerated, contentFailed, latestContent,
    knowledgeTotal, knowledgeActive, knowledgeDraft, knowledgeCoreActive,
    profile, brandKit, projectsTotal, latestProject, plans,
    generationActive, generationFailed, generationCompleted, latestGeneration, latestActiveGeneration,
    assemblyActive, assemblyFailed, assemblyCompleted, finalRenders, latestAssembly, latestActiveAssembly,
    mediaActive, mediaVideo, latestMedia, integrations,
  ];
  if (results.some((result) => result.error)) throw queryFailure();

  const planRows = (plans.data ?? []) as PlanRow[];
  const currentPlans = currentPlanRows(planRows);
  const plansNeedingWorkRows = currentPlans
    .filter((row) => PLAN_NEEDS_WORK_STATES.has(row.status))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const plansNeedingWork = plansNeedingWorkRows.length;
  const approvedPlans = currentPlans.filter((row) => row.status === "APPROVED").length;
  const projectByPlanId = new Map(planRows.map((row) => [row.id, row.video_project_id]));
  const generationProjectId = latestActiveGeneration.data
    ? projectByPlanId.get((latestActiveGeneration.data as ActiveProductionRow).plan_version_id)
    : undefined;
  const assemblyProjectId = latestActiveAssembly.data
    ? projectByPlanId.get((latestActiveAssembly.data as ActiveProductionRow).plan_version_id)
    : undefined;
  const actionableProjectId = plansNeedingWorkRows[0]?.video_project_id
    ?? ((generationActive.count ?? 0) > 0 ? generationProjectId : undefined)
    ?? ((assemblyActive.count ?? 0) > 0 ? assemblyProjectId : undefined);

  const profileRevision = typeof profile.data?.revision === "number" ? profile.data.revision : null;
  const brandKitRevision = typeof brandKit.data?.revision === "number" ? brandKit.data.revision : null;
  const integrationRows = (integrations.data ?? []) as IntegrationRow[];
  const openAI = safeIntegration(integrationRows, "OPENAI");

  const summary = buildDashboardOrganizationSummary({
    organizationId,
    organizationName: organizationName(membership),
    role: membership.role,
    generatedContentCount: contentGenerated.count ?? 0,
    failedContentCount: contentFailed.count ?? 0,
    activeKnowledgeCount: knowledgeActive.count ?? 0,
    draftKnowledgeCount: knowledgeDraft.count ?? 0,
    openAiStatus: openAI.status,
    ...(latestContent.data?.updated_at ? { lastContentUpdatedAt: latestContent.data.updated_at } : {}),
  });

  const lastActivityAt = latestTimestamp([
    latestContent.data?.updated_at,
    profile.data?.updated_at,
    brandKit.data?.updated_at,
    latestProject.data?.updated_at,
    latestGeneration.data?.updated_at,
    latestAssembly.data?.updated_at,
    latestMedia.data?.updated_at,
  ]);

  const nextAction = resolveDashboardNextAction({
    profileRevision,
    brandKitRevision,
    knowledgeDrafts: knowledgeDraft.count ?? 0,
    generatedContent: contentGenerated.count ?? 0,
    projects: projectsTotal.count ?? 0,
    plansNeedingWork,
    activeGeneration: generationActive.count ?? 0,
    assemblyActive: assemblyActive.count ?? 0,
    completedAssemblies: assemblyCompleted.count ?? 0,
    ...(actionableProjectId ? { actionableProjectId } : {}),
  });

  return {
    organizationId,
    organizationLabel: summary.organizationName,
    role: summary.role,
    identity: {
      profileRevision,
      brandKitRevision,
      activeCoreKnowledge: knowledgeCoreActive.count ?? 0,
    },
    content: {
      total: contentTotal.count ?? 0,
      generated: summary.generatedContentCount,
      failed: summary.failedContentCount,
    },
    knowledge: {
      total: knowledgeTotal.count ?? 0,
      active: summary.activeKnowledgeCount,
      draft: summary.draftKnowledgeCount,
      coreActive: knowledgeCoreActive.count ?? 0,
    },
    production: {
      projects: projectsTotal.count ?? 0,
      plansNeedingWork,
      approvedPlans,
      generation: {
        active: generationActive.count ?? 0,
        failed: generationFailed.count ?? 0,
        completed: generationCompleted.count ?? 0,
      },
      assembly: {
        active: assemblyActive.count ?? 0,
        failed: assemblyFailed.count ?? 0,
        completed: assemblyCompleted.count ?? 0,
      },
      ...(actionableProjectId ? { actionableProjectId } : {}),
    },
    media: {
      active: mediaActive.count ?? 0,
      video: mediaVideo.count ?? 0,
      finalRenders: finalRenders.count ?? 0,
    },
    integrations: {
      openAI,
      ltx: safeIntegration(integrationRows, "LTX"),
    },
    ...(lastActivityAt ? { lastActivityAt } : {}),
    nextAction,
    openAI,
    ...(summary.lastContentUpdatedAt ? { lastContentUpdatedAt: summary.lastContentUpdatedAt } : {}),
  };
}
