"use server";

import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTextGenerationProvider } from "@/modules/ai/text/provider-factory";
import type { AppRole } from "@/modules/auth/roles";
import { generateScenePlan } from "@/modules/scene-planning/planner";
import { runScenePlanQc, type ScenePlanQcInput } from "@/modules/scene-planning/qc";
import { SupabaseScenePlanningRepository } from "@/modules/scene-planning/repository";
import { ScenePlanningService } from "@/modules/scene-planning/service";
import { computeSceneSourceIntegrityHash } from "@/modules/scene-planning/source-integrity";

const editRoles: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR"];
const approveRoles: readonly AppRole[] = ["OWNER", "ADMIN", "REVIEWER"];
const idPairSchema = z.object({ organizationId: z.string().uuid(), projectId: z.string().uuid() }).strict();
const planActionSchema = z.object({ organizationId: z.string().uuid(), planVersionId: z.string().uuid() }).strict();
const approveSchema = planActionSchema.extend({ acknowledgeWarnings: z.boolean() }).strict();

const briefSchema = z.object({
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  purpose: z.string().trim().max(4000),
  targetDurationSeconds: z.number().positive().max(3600),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]),
  qualityProfile: z.enum(["STANDARD", "PREMIUM", "CINEMATIC"]),
  targetPlatforms: z.array(z.string().trim().min(1)).max(20),
}).strict();

const visualBibleSchema = z.object({
  organizationId: z.string().uuid(),
  projectId: z.string().uuid(),
  characters: z.array(z.string().trim().min(1)).max(50),
  locations: z.array(z.string().trim().min(1)).max(50),
  globalNegativeConstraints: z.array(z.string().trim().min(1)).max(100),
  realismLevel: z.string().trim().max(2000),
  cinematographyLanguage: z.string().trim().max(4000),
  lightingLanguage: z.string().trim().max(4000),
}).strict();

type Actor = { id: string };

export type ScenePlanningGenerationContext = {
  organizationId: string;
  project: {
    id: string;
    sourceIntegrityHash: string;
    language: "EN" | "PL" | "HI";
    targetDurationSeconds: number;
    aspectRatio: string;
    qualityProfile: string;
    targetPlatforms: string[];
    productionConstraints: Record<string, unknown>;
  };
  source: {
    id: string;
    revision: number;
    scriptText: string;
    integrityHash: string;
  };
  visualBible: Record<string, unknown>;
};

export type GenerateActionDependencies = {
  getActor(): Promise<Actor | null>;
  authorize(actorId: string, organizationId: string): Promise<boolean>;
  loadGenerationContext(organizationId: string, projectId: string): Promise<ScenePlanningGenerationContext>;
  generatePlan(context: ScenePlanningGenerationContext): Promise<{ plan: unknown; provider: string; model: string }>;
  persistPlan(
    actorId: string,
    context: ScenePlanningGenerationContext,
    generated: { plan: unknown; provider: string; model: string },
  ): Promise<{ id: string }>;
  runAndPersistQc(
    planVersionId: string,
    context: ScenePlanningGenerationContext,
    plan: unknown,
  ): Promise<{ blockerCount: number; warningCount: number }>;
};

export async function executeGenerateScenePlanAction(
  input: unknown,
  dependencies: GenerateActionDependencies,
): Promise<
  | { ok: true; planVersionId: string; blockerCount: number; warningCount: number }
  | { ok: false; error: string }
> {
  const parsed = idPairSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the Scene Planning project and try again." };
  const actor = await dependencies.getActor();
  if (!actor) return { ok: false, error: "You must be signed in to generate a Scene Plan." };

  try {
    const authorized = await dependencies.authorize(actor.id, parsed.data.organizationId);
    if (!authorized) {
      return { ok: false, error: "You do not have permission to generate a Scene Plan for this organization." };
    }
    const context = await dependencies.loadGenerationContext(parsed.data.organizationId, parsed.data.projectId);
    if (context.source.integrityHash !== context.project.sourceIntegrityHash) {
      return { ok: false, error: "The source artifact changed. Create or refresh the Scene Planning project before generating." };
    }
    const generated = await dependencies.generatePlan(context);
    const persisted = await dependencies.persistPlan(actor.id, context, generated);
    const qc = await dependencies.runAndPersistQc(persisted.id, context, generated.plan);
    return { ok: true, planVersionId: persisted.id, ...qc };
  } catch {
    return { ok: false, error: "Scene Plan generation is temporarily unavailable." };
  }
}

