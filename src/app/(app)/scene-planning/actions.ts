"use server";

import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseScenePlanningRepository } from "@/modules/scene-planning/repository";
import { ScenePlanningService, type CreateScenePlanningProjectInput } from "@/modules/scene-planning/service";
import { computeSceneSourceIntegrityHash } from "@/modules/scene-planning/source-integrity";

const createProjectActionSchema = z.object({
  organizationId: z.string().uuid(),
  sourceArtifactId: z.string().uuid(),
});

type Actor = { id: string };

export type CreateScenePlanningProjectActionDependencies = {
  getActor(): Promise<Actor | null>;
  createProject(input: CreateScenePlanningProjectInput): Promise<{ id: string }>;
};

export type CreateScenePlanningProjectActionResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

export async function executeCreateScenePlanningProjectAction(
  input: unknown,
  dependencies: CreateScenePlanningProjectActionDependencies,
): Promise<CreateScenePlanningProjectActionResult> {
  const parsed = createProjectActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the Scene Planning source and try again." };
  }

  const actor = await dependencies.getActor();
  if (!actor) {
    return { ok: false, error: "You must be signed in to create a Scene Planning project." };
  }

  try {
    const project = await dependencies.createProject({
      organizationId: parsed.data.organizationId,
      actorUserId: actor.id,
      sourceArtifactId: parsed.data.sourceArtifactId,
      title: "New Scene Planning project",
      targetPlatforms: [],
      aspectRatio: "16:9",
      targetDurationSeconds: 60,
      qualityProfile: "PREMIUM",
    });
    return { ok: true, projectId: project.id };
  } catch {
    return { ok: false, error: "Scene Planning project creation is temporarily unavailable." };
  }
}

async function getActor(): Promise<Actor | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

export async function createScenePlanningProjectAction(
  input: unknown,
): Promise<CreateScenePlanningProjectActionResult> {
  const repository = new SupabaseScenePlanningRepository();
  const service = new ScenePlanningService(repository, {
    now: () => new Date(),
    createId: () => crypto.randomUUID(),
    hashSource: async (source) => computeSceneSourceIntegrityHash(source),
  });

  return executeCreateScenePlanningProjectAction(input, {
    getActor,
    async createProject(projectInput) {
      return service.createProject(projectInput);
    },
  });
}
