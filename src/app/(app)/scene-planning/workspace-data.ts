import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import type { ScenePlanStatus } from "@/modules/scene-planning/schema";
import { SupabaseScenePlanningRepository } from "@/modules/scene-planning/repository";
import type { ScenePlanningWorkspaceProps } from "./scene-planning-workspace";

type ProjectRow = {
  id: string;
  title: string;
  purpose: string;
  target_duration_seconds: number | string;
  aspect_ratio: "16:9" | "9:16" | "1:1" | "4:5";
  quality_profile: "STANDARD" | "PREMIUM" | "CINEMATIC";
  target_platform: string[] | null;
  language: "EN" | "PL" | "HI";
  source_integrity_hash: string;
};

type VisualBibleRow = {
  characters: unknown;
  locations: unknown;
  global_negative_constraints: unknown;
  realism_level: string | null;
  cinematography_language: string | null;
  lighting_language: string | null;
};

type PlanRow = {
  id: string;
  version_number: number;
  status: ScenePlanStatus;
  source_integrity_hash: string;
};

type FindingRow = {
  id: string;
  severity: "BLOCKER" | "WARNING" | "INFO";
  code: string;
  message: string;
  acknowledged_at: string | null;
};

type SceneRow = {
  id: string;
  ordinal: number;
  title: string;
  narrative_role: string;
  duration_seconds: number | string;
  creative_direction: string;
};

type ShotRow = {
  id: string;
  scene_id: string;
  ordinal: number;
  duration_seconds: number | string;
  narration_text: string;
  narration_start_char: number | null;
  narration_end_char: number | null;
  creative_direction: string;
  master_visual_prompt: string;
  camera_motion: string;
  human_modified: boolean;
};

type AssembleInput = {
  organizationId: string;
  actorRole: AppRole;
  project: ProjectRow;
  visualBible: VisualBibleRow | null;
  plan: PlanRow | null;
  currentSourceIntegrityHash: string | null;
  findings: FindingRow[];
  scenes: SceneRow[];
  shots: ShotRow[];
};

export function descriptionsFromJsonEntries(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string" && entry.trim()) return [entry.trim()];
    if (
      entry &&
      typeof entry === "object" &&
      "description" in entry &&
      typeof entry.description === "string" &&
      entry.description.trim()
    ) {
      return [entry.description.trim()];
    }
    return [];
  });
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

export function assembleScenePlanningWorkspace(input: AssembleInput): ScenePlanningWorkspaceProps {
  const findings = input.findings.map((finding) => ({
    id: finding.id,
    severity: finding.severity,
    code: finding.code,
    message: finding.message,
    acknowledged: finding.acknowledged_at !== null,
  }));

  const sortedScenes = [...input.scenes]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((scene) => ({
      id: scene.id,
      ordinal: scene.ordinal,
      title: scene.title,
      narrativeRole: scene.narrative_role,
      durationSeconds: Number(scene.duration_seconds),
      creativeDirection: scene.creative_direction,
      shots: input.shots
        .filter((shot) => shot.scene_id === scene.id)
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((shot) => ({
          id: shot.id,
          ordinal: shot.ordinal,
          durationSeconds: Number(shot.duration_seconds),
          narrationText: shot.narration_text,
          narrationStartChar: shot.narration_start_char,
          narrationEndChar: shot.narration_end_char,
          creativeDirection: shot.creative_direction,
          masterVisualPrompt: shot.master_visual_prompt,
          cameraMotion: shot.camera_motion,
          humanModified: shot.human_modified,
        })),
    }));

  const plan = input.plan
    ? {
        id: input.plan.id,
        versionNumber: input.plan.version_number,
        status: input.plan.status,
        sourceFresh:
          input.currentSourceIntegrityHash !== null &&
          input.currentSourceIntegrityHash === input.plan.source_integrity_hash,
        qcSummary: {
          blockerCount: findings.filter((finding) => finding.severity === "BLOCKER").length,
          warningCount: findings.filter((finding) => finding.severity === "WARNING").length,
          infoCount: findings.filter((finding) => finding.severity === "INFO").length,
        },
        findings,
        scenes: sortedScenes,
      }
    : undefined;

  return {
    organizationId: input.organizationId,
    actorRole: input.actorRole,
    project: {
      id: input.project.id,
      title: input.project.title,
      purpose: input.project.purpose,
      targetDurationSeconds: Number(input.project.target_duration_seconds),
      aspectRatio: input.project.aspect_ratio,
      qualityProfile: input.project.quality_profile,
      targetPlatforms: input.project.target_platform ?? [],
      language: input.project.language,
      sourceIntegrityHash: input.project.source_integrity_hash,
    },
    visualBible: {
      characters: descriptionsFromJsonEntries(input.visualBible?.characters),
      locations: descriptionsFromJsonEntries(input.visualBible?.locations),
      globalNegativeConstraints: stringList(input.visualBible?.global_negative_constraints),
      realismLevel: input.visualBible?.realism_level ?? "",
      cinematographyLanguage: input.visualBible?.cinematography_language ?? "",
      lightingLanguage: input.visualBible?.lighting_language ?? "",
    },
    ...(plan ? { plan } : {}),
  };
}

