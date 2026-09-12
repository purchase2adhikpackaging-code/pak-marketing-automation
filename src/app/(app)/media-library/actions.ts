"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import {
  invokeMediaLibrary,
  type MediaLibraryEdgeRequest,
} from "@/modules/integrations/edge-client";
import { SupabaseMediaRepository } from "@/modules/media/repository";
import { SupabaseScenePlanningRepository } from "@/modules/scene-planning/repository";

const EDIT_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR"];
const ADMIN_ROLES: readonly AppRole[] = ["OWNER", "ADMIN"];

const mediaIdsSchema = z.object({
  organizationId: z.string().uuid(),
  mediaAssetId: z.string().uuid(),
}).strict();

const previewResultSchema = z.object({
  mediaAssetId: z.string().uuid(),
  signedUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive().max(3600),
}).strict();

type Actor = { id: string };

export type MediaLibraryActionDependencies = {
  getActor(): Promise<Actor | null>;
  getRole(actorId: string, organizationId: string): Promise<AppRole | null>;
  archive(organizationId: string, mediaAssetId: string, actorId: string): Promise<void>;
  invokeEdge(input: MediaLibraryEdgeRequest): Promise<unknown>;
};

export type MediaMutationActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type MediaPreviewActionResult =
  | {
      ok: true;
      mediaAssetId: string;
      signedUrl: string;
      expiresInSeconds: number;
    }
  | { ok: false; error: string };

async function authorizeMember(
  organizationId: string,
  dependencies: MediaLibraryActionDependencies,
): Promise<{ actor: Actor; role: AppRole } | { error: string }> {
  const actor = await dependencies.getActor();
  if (!actor) return { error: "You must be signed in to use the Media Library." };

  const role = await dependencies.getRole(actor.id, organizationId);
  if (!role) return { error: "You do not have access to this organization's Media Library." };
  return { actor, role };
}

export async function executeArchiveMediaAction(
  input: unknown,
  dependencies: MediaLibraryActionDependencies,
): Promise<MediaMutationActionResult> {
  const parsed = mediaIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the media asset and try again." };

  try {
    const authorization = await authorizeMember(parsed.data.organizationId, dependencies);
    if ("error" in authorization) return { ok: false, error: authorization.error };
    if (!EDIT_ROLES.includes(authorization.role)) {
      return { ok: false, error: "You do not have permission to archive media." };
    }

    await dependencies.archive(
      parsed.data.organizationId,
      parsed.data.mediaAssetId,
      authorization.actor.id,
    );
    return { ok: true };
  } catch {
    return { ok: false, error: "The media asset could not be archived." };
  }
}

export async function executeDeleteMediaAction(
  input: unknown,
  dependencies: MediaLibraryActionDependencies,
): Promise<MediaMutationActionResult> {
  const parsed = mediaIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the media asset and try again." };

  try {
    const authorization = await authorizeMember(parsed.data.organizationId, dependencies);
    if ("error" in authorization) return { ok: false, error: authorization.error };
    if (!ADMIN_ROLES.includes(authorization.role)) {
      return { ok: false, error: "Only organization Owners and Admins may permanently delete media." };
    }

    await dependencies.invokeEdge({
      operation: "delete",
      organizationId: parsed.data.organizationId,
      mediaAssetId: parsed.data.mediaAssetId,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "The media asset could not be permanently deleted. It may still be required by generation lineage." };
  }
}

export async function executePreviewMediaAction(
  input: unknown,
  dependencies: MediaLibraryActionDependencies,
): Promise<MediaPreviewActionResult> {
  const parsed = mediaIdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the media asset and try again." };

  try {
    const authorization = await authorizeMember(parsed.data.organizationId, dependencies);
    if ("error" in authorization) return { ok: false, error: authorization.error };

    const response = await dependencies.invokeEdge({
      operation: "preview",
      organizationId: parsed.data.organizationId,
      mediaAssetId: parsed.data.mediaAssetId,
    });
    const safe = previewResultSchema.safeParse(response);
    if (!safe.success) return { ok: false, error: "The secure media preview response was invalid." };

    return {
      ok: true,
      mediaAssetId: safe.data.mediaAssetId,
      signedUrl: safe.data.signedUrl,
      expiresInSeconds: safe.data.expiresInSeconds,
    };
  } catch {
    return { ok: false, error: "A secure media preview could not be created." };
  }
}

async function productionActor(): Promise<Actor | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

const mediaRepository = new SupabaseMediaRepository();
const roleRepository = new SupabaseScenePlanningRepository();

const productionDependencies: MediaLibraryActionDependencies = {
  getActor: productionActor,
  getRole(actorId, organizationId) {
    return roleRepository.getActorRole(organizationId, actorId);
  },
  archive(organizationId, mediaAssetId, actorId) {
    return mediaRepository.archive(organizationId, mediaAssetId, actorId);
  },
  invokeEdge(input) {
    return invokeMediaLibrary(input);
  },
};

export async function archiveMediaAction(input: unknown): Promise<MediaMutationActionResult> {
  return executeArchiveMediaAction(input, productionDependencies);
}

export async function deleteMediaAction(input: unknown): Promise<MediaMutationActionResult> {
  return executeDeleteMediaAction(input, productionDependencies);
}

export async function previewMediaAction(input: unknown): Promise<MediaPreviewActionResult> {
  return executePreviewMediaAction(input, productionDependencies);
}
