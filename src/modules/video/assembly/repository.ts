import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { FinalRenderProfile } from "./types";

export type EnqueueFinalAssemblyInput = {
  organizationId: string;
  planVersionId: string;
  profile: FinalRenderProfile;
};

export type EnqueueFinalAssemblyResult = {
  assemblyId: string;
  jobId: string;
  reused: boolean;
  mediaAssetId?: string;
};

export interface FinalAssemblyRepository {
  enqueueApprovedPlan(input: EnqueueFinalAssemblyInput): Promise<EnqueueFinalAssemblyResult>;
}

function parseEnqueueResult(data: unknown): EnqueueFinalAssemblyResult {
  if (!data || typeof data !== "object") {
    throw new AppError("INTERNAL_ERROR", "Final video assembly enqueue returned an invalid response.");
  }

  const value = data as Record<string, unknown>;
  if (
    typeof value.assemblyId !== "string" ||
    typeof value.jobId !== "string" ||
    typeof value.reused !== "boolean"
  ) {
    throw new AppError("INTERNAL_ERROR", "Final video assembly enqueue returned an invalid response.");
  }

  return {
    assemblyId: value.assemblyId,
    jobId: value.jobId,
    reused: value.reused,
    ...(typeof value.mediaAssetId === "string" ? { mediaAssetId: value.mediaAssetId } : {}),
  };
}

export class SupabaseFinalAssemblyRepository implements FinalAssemblyRepository {
  async enqueueApprovedPlan(input: EnqueueFinalAssemblyInput): Promise<EnqueueFinalAssemblyResult> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("enqueue_final_video_assembly", {
      _organization_id: input.organizationId,
      _plan_version_id: input.planVersionId,
      _profile: input.profile,
    });

    if (error) {
      const message = error.message || "Unable to enqueue final video assembly.";
      const conflict = /approved|stale|blocker|source|shot|media|aspect ratio|profile|already running/i.test(message);
      throw new AppError(conflict ? "CONFLICT" : "INTERNAL_ERROR", message);
    }

    return parseEnqueueResult(data);
  }
}
