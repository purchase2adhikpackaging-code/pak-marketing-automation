import { AppError } from "@/lib/errors/app-error";
import {
  SupabaseFinalAssemblyRepository,
  type EnqueueFinalAssemblyResult,
  type FinalAssemblyRepository,
} from "./repository";
import type { FinalRenderProfile } from "./types";

export type EnqueueFinalVideoAssemblyInput = {
  organizationId: string;
  planVersionId: string;
  profile?: FinalRenderProfile;
};

export async function enqueueFinalVideoAssembly(
  input: EnqueueFinalVideoAssemblyInput,
  repository: FinalAssemblyRepository = new SupabaseFinalAssemblyRepository(),
): Promise<EnqueueFinalAssemblyResult> {
  if (!input.organizationId || !input.planVersionId) {
    throw new AppError("VALIDATION_ERROR", "Organization and approved scene plan are required.");
  }

  return repository.enqueueApprovedPlan({
    organizationId: input.organizationId,
    planVersionId: input.planVersionId,
    profile: input.profile ?? "PAK_MASTER_1080P_V1",
  });
}
