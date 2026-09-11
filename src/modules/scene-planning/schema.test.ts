import { describe, expect, it } from "vitest";
import {
  ScenePlanGenerationSchema,
  ScenePlanStatusSchema,
  ShotSchema,
} from "./schema";

const shot = {
  ordinal: 1,
  durationSeconds: 6,
  narrationStartChar: 0,
  narrationEndChar: 5,
  narrationText: "Train",
  creativeDirection: "Establish credible railway training context.",
  masterVisualPrompt: "Cinematic European railway training workshop with realistic technicians.",
  negativeConstraints: ["no distorted hands"],
  subjectRefs: ["trainee-1"],
  locationRefs: ["workshop-1"],
  composition: "balanced industrial composition",
  shotSize: "medium wide",
  cameraAngle: "eye level",
  lensIntent: "natural perspective",
  cameraMotion: "slow push-in",
  subjectMotion: "measured inspection movement",
  environmentMotion: "subtle practical workshop activity",
  depthOfFieldIntent: "moderate depth",
  lighting: "natural industrial daylight",
  mood: "professional",
  transitionIn: "cut",
  transitionOut: "cut",
  ambienceIntent: "quiet workshop room tone",
  sfxIntent: "light tool handling",
  musicIntent: "restrained institutional underscore",
  aspectRatio: "16:9",
  continuityState: { wardrobe: "navy technical uniform" },
  generationRequirements: { preserveNarration: true, providerNeutral: true, generatedDialogue: false },
};

const validPlan = {
  scenes: [
    {
      ordinal: 1,
      title: "Professional railway training",
      narrativeRole: "HOOK",
      durationSeconds: 6,
      creativeDirection: "Open with credibility and technical precision.",
      continuityContext: { timeOfDay: "day" },
      shots: [shot],
    },
  ],
};

describe("Scene Planning domain schemas", () => {
  it("accepts a complete provider-neutral plan", () => {
    expect(ScenePlanGenerationSchema.parse(validPlan)).toEqual(validPlan);
  });

  it("rejects missing canonical narration on a narrated shot", () => {
    const result = ShotSchema.safeParse({ ...shot, narrationText: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate scene or shot ordinals", () => {
    const duplicateScene = ScenePlanGenerationSchema.safeParse({
      scenes: [validPlan.scenes[0], { ...validPlan.scenes[0] }],
    });
    expect(duplicateScene.success).toBe(false);

    const duplicateShot = ScenePlanGenerationSchema.safeParse({
      scenes: [{ ...validPlan.scenes[0], shots: [shot, { ...shot }] }],
    });
    expect(duplicateShot.success).toBe(false);
  });

  it("rejects non-positive duration", () => {
    expect(ShotSchema.safeParse({ ...shot, durationSeconds: 0 }).success).toBe(false);
  });

  it("rejects provider execution fields", () => {
    expect(
      ShotSchema.safeParse({
        ...shot,
        providerJobId: "job-123",
        providerUrl: "https://provider.invalid/job-123",
      }).success,
    ).toBe(false);
  });

  it("accepts only supported workflow statuses", () => {
    expect(ScenePlanStatusSchema.safeParse("APPROVED").success).toBe(true);
    expect(ScenePlanStatusSchema.safeParse("GENERATING_VIDEO").success).toBe(false);
  });
});
