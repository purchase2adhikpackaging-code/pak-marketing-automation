"use server";

import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTextGenerationProvider } from "@/modules/ai/text/provider-factory";
import type { AppRole } from "@/modules/auth/roles";
import { generateScenePlan } from "@/modules/scene-planning/planner";
import { assertGranularReplanBoundary, type GranularReplanBoundary } from "@/modules/scene-planning/replan-boundary";
import { SupabaseScenePlanningRepository } from "@/modules/scene-planning/repository";
import { ScenePlanGenerationSchema, type ScenePlanGeneration } from "@/modules/scene-planning/schema";
import { ScenePlanningService } from "@/modules/scene-planning/service";
import { computeSceneSourceIntegrityHash } from "@/modules/scene-planning/source-integrity";
import { runScenePlanQcAction } from "./workflow-actions";

const EDIT_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR"];

const granularReplanSchema = z
  .object({
    organizationId: z.string().uuid(),
    planVersionId: z.string().uuid(),
    scope: z.enum(["SHOT", "SCENE"]),
    targetSceneOrdinal: z.number().int().positive(),
    targetShotOrdinal: z.number().int().positive().optional(),
    replaceHumanModifiedShots: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.scope === "SHOT" && value.targetShotOrdinal === undefined) {
      context.addIssue({
        code: "custom",
        path: ["targetShotOrdinal"],
        message: "Shot replans require a target shot ordinal",
      });
    }
  });

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

type GeneratedPlan = { plan: ScenePlanGeneration; provider: string; model: string };

export type GranularReplanDependencies = {
  getActor(): Promise<Actor | null>;
  authorize(actorId: string, organizationId: string): Promise<boolean>;
  loadReplanContext(
    organizationId: string,
    planVersionId: string,
  ): Promise<{ context: ScenePlanningGenerationContext; currentPlan: ScenePlanGeneration }>;
  generatePlan(
    context: ScenePlanningGenerationContext,
    currentPlan: ScenePlanGeneration,
    boundary: GranularReplanBoundary,
  ): Promise<GeneratedPlan>;
  validateBoundary(
    currentPlan: ScenePlanGeneration,
    nextPlan: ScenePlanGeneration,
    boundary: GranularReplanBoundary,
  ): void;
  persistPlan(
    actorId: string,
    context: ScenePlanningGenerationContext,
    generated: GeneratedPlan,
  ): Promise<{ id: string }>;
  runAndPersistQc(
    planVersionId: string,
    context: ScenePlanningGenerationContext,
    plan: ScenePlanGeneration,
  ): Promise<{ blockerCount: number; warningCount: number }>;
};

export async function executeGranularReplanAction(
  input: unknown,
  dependencies: GranularReplanDependencies,
): Promise<
  | { ok: true; planVersionId: string; blockerCount: number; warningCount: number }
  | { ok: false; error: string }
> {
  const parsed = granularReplanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the granular replan request and try again." };
  }

  const actor = await dependencies.getActor();
  if (!actor) return { ok: false, error: "You must be signed in to replan Scene Planning content." };

  const authorized = await dependencies.authorize(actor.id, parsed.data.organizationId);
  if (!authorized) {
    return { ok: false, error: "You do not have permission to replan Scene Planning content for this organization." };
  }

  try {
    const loaded = await dependencies.loadReplanContext(
      parsed.data.organizationId,
      parsed.data.planVersionId,
    );
    if (loaded.context.source.integrityHash !== loaded.context.project.sourceIntegrityHash) {
      return { ok: false, error: "The source artifact changed. Refresh Scene Planning before replanning." };
    }

    const boundary: GranularReplanBoundary = {
      scope: parsed.data.scope,
      targetSceneOrdinal: parsed.data.targetSceneOrdinal,
      ...(parsed.data.targetShotOrdinal !== undefined
        ? { targetShotOrdinal: parsed.data.targetShotOrdinal }
        : {}),
      preserveHumanModifiedShots: !parsed.data.replaceHumanModifiedShots,
    };

    const generated = await dependencies.generatePlan(loaded.context, loaded.currentPlan, boundary);
    dependencies.validateBoundary(loaded.currentPlan, generated.plan, boundary);
    const persisted = await dependencies.persistPlan(actor.id, loaded.context, generated);
    const qc = await dependencies.runAndPersistQc(persisted.id, loaded.context, generated.plan);
    return { ok: true, planVersionId: persisted.id, ...qc };
  } catch {
    return { ok: false, error: "Granular Scene Planning replan is temporarily unavailable." };
  }
}