export type ApproveActionDependencies = {
  getActor(): Promise<Actor | null>;
  authorize(actorId: string, organizationId: string): Promise<boolean>;
  countUnacknowledgedWarnings(organizationId: string, planVersionId: string): Promise<number>;
  acknowledgeWarnings(organizationId: string, planVersionId: string, actorId: string): Promise<void>;
  approvePlan(organizationId: string, planVersionId: string, actorId: string): Promise<unknown>;
};

export async function executeApproveScenePlanAction(
  input: unknown,
  dependencies: ApproveActionDependencies,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the approval request and try again." };
  const actor = await dependencies.getActor();
  if (!actor) return { ok: false, error: "You must be signed in to approve a Scene Plan." };
  try {
    const authorized = await dependencies.authorize(actor.id, parsed.data.organizationId);
    if (!authorized) {
      return { ok: false, error: "You do not have permission to approve a Scene Plan for this organization." };
    }
    const warningCount = await dependencies.countUnacknowledgedWarnings(parsed.data.organizationId, parsed.data.planVersionId);
    if (warningCount > 0 && !parsed.data.acknowledgeWarnings) {
      return { ok: false, error: "Acknowledge the outstanding QC warnings before approval." };
    }
    if (warningCount > 0) {
      await dependencies.acknowledgeWarnings(parsed.data.organizationId, parsed.data.planVersionId, actor.id);
    }
    await dependencies.approvePlan(parsed.data.organizationId, parsed.data.planVersionId, actor.id);
    return { ok: true };
  } catch {
    return { ok: false, error: "Scene Plan approval is temporarily unavailable." };
  }
}

async function getActor(): Promise<Actor | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

async function hasRole(organizationId: string, actorId: string, roles: readonly AppRole[]): Promise<boolean> {
  const repository = new SupabaseScenePlanningRepository();
  const role = await repository.getActorRole(organizationId, actorId);
  return role !== null && roles.includes(role);
}

async function requireEditor(organizationId: string, actorId: string): Promise<void> {
  if (!(await hasRole(organizationId, actorId, editRoles))) {
    throw new Error("Scene Planning edit permission required");
  }
}

async function loadGenerationContext(
  organizationId: string,
  projectId: string,
): Promise<ScenePlanningGenerationContext> {
  const supabase = await createServerSupabaseClient();
  const { data: project, error: projectError } = await supabase
    .from("video_projects")
    .select("id,source_artifact_id,source_integrity_hash,language,target_duration_seconds,aspect_ratio,quality_profile,target_platform,production_constraints")
    .eq("organization_id", organizationId)
    .eq("id", projectId)
    .maybeSingle();
  if (projectError || !project) throw new Error("Scene Planning project unavailable");

  const repository = new SupabaseScenePlanningRepository();
  const source = await repository.loadSourceArtifact(organizationId, project.source_artifact_id);
  if (!source?.scriptText || source.status !== "GENERATED") throw new Error("Scene Planning source unavailable");
  const integrityHash = computeSceneSourceIntegrityHash({ artifactId: source.id, revision: source.revision, scriptText: source.scriptText });

  const { data: visualBible } = await supabase
    .from("visual_bibles")
    .select("characters,wardrobe,locations,props,palette,lighting_language,realism_level,cinematography_language,logo_treatment,typography_treatment,cultural_constraints,forbidden_traits,global_negative_constraints")
    .eq("organization_id", organizationId)
    .eq("video_project_id", projectId)
    .eq("is_active", true)
    .maybeSingle();

  return {
    organizationId,
    project: {
      id: project.id,
      sourceIntegrityHash: project.source_integrity_hash,
      language: project.language as "EN" | "PL" | "HI",
      targetDurationSeconds: Number(project.target_duration_seconds),
      aspectRatio: project.aspect_ratio,
      qualityProfile: project.quality_profile,
      targetPlatforms: (project.target_platform ?? []) as string[],
      productionConstraints: (project.production_constraints ?? {}) as Record<string, unknown>,
    },
    source: { id: source.id, revision: source.revision, scriptText: source.scriptText, integrityHash },
    visualBible: visualBible ? {
      characters: visualBible.characters,
      wardrobe: visualBible.wardrobe,
      locations: visualBible.locations,
      props: visualBible.props,
      palette: visualBible.palette,
      lightingLanguage: visualBible.lighting_language,
      realismLevel: visualBible.realism_level,
      cinematographyLanguage: visualBible.cinematography_language,
      logoTreatment: visualBible.logo_treatment,
      typographyTreatment: visualBible.typography_treatment,
      culturalConstraints: visualBible.cultural_constraints,
      forbiddenTraits: visualBible.forbidden_traits,
      globalNegativeConstraints: visualBible.global_negative_constraints,
    } : {},
  };
}

