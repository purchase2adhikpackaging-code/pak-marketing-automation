import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import {
  ScenePlanningService,
  type ScenePlanningRepository,
  type ScenePlanningSourceArtifact,
} from "./service";

const sourceArtifact: ScenePlanningSourceArtifact = {
  id: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  contentItemId: "33333333-3333-4333-8333-333333333333",
  language: "EN",
  status: "GENERATED",
  scriptText: "Exact approved railway narration.",
  revision: 4,
};

function repository(overrides: Partial<ScenePlanningRepository> = {}): ScenePlanningRepository {
  return {
    getActorRole: vi.fn().mockResolvedValue("OWNER"),
    loadSourceArtifact: vi.fn().mockResolvedValue(sourceArtifact),
    createProject: vi.fn().mockImplementation(async (input) => ({ id: "project-1", ...input })),
    getNextVersionNumber: vi.fn().mockResolvedValue(2),
    persistDraftGraph: vi.fn().mockImplementation(async (input) => ({ id: "plan-v2", ...input })),
    loadPlanVersion: vi.fn().mockResolvedValue(null),
    clonePlanVersion: vi.fn().mockResolvedValue({ id: "plan-v4", versionNumber: 4, status: "DRAFT" }),
    updatePlanStatus: vi.fn().mockImplementation(async (_organizationId, _planId, status) => ({ status })),
    countQcBlockers: vi.fn().mockResolvedValue(0),
    loadCurrentSourceIntegrityHash: vi.fn().mockResolvedValue("hash-current-123456"),
    ...overrides,
  };
}

function service(repo: ScenePlanningRepository = repository()) {
  return new ScenePlanningService(repo, {
    now: () => new Date("2026-09-11T10:00:00.000Z"),
    createId: () => "project-1",
    hashSource: async () => "hash-current-123456",
  });
}

