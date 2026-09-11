"use server";

import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { invokeVideoGeneration, type VideoGenerationEdgeRequest } from "@/modules/integrations/edge-client";
import type { AppRole } from "@/modules/auth/roles";
import { SupabaseScenePlanningRepository } from "@/modules/scene-planning/repository";
import {
  enqueueVideoShotGeneration,
  type EnqueueVideoShotGenerationInput,
} from "@/modules/video/generation/enqueue";
import type { EnqueueVideoGenerationResult } from "@/modules/video/generation/repository";

const EDIT_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR"];

const enqueueSchema = z.object({
  organizationId: z.string().uuid(),
  planVersionId: z.string().uuid(),
  shotId: z.string().uuid(),
}).strict();

const edgeIdsSchema = z.object({
  organizationId: z.string().uuid(),
  jobId: z.string().uuid(),
  attemptId: z.string().uuid(),
}).strict();

const safeEdgeResultSchema = z.object({
  state: z.enum(["QUEUED", "SUBMITTED", "PROCESSING", "IMPORT_PENDING", "COMPLETED", "FAILED"]),
  jobId: z.string().uuid(),
  attemptId: z.string().uuid(),
  mediaAssetId: z.string().uuid().optional(),
  errorCode: z.string().max(200).optional(),
  retryable: z.boolean().optional(),
}).strict();

type Actor = { id: string };

export type SafeVideoGenerationActionResult =
  | {
      ok: true;
      state: "QUEUED" | "SUBMITTED" | "PROCESSING" | "IMPORT_PENDING" | "COMPLETED" | "FAILED";
      jobId: string;
      attemptId: string;
      mediaAssetId?: string;
      errorCode?: string;
      retryable?: boolean;
      reused?: boolean;
    }
  | { ok: false; error: string };

export type VideoGenerationActionDependencies = {
  getActor(): Promise<Actor | null>;
  getRole(actorId: string, organizationId: string): Promise<AppRole | null>;
  enqueue(input: EnqueueVideoShotGenerationInput): Promise<EnqueueVideoGenerationResult>;
  invokeEdge(input: VideoGenerationEdgeRequest): Promise<unknown>;
};

function normalizeEdgeResult(value: unknown): SafeVideoGenerationActionResult {
  const parsed = safeEdgeResultSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: "Video generation returned an invalid response." };
  const data = parsed.data;
  return {
    ok: true,
    state: data.state,
    jobId: data.jobId,
    attemptId: data.attemptId,
    ...(data.mediaAssetId !== undefined ? { mediaAssetId: data.mediaAssetId } : {}),
    ...(data.errorCode !== undefined ? { errorCode: data.errorCode } : {}),
    ...(data.retryable !== undefined ? { retryable: data.retryable } : {}),
  };
}

async function authorizeEditor(
  organizationId: string,
  dependencies: VideoGenerationActionDependencies,
): Promise<{ actor: Actor } | { error: string }> {
  const actor = await dependencies.getActor();
  if (!actor) return { error: "You must be signed in to generate video." };
  const role = await dependencies.getRole(actor.id, organizationId);
  if (!role || !EDIT_ROLES.includes(role)) {
    return { error: "You do not have permission to generate video for this organization." };
  }
  return { actor };
}

export async function executeEnqueueShotVideoGenerationAction(
  input: unknown,
  dependencies: VideoGenerationActionDependencies,
): Promise<SafeVideoGenerationActionResult> {
  const parsed = enqueueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the approved shot and try again." };

  try {
    const authorization = await authorizeEditor(parsed.data.organizationId, dependencies);
    if ("error" in authorization) return { ok: false, error: authorization.error };

    const queued = await dependencies.enqueue(parsed.data);
    if (queued.reused) {
      return {
        ok: true,
        state: "QUEUED",
        jobId: queued.jobId,
        attemptId: queued.attemptId,
        reused: true,
      };
    }

    const edge = await dependencies.invokeEdge({
      operation: "submit",
      organizationId: parsed.data.organizationId,
      jobId: queued.jobId,
      attemptId: queued.attemptId,
    });
    const normalized = normalizeEdgeResult(edge);
    return normalized.ok ? { ...normalized, reused: false } : normalized;
  } catch {
    return { ok: false, error: "Video generation could not be started." };
  }
}

export async function executeReconcileShotVideoGenerationAction(
  input: unknown,
  dependencies: VideoGenerationActionDependencies,
): Promise<SafeVideoGenerationActionResult> {
  const parsed = edgeIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the video generation job and try again." };

  try {
    const authorization = await authorizeEditor(parsed.data.organizationId, dependencies);
    if ("error" in authorization) return { ok: false, error: authorization.error };
    return normalizeEdgeResult(await dependencies.invokeEdge({ operation: "reconcile", ...parsed.data }));
  } catch {
    return { ok: false, error: "Video generation status could not be refreshed." };
  }
}

export async function executeRetryShotVideoGenerationAction(
  input: unknown,
  dependencies: VideoGenerationActionDependencies,
): Promise<SafeVideoGenerationActionResult> {
  const parsed = edgeIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the failed video generation and try again." };

  try {
    const authorization = await authorizeEditor(parsed.data.organizationId, dependencies);
    if ("error" in authorization) return { ok: false, error: authorization.error };
    return normalizeEdgeResult(await dependencies.invokeEdge({ operation: "retry", ...parsed.data }));
  } catch {
    return { ok: false, error: "Video generation retry could not be started." };
  }
}

async function productionActor(): Promise<Actor | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

const productionDependencies: VideoGenerationActionDependencies = {
  getActor: productionActor,
  async getRole(actorId, organizationId) {
    return new SupabaseScenePlanningRepository().getActorRole(organizationId, actorId);
  },
  enqueue: enqueueVideoShotGeneration,
  invokeEdge: invokeVideoGeneration,
};

export async function enqueueShotVideoGenerationAction(input: unknown): Promise<SafeVideoGenerationActionResult> {
  return executeEnqueueShotVideoGenerationAction(input, productionDependencies);
}

export async function reconcileShotVideoGenerationAction(input: unknown): Promise<SafeVideoGenerationActionResult> {
  return executeReconcileShotVideoGenerationAction(input, productionDependencies);
}

export async function retryShotVideoGenerationAction(input: unknown): Promise<SafeVideoGenerationActionResult> {
  return executeRetryShotVideoGenerationAction(input, productionDependencies);
}