function referenceIds(visualBible: Record<string, unknown>): string[] {
  const ids: string[] = [];
  for (const key of ["characters", "locations"] as const) {
    const entries = visualBible[key];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry && typeof entry === "object" && "id" in entry && typeof entry.id === "string") ids.push(entry.id);
    }
  }
  return ids;
}

async function persistQcResult(
  planVersionId: string,
  context: ScenePlanningGenerationContext,
  plan: unknown,
): Promise<{ blockerCount: number; warningCount: number }> {
  const parsedPlan = z.object({ scenes: z.array(z.any()) }).parse(plan);
  const qcInput: ScenePlanQcInput = {
    canonicalNarration: context.source.scriptText,
    currentSourceIntegrityHash: context.source.integrityHash,
    planSourceIntegrityHash: context.project.sourceIntegrityHash,
    targetDurationSeconds: context.project.targetDurationSeconds,
    expectedAspectRatio: context.project.aspectRatio,
    availableReferences: referenceIds(context.visualBible),
    scenes: parsedPlan.scenes as ScenePlanQcInput["scenes"],
  };
  const result = runScenePlanQc(qcInput);
  const blockerCount = result.findings.filter((finding) => finding.severity === "BLOCKER").length;
  const warningCount = result.findings.filter((finding) => finding.severity === "WARNING").length;
  const supabase = await createServerSupabaseClient();

  const { error: deleteError } = await supabase
    .from("scene_plan_qc_findings")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("scene_plan_version_id", planVersionId);
  if (deleteError) throw deleteError;

  if (result.findings.length > 0) {
    const { error: insertError } = await supabase.from("scene_plan_qc_findings").insert(
      result.findings.map((finding) => ({
        organization_id: context.organizationId,
        scene_plan_version_id: planVersionId,
        severity: finding.severity,
        code: finding.code,
        message: finding.message,
      })),
    );
    if (insertError) throw insertError;
  }

  const { error: updateError } = await supabase
    .from("scene_plan_versions")
    .update({
      status: blockerCount > 0 ? "QC_REQUIRED" : "REVIEW_REQUIRED",
      total_duration_seconds: result.totalDurationSeconds,
      narration_coverage_hash: `coverage:${result.narrationCoveragePercent}`,
      qc_summary: { blockerCount, warningCount, narrationCoveragePercent: result.narrationCoveragePercent },
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", context.organizationId)
    .eq("id", planVersionId);
  if (updateError) throw updateError;
  return { blockerCount, warningCount };
}

function service() {
  const repository = new SupabaseScenePlanningRepository();
  return new ScenePlanningService(repository, {
    now: () => new Date(),
    createId: () => crypto.randomUUID(),
    hashSource: async (source) => computeSceneSourceIntegrityHash(source),
  });
}

export async function generateScenePlanAction(input: unknown) {
  return executeGenerateScenePlanAction(input, {
    getActor,
    authorize: (actorId, organizationId) => hasRole(organizationId, actorId, editRoles),
    loadGenerationContext,
    async generatePlan(context) {
      const provider = createTextGenerationProvider({ organizationId: context.organizationId, model: "gpt-5.6-terra" });
      return generateScenePlan({
        provider,
        model: "gpt-5.6-terra",
        input: {
          canonicalNarration: context.source.scriptText,
          language: context.project.language,
          targetDurationSeconds: context.project.targetDurationSeconds,
          aspectRatio: context.project.aspectRatio,
          qualityProfile: context.project.qualityProfile,
          targetPlatforms: context.project.targetPlatforms,
          productionConstraints: Object.entries(context.project.productionConstraints).map(([key, value]) => `${key}: ${String(value)}`),
          visualBible: context.visualBible,
        },
      });
    },
    async persistPlan(actorId, context, generated) {
      return service().persistGeneratedPlan({
        organizationId: context.organizationId,
        actorUserId: actorId,
        videoProjectId: context.project.id,
        sourceIntegrityHash: context.project.sourceIntegrityHash,
        canonicalNarration: context.source.scriptText,
        language: context.project.language,
        aspectRatio: context.project.aspectRatio,
        plannerProvider: generated.provider,
        plannerModel: generated.model,
        creativeBriefSnapshot: {
          targetDurationSeconds: context.project.targetDurationSeconds,
          aspectRatio: context.project.aspectRatio,
          qualityProfile: context.project.qualityProfile,
          targetPlatforms: context.project.targetPlatforms,
        },
        visualBibleSnapshot: context.visualBible,
        plan: generated.plan,
      }) as Promise<{ id: string }>;
    },
    runAndPersistQc: persistQcResult,
  });
}

export async function saveScenePlanningBriefAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = briefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the production brief and try again." };
  const actor = await getActor();
  if (!actor) return { ok: false, error: "You must be signed in to edit Scene Planning." };
  try {
    await requireEditor(parsed.data.organizationId, actor.id);
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("video_projects").update({
      title: parsed.data.title,
      purpose: parsed.data.purpose,
      target_duration_seconds: parsed.data.targetDurationSeconds,
      aspect_ratio: parsed.data.aspectRatio,
      quality_profile: parsed.data.qualityProfile,
      target_platform: parsed.data.targetPlatforms,
      updated_at: new Date().toISOString(),
    }).eq("organization_id", parsed.data.organizationId).eq("id", parsed.data.projectId);
    if (error) throw error;
    const { error: staleError } = await supabase.from("scene_plan_versions").update({ status: "STALE", updated_at: new Date().toISOString() })
      .eq("organization_id", parsed.data.organizationId).eq("video_project_id", parsed.data.projectId)
      .in("status", ["APPROVED", "REVIEW_REQUIRED"]);
    if (staleError) throw staleError;
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to save the Scene Planning brief." };
  }
}

export async function saveVisualBibleAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = visualBibleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the Visual Bible and try again." };
  const actor = await getActor();
  if (!actor) return { ok: false, error: "You must be signed in to edit the Visual Bible." };
  try {
    await requireEditor(parsed.data.organizationId, actor.id);
    const supabase = await createServerSupabaseClient();
    const payload = {
      organization_id: parsed.data.organizationId,
      video_project_id: parsed.data.projectId,
      version_number: 1,
      is_active: true,
      characters: parsed.data.characters.map((description, index) => ({ id: `person:${index + 1}`, description })),
      locations: parsed.data.locations.map((description, index) => ({ id: `location:${index + 1}`, description })),
      global_negative_constraints: parsed.data.globalNegativeConstraints,
      realism_level: parsed.data.realismLevel,
      cinematography_language: parsed.data.cinematographyLanguage,
      lighting_language: parsed.data.lightingLanguage,
      created_by: actor.id,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("visual_bibles").upsert(payload, { onConflict: "video_project_id,version_number" });
    if (error) throw error;
    const { error: staleError } = await supabase.from("scene_plan_versions").update({ status: "STALE", updated_at: new Date().toISOString() })
      .eq("organization_id", parsed.data.organizationId).eq("video_project_id", parsed.data.projectId)
      .in("status", ["APPROVED", "REVIEW_REQUIRED"]);
    if (staleError) throw staleError;
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to save the Visual Bible." };
  }
}

async function loadPersistedPlanForQc(organizationId: string, planVersionId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: plan, error } = await supabase
    .from("scene_plan_versions")
    .select("id,video_project_id,source_integrity_hash,canonical_narration,language,aspect_ratio,visual_bible_snapshot")
    .eq("organization_id", organizationId).eq("id", planVersionId).maybeSingle();
  if (error || !plan) throw new Error("Plan unavailable");
  const context = await loadGenerationContext(organizationId, plan.video_project_id);
  const { data: scenes, error: sceneError } = await supabase
    .from("scene_plan_scenes")
    .select("id,ordinal,duration_seconds,creative_direction,scene_plan_shots(ordinal,duration_seconds,narration_start_char,narration_end_char,narration_text,creative_direction,master_visual_prompt,aspect_ratio,subject_refs,location_refs,camera_motion,generation_requirements)")
    .eq("organization_id", organizationId).eq("scene_plan_version_id", planVersionId).order("ordinal");
  if (sceneError) throw sceneError;
  return {
    context,
    scenes: (scenes ?? []).map((scene) => ({
      ordinal: scene.ordinal,
      durationSeconds: Number(scene.duration_seconds),
      creativeDirection: scene.creative_direction,
      shots: ((scene.scene_plan_shots ?? []) as Array<Record<string, unknown>>).map((shot) => ({
        ordinal: Number(shot.ordinal), durationSeconds: Number(shot.duration_seconds),
        narrationStartChar: shot.narration_start_char as number | null, narrationEndChar: shot.narration_end_char as number | null,
        narrationText: String(shot.narration_text ?? ""), creativeDirection: String(shot.creative_direction ?? ""),
        masterVisualPrompt: String(shot.master_visual_prompt ?? ""), aspectRatio: String(shot.aspect_ratio ?? ""),
        subjectRefs: (shot.subject_refs ?? []) as string[], locationRefs: (shot.location_refs ?? []) as string[],
        cameraMotion: String(shot.camera_motion ?? ""), generationRequirements: (shot.generation_requirements ?? {}) as Record<string, boolean>,
      })),
    })),
  };
}

