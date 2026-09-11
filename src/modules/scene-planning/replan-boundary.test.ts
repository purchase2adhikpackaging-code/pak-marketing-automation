import { describe, expect, it } from "vitest";
import type { ScenePlanGeneration } from "./schema";
import { assertGranularReplanBoundary } from "./replan-boundary";

function plan(): ScenePlanGeneration {
  const shot = (ordinal: number, direction: string, humanModified = false) => ({
    ordinal,
    durationSeconds: 5,
    narrationStartChar: ordinal === 1 ? 0 : 5,
    narrationEndChar: ordinal === 1 ? 5 : 10,
    narrationText: ordinal === 1 ? "Alpha" : " beta",
    creativeDirection: direction,
    masterVisualPrompt: `${direction} prompt`,
    negativeConstraints: [],
    subjectRefs: [],
    locationRefs: [],
    composition: "balanced",
    shotSize: "medium",
    cameraAngle: "eye level",
    lensIntent: "natural",
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
    ...(humanModified ? { humanModified: true } : {}),
  });

  return {
    scenes: [
      { ordinal: 1, title: "Hook", narrativeRole: "HOOK", durationSeconds: 10, creativeDirection: "Hook scene", continuityContext: {}, shots: [shot(1, "Human shot", true), shot(2, "AI shot")] },
      { ordinal: 2, title: "Proof", narrativeRole: "PROOF", durationSeconds: 10, creativeDirection: "Proof scene", continuityContext: {}, shots: [shot(1, "Proof one"), shot(2, "Proof two")] },
    ],
  };
}

describe("assertGranularReplanBoundary", () => {
  it("allows a shot replan to change only the explicit target shot", () => {
    const current = plan();
    const next = structuredClone(current);
    next.scenes[0]!.shots[1]!.creativeDirection = "Replanned target";
    expect(() => assertGranularReplanBoundary(current, next, { scope: "SHOT", targetSceneOrdinal: 1, targetShotOrdinal: 2, preserveHumanModifiedShots: true })).not.toThrow();
  });

  it("protects a targeted human-modified shot unless replacement is explicit", () => {
    const current = plan();
    const next = structuredClone(current);
    next.scenes[0]!.shots[0]!.creativeDirection = "Replanned human target";

    expect(() => assertGranularReplanBoundary(current, next, {
      scope: "SHOT",
      targetSceneOrdinal: 1,
      targetShotOrdinal: 1,
      preserveHumanModifiedShots: true,
    })).toThrow(/human/i);

    expect(() => assertGranularReplanBoundary(current, next, {
      scope: "SHOT",
      targetSceneOrdinal: 1,
      targetShotOrdinal: 1,
      preserveHumanModifiedShots: false,
    })).not.toThrow();
  });

  it("rejects a shot replan that changes scene metadata or sibling shots", () => {
    const current = plan();
    const changedScene = structuredClone(current);
    changedScene.scenes[0]!.title = "Changed title";
    expect(() => assertGranularReplanBoundary(current, changedScene, { scope: "SHOT", targetSceneOrdinal: 1, targetShotOrdinal: 2, preserveHumanModifiedShots: true })).toThrow(/outside/i);

    const changedSibling = structuredClone(current);
    changedSibling.scenes[0]!.shots[0]!.creativeDirection = "Overwrote human edit";
    expect(() => assertGranularReplanBoundary(current, changedSibling, { scope: "SHOT", targetSceneOrdinal: 1, targetShotOrdinal: 2, preserveHumanModifiedShots: true })).toThrow(/outside|human/i);
  });

  it("allows scene replanning inside the target scene while protecting human-modified shots", () => {
    const current = plan();
    const next = structuredClone(current);
    next.scenes[0]!.title = "Replanned hook";
    next.scenes[0]!.shots[1]!.creativeDirection = "Replanned AI shot";
    expect(() => assertGranularReplanBoundary(current, next, { scope: "SCENE", targetSceneOrdinal: 1, preserveHumanModifiedShots: true })).not.toThrow();

    const humanOverwrite = structuredClone(next);
    humanOverwrite.scenes[0]!.shots[0]!.creativeDirection = "Replaced human shot";
    expect(() => assertGranularReplanBoundary(current, humanOverwrite, { scope: "SCENE", targetSceneOrdinal: 1, preserveHumanModifiedShots: true })).toThrow(/human/i);
  });

  it("allows explicit scene-level replacement of human-modified shots", () => {
    const current = plan();
    const next = structuredClone(current);
    next.scenes[0]!.shots[0]!.creativeDirection = "Explicit replacement";
    expect(() => assertGranularReplanBoundary(current, next, { scope: "SCENE", targetSceneOrdinal: 1, preserveHumanModifiedShots: false })).not.toThrow();
  });

  it("rejects changes outside the target scene and structural insertion/removal", () => {
    const current = plan();
    const otherScene = structuredClone(current);
    otherScene.scenes[1]!.creativeDirection = "Changed outside scope";
    expect(() => assertGranularReplanBoundary(current, otherScene, { scope: "SCENE", targetSceneOrdinal: 1, preserveHumanModifiedShots: true })).toThrow(/outside/i);

    const removed = structuredClone(current);
    removed.scenes.pop();
    expect(() => assertGranularReplanBoundary(current, removed, { scope: "SCENE", targetSceneOrdinal: 1, preserveHumanModifiedShots: true })).toThrow(/structure/i);
  });
});