export async function loadScenePlanningWorkspaceData(
  projectId: string,
): Promise<ScenePlanningWorkspaceProps | null> {
  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id,role")
    .eq("user_id", authData.user.id);
  if (membershipError || !memberships?.length) return null;

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const { data: projectData, error: projectError } = await supabase
    .from("video_projects")
    .select("id,organization_id,title,purpose,target_duration_seconds,aspect_ratio,quality_profile,target_platform,language,source_integrity_hash")
    .in("organization_id", organizationIds)
    .eq("id", projectId)
    .maybeSingle();
  if (projectError || !projectData) return null;

  const membership = memberships.find((item) => item.organization_id === projectData.organization_id);
  if (!membership?.role) return null;
  const organizationId = projectData.organization_id as string;

  const [{ data: visualBibleData, error: visualBibleError }, { data: planData, error: planError }] = await Promise.all([
    supabase
      .from("visual_bibles")
      .select("characters,locations,global_negative_constraints,realism_level,cinematography_language,lighting_language")
      .eq("organization_id", organizationId)
      .eq("video_project_id", projectId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("scene_plan_versions")
      .select("id,version_number,status,source_integrity_hash")
      .eq("organization_id", organizationId)
      .eq("video_project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (visualBibleError || planError) return null;

  let currentSourceIntegrityHash: string | null = null;
  try {
    currentSourceIntegrityHash = await new SupabaseScenePlanningRepository().loadCurrentSourceIntegrityHash(
      organizationId,
      projectId,
    );
  } catch {
    currentSourceIntegrityHash = null;
  }

  let findings: FindingRow[] = [];
  let scenes: SceneRow[] = [];
  let shots: ShotRow[] = [];

  if (planData) {
    const [findingResult, sceneResult] = await Promise.all([
      supabase
        .from("scene_plan_qc_findings")
        .select("id,severity,code,message,acknowledged_at")
        .eq("organization_id", organizationId)
        .eq("scene_plan_version_id", planData.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("scene_plan_scenes")
        .select("id,ordinal,title,narrative_role,duration_seconds,creative_direction")
        .eq("organization_id", organizationId)
        .eq("scene_plan_version_id", planData.id)
        .order("ordinal", { ascending: true }),
    ]);
    if (findingResult.error || sceneResult.error) return null;
    findings = (findingResult.data ?? []) as FindingRow[];
    scenes = (sceneResult.data ?? []) as SceneRow[];

    const sceneIds = scenes.map((scene) => scene.id);
    if (sceneIds.length > 0) {
      const { data: shotData, error: shotError } = await supabase
        .from("scene_plan_shots")
        .select("id,scene_id,ordinal,duration_seconds,narration_text,narration_start_char,narration_end_char,creative_direction,master_visual_prompt,camera_motion,human_modified")
        .eq("organization_id", organizationId)
        .in("scene_id", sceneIds)
        .order("ordinal", { ascending: true });
      if (shotError) return null;
      shots = (shotData ?? []) as ShotRow[];
    }
  }

  return assembleScenePlanningWorkspace({
    organizationId,
    actorRole: membership.role as AppRole,
    project: {
      id: projectData.id,
      title: projectData.title,
      purpose: projectData.purpose,
      target_duration_seconds: projectData.target_duration_seconds,
      aspect_ratio: projectData.aspect_ratio as ProjectRow["aspect_ratio"],
      quality_profile: projectData.quality_profile as ProjectRow["quality_profile"],
      target_platform: (projectData.target_platform ?? []) as string[],
      language: projectData.language as ProjectRow["language"],
      source_integrity_hash: projectData.source_integrity_hash,
    },
    visualBible: visualBibleData
      ? {
          characters: visualBibleData.characters,
          locations: visualBibleData.locations,
          global_negative_constraints: visualBibleData.global_negative_constraints,
          realism_level: visualBibleData.realism_level,
          cinematography_language: visualBibleData.cinematography_language,
          lighting_language: visualBibleData.lighting_language,
        }
      : null,
    plan: planData
      ? {
          id: planData.id,
          version_number: planData.version_number,
          status: planData.status as ScenePlanStatus,
          source_integrity_hash: planData.source_integrity_hash,
        }
      : null,
    currentSourceIntegrityHash,
    findings,
    scenes,
    shots,
  });
}
