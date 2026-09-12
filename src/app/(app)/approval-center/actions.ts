"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import { SupabaseApprovalRepository } from "@/modules/approval/repository";
import type {
  ApprovalDetail,
  ApprovalListPage,
  ApprovalListQuery,
} from "@/modules/approval/read-model";
import {
  decideApprovalInputSchema,
  submitApprovalInputSchema,
} from "@/modules/approval/schema";
import {
  APPROVAL_STATUSES,
  APPROVAL_TARGET_TYPES,
  type ApprovalStatus,
  type DecideApprovalInput,
  type SubmitApprovalInput,
} from "@/modules/approval/types";
import {
  invokeMediaLibrary,
  type MediaLibraryEdgeRequest,
} from "@/modules/integrations/edge-client";
import { SupabaseScenePlanningRepository } from "@/modules/scene-planning/repository";

const SUBMIT_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR"];
const DECIDE_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "REVIEWER"];
const REVIEW_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR", "REVIEWER"];

const listSchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(APPROVAL_STATUSES).optional(),
  targetType: z.enum(APPROVAL_TARGET_TYPES).optional(),
  limit: z.number().int().positive().max(50).optional(),
}).strict();

const detailSchema = z.object({
  organizationId: z.string().uuid(),
  requestId: z.string().uuid(),
}).strict();

const previewSchema = z.object({
  organizationId: z.string().uuid(),
  mediaAssetId: z.string().uuid(),
}).strict();

const previewResultSchema = z.object({
  mediaAssetId: z.string().uuid(),
  signedUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive().max(3600),
}).strict();

const decisionRpcResultSchema = z.object({
  approval_request_id: z.string().uuid(),
  status: z.enum(APPROVAL_STATUSES),
  stale_target: z.boolean(),
});

type Actor = { id: string };

export type ApprovalDecisionResult = {
  approvalRequestId: string;
  status: ApprovalStatus;
  staleTarget: boolean;
};

export type ApprovalCenterActionDependencies = {
  getActor(): Promise<Actor | null>;
  getRole(actorId: string, organizationId: string): Promise<AppRole | null>;
  submit(input: SubmitApprovalInput): Promise<string>;
  decide(input: DecideApprovalInput): Promise<ApprovalDecisionResult>;
  list(input: ApprovalListQuery): Promise<ApprovalListPage>;
  getDetail(organizationId: string, requestId: string): Promise<ApprovalDetail | null>;
  previewMedia(input: MediaLibraryEdgeRequest): Promise<unknown>;
};

export type SubmitApprovalActionResult =
  | { ok: true; requestId: string }
  | { ok: false; error: string };

export type DecideApprovalActionResult =
  | { ok: true; requestId: string; status: ApprovalStatus; staleTarget: boolean }
  | { ok: false; error: string };

export type ListApprovalActionResult =
  | { ok: true; page: ApprovalListPage }
  | { ok: false; error: string };

export type LoadApprovalDetailActionResult =
  | { ok: true; detail: ApprovalDetail | null }
  | { ok: false; error: string };

export type PreviewApprovalMediaActionResult =
  | { ok: true; mediaAssetId: string; signedUrl: string; expiresInSeconds: number }
  | { ok: false; error: string };

async function authorizeMember(
  organizationId: string,
  dependencies: ApprovalCenterActionDependencies,
): Promise<{ actor: Actor; role: AppRole } | { error: string }> {
  const actor = await dependencies.getActor();
  if (!actor) return { error: "You must be signed in to use the Approval Center." };
  const role = await dependencies.getRole(actor.id, organizationId);
  if (!role) return { error: "You do not have access to this organization's Approval Center." };
  return { actor, role };
}

export async function executeSubmitApprovalAction(
  input: unknown,
  dependencies: ApprovalCenterActionDependencies,
): Promise<SubmitApprovalActionResult> {
  const parsed = submitApprovalInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the approval target and review context." };

  try {
    const authorization = await authorizeMember(parsed.data.organizationId, dependencies);
    if ("error" in authorization) return { ok: false, error: authorization.error };
    if (!SUBMIT_ROLES.includes(authorization.role)) {
      return { ok: false, error: "You do not have permission to submit approval requests." };
    }
    const submission: SubmitApprovalInput = {
      organizationId: parsed.data.organizationId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      ...(parsed.data.publicationIntent !== undefined
        ? { publicationIntent: parsed.data.publicationIntent }
        : {}),
    };
    const requestId = await dependencies.submit(submission);
    return { ok: true, requestId };
  } catch {
    return { ok: false, error: "The approval request could not be submitted." };
  }
}

export async function executeDecideApprovalAction(
  input: unknown,
  dependencies: ApprovalCenterActionDependencies,
): Promise<DecideApprovalActionResult> {
  const parsed = decideApprovalInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the approval decision and comment." };

  try {
    const authorization = await authorizeMember(parsed.data.organizationId, dependencies);
    if ("error" in authorization) return { ok: false, error: authorization.error };
    if (!DECIDE_ROLES.includes(authorization.role)) {
      return { ok: false, error: "You do not have permission to decide approval requests." };
    }
    const decisionInput: DecideApprovalInput = {
      organizationId: parsed.data.organizationId,
      requestId: parsed.data.requestId,
      decision: parsed.data.decision,
      ...(parsed.data.comment !== undefined ? { comment: parsed.data.comment } : {}),
    };
    const decision = await dependencies.decide(decisionInput);
    return {
      ok: true,
      requestId: decision.approvalRequestId,
      status: decision.status,
      staleTarget: decision.staleTarget,
    };
  } catch {
    return { ok: false, error: "The approval decision could not be saved." };
  }
}

