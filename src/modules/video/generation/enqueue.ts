import { AppError } from "@/lib/errors/app-error";
import {
  SupabaseVideoGenerationRepository,
  type EnqueueVideoGenerationResult,
  type VideoGenerationProfile,
  type VideoGenerationRepository,
} from "./repository";

export type EnqueueVideoShotGenerationInput = {
  organizationId: string;
  planVersionId: string;
  shotId: string;
  profile?: VideoGenerationProfile;
};

export async function enqueueVideoShotGeneration(
  input: EnqueueVideoShotGenerationInput,
  repository: VideoGenerationRepository = new SupabaseVideoGenerationRepository(),
): Promise<EnqueueVideoGenerationResult> {
  if (!input.organizationId || !input.planVersionId || !input.shotId) {
    throw new AppError("VALIDATION_ERROR", "Organization, approved plan, and shot are required.");
  }

  return repository.enqueueApprovedShot({
    organizationId: input.organizationId,
    planVersionId: input.planVersionId,
    shotId: input.shotId,
    profile: input.profile ?? "QUALITY_1080P",
  });
}