async function getActor(): Promise<Actor | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

async function authorize(actorId: string, organizationId: string): Promise<boolean> {
  const role = await new SupabaseScenePlanningRepository().getActorRole(organizationId, actorId);
  return role !== null && EDIT_ROLES.includes(role);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function loadReplanContext(
  organizationId: string,
  planVersionId: string,
): Promise<{ context: ScenePlanningGenerationContext; currentPlan: ScenePlanGeneration }> {
  const supabase = await createServerSupabaseClient();
  const { data: planRow, error: planError } = await supabase
    .from("scene_plan_versions")
    .select("id,video_project_id,status")
    .eq("organization_id", organizationId)
    .eq("id", planVersionId)
    .maybeSingle();
  if (planError || !planRow) throw new Error("Scene Plan version unavailable");
  if (["APPROVED", "STALE", "SUPERSEDED"].includes(planRow.status)) {
    throw new Error("Scene Plan version is not editable");
  }

  const { data: project, error: projectError } = await supabase
    .from("video_projects")
    .select("id,source_artifact_id,source_integrity_hash,language,target_duration_seconds,aspect_ratio,quality_profile,target_platform,production_constraints")
    .eq("organization_id", organizationId)
    .eq("id", planRow.video_project_id)
    .maybeSingle();
  if (projectError || !project) throw new Error("Scene Planning project unavailable");

  const repository = new SupabaseScenePlanningRepository();
  const source = await repository.loadSourceArtifact(organizationId, project.source_artifact_id);
  if (!source?.scriptText || source.status !== "GENERATED") throw new Error("Scene Planning source unavailable");
  const integrityHash = computeSceneSourceIntegrityHash({
    artifactId: source.id,
    revision: source.revision,
    scriptText: source.scriptText,
  });

  const { data: visualBible, error: visualBibleError } = await supabase
    .from("visual_bibles")
    .select("characters,wardrobe,locations,props,palette,lighting_language,realism_level,cinematography_language,logo_treatment,typography_treatment,cultural_constraints,forbidden_traits,global_negative_constraints")
    .eq("organization_id", organizationId)
    .eq("video_project_id", project.id)
    .eq("is_active", true)
    .maybeSingle();
  if (visualBibleError) throw visualBibleError;

  const { data: sceneRows, error: sceneError } = await supabase
    .from("scene_plan_scenes")
    .select("id,ordinal,title,narrative_role,narration_text,narration_start_char,narration_end_char,narrative_objective,emotional_objective,duration_seconds,continuity_context,creative_direction")
    .eq("organization_id", organizationId)
    .eq("scene_plan_version_id", planVersionId)
    .order("ordinal", { ascending: true });
  if (sceneError || !sceneRows?.length) throw new Error("Scene Plan graph unavailable");

  const sceneIds = sceneRows.map((scene) => scene.id);
  const { data: shotRows, error: shotError } = await supabase
    .from("scene_plan_shots")
    .select("id,scene_id,ordinal,duration_seconds,narration_text,narration_start_char,narration_end_char,creative_direction,master_visual_prompt,negative_constraints,subject_refs,location_refs,composition,shot_size,camera_angle,lens_intent,camera_motion,subject_motion,environment_motion,depth_of_field_intent,lighting,mood,transition_in,transition_out,ambience_intent,sfx_intent,music_intent,aspect_ratio,continuity_state,generation_requirements,human_modified")
    .eq("organization_id", organizationId)
    .in("scene_id", sceneIds)
    .order("ordinal", { ascending: true });
  if (shotError) throw shotError;

  const currentPlan = ScenePlanGenerationSchema.parse({
    scenes: sceneRows.map((scene) => ({
      ordinal: scene.ordinal,
      title: scene.title,
      narrativeRole: scene.narrative_role,
      durationSeconds: Number(scene.duration_seconds),
      ...(scene.narration_text ? { narrationText: scene.narration_text } : {}),
      ...(scene.narration_start_char !== null ? { narrationStartChar: scene.narration_start_char } : {}),
      ...(scene.narration_end_char !== null ? { narrationEndChar: scene.narration_end_char } : {}),
      ...(scene.narrative_objective ? { narrativeObjective: scene.narrative_objective } : {}),
      ...(scene.emotional_objective ? { emotionalObjective: scene.emotional_objective } : {}),
      creativeDirection: scene.creative_direction,
      continuityContext: objectValue(scene.continuity_context),
      shots: (shotRows ?? [])
        .filter((shot) => shot.scene_id === scene.id)
        .map((shot) => ({
          ordinal: shot.ordinal,
          durationSeconds: Number(shot.duration_seconds),
          narrationStartChar: shot.narration_start_char,
          narrationEndChar: shot.narration_end_char,
          narrationText: shot.narration_text,
          creativeDirection: shot.creative_direction,
          masterVisualPrompt: shot.master_visual_prompt,
          negativeConstraints: stringArray(shot.negative_constraints),
          subjectRefs: stringArray(shot.subject_refs),
          locationRefs: stringArray(shot.location_refs),
          composition: shot.composition,
          shotSize: shot.shot_size,
          cameraAngle: shot.camera_angle,
          lensIntent: shot.lens_intent,
          cameraMotion: shot.camera_motion,
          subjectMotion: shot.subject_motion,
          environmentMotion: shot.environment_motion,
          depthOfFieldIntent: shot.depth_of_field_intent,
          lighting: shot.lighting,
          mood: shot.mood,
          transitionIn: shot.transition_in,
          transitionOut: shot.transition_out,
          ambienceIntent: shot.ambience_intent,
          sfxIntent: shot.sfx_intent,
          musicIntent: shot.music_intent,
          aspectRatio: shot.aspect_ratio,
          continuityState: objectValue(shot.continuity_state),
          generationRequirements: objectValue(shot.generation_requirements),
          ...(shot.human_modified ? { humanModified: true } : {}),
        })),
    })),
  });

  const context: ScenePlanningGenerationContext = {
    organizationId,
    project: {
      id: project.id,
      sourceIntegrityHash: project.source_integrity_hash,
      language: project.language as "EN" | "PL" | "HI",
      targetDurationSeconds: Number(project.target_duration_seconds),
      aspectRatio: project.aspect_ratio,
      qualityProfile: project.quality_profile,
      targetPlatforms: (project.target_platform ?? []) as string[],
      productionConstraints: objectValue(project.production_constraints),
    },
    source: {
      id: source.id,
      revision: source.revision,
      scriptText: source.scriptText,
      integrityHash,
    },
    visualBible: visualBible
      ? {
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
        }
      : {},
  };

  return { context, currentPlan };
}

function service() {
  return new ScenePlanningService(new SupabaseScenePlanningRepository(), {
    now: () => new Date(),
    createId: () => crypto.randomUUID(),
    hashSource: async (source) => computeSceneSourceIntegrityHash(source),
  });
}

export async function granularReplanScenePlanAction(input: unknown) {
  return executeGranularReplanAction(input, {
    getActor,
    authorize,
    loadReplanContext,
    async generatePlan(context, currentPlan, boundary) {
      const provider = createTextGenerationProvider({
        organizationId: context.organizationId,
        model: "gpt-5.6-terra",
      });
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
          productionConstraints: Object.entries(context.project.productionConstraints).map(
            ([key, value]) => `${key}: ${String(value)}`,
          ),
          visualBible: context.visualBible,
          replan: {
            scope: boundary.scope,
            targetSceneOrdinal: boundary.targetSceneOrdinal,
            ...(boundary.targetShotOrdinal !== undefined
              ? { targetShotOrdinal: boundary.targetShotOrdinal }
              : {}),
            preserveHumanModifiedShots: boundary.preserveHumanModifiedShots,
            currentPlanContext: currentPlan,
          },
        },
      });
    },
    validateBoundary: assertGranularReplanBoundary,
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
          replanScope: "GRANULAR",
        },
        visualBibleSnapshot: context.visualBible,
        plan: generated.plan,
      }) as Promise<{ id: string }>;
    },
    async runAndPersistQc(planVersionId, context) {
      const result = await runScenePlanQcAction({
        organizationId: context.organizationId,
        planVersionId,
      });
      if (!result.ok) throw new Error(result.error);
      return { blockerCount: result.blockerCount, warningCount: result.warningCount };
    },
  });
}