export async function executeListApprovalRequestsAction(
  input: unknown,
  dependencies: ApprovalCenterActionDependencies,
): Promise<ListApprovalActionResult> {
  const parsed = listSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the Approval Center filters." };

  try {
    const authorization = await authorizeMember(parsed.data.organizationId, dependencies);
    if ("error" in authorization) return { ok: false, error: authorization.error };
    if (!REVIEW_ROLES.includes(authorization.role)) {
      return { ok: false, error: "You do not have permission to view the Approval Center queue." };
    }
    const listInput: ApprovalListQuery = {
      organizationId: parsed.data.organizationId,
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.targetType !== undefined ? { targetType: parsed.data.targetType } : {}),
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
    };
    return { ok: true, page: await dependencies.list(listInput) };
  } catch {
    return { ok: false, error: "The Approval Center queue could not be loaded." };
  }
}

export async function executeLoadApprovalDetailAction(
  input: unknown,
  dependencies: ApprovalCenterActionDependencies,
): Promise<LoadApprovalDetailActionResult> {
  const parsed = detailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the approval request." };

  try {
    const authorization = await authorizeMember(parsed.data.organizationId, dependencies);
    if ("error" in authorization) return { ok: false, error: authorization.error };
    if (!REVIEW_ROLES.includes(authorization.role)) {
      return { ok: false, error: "You do not have permission to view approval details." };
    }
    return { ok: true, detail: await dependencies.getDetail(parsed.data.organizationId, parsed.data.requestId) };
  } catch {
    return { ok: false, error: "The approval request could not be loaded." };
  }
}

export async function executePreviewApprovalMediaAction(
  input: unknown,
  dependencies: ApprovalCenterActionDependencies,
): Promise<PreviewApprovalMediaActionResult> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the media asset." };

  try {
    const authorization = await authorizeMember(parsed.data.organizationId, dependencies);
    if ("error" in authorization) return { ok: false, error: authorization.error };
    const response = await dependencies.previewMedia({
      operation: "preview",
      organizationId: parsed.data.organizationId,
      mediaAssetId: parsed.data.mediaAssetId,
    });
    const safe = previewResultSchema.safeParse(response);
    if (!safe.success) return { ok: false, error: "The secure media preview response was invalid." };
    return { ok: true, ...safe.data };
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

const approvalRepository = new SupabaseApprovalRepository();
const roleRepository = new SupabaseScenePlanningRepository();

const productionDependencies: ApprovalCenterActionDependencies = {
  getActor: productionActor,
  getRole(actorId, organizationId) {
    return roleRepository.getActorRole(organizationId, actorId);
  },
  async submit(input) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("submit_approval_request", {
      _organization_id: input.organizationId,
      _target_type: input.targetType,
      _target_id: input.targetId,
      _publication_intent: input.publicationIntent ?? {},
    });
    if (error || typeof data !== "string") throw new Error("approval submission failed");
    return data;
  },
  async decide(input) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("decide_approval_request", {
      _organization_id: input.organizationId,
      _approval_request_id: input.requestId,
      _decision: input.decision,
      _comment: input.comment ?? null,
    });
    if (error) throw new Error("approval decision failed");
    const candidate = Array.isArray(data) ? data[0] : data;
    const parsed = decisionRpcResultSchema.safeParse(candidate);
    if (!parsed.success) throw new Error("invalid approval decision response");
    return {
      approvalRequestId: parsed.data.approval_request_id,
      status: parsed.data.status,
      staleTarget: parsed.data.stale_target,
    };
  },
  list(input) {
    return approvalRepository.list(input);
  },
  getDetail(organizationId, requestId) {
    return approvalRepository.getDetail(organizationId, requestId);
  },
  previewMedia(input) {
    return invokeMediaLibrary(input);
  },
};

export async function submitApprovalAction(input: unknown): Promise<SubmitApprovalActionResult> {
  return executeSubmitApprovalAction(input, productionDependencies);
}

export async function decideApprovalAction(input: unknown): Promise<DecideApprovalActionResult> {
  return executeDecideApprovalAction(input, productionDependencies);
}

export async function listApprovalRequestsAction(input: unknown): Promise<ListApprovalActionResult> {
  return executeListApprovalRequestsAction(input, productionDependencies);
}

export async function loadApprovalDetailAction(input: unknown): Promise<LoadApprovalDetailActionResult> {
  return executeLoadApprovalDetailAction(input, productionDependencies);
}

export async function previewApprovalMediaAction(input: unknown): Promise<PreviewApprovalMediaActionResult> {
  return executePreviewApprovalMediaAction(input, productionDependencies);
}
