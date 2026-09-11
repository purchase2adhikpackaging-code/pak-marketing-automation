import { AppError } from "@/lib/errors/app-error";
import type { AppRole } from "@/modules/auth/roles";
import {
  ScenePlanGenerationSchema,
  type ScenePlanGeneration,
  type ScenePlanStatus,
} from "./schema";
import { assertScenePlanTransition } from "./workflow";

const EDIT_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR"];
const APPROVE_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "REVIEWER"];

export type ScenePlanningSourceArtifact = {
  id: string;
  organizationId: string;
  contentItemId: string;
  language: "EN" | "PL" | "HI";
  status: "PENDING" | "GENERATING" | "GENERATED" | "STALE" | "FAILED";
  scriptText?: string;
  revision: number;
};

export type ScenePlanVersionSummary = {
  id: string;
  organizationId: string;
  videoProjectId: string;
  versionNumber: number;
  status: ScenePlanStatus;
  sourceIntegrityHash: string;
};

export type CreateProjectPersistenceInput = {
  id: string;
  organizationId: string;
  sourceContentId: string;
  sourceArtifactId: string;
  sourceArtifactRevision: number;
  sourceIntegrityHash: string;
  language: "EN" | "PL" | "HI";
  title: string;
  purpose: string;
  targetPlatforms: string[];
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
  targetDurationSeconds: number;
  qualityProfile: "STANDARD" | "PREMIUM" | "CINEMATIC";
  audience: Record<string, unknown>;
  productionConstraints: Record<string, unknown>;
  createdBy: string;
};

export type PersistDraftGraphInput = {
  organizationId: string;
  videoProjectId: string;
  versionNumber: number;
  sourceIntegrityHash: string;
  status: "DRAFT";
  canonicalNarration: string;
  language: "EN" | "PL" | "HI";
  aspectRatio: string;
  plannerProvider: string;
  plannerModel: string;
  creativeBriefSnapshot: Record<string, unknown>;
  visualBibleSnapshot: Record<string, unknown>;
  createdBy: string;
  scenes: ScenePlanGeneration["scenes"];
};

export interface ScenePlanningRepository {
  getActorRole(organizationId: string, actorUserId: string): Promise<AppRole | null>;
  loadSourceArtifact(organizationId: string, sourceArtifactId: string): Promise<ScenePlanningSourceArtifact | null>;
  createProject(input: CreateProjectPersistenceInput): Promise<CreateProjectPersistenceInput & { id: string }>;
  getNextVersionNumber(organizationId: string, videoProjectId: string): Promise<number>;
  persistDraftGraph(input: PersistDraftGraphInput): Promise<unknown>;
  loadPlanVersion(organizationId: string, planVersionId: string): Promise<ScenePlanVersionSummary | null>;
  clonePlanVersion(
    organizationId: string,
    planVersionId: string,
    nextVersionNumber: number,
    actorUserId: string,
  ): Promise<unknown>;
  updatePlanStatus(
    organizationId: string,
    planVersionId: string,
    status: ScenePlanStatus,
    metadata?: { approvedBy?: string; approvedAt?: string },
  ): Promise<unknown>;
  countQcBlockers(organizationId: string, planVersionId: string): Promise<number>;
  loadCurrentSourceIntegrityHash(organizationId: string, videoProjectId: string): Promise<string>;
}

export type ScenePlanningServiceDependencies = {
  now(): Date;
  createId(): string;
  hashSource(source: { artifactId: string; revision: number; scriptText: string }): Promise<string>;
};

export type CreateScenePlanningProjectInput = {
  organizationId: string;
  actorUserId: string;
  sourceArtifactId: string;
  title: string;
  purpose?: string;
  targetPlatforms: string[];
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
  targetDurationSeconds: number;
  qualityProfile: "STANDARD" | "PREMIUM" | "CINEMATIC";
  audience?: Record<string, unknown>;
  productionConstraints?: Record<string, unknown>;
};

export type PersistGeneratedPlanInput = {
  organizationId: string;
  actorUserId: string;
  videoProjectId: string;
  sourceIntegrityHash: string;
  canonicalNarration: string;
  language: "EN" | "PL" | "HI";
  aspectRatio: string;
  plannerProvider: string;
  plannerModel: string;
  creativeBriefSnapshot: Record<string, unknown>;
  visualBibleSnapshot: Record<string, unknown>;
  plan: unknown;
};

export class ScenePlanningService {
  constructor(
    private readonly repository: ScenePlanningRepository,
    private readonly dependencies: ScenePlanningServiceDependencies,
  ) {}

  private async requireRole(
    organizationId: string,
    actorUserId: string,
    allowedRoles: readonly AppRole[],
    message: string,
  ): Promise<AppRole> {
    const role = await this.repository.getActorRole(organizationId, actorUserId);
    if (!role || !allowedRoles.includes(role)) {
      throw new AppError("FORBIDDEN", message);
    }
    return role;
  }

