"use server";

import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import { SupabaseScenePlanningRepository } from "@/modules/scene-planning/repository";

const EDIT_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR"];

const updateSceneSchema = z.object({
  organizationId: z.string().uuid(),
  planVersionId: z.string().uuid(),
  sceneId: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  durationSeconds: z.number().positive().max(600),
  creativeDirection: z.string().trim().min(1).max(4000),
}).strict();

const updateShotSchema = z.object({
  organizationId: z.string().uuid(),
  planVersionId: z.string().uuid(),
  shotId: z.string().uuid(),
  durationSeconds: z.number().positive().max(600),
  creativeDirection: z.string().trim().min(1).max(4000),
  masterVisualPrompt: z.string().trim().min(1).max(12000),
  cameraMotion: z.string().trim().max(1000),
}).strict();

const reorderSceneSchema = z.object({
  organizationId: z.string().uuid(),
  planVersionId: z.string().uuid(),
  orderedSceneIds: z.array(z.string().uuid()).min(1).max(200)
    .refine((ids) => new Set(ids).size === ids.length, "Scene IDs must be unique"),
}).strict();

const reorderShotSchema = z.object({
  organizationId: z.string().uuid(),
  planVersionId: z.string().uuid(),
  sceneId: z.string().uuid(),
  orderedShotIds: z.array(z.string().uuid()).min(1).max(500)
    .refine((ids) => new Set(ids).size === ids.length, "Shot IDs must be unique"),
}).strict();

type Actor = { id: string };
type ActionResult = { ok: true } | { ok: false; error: string };

type UpdateSceneInput = z.infer<typeof updateSceneSchema>;
type UpdateShotInput = z.infer<typeof updateShotSchema>;
type ReorderSceneInput = z.infer<typeof reorderSceneSchema>;
type ReorderShotInput = z.infer<typeof reorderShotSchema>;

export type DraftEditDependencies = {
  getActor(): Promise<Actor | null>;
  authorize(actorId: string, organizationId: string): Promise<boolean>;
  updateScene(input: UpdateSceneInput): Promise<void>;
  updateShot(input: UpdateShotInput): Promise<void>;
  reorderScenes(input: ReorderSceneInput): Promise<void>;
  reorderShots(input: ReorderShotInput): Promise<void>;
};

async function authorizeMutation(
  organizationId: string,
  dependencies: Pick<DraftEditDependencies, "getActor" | "authorize">,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await dependencies.getActor();
  if (!actor) return { ok: false, error: "You must be signed in to edit Scene Planning content." };
  if (!(await dependencies.authorize(actor.id, organizationId))) {
    return { ok: false, error: "You do not have permission to edit Scene Planning content for this organization." };
  }
  return { ok: true };
}

export async function executeUpdateSceneDraftAction(
  input: unknown,
  dependencies: DraftEditDependencies,
): Promise<ActionResult> {
  const parsed = updateSceneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the scene edit details and try again." };
  const authorization = await authorizeMutation(parsed.data.organizationId, dependencies);
  if (!authorization.ok) return authorization;
  try {
    await dependencies.updateScene(parsed.data);
    return { ok: true };
  } catch {
    return { ok: false, error: "Scene Planning draft update is temporarily unavailable." };
  }
}

export async function executeUpdateShotDraftAction(
  input: unknown,
  dependencies: DraftEditDependencies,
): Promise<ActionResult> {
  const parsed = updateShotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the shot edit details and try again." };
  const authorization = await authorizeMutation(parsed.data.organizationId, dependencies);
  if (!authorization.ok) return authorization;
  try {
    await dependencies.updateShot(parsed.data);
    return { ok: true };
  } catch {
    return { ok: false, error: "Scene Planning draft update is temporarily unavailable." };
  }
}

export async function executeReorderSceneDraftAction(
  input: unknown,
  dependencies: DraftEditDependencies,
): Promise<ActionResult> {
  const parsed = reorderSceneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the scene reorder details and try again." };
  const authorization = await authorizeMutation(parsed.data.organizationId, dependencies);
  if (!authorization.ok) return authorization;
  try {
    await dependencies.reorderScenes(parsed.data);
    return { ok: true };
  } catch {
    return { ok: false, error: "Scene Planning draft update is temporarily unavailable." };
  }
}

export async function executeReorderShotDraftAction(
  input: unknown,
  dependencies: DraftEditDependencies,
): Promise<ActionResult> {
  const parsed = reorderShotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the shot reorder details and try again." };
  const authorization = await authorizeMutation(parsed.data.organizationId, dependencies);
  if (!authorization.ok) return authorization;
  try {
    await dependencies.reorderShots(parsed.data);
    return { ok: true };
  } catch {
    return { ok: false, error: "Scene Planning draft update is temporarily unavailable." };
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

async function updateScene(input: UpdateSceneInput): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_scene_plan_scene_draft", {
    _organization_id: input.organizationId,
    _plan_version_id: input.planVersionId,
    _scene_id: input.sceneId,
    _title: input.title,
    _duration_seconds: input.durationSeconds,
    _creative_direction: input.creativeDirection,
  });
  if (error) throw error;
}

async function updateShot(input: UpdateShotInput): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_scene_plan_shot_draft", {
    _organization_id: input.organizationId,
    _plan_version_id: input.planVersionId,
    _shot_id: input.shotId,
    _duration_seconds: input.durationSeconds,
    _creative_direction: input.creativeDirection,
    _master_visual_prompt: input.masterVisualPrompt,
    _camera_motion: input.cameraMotion,
  });
  if (error) throw error;
}

async function reorderScenes(input: ReorderSceneInput): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reorder_scene_plan_scenes", {
    _organization_id: input.organizationId,
    _plan_version_id: input.planVersionId,
    _ordered_scene_ids: input.orderedSceneIds,
  });
  if (error) throw error;
}

async function reorderShots(input: ReorderShotInput): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reorder_scene_plan_shots", {
    _organization_id: input.organizationId,
    _plan_version_id: input.planVersionId,
    _scene_id: input.sceneId,
    _ordered_shot_ids: input.orderedShotIds,
  });
  if (error) throw error;
}

const dependencies: DraftEditDependencies = {
  getActor,
  authorize,
  updateScene,
  updateShot,
  reorderScenes,
  reorderShots,
};

export async function updateScenePlanSceneDraftAction(input: unknown): Promise<ActionResult> {
  return executeUpdateSceneDraftAction(input, dependencies);
}

export async function updateScenePlanShotDraftAction(input: unknown): Promise<ActionResult> {
  return executeUpdateShotDraftAction(input, dependencies);
}

export async function reorderScenePlanScenesAction(input: unknown): Promise<ActionResult> {
  return executeReorderSceneDraftAction(input, dependencies);
}

export async function reorderScenePlanShotsAction(input: unknown): Promise<ActionResult> {
  return executeReorderShotDraftAction(input, dependencies);
}