describe("ScenePlanningService", () => {
  it("enforces existing edit and approval role boundaries", async () => {
    const analystRepo = repository({ getActorRole: vi.fn().mockResolvedValue("ANALYST") });
    await expect(
      service(analystRepo).createProject({
        organizationId: sourceArtifact.organizationId,
        actorUserId: "44444444-4444-4444-8444-444444444444",
        sourceArtifactId: sourceArtifact.id,
        title: "PAK credibility film",
        targetDurationSeconds: 55,
        aspectRatio: "16:9",
        qualityProfile: "CINEMATIC",
        targetPlatforms: ["youtube"],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const reviewerRepo = repository({
      getActorRole: vi.fn().mockResolvedValue("REVIEWER"),
      loadPlanVersion: vi.fn().mockResolvedValue({
        id: "plan-v3",
        organizationId: sourceArtifact.organizationId,
        videoProjectId: "project-1",
        versionNumber: 3,
        status: "REVIEW_REQUIRED",
        sourceIntegrityHash: "hash-current-123456",
      }),
    });
    await expect(
      service(reviewerRepo).approvePlan({
        organizationId: sourceArtifact.organizationId,
        actorUserId: "44444444-4444-4444-8444-444444444444",
        planVersionId: "plan-v3",
      }),
    ).resolves.toBeDefined();
  });

  it("rejects cross-tenant source artifacts before project creation", async () => {
    const repo = repository();
    await expect(
      service(repo).createProject({
        organizationId: "99999999-9999-4999-8999-999999999999",
        actorUserId: "44444444-4444-4444-8444-444444444444",
        sourceArtifactId: sourceArtifact.id,
        title: "PAK credibility film",
        targetDurationSeconds: 55,
        aspectRatio: "16:9",
        qualityProfile: "CINEMATIC",
        targetPlatforms: ["youtube"],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repo.createProject).not.toHaveBeenCalled();
  });

  it("rejects stale or incomplete source artifacts", async () => {
    const repo = repository({
      loadSourceArtifact: vi.fn().mockResolvedValue({ ...sourceArtifact, status: "STALE" }),
    });
    await expect(
      service(repo).createProject({
        organizationId: sourceArtifact.organizationId,
        actorUserId: "44444444-4444-4444-8444-444444444444",
        sourceArtifactId: sourceArtifact.id,
        title: "PAK credibility film",
        targetDurationSeconds: 55,
        aspectRatio: "16:9",
        qualityProfile: "CINEMATIC",
        targetPlatforms: ["youtube"],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("creates a project from the server-resolved persisted source identity and hash", async () => {
    const repo = repository();
    const result = await service(repo).createProject({
      organizationId: sourceArtifact.organizationId,
      actorUserId: "44444444-4444-4444-8444-444444444444",
      sourceArtifactId: sourceArtifact.id,
      title: "PAK credibility film",
      targetDurationSeconds: 55,
      aspectRatio: "16:9",
      qualityProfile: "CINEMATIC",
      targetPlatforms: ["youtube", "linkedin"],
    });

    expect(result.sourceArtifactId).toBe(sourceArtifact.id);
    expect(result.sourceArtifactRevision).toBe(4);
    expect(result.sourceIntegrityHash).toBe("hash-current-123456");
    expect(repo.createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: sourceArtifact.organizationId,
        sourceContentId: sourceArtifact.contentItemId,
        sourceArtifactId: sourceArtifact.id,
        sourceArtifactRevision: 4,
        sourceIntegrityHash: "hash-current-123456",
      }),
    );
  });

  it("persists a complete generated plan through one atomic repository operation with next version number", async () => {
    const repo = repository();
    const plan = {
      scenes: [
        {
          ordinal: 1,
          title: "Opening",
          narrativeRole: "HOOK" as const,
          durationSeconds: 5,
          creativeDirection: "Open credibly.",
          continuityContext: {},
          shots: [
            {
              ordinal: 1,
              durationSeconds: 5,
              narrationStartChar: 0,
              narrationEndChar: 5,
              narrationText: "Exact",
              creativeDirection: "Railway lab opening.",
              masterVisualPrompt: "Photorealistic railway lab.",
              negativeConstraints: [],
              subjectRefs: [],
              locationRefs: [],
              composition: "balanced",
              shotSize: "wide",
              cameraAngle: "eye level",
              lensIntent: "35mm",
              cameraMotion: "slow push",
              subjectMotion: "natural",
              environmentMotion: "subtle",
              depthOfFieldIntent: "moderate",
              lighting: "daylight",
              mood: "credible",
              transitionIn: "cut",
              transitionOut: "cut",
              ambienceIntent: "room tone",
              sfxIntent: "none",
              musicIntent: "restrained",
              aspectRatio: "16:9" as const,
              continuityState: {},
              generationRequirements: { preserveNarration: true, providerNeutral: true, generatedDialogue: false },
            },
          ],
        },
      ],
    };

    await service(repo).persistGeneratedPlan({
      organizationId: sourceArtifact.organizationId,
      actorUserId: "44444444-4444-4444-8444-444444444444",
      videoProjectId: "project-1",
      sourceIntegrityHash: "hash-current-123456",
      canonicalNarration: "Exact",
      language: "EN",
      aspectRatio: "16:9",
      plannerProvider: "openai",
      plannerModel: "gpt-5.6-terra",
      creativeBriefSnapshot: {},
      visualBibleSnapshot: {},
      plan,
    });

    expect(repo.getNextVersionNumber).toHaveBeenCalledWith(sourceArtifact.organizationId, "project-1");
    expect(repo.persistDraftGraph).toHaveBeenCalledTimes(1);
    expect(repo.persistDraftGraph).toHaveBeenCalledWith(
      expect.objectContaining({ versionNumber: 2, status: "DRAFT", scenes: plan.scenes }),
    );
  });

  it("approves only a fresh zero-blocker review version and rejects stale approval", async () => {
    const current = {
      id: "plan-v3",
      organizationId: sourceArtifact.organizationId,
      videoProjectId: "project-1",
      versionNumber: 3,
      status: "REVIEW_REQUIRED" as const,
      sourceIntegrityHash: "hash-current-123456",
    };
    const repo = repository({ loadPlanVersion: vi.fn().mockResolvedValue(current) });
    await service(repo).approvePlan({
      organizationId: sourceArtifact.organizationId,
      actorUserId: "44444444-4444-4444-8444-444444444444",
      planVersionId: current.id,
    });
    expect(repo.updatePlanStatus).toHaveBeenCalledWith(
      sourceArtifact.organizationId,
      current.id,
      "APPROVED",
      expect.objectContaining({ approvedBy: "44444444-4444-4444-8444-444444444444" }),
    );

    const staleRepo = repository({
      loadPlanVersion: vi.fn().mockResolvedValue(current),
      loadCurrentSourceIntegrityHash: vi.fn().mockResolvedValue("hash-new-123456789"),
    });
    await expect(
      service(staleRepo).approvePlan({
        organizationId: sourceArtifact.organizationId,
        actorUserId: "44444444-4444-4444-8444-444444444444",
        planVersionId: current.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("delegates approved edits to copy-on-write cloning", async () => {
    const current = {
      id: "plan-v3",
      organizationId: sourceArtifact.organizationId,
      videoProjectId: "project-1",
      versionNumber: 3,
      status: "APPROVED" as const,
      sourceIntegrityHash: "hash-current-123456",
    };
    const repo = repository({ loadPlanVersion: vi.fn().mockResolvedValue(current) });
    await service(repo).cloneForEdit({
      organizationId: sourceArtifact.organizationId,
      actorUserId: "44444444-4444-4444-8444-444444444444",
      planVersionId: current.id,
    });
    expect(repo.clonePlanVersion).toHaveBeenCalledWith(
      sourceArtifact.organizationId,
      current.id,
      4,
      "44444444-4444-4444-8444-444444444444",
    );
  });

  it("surfaces repository failures instead of pretending partial persistence succeeded", async () => {
    const repo = repository({
      persistDraftGraph: vi.fn().mockRejectedValue(new AppError("INTERNAL_ERROR", "atomic persistence failed")),
    });
    await expect(
      service(repo).persistGeneratedPlan({
        organizationId: sourceArtifact.organizationId,
        actorUserId: "44444444-4444-4444-8444-444444444444",
        videoProjectId: "project-1",
        sourceIntegrityHash: "hash-current-123456",
        canonicalNarration: "Exact",
        language: "EN",
        aspectRatio: "16:9",
        plannerProvider: "openai",
        plannerModel: "gpt-5.6-terra",
        creativeBriefSnapshot: {},
        visualBibleSnapshot: {},
        plan: { scenes: [] },
      }),
    ).rejects.toThrow("atomic persistence failed");
  });
});
