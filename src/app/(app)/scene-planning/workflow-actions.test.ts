import { describe, expect, it, vi } from "vitest";
import {
  executeApproveScenePlanAction,
  executeGenerateScenePlanAction,
  type ScenePlanningGenerationContext,
} from "./workflow-actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const planVersionId = "33333333-3333-4333-8333-333333333333";
const actorId = "44444444-4444-4444-8444-444444444444";

const context: ScenePlanningGenerationContext = {
  organizationId,
  project: {
    id: projectId,
    sourceIntegrityHash: "sha256:current",
    language: "EN",
    targetDurationSeconds: 55,
    aspectRatio: "16:9",
    qualityProfile: "CINEMATIC",
    targetPlatforms: ["youtube"],
    productionConstraints: {},
  },
  source: {
    id: "55555555-5555-4555-8555-555555555555",
    revision: 2,
    scriptText: "Canonical railway narration.",
    integrityHash: "sha256:current",
  },
  visualBible: { realismLevel: "photorealistic" },
};

const generatedPlan = {
  scenes: [
    {
      ordinal: 1,
      title: "Opening",
      narrativeRole: "HOOK" as const,
      durationSeconds: 5,
      creativeDirection: "Open with credibility.",
      continuityContext: {},
      shots: [
        {
          ordinal: 1,
          durationSeconds: 5,
          narrationStartChar: 0,
          narrationEndChar: 5,
          narrationText: "Canon",
          creativeDirection: "Railway lab establishing shot.",
          masterVisualPrompt: "Photorealistic railway training lab.",
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

describe("Scene Planning workflow actions", () => {
  it("generates from server-loaded project/source context, persists once, then runs deterministic QC", async () => {
    const dependencies = {
      getActor: vi.fn().mockResolvedValue({ id: actorId }),
      loadGenerationContext: vi.fn().mockResolvedValue(context),
      generatePlan: vi.fn().mockResolvedValue({ plan: generatedPlan, provider: "openai", model: "gpt-5.6-terra" }),
      persistPlan: vi.fn().mockResolvedValue({ id: planVersionId }),
      runAndPersistQc: vi.fn().mockResolvedValue({ blockerCount: 0, warningCount: 1 }),
    };

    const result = await executeGenerateScenePlanAction({ organizationId, projectId }, dependencies);

    expect(result).toEqual({ ok: true, planVersionId, blockerCount: 0, warningCount: 1 });
    expect(dependencies.loadGenerationContext).toHaveBeenCalledWith(organizationId, projectId);
    expect(dependencies.generatePlan).toHaveBeenCalledWith(context);
    expect(dependencies.persistPlan).toHaveBeenCalledTimes(1);
    expect(dependencies.runAndPersistQc).toHaveBeenCalledWith(planVersionId, context, generatedPlan);
  });

  it("rejects non-editor actors before loading context or spending planner tokens", async () => {
    const dependencies = {
      getActor: vi.fn().mockResolvedValue({ id: actorId }),
      authorize: vi.fn().mockResolvedValue(false),
      loadGenerationContext: vi.fn().mockResolvedValue(context),
      generatePlan: vi.fn().mockResolvedValue({ plan: generatedPlan, provider: "openai", model: "gpt-5.6-terra" }),
      persistPlan: vi.fn().mockResolvedValue({ id: planVersionId }),
      runAndPersistQc: vi.fn().mockResolvedValue({ blockerCount: 0, warningCount: 0 }),
    };

    const result = await executeGenerateScenePlanAction({ organizationId, projectId }, dependencies);

    expect(result).toEqual({ ok: false, error: "You do not have permission to generate a Scene Plan for this organization." });
    expect(dependencies.authorize).toHaveBeenCalledWith(actorId, organizationId);
    expect(dependencies.loadGenerationContext).not.toHaveBeenCalled();
    expect(dependencies.generatePlan).not.toHaveBeenCalled();
    expect(dependencies.persistPlan).not.toHaveBeenCalled();
    expect(dependencies.runAndPersistQc).not.toHaveBeenCalled();
  });

  it("does not persist or run QC when source integrity is stale", async () => {
    const stale = { ...context, source: { ...context.source, integrityHash: "sha256:new" } };
    const dependencies = {
      getActor: vi.fn().mockResolvedValue({ id: actorId }),
      loadGenerationContext: vi.fn().mockResolvedValue(stale),
      generatePlan: vi.fn(),
      persistPlan: vi.fn(),
      runAndPersistQc: vi.fn(),
    };
    const result = await executeGenerateScenePlanAction({ organizationId, projectId }, dependencies);
    expect(result).toEqual({ ok: false, error: "The source artifact changed. Create or refresh the Scene Planning project before generating." });
    expect(dependencies.generatePlan).not.toHaveBeenCalled();
    expect(dependencies.persistPlan).not.toHaveBeenCalled();
  });

  it("rejects non-reviewer approval before warning acknowledgement mutation", async () => {
    const dependencies = {
      getActor: vi.fn().mockResolvedValue({ id: actorId }),
      authorize: vi.fn().mockResolvedValue(false),
      countUnacknowledgedWarnings: vi.fn().mockResolvedValue(1),
      acknowledgeWarnings: vi.fn(),
      approvePlan: vi.fn(),
    };

    const result = await executeApproveScenePlanAction(
      { organizationId, planVersionId, acknowledgeWarnings: true },
      dependencies,
    );

    expect(result).toEqual({ ok: false, error: "You do not have permission to approve a Scene Plan for this organization." });
    expect(dependencies.authorize).toHaveBeenCalledWith(actorId, organizationId);
    expect(dependencies.countUnacknowledgedWarnings).not.toHaveBeenCalled();
    expect(dependencies.acknowledgeWarnings).not.toHaveBeenCalled();
    expect(dependencies.approvePlan).not.toHaveBeenCalled();
  });

  it("requires warning acknowledgement before approval and never performs provider execution", async () => {
    const dependencies = {
      getActor: vi.fn().mockResolvedValue({ id: actorId }),
      countUnacknowledgedWarnings: vi.fn().mockResolvedValue(2),
      acknowledgeWarnings: vi.fn(),
      approvePlan: vi.fn(),
    };
    const denied = await executeApproveScenePlanAction(
      { organizationId, planVersionId, acknowledgeWarnings: false },
      dependencies,
    );
    expect(denied).toEqual({ ok: false, error: "Acknowledge the outstanding QC warnings before approval." });
    expect(dependencies.approvePlan).not.toHaveBeenCalled();

    const approved = await executeApproveScenePlanAction(
      { organizationId, planVersionId, acknowledgeWarnings: true },
      dependencies,
    );
    expect(approved).toEqual({ ok: true });
    expect(dependencies.acknowledgeWarnings).toHaveBeenCalledWith(organizationId, planVersionId, actorId);
    expect(dependencies.approvePlan).toHaveBeenCalledWith(organizationId, planVersionId, actorId);
  });
});
