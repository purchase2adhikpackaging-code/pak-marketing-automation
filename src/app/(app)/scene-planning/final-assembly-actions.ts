"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import { SupabaseScenePlanningRepository } from "@/modules/scene-planning/repository";
import {
  enqueueFinalVideoAssembly,
  type EnqueueFinalVideoAssemblyInput,
} from "@/modules/video/assembly/enqueue";
import type { EnqueueFinalAssemblyResult } from "@/modules/video/assembly/repository";

const EDIT_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR"];

const enqueueSchema = z.object({
  organizationId: z.string().uuid(),
  planVersionId: z.string().uuid(),
  profile: z.literal("PAK_MASTER_1080P_V1"),
}).strict();

type Actor = { id: string };

export type FinalAssemblyActionDependencies = {
  getActor(): Promise<Actor | null>;
  getRole(actorId: string, organizationId: string): Promise<AppRole | null>;
  enqueue(input: EnqueueFinalVideoAssemblyInput): Promise<EnqueueFinalAssemblyResult>;
};

export type FinalAssemblyActionResult =
  | {
      ok: true;
      assemblyId: string;
      jobId: string;
      reused: boolean;
      mediaAssetId?: string;
    }
  | { ok: false; error: string };

export async function executeEnqueueFinalAssemblyAction(
  input: unknown,
  dependencies: FinalAssemblyActionDependencies,
): Promise<FinalAssemblyActionResult> {
  const parsed = enqueueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the approved scene plan and try again." };

  try {
    const actor = await dependencies.getActor();
    if (!actor) return { ok: false, error: "You must be signed in to create a final video." };

    const role = await dependencies.getRole(actor.id, parsed.data.organizationId);
    if (!role || !EDIT_ROLES.includes(role)) {
      return { ok: false, error: "You do not have permission to create a final video for this organization." };
    }

    const queued = await dependencies.enqueue(parsed.data);
    return {
      ok: true,
      assemblyId: queued.assemblyId,
      jobId: queued.jobId,
      reused: queued.reused,
      ...(queued.mediaAssetId ? { mediaAssetId: queued.mediaAssetId } : {}),
    };
  } catch {
    return { ok: false, error: "Final video assembly could not be queued. Check render readiness and try again." };
  }
}

async function productionActor(): Promise<Actor | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

const roleRepository = new SupabaseScenePlanningRepository();
const productionDependencies: FinalAssemblyActionDependencies = {
  getActor: productionActor,
  getRole(actorId, organizationId) {
    return roleRepository.getActorRole(organizationId, actorId);
  },
  enqueue: enqueueFinalVideoAssembly,
};

export async function enqueueFinalAssemblyAction(input: unknown): Promise<FinalAssemblyActionResult> {
  return executeEnqueueFinalAssemblyAction(input, productionDependencies);
}
