import { describe, expect, it, vi } from "vitest";
import type { TextGenerationProvider } from "@/modules/ai/text/provider";
import { buildScenePlannerRequest, generateScenePlan, selectScenePlannerModel } from "./planner";

const input = {
  canonicalNarration: "Exact narration must remain unchanged.",
  language: "EN" as const,
  targetDurationSeconds: 55,
  aspectRatio: "16:9",
  qualityProfile: "CINEMATIC" as const,
  targetPlatforms: ["youtube", "linkedin"],
  productionConstraints: ["no generated on-screen text", "no unsafe railway behavior"],
  visualBible: {
    realismLevel: "photorealistic institutional documentary-cinematic",
    cameraLanguage: "restrained 28-50mm feel",
    lighting: "natural daylight and soft industrial practicals",
    globalNegativeConstraints: ["no plastic faces", "no impossible railway geometry"],
  },
};

const validProviderPlan = {
  scenes: [
    {
      ordinal: 1,
      title: "Opening",
      narrativeRole: "HOOK",
      durationSeconds: 6,
      creativeDirection: "Establish technical seriousness.",
      continuityContext: {},
      shots: [
        {
          ordinal: 1,
          durationSeconds: 6,
          narrationStartChar: 0,
          narrationEndChar: 38,
          narrationText: input.canonicalNarration,
          creativeDirection: "Trainer enters a realistic railway lab.",
          masterVisualPrompt: "Photorealistic European railway training laboratory.",
          negativeConstraints: [],
          subjectRefs: [],
          locationRefs: [],
          composition: "balanced medium-wide",
          shotSize: "medium-wide",
          cameraAngle: "eye level",
          lensIntent: "35mm documentary feel",
          cameraMotion: "slow dolly in",
          subjectMotion: "natural walking pace",
          environmentMotion: "subtle background activity",
          depthOfFieldIntent: "moderate depth",
          lighting: "natural daylight",
          mood: "credible",
          transitionIn: "clean cut",
          transitionOut: "cut",
          ambienceIntent: "room tone",
          sfxIntent: "subtle equipment",
          musicIntent: "restrained underscore",
          aspectRatio: "16:9",
          continuityState: {},
          generationRequirements: { preserveNarration: true, providerNeutral: true, generatedDialogue: false },
        },
      ],
    },
  ],
};

describe("Scene Planner", () => {
  it("uses Terra by default and allows Luna as the cost-saving override", () => {
    expect(selectScenePlannerModel()).toBe("gpt-5.6-terra");
    expect(selectScenePlannerModel("gpt-5.6-luna")).toBe("gpt-5.6-luna");
    expect(() => selectScenePlannerModel("gpt-5.6-sol")).toThrow(/not allowed/i);
  });

  it("preserves canonical narration and requires provider-neutral semantic scene/shot output", () => {
    const request = buildScenePlannerRequest(input);
    expect(request.prompt).toContain(input.canonicalNarration);
    expect(request.prompt).toContain("DO NOT rewrite, paraphrase, shorten, expand, translate, or invent narration");
    expect(request.prompt).toContain("Scene = narrative unit");
    expect(request.prompt).toContain("Shot = generation unit");
    expect(request.prompt).toContain("provider-neutral");
    expect(request.prompt).toContain("creativeDirection");
    expect(request.prompt).toContain("masterVisualPrompt");
    expect(request.prompt).toContain("narrationStartChar");
    expect(request.prompt).toContain("[start,end)");
  });

  it("supports granular replanning while protecting human-modified shots", () => {
    const request = buildScenePlannerRequest({
      ...input,
      replan: {
        scope: "SCENE",
        targetSceneOrdinal: 3,
        preserveHumanModifiedShots: true,
        currentPlanContext: { sceneTitle: "Technical competence" },
      },
    });
    expect(request.prompt).toContain("REPLAN_SCOPE: SCENE");
    expect(request.prompt).toContain("TARGET_SCENE_ORDINAL: 3");
    expect(request.prompt).toContain("Do not overwrite human-modified shots");
  });

  it("validates provider JSON before returning it", async () => {
    const generate = vi.fn().mockResolvedValue({
      text: JSON.stringify(validProviderPlan),
      provider: "fake",
      model: "gpt-5.6-terra",
    });
    const provider: TextGenerationProvider = {
      name: "fake",
      validateConfiguration: vi.fn().mockResolvedValue(undefined),
      generate,
    };

    const result = await generateScenePlan({ input, provider });
    expect(result.plan).toEqual(validProviderPlan);
    expect(result.provider).toBe("fake");
    expect(result.model).toBe("gpt-5.6-terra");
  });

  it("rejects invalid JSON and schema-invalid provider payloads without returning raw output", async () => {
    const provider: TextGenerationProvider = {
      name: "fake",
      validateConfiguration: vi.fn().mockResolvedValue(undefined),
      generate: vi.fn().mockResolvedValue({ text: "not-json", provider: "fake", model: "fake" }),
    };
    await expect(generateScenePlan({ input, provider })).rejects.toThrow(/valid Scene Planning JSON/i);

    provider.generate = vi.fn().mockResolvedValue({
      text: JSON.stringify({ scenes: [{ ordinal: 1 }] }),
      provider: "fake",
      model: "fake",
    });
    await expect(generateScenePlan({ input, provider })).rejects.toThrow(/schema/i);
  });
});