export async function runScenePlanQcAction(input: unknown): Promise<{ ok: true; blockerCount: number; warningCount: number } | { ok: false; error: string }> {
  const parsed = planActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the QC request and try again." };
  const actor = await getActor();
  if (!actor) return { ok: false, error: "You must be signed in to run Scene Planning QC." };
  try {
    await requireEditor(parsed.data.organizationId, actor.id);
    const loaded = await loadPersistedPlanForQc(parsed.data.organizationId, parsed.data.planVersionId);
    const qc = await persistQcResult(parsed.data.planVersionId, loaded.context, { scenes: loaded.scenes });
    return { ok: true, ...qc };
  } catch {
    return { ok: false, error: "Scene Planning QC is temporarily unavailable." };
  }
}

export async function submitScenePlanForReviewAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = planActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the review request and try again." };
  const actor = await getActor();
  if (!actor) return { ok: false, error: "You must be signed in to submit a Scene Plan." };
  try {
    await service().submitForReview({ organizationId: parsed.data.organizationId, actorUserId: actor.id, planVersionId: parsed.data.planVersionId });
    return { ok: true };
  } catch {
    return { ok: false, error: "The Scene Plan cannot be submitted for review yet." };
  }
}

export async function cloneScenePlanForEditAction(input: unknown): Promise<{ ok: true; planVersionId: string } | { ok: false; error: string }> {
  const parsed = planActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the clone request and try again." };
  const actor = await getActor();
  if (!actor) return { ok: false, error: "You must be signed in to edit a Scene Plan." };
  try {
    const result = await service().cloneForEdit({ organizationId: parsed.data.organizationId, actorUserId: actor.id, planVersionId: parsed.data.planVersionId }) as { id: string };
    return { ok: true, planVersionId: result.id };
  } catch {
    return { ok: false, error: "Unable to create an editable Scene Plan version." };
  }
}

export async function approveScenePlanAction(input: unknown) {
  return executeApproveScenePlanAction(input, {
    getActor,
    authorize: (actorId, organizationId) => hasRole(organizationId, actorId, approveRoles),
    async countUnacknowledgedWarnings(organizationId, planVersionId) {
      const supabase = await createServerSupabaseClient();
      const { count, error } = await supabase.from("scene_plan_qc_findings").select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId).eq("scene_plan_version_id", planVersionId)
        .eq("severity", "WARNING").is("acknowledged_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    async acknowledgeWarnings(organizationId, planVersionId, actorId) {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.from("scene_plan_qc_findings").update({ acknowledged_by: actorId, acknowledged_at: new Date().toISOString() })
        .eq("organization_id", organizationId).eq("scene_plan_version_id", planVersionId)
        .eq("severity", "WARNING").is("acknowledged_at", null);
      if (error) throw error;
    },
    async approvePlan(organizationId, planVersionId, actorId) {
      return service().approvePlan({ organizationId, actorUserId: actorId, planVersionId });
    },
  });
}
