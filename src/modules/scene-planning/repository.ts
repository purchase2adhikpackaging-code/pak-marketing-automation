import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import { computeSceneSourceIntegrityHash } from "./source-integrity";
import type {
  CreateProjectPersistenceInput,
  PersistDraftGraphInput,
  ScenePlanningRepository,
  ScenePlanningSourceArtifact,
  ScenePlanVersionSummary,
} from "./service";
import type { ScenePlanStatus } from "./schema";

function internal(message: string): AppError {
  return new AppError("INTERNAL_ERROR", message);
}

export class SupabaseScenePlanningRepository implements ScenePlanningRepository {
  async getActorRole(organizationId: string, actorUserId: string): Promise<AppRole | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", actorUserId)
      .maybeSingle();
    if (error) throw internal("Unable to authorize Scene Planning access.");
    return data?.role ? (data.role as AppRole) : null;
  }

  async loadSourceArtifact(
    organizationId: string,
    sourceArtifactId: string,
  ): Promise<ScenePlanningSourceArtifact | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("content_script_artifacts")
      .select("id,organization_id,content_item_id,language,status,script_text,revision")
      .eq("organization_id", organizationId)
      .eq("id", sourceArtifactId)
      .maybeSingle();
    if (error) throw internal("Unable to load the Scene Planning source artifact.");
    if (!data) return null;
    return {
      id: data.id,
      organizationId: data.organization_id,
      contentItemId: data.content_item_id,
      language: data.language as "EN" | "PL" | "HI",
      status: data.status as ScenePlanningSourceArtifact["status"],
      ...(data.script_text ? { scriptText: data.script_text } : {}),
      revision: data.revision,
    };
  }

  async createProject(input: CreateProjectPersistenceInput) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("video_projects")
      .insert({
        id: input.id,
        organization_id: input.organizationId,
        source_content_id: input.sourceContentId,
        source_artifact_id: input.sourceArtifactId,
        source_artifact_revision: input.sourceArtifactRevision,
        source_integrity_hash: input.sourceIntegrityHash,
        language: input.language,
        title: input.title,
        purpose: input.purpose,
        target_platform: input.targetPlatforms,
        aspect_ratio: input.aspectRatio,
        target_duration_seconds: input.targetDurationSeconds,
        quality_profile: input.qualityProfile,
        audience: input.audience,
        production_constraints: input.productionConstraints,
        created_by: input.createdBy,
      })
      .eq("organization_id", input.organizationId)
      .select("id")
      .single();
    if (error || !data) throw internal("Unable to create the Scene Planning project.");
    return { ...input, id: data.id };
  }

  async getNextVersionNumber(organizationId: string, videoProjectId: string): Promise<number> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("scene_plan_versions")
      .select("version_number")
      .eq("organization_id", organizationId)
      .eq("video_project_id", videoProjectId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw internal("Unable to determine the next Scene Planning version.");
    return (data?.version_number ?? 0) + 1;
  }

  async persistDraftGraph(input: PersistDraftGraphInput): Promise<{ id: string }> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("persist_scene_plan_draft", {
      _organization_id: input.organizationId,
      _video_project_id: input.videoProjectId,
      _version_number: input.versionNumber,
      _source_integrity_hash: input.sourceIntegrityHash,
      _canonical_narration: input.canonicalNarration,
      _language: input.language,
      _aspect_ratio: input.aspectRatio,
      _planner_provider: input.plannerProvider,
      _planner_model: input.plannerModel,
      _creative_brief_snapshot: input.creativeBriefSnapshot,
      _visual_bible_snapshot: input.visualBibleSnapshot,
      _created_by: input.createdBy,
      _scenes: input.scenes,
    });
    if (error || typeof data !== "string") throw internal("Unable to persist the complete Scene Planning draft.");
    return { id: data };
  }

  async loadPlanVersion(organizationId: string, planVersionId: string): Promise<ScenePlanVersionSummary | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("scene_plan_versions")
      .select("id,organization_id,video_project_id,version_number,status,source_integrity_hash")
      .eq("organization_id", organizationId)
      .eq("id", planVersionId)
      .maybeSingle();
    if (error) throw internal("Unable to load the Scene Planning version.");
    if (!data) return null;
    return {
      id: data.id,
      organizationId: data.organization_id,
      videoProjectId: data.video_project_id,
      versionNumber: data.version_number,
      status: data.status as ScenePlanStatus,
      sourceIntegrityHash: data.source_integrity_hash,
    };
  }

  async clonePlanVersion(
    organizationId: string,
    planVersionId: string,
    nextVersionNumber: number,
    actorUserId: string,
  ): Promise<{ id: string; versionNumber: number; status: "DRAFT" }> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("clone_scene_plan_version", {
      _organization_id: organizationId,
      _source_plan_id: planVersionId,
      _next_version_number: nextVersionNumber,
      _created_by: actorUserId,
    });
    if (error || typeof data !== "string") throw internal("Unable to clone the Scene Planning version.");
    return { id: data, versionNumber: nextVersionNumber, status: "DRAFT" };
  }

  async updatePlanStatus(
    organizationId: string,
    planVersionId: string,
    status: ScenePlanStatus,
    metadata?: { approvedBy?: string; approvedAt?: string },
  ): Promise<{ id: string; status: ScenePlanStatus }> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("scene_plan_versions")
      .update({
        status,
        ...(metadata?.approvedBy ? { approved_by: metadata.approvedBy } : {}),
        ...(metadata?.approvedAt ? { approved_at: metadata.approvedAt } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", planVersionId)
      .select("id,status")
      .single();
    if (error || !data) throw internal("Unable to update the Scene Planning status.");
    return { id: data.id, status: data.status as ScenePlanStatus };
  }

  async countQcBlockers(organizationId: string, planVersionId: string): Promise<number> {
    const supabase = await createServerSupabaseClient();
    const { count, error } = await supabase
      .from("scene_plan_qc_findings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("scene_plan_version_id", planVersionId)
      .eq("severity", "BLOCKER");
    if (error) throw internal("Unable to read Scene Planning quality findings.");
    return count ?? 0;
  }

  async loadCurrentSourceIntegrityHash(organizationId: string, videoProjectId: string): Promise<string> {
    const supabase = await createServerSupabaseClient();
    const { data: project, error: projectError } = await supabase
      .from("video_projects")
      .select("source_artifact_id")
      .eq("organization_id", organizationId)
      .eq("id", videoProjectId)
      .maybeSingle();
    if (projectError || !project) throw internal("Unable to resolve the Scene Planning project source.");

    const source = await this.loadSourceArtifact(organizationId, project.source_artifact_id);
    if (!source?.scriptText || source.status !== "GENERATED") {
      throw new AppError("CONFLICT", "The Scene Planning source artifact is no longer current.");
    }
    return computeSceneSourceIntegrityHash({
      artifactId: source.id,
      revision: source.revision,
      scriptText: source.scriptText,
    });
  }
}
