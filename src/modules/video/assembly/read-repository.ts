import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseScenePlanningRepository } from "@/modules/scene-planning/repository";
import {
  computeFinalAssemblyReadiness,
  type AssemblyBlockReason,
  type FinalAssemblyShotReadiness,
} from "./readiness";
import type { VideoAssemblyState } from "./types";

export type FinalAssemblyReadModel = {
  ready: boolean;
  reasons: AssemblyBlockReason[];
  assembly?: {
    assemblyId: string;
    jobId: string;
    state: VideoAssemblyState;
    finalMediaAssetId?: string;
  };
};

type PlanRow = {
  id: string;
  video_project_id: string;
  status: string;
  source_integrity_hash: string;
};

type ProjectRow = { aspect_ratio: string };
type SceneRow = { id: string; ordinal: number };
type ShotRow = { id: string; scene_id: string; ordinal: number };
type AttemptRow = { shot_id: string; attempt_number: number; media_asset_id: string | null };
type MediaRow = { id: string; asset_type: string; status: string; checksum: string | null };
type AssemblyRow = {
  id: string;
  job_id: string;
  state: VideoAssemblyState;
  final_media_asset_id: string | null;
};

function internal(message: string): AppError {
  return new AppError("INTERNAL_ERROR", message);
}

export class SupabaseFinalAssemblyReadRepository {
  async load(organizationId: string, planVersionId: string): Promise<FinalAssemblyReadModel | null> {
    const supabase = await createServerSupabaseClient();
    const { data: planData, error: planError } = await supabase
      .from("scene_plan_versions")
      .select("id,video_project_id,status,source_integrity_hash")
      .eq("organization_id", organizationId)
      .eq("id", planVersionId)
      .maybeSingle();
    if (planError) throw internal("Unable to load final render readiness.");
    if (!planData) return null;
    const plan = planData as PlanRow;

    const [projectResult, blockerResult, sceneResult, assemblyResult] = await Promise.all([
      supabase
        .from("video_projects")
        .select("aspect_ratio")
        .eq("organization_id", organizationId)
        .eq("id", plan.video_project_id)
        .maybeSingle(),
      supabase
        .from("scene_plan_qc_findings")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("scene_plan_version_id", planVersionId)
        .eq("severity", "BLOCKER")
        .limit(1),
      supabase
        .from("scene_plan_scenes")
        .select("id,ordinal")
        .eq("organization_id", organizationId)
        .eq("scene_plan_version_id", planVersionId)
        .order("ordinal", { ascending: true }),
      supabase
        .from("video_assemblies")
        .select("id,job_id,state,final_media_asset_id")
        .eq("organization_id", organizationId)
        .eq("plan_version_id", planVersionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (projectResult.error || blockerResult.error || sceneResult.error || assemblyResult.error) {
      throw internal("Unable to resolve final render readiness.");
    }
    const project = projectResult.data as ProjectRow | null;
    if (!project) return null;

    const scenes = (sceneResult.data ?? []) as SceneRow[];
    const sceneIds = scenes.map((scene) => scene.id);
    let shots: ShotRow[] = [];
    if (sceneIds.length > 0) {
      const { data, error } = await supabase
        .from("scene_plan_shots")
        .select("id,scene_id,ordinal")
        .eq("organization_id", organizationId)
        .in("scene_id", sceneIds)
        .order("ordinal", { ascending: true });
      if (error) throw internal("Unable to resolve final render shots.");
      shots = (data ?? []) as ShotRow[];
    }

    let attempts: AttemptRow[] = [];
    if (shots.length > 0) {
      const { data, error } = await supabase
        .from("video_generation_attempts")
        .select("shot_id,attempt_number,media_asset_id")
        .eq("organization_id", organizationId)
        .eq("plan_version_id", planVersionId)
        .eq("state", "COMPLETED")
        .not("media_asset_id", "is", null)
        .order("attempt_number", { ascending: false });
      if (error) throw internal("Unable to resolve generated shot media.");
      attempts = (data ?? []) as AttemptRow[];
    }

    const latestCompletedByShot = new Map<string, AttemptRow>();
    for (const attempt of attempts) {
      if (!latestCompletedByShot.has(attempt.shot_id)) latestCompletedByShot.set(attempt.shot_id, attempt);
    }

    const mediaIds = Array.from(new Set(
      shots.flatMap((shot) => {
        const mediaAssetId = latestCompletedByShot.get(shot.id)?.media_asset_id;
        return mediaAssetId ? [mediaAssetId] : [];
      }),
    ));
    let mediaRows: MediaRow[] = [];
    if (mediaIds.length > 0) {
      const { data, error } = await supabase
        .from("media_assets")
        .select("id,asset_type,status,checksum")
        .eq("organization_id", organizationId)
        .in("id", mediaIds);
      if (error) throw internal("Unable to validate generated media assets.");
      mediaRows = (data ?? []) as MediaRow[];
    }
    const mediaById = new Map(mediaRows.map((row) => [row.id, row]));

    const orderedShots = [...shots].sort((a, b) => {
      const sceneA = scenes.find((scene) => scene.id === a.scene_id)?.ordinal ?? 0;
      const sceneB = scenes.find((scene) => scene.id === b.scene_id)?.ordinal ?? 0;
      return sceneA === sceneB ? a.ordinal - b.ordinal : sceneA - sceneB;
    });
    const shotReadiness: FinalAssemblyShotReadiness[] = orderedShots.map((shot) => {
      const mediaAssetId = latestCompletedByShot.get(shot.id)?.media_asset_id;
      const media = mediaAssetId ? mediaById.get(mediaAssetId) : undefined;
      return {
        shotId: shot.id,
        media: mediaAssetId && media
          ? {
              mediaAssetId,
              assetType: media.asset_type,
              status: media.status,
              checksum: media.checksum,
            }
          : null,
      };
    });

    let currentSourceIntegrityHash: string | null = null;
    try {
      currentSourceIntegrityHash = await new SupabaseScenePlanningRepository().loadCurrentSourceIntegrityHash(
        organizationId,
        plan.video_project_id,
      );
    } catch {
      currentSourceIntegrityHash = null;
    }

    const assembly = assemblyResult.data as AssemblyRow | null;
    const readiness = computeFinalAssemblyReadiness({
      planStatus: plan.status,
      sourceFresh: currentSourceIntegrityHash !== null && currentSourceIntegrityHash === plan.source_integrity_hash,
      hasBlocker: (blockerResult.data ?? []).length > 0,
      aspectRatio: project.aspect_ratio,
      assemblyAlreadyRunning: assembly?.state === "QUEUED" || assembly?.state === "PROCESSING",
      shots: shotReadiness,
    });

    return {
      ready: readiness.ready,
      reasons: readiness.reasons,
      ...(assembly
        ? {
            assembly: {
              assemblyId: assembly.id,
              jobId: assembly.job_id,
              state: assembly.state,
              ...(assembly.final_media_asset_id ? { finalMediaAssetId: assembly.final_media_asset_id } : {}),
            },
          }
        : {}),
    };
  }
}
