import { describe, expect, it, vi } from "vitest";
import type { ScenePlanGeneration } from "@/modules/scene-planning/schema";
import { executeGranularReplanAction, type ScenePlanningGenerationContext } from "./granular-replan-actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const planVersionId = "33333333-3333-4333-8333-333333333333";
const nextPlanVersionId = "44444444-4444-4444-8444-444444444444";
const actorId = "55555555-5555-4555-8555-555555555555";

const context: ScenePlanningGenerationContext = {
  organizationId,
  project: {
    id: projectId,
    sourceIntegrityHash: "sha256:current",
    language: "EN",
    targetDurationSeconds: 10,
    aspectRatio: "16:9",
    qualityProfile: "CINEMATIC",
    targetPlatforms: ["youtube"],
    productionConstraints: {},
  },
  source: {
    id: "66666666-6666-4666-8666-666666666666",
    revision: 2,
    scriptText: "Alpha beta",
    integrityHash: "sha256:current",
  },
  visualBible: {},
};

const shot = (ordinal: number, direction: string, humanModified = false) => ({
  ordinal,
  durationSeconds: 5,
  narrationStartChar: ordinal === 1 ? 0 : 5,
  narrationEndChar: ordinal === 1 ? 5 : 10,
  narrationText: ordinal === 1 ? "Alpha" : " beta",
  creativeDirection: direction,
  masterVisualPrompt: `${direction} prompt`,
  negativeConstraints: [], subjectRefs: [], locationRefs: [], composition: "balanced", shotSize: "medium",
  cameraAngle: "eye level", lensIntent: "natural", cameraMotion: "slow push", subjectMotion: "natural",
  environmentMotion: "subtle", depthOfFieldIntent: "moderate", lighting: "daylight", mood: "credible",
  transitionIn: "cut", transitionOut: "cut", ambienceIntent: "room tone", sfxIntent: "none", musicIntent: "restrained",
  aspectRatio: "16:9" as const, continuityState: {},
  generationRequirements: { preserveNarration: true, providerNeutral: true, generatedDialogue: false },
  ...(humanModified ? { humanModified: true } : {}),
});

const currentPlan: ScenePlanGeneration = {
  scenes: [{
    ordinal: 1, title: "Hook", narrativeRole: "HOOK", durationSeconds: 10, creativeDirection: "Hook scene", continuityContext: {},
    shots: [shot(1, "Human edit", true), shot(2, "Target")],
  }],
};

describe("executeGranularReplanAction", () => {
  it("loads persisted context, requests the exact scope, validates the boundary, persists a new version, and reruns QC", async () => {
    const nextPlan = structuredClone(currentPlan);
    nextPlan.scenes[0]!.shots[1]!.creativeDirection = "Replanned target";
    const dependencies = {
      getActor: vi.fn().mockResolvedValue({ id: actorId }),
      loadReplanContext: vi.fn().mockResolvedValue({ context, currentPlan }),
      generatePlan: vi.fn().mockResolvedValue({ plan: nextPlan, provider: "openai", model: "gpt-5.6-terra" }),
      validateBoundary: vi.fn(),
      persistPlan: vi.fn().mockResolvedValue({ id: nextPlanVersionId }),
      runAndPersistQc: vi.fn().mockResolvedValue({ blockerCount: 0, warningCount: 1 }),
    };

    const result = await executeGranularReplanAction({
      organizationId,
      planVersionId,
      scope: "SHOT",
      targetSceneOrdinal: 1,
      targetShotOrdinal: 2,
      replaceHumanModifiedShots: false,
    }, dependencies);

    expect(result).toEqual({ ok: true, planVersionId: nextPlanVersionId, blockerCount: 0, warningCount: 1 });
    expect(dependencies.loadReplanContext).toHaveBeenCalledWith(organizationId, planVersionId);
    expect(dependencies.generatePlan).toHaveBeenCalledWith(context, currentPlan, {
      scope: "SHOT",
      targetSceneOrdinal: 1,
      targetShotOrdinal: 2,
      preserveHumanModifiedShots: true,
    });
    expect(dependencies.validateBoundary).toHaveBeenCalledWith(currentPlan, nextPlan, expect.objectContaining({ scope: "SHOT", targetShotOrdinal: 2 }));
    expect(dependencies.persistPlan).toHaveBeenCalledWith(actorId, context, expect.objectContaining({ plan: nextPlan }));
    expect(dependencies.runAndPersistQc).toHaveBeenCalledWith(nextPlanVersionId, context, nextPlan);
  });

  it("refuses stale source before provider or persistence work", async () => {
    const staleContext = { ...context, source: { ...context.source, integrityHash: "sha256:new" } };
    const dependencies = {
      getActor: vi.fn().mockResolvedValue({ id: actorId }),
      loadReplanContext: vi.fn().mockResolvedValue({ context: staleContext, currentPlan }),
      generatePlan: vi.fn(), validateBoundary: vi.fn(), persistPlan: vi.fn(), runAndPersistQc: vi.fn(),
    };
    const result = await executeGranularReplanAction({ organizationId, planVersionId, scope: "SCENE", targetSceneOrdinal: 1, replaceHumanModifiedShots: false }, dependencies);
    expect(result).toEqual({ ok: false, error: "The source artifact changed. Refresh Scene Planning before replanning." });
    expect(dependencies.generatePlan).not.toHaveBeenCalled();
    expect(dependencies.persistPlan).not.toHaveBeenCalled();
  });

  it("maps boundary/provider failures to a safe replan error and does not persist", async () => {
    const dependencies = {
      getActor: vi.fn().mockResolvedValue({ id: actorId }),
      loadReplanContext: vi.fn().mockResolvedValue({ context, currentPlan }),
      generatePlan: vi.fn().mockResolvedValue({ plan: structuredClone(currentPlan), provider: "openai", model: "gpt-5.6-terra" }),
      validateBoundary: vi.fn().mockImplementation(() => { throw new Error("provider changed sibling"); }),
      persistPlan: vi.fn(), runAndPersistQc: vi.fn(),
    };
    const result = await executeGranularReplanAction({ organizationId, planVersionId, scope: "SHOT", targetSceneOrdinal: 1, targetShotOrdinal: 2, replaceHumanModifiedShots: false }, dependencies);
    expect(result).toEqual({ ok: false, error: "Granular Scene Planning replan is temporarily unavailable." });
    expect(dependencies.persistPlan).not.toHaveBeenCalled();
  });
});