  async createProject(input: CreateScenePlanningProjectInput) {
    await this.requireRole(
      input.organizationId,
      input.actorUserId,
      EDIT_ROLES,
      "You do not have permission to create Scene Planning projects for this organization.",
    );

    const source = await this.repository.loadSourceArtifact(input.organizationId, input.sourceArtifactId);
    if (!source) {
      throw new AppError("NOT_FOUND", "The selected persisted script artifact is unavailable.");
    }
    if (source.organizationId !== input.organizationId) {
      throw new AppError("FORBIDDEN", "The selected script artifact belongs to another organization.");
    }
    if (source.status !== "GENERATED" || !source.scriptText?.trim()) {
      throw new AppError("CONFLICT", "Only complete, current script artifacts can enter Scene Planning.");
    }

    const sourceIntegrityHash = await this.dependencies.hashSource({
      artifactId: source.id,
      revision: source.revision,
      scriptText: source.scriptText,
    });

    return this.repository.createProject({
      id: this.dependencies.createId(),
      organizationId: input.organizationId,
      sourceContentId: source.contentItemId,
      sourceArtifactId: source.id,
      sourceArtifactRevision: source.revision,
      sourceIntegrityHash,
      language: source.language,
      title: input.title.trim(),
      purpose: input.purpose?.trim() ?? "",
      targetPlatforms: [...new Set(input.targetPlatforms.map((platform) => platform.trim()).filter(Boolean))],
      aspectRatio: input.aspectRatio,
      targetDurationSeconds: input.targetDurationSeconds,
      qualityProfile: input.qualityProfile,
      audience: input.audience ?? {},
      productionConstraints: input.productionConstraints ?? {},
      createdBy: input.actorUserId,
    });
  }

  async persistGeneratedPlan(input: PersistGeneratedPlanInput) {
    await this.requireRole(
      input.organizationId,
      input.actorUserId,
      EDIT_ROLES,
      "You do not have permission to persist Scene Planning drafts for this organization.",
    );

    const parsedPlan = ScenePlanGenerationSchema.safeParse(input.plan);
    if (!parsedPlan.success) {
      throw new AppError("VALIDATION_ERROR", "Generated Scene Planning data failed schema validation.");
    }

    const currentSourceHash = await this.repository.loadCurrentSourceIntegrityHash(
      input.organizationId,
      input.videoProjectId,
    );
    if (currentSourceHash !== input.sourceIntegrityHash) {
      throw new AppError("CONFLICT", "The source artifact changed before the scene plan could be persisted.");
    }

    const versionNumber = await this.repository.getNextVersionNumber(input.organizationId, input.videoProjectId);
    return this.repository.persistDraftGraph({
      organizationId: input.organizationId,
      videoProjectId: input.videoProjectId,
      versionNumber,
      sourceIntegrityHash: input.sourceIntegrityHash,
      status: "DRAFT",
      canonicalNarration: input.canonicalNarration,
      language: input.language,
      aspectRatio: input.aspectRatio,
      plannerProvider: input.plannerProvider,
      plannerModel: input.plannerModel,
      creativeBriefSnapshot: structuredClone(input.creativeBriefSnapshot),
      visualBibleSnapshot: structuredClone(input.visualBibleSnapshot),
      createdBy: input.actorUserId,
      scenes: parsedPlan.data.scenes,
    });
  }

  async cloneForEdit(input: { organizationId: string; actorUserId: string; planVersionId: string }) {
    await this.requireRole(
      input.organizationId,
      input.actorUserId,
      EDIT_ROLES,
      "You do not have permission to edit Scene Planning drafts for this organization.",
    );
    const plan = await this.repository.loadPlanVersion(input.organizationId, input.planVersionId);
    if (!plan) throw new AppError("NOT_FOUND", "Scene plan version was not found.");

    const nextVersionNumber = await this.repository.getNextVersionNumber(input.organizationId, plan.videoProjectId);
    return this.repository.clonePlanVersion(
      input.organizationId,
      input.planVersionId,
      nextVersionNumber,
      input.actorUserId,
    );
  }

  async submitForReview(input: { organizationId: string; actorUserId: string; planVersionId: string }) {
    await this.requireRole(
      input.organizationId,
      input.actorUserId,
      EDIT_ROLES,
      "You do not have permission to submit Scene Planning drafts for review.",
    );
    const plan = await this.repository.loadPlanVersion(input.organizationId, input.planVersionId);
    if (!plan) throw new AppError("NOT_FOUND", "Scene plan version was not found.");
    const blockerCount = await this.repository.countQcBlockers(input.organizationId, input.planVersionId);
    const currentSourceHash = await this.repository.loadCurrentSourceIntegrityHash(
      input.organizationId,
      plan.videoProjectId,
    );
    assertScenePlanTransition(plan.status, "REVIEW_REQUIRED", {
      blockerCount,
      sourceFresh: currentSourceHash === plan.sourceIntegrityHash,
    });
    return this.repository.updatePlanStatus(input.organizationId, input.planVersionId, "REVIEW_REQUIRED");
  }

  async approvePlan(input: { organizationId: string; actorUserId: string; planVersionId: string }) {
    await this.requireRole(
      input.organizationId,
      input.actorUserId,
      APPROVE_ROLES,
      "You do not have permission to approve Scene Planning versions.",
    );
    const plan = await this.repository.loadPlanVersion(input.organizationId, input.planVersionId);
    if (!plan) throw new AppError("NOT_FOUND", "Scene plan version was not found.");
    const blockerCount = await this.repository.countQcBlockers(input.organizationId, input.planVersionId);
    const currentSourceHash = await this.repository.loadCurrentSourceIntegrityHash(
      input.organizationId,
      plan.videoProjectId,
    );
    assertScenePlanTransition(plan.status, "APPROVED", {
      blockerCount,
      sourceFresh: currentSourceHash === plan.sourceIntegrityHash,
    });
    return this.repository.updatePlanStatus(input.organizationId, input.planVersionId, "APPROVED", {
      approvedBy: input.actorUserId,
      approvedAt: this.dependencies.now().toISOString(),
    });
  }
}
