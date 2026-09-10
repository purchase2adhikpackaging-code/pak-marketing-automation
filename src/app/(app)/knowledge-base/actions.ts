"use server";

import { z } from "zod";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { can } from "@/modules/auth/authorization";
import type { AppRole } from "@/modules/auth/roles";
import {
  SupabaseKnowledgeRepository,
  type CreateKnowledgeInput,
  type UpdateKnowledgeInput,
} from "@/modules/knowledge-base/repository";
import {
  createKnowledgeRecordSchema,
  updateKnowledgeRecordSchema,
} from "@/modules/knowledge-base/schema";
import type { KnowledgeRecord } from "@/modules/knowledge-base/types";

type Actor = { id: string };
type Membership = { role: AppRole } | null;

const archiveKnowledgeSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  expectedRevision: z.number().int().min(1),
});

const deleteKnowledgeSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export type KnowledgeActionResult =
  | { ok: true; record: KnowledgeRecord }
  | { ok: false; error: string };

export type DeleteKnowledgeActionResult = { ok: true } | { ok: false; error: string };

export type KnowledgeActionDependencies = {
  getActor(): Promise<Actor | null>;
  getMembership(actorId: string, organizationId: string): Promise<Membership>;
  create(input: CreateKnowledgeInput): Promise<KnowledgeRecord>;
  update(input: UpdateKnowledgeInput): Promise<KnowledgeRecord>;
  archive(
    id: string,
    organizationId: string,
    expectedRevision: number,
    actorUserId: string,
  ): Promise<KnowledgeRecord>;
  delete(id: string, organizationId: string): Promise<void>;
};

function mutationError(error: unknown): KnowledgeActionResult {
  if (error instanceof AppError && error.code === "CONFLICT") {
    return {
      ok: false,
      error: "This Knowledge Base record changed before your update completed. Refresh and try again.",
    };
  }

  return { ok: false, error: "Knowledge Base is temporarily unavailable." };
}

async function authorize(
  organizationId: string,
  permission: "knowledge:manage" | "knowledge:delete",
  dependencies: Pick<KnowledgeActionDependencies, "getActor" | "getMembership">,
): Promise<{ actorId: string } | { error: string }> {
  const actor = await dependencies.getActor();
  if (!actor) {
    return { error: "You must be signed in to manage Knowledge Base records." };
  }

  const membership = await dependencies.getMembership(actor.id, organizationId);
  if (!membership || !can(membership.role, permission)) {
    return {
      error:
        permission === "knowledge:delete"
          ? "You do not have permission to delete Knowledge Base records for this organization."
          : "You do not have permission to manage Knowledge Base records for this organization.",
    };
  }

  return { actorId: actor.id };
}

export async function executeCreateKnowledgeAction(
  input: unknown,
  dependencies: KnowledgeActionDependencies,
): Promise<KnowledgeActionResult> {
  const parsed = createKnowledgeRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the Knowledge Base details and try again." };
  }

  const authorization = await authorize(parsed.data.organizationId, "knowledge:manage", dependencies);
  if ("error" in authorization) {
    return { ok: false, error: authorization.error };
  }

  try {
    const record = await dependencies.create({
      organizationId: parsed.data.organizationId,
      title: parsed.data.title,
      content: parsed.data.content,
      sourceType: parsed.data.sourceType,
      ...(parsed.data.sourceLabel !== undefined ? { sourceLabel: parsed.data.sourceLabel } : {}),
      ...(parsed.data.sourceReference !== undefined
        ? { sourceReference: parsed.data.sourceReference }
        : {}),
      actorUserId: authorization.actorId,
    });
    return { ok: true, record };
  } catch (error) {
    return mutationError(error);
  }
}

export async function executeUpdateKnowledgeAction(
  input: unknown,
  dependencies: KnowledgeActionDependencies,
): Promise<KnowledgeActionResult> {
  const parsed = updateKnowledgeRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the Knowledge Base details and try again." };
  }

  const authorization = await authorize(parsed.data.organizationId, "knowledge:manage", dependencies);
  if ("error" in authorization) {
    return { ok: false, error: authorization.error };
  }

  try {
    const record = await dependencies.update({
      id: parsed.data.id,
      organizationId: parsed.data.organizationId,
      expectedRevision: parsed.data.expectedRevision,
      title: parsed.data.title,
      content: parsed.data.content,
      status: parsed.data.status,
      sourceType: parsed.data.sourceType,
      ...(parsed.data.sourceLabel !== undefined ? { sourceLabel: parsed.data.sourceLabel } : {}),
      ...(parsed.data.sourceReference !== undefined
        ? { sourceReference: parsed.data.sourceReference }
        : {}),
      actorUserId: authorization.actorId,
    });
    return { ok: true, record };
  } catch (error) {
    return mutationError(error);
  }
}

export async function executeArchiveKnowledgeAction(
  input: unknown,
  dependencies: KnowledgeActionDependencies,
): Promise<KnowledgeActionResult> {
  const parsed = archiveKnowledgeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the Knowledge Base details and try again." };
  }

  const authorization = await authorize(parsed.data.organizationId, "knowledge:manage", dependencies);
  if ("error" in authorization) {
    return { ok: false, error: authorization.error };
  }

  try {
    const record = await dependencies.archive(
      parsed.data.id,
      parsed.data.organizationId,
      parsed.data.expectedRevision,
      authorization.actorId,
    );
    return { ok: true, record };
  } catch (error) {
    return mutationError(error);
  }
}

export async function executeDeleteKnowledgeAction(
  input: unknown,
  dependencies: KnowledgeActionDependencies,
): Promise<DeleteKnowledgeActionResult> {
  const parsed = deleteKnowledgeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the Knowledge Base details and try again." };
  }

  const authorization = await authorize(parsed.data.organizationId, "knowledge:delete", dependencies);
  if ("error" in authorization) {
    return { ok: false, error: authorization.error };
  }

  try {
    await dependencies.delete(parsed.data.id, parsed.data.organizationId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Knowledge Base is temporarily unavailable." };
  }
}

async function getActor(): Promise<Actor | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

async function getMembership(actorId: string, organizationId: string): Promise<Membership> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", actorId)
    .maybeSingle();

  if (error || !data) return null;
  return { role: data.role as AppRole };
}

function productionDependencies(): KnowledgeActionDependencies {
  const repository = new SupabaseKnowledgeRepository();
  return {
    getActor,
    getMembership,
    create: (input) => repository.create(input),
    update: (input) => repository.update(input),
    archive: (id, organizationId, expectedRevision, actorUserId) =>
      repository.archive(id, organizationId, expectedRevision, actorUserId),
    delete: (id, organizationId) => repository.delete(id, organizationId),
  };
}

export async function createKnowledgeAction(input: unknown): Promise<KnowledgeActionResult> {
  return executeCreateKnowledgeAction(input, productionDependencies());
}

export async function updateKnowledgeAction(input: unknown): Promise<KnowledgeActionResult> {
  return executeUpdateKnowledgeAction(input, productionDependencies());
}

export async function archiveKnowledgeAction(input: unknown): Promise<KnowledgeActionResult> {
  return executeArchiveKnowledgeAction(input, productionDependencies());
}

export async function deleteKnowledgeAction(input: unknown): Promise<DeleteKnowledgeActionResult> {
  return executeDeleteKnowledgeAction(input, productionDependencies());
}
