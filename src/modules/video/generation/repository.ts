import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const VIDEO_GENERATION_PROFILES = ["QUALITY_1080P"] as const;
export type VideoGenerationProfile = (typeof VIDEO_GENERATION_PROFILES)[number];

export type EnqueueVideoGenerationInput = {
  organizationId: string;
  planVersionId: string;
  shotId: string;
  profile: VideoGenerationProfile;
};

export type EnqueueVideoGenerationResult = {
  jobId: string;
  attemptId: string;
  reused: boolean;
};

export interface VideoGenerationRepository {
  enqueueApprovedShot(input: EnqueueVideoGenerationInput): Promise<EnqueueVideoGenerationResult>;
}

function parseEnqueueResult(data: unknown): EnqueueVideoGenerationResult {
  if (!data || typeof data !== "object") {
    throw new AppError("INTERNAL_ERROR", "Video generation enqueue returned an invalid response.");
  }
  const value = data as Record<string, unknown>;
  if (
    typeof value.jobId !== "string" ||
    typeof value.attemptId !== "string" ||
    typeof value.reused !== "boolean"
  ) {
    throw new AppError("INTERNAL_ERROR", "Video generation enqueue returned an invalid response.");
  }
  return {
    jobId: value.jobId,
    attemptId: value.attemptId,
    reused: value.reused,
  };
}

export class SupabaseVideoGenerationRepository implements VideoGenerationRepository {
  async enqueueApprovedShot(input: EnqueueVideoGenerationInput): Promise<EnqueueVideoGenerationResult> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("enqueue_video_shot_generation", {
      _organization_id: input.organizationId,
      _plan_version_id: input.planVersionId,
      _shot_id: input.shotId,
      _profile: input.profile,
    });

    if (error) {
      const message = error.message || "Unable to enqueue video generation.";
      const conflict = /approved|stale|blocker|source|aspect ratio|duration|profile/i.test(message);
      throw new AppError(conflict ? "CONFLICT" : "INTERNAL_ERROR", message);
    }
    return parseEnqueueResult(data);
  }
}
