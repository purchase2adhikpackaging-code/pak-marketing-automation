import { describe, expect, it } from "vitest";
import { runScenePlanQc, type ScenePlanQcInput, type ScenePlanScene, type ScenePlanShot } from "./qc";

const canonicalNarration = "Alpha beta. Gamma delta.";

function validInput(): ScenePlanQcInput {
  return {
    canonicalNarration,
    currentSourceIntegrityHash: "sha256:current",
    planSourceIntegrityHash: "sha256:current",
    targetDurationSeconds: 10,
    durationToleranceSeconds: 1,
    expectedAspectRatio: "16:9",
    availableReferences: ["person:trainer-1", "location:lab-1"],
    scenes: [
      {
        ordinal: 1,
        durationSeconds: 5,
        creativeDirection: "Establish the academy with restrained confidence.",
        shots: [{ ordinal: 1, durationSeconds: 5, narrationStartChar: 0, narrationEndChar: 12, narrationText: canonicalNarration.slice(0, 12), creativeDirection: "Trainer enters the railway systems laboratory.", masterVisualPrompt: "Photorealistic European railway training laboratory, trainer entering frame.", aspectRatio: "16:9", subjectRefs: ["person:trainer-1"], locationRefs: ["location:lab-1"], cameraMotion: "slow dolly in", generationRequirements: { preserveNarration: true, providerNeutral: true } }],
      },
      {
        ordinal: 2,
        durationSeconds: 5,
        creativeDirection: "Move from setup into practical technical learning.",
        shots: [{ ordinal: 1, durationSeconds: 5, narrationStartChar: 12, narrationEndChar: canonicalNarration.length, narrationText: canonicalNarration.slice(12), creativeDirection: "Trainees inspect a railway control panel with the trainer.", masterVisualPrompt: "Photorealistic trainees inspecting a railway control panel under practical lighting.", aspectRatio: "16:9", subjectRefs: ["person:trainer-1"], locationRefs: ["location:lab-1"], cameraMotion: "controlled lateral track", generationRequirements: { preserveNarration: true, providerNeutral: true } }],
      },
    ],
  };
}

function sceneAt(input: ScenePlanQcInput, index: number): ScenePlanScene {
  const scene = input.scenes[index];
  if (!scene) throw new Error(`Missing test scene ${index}`);
  return scene;
}

function shotAt(input: ScenePlanQcInput, sceneIndex: number, shotIndex = 0): ScenePlanShot {
  const shot = sceneAt(input, sceneIndex).shots[shotIndex];
  if (!shot) throw new Error(`Missing test shot ${sceneIndex}:${shotIndex}`);
  return shot;
}

function codes(result: ReturnType<typeof runScenePlanQc>, severity?: "BLOCKER" | "WARNING" | "INFO") {
  return result.findings.filter((finding) => !severity || finding.severity === severity).map((finding) => finding.code);
}

describe("runScenePlanQc", () => {
  it("accepts a complete plan with exact narration coverage", () => {
    const result = runScenePlanQc(validInput());
    expect(result.stale).toBe(false);
    expect(result.totalDurationSeconds).toBe(10);
    expect(result.narrationCoveragePercent).toBe(100);
    expect(codes(result, "BLOCKER")).toEqual([]);
  });

  it("treats whitespace-only gaps between exact narration spans as fully covered", () => {
    const input = validInput();
    shotAt(input, 0).narrationEndChar = 11;
    shotAt(input, 0).narrationText = canonicalNarration.slice(0, 11);
    shotAt(input, 1).narrationStartChar = 12;
    shotAt(input, 1).narrationText = canonicalNarration.slice(12);
    const result = runScenePlanQc(input);
    expect(result.narrationCoveragePercent).toBe(100);
    expect(codes(result, "BLOCKER")).not.toContain("NARRATION_GAP");
  });

  it("blocks stale source, narration gaps, overlap, and rewritten narration", () => {
    const stale = validInput();
    stale.currentSourceIntegrityHash = "sha256:new";
    expect(codes(runScenePlanQc(stale), "BLOCKER")).toContain("SOURCE_STALE");

    const gap = validInput();
    shotAt(gap, 1).narrationStartChar = 14;
    shotAt(gap, 1).narrationText = canonicalNarration.slice(14);
    expect(codes(runScenePlanQc(gap), "BLOCKER")).toContain("NARRATION_GAP");

    const overlap = validInput();
    shotAt(overlap, 1).narrationStartChar = 10;
    shotAt(overlap, 1).narrationText = canonicalNarration.slice(10);
    expect(codes(runScenePlanQc(overlap), "BLOCKER")).toContain("NARRATION_OVERLAP");

    const rewritten = validInput();
    shotAt(rewritten, 0).narrationText = "Rewritten narration";
    expect(codes(runScenePlanQc(rewritten), "BLOCKER")).toContain("NARRATION_REWRITTEN");
  });

  it("blocks missing prompts, unresolved references, generated dialogue, and ratio/order errors", () => {
    const missingPrompt = validInput();
    shotAt(missingPrompt, 0).masterVisualPrompt = "   ";
    expect(codes(runScenePlanQc(missingPrompt), "BLOCKER")).toContain("MISSING_VISUAL_PROMPT");

    const missingReference = validInput();
    shotAt(missingReference, 0).subjectRefs = ["person:unknown"];
    expect(codes(runScenePlanQc(missingReference), "BLOCKER")).toContain("UNRESOLVED_REFERENCE");

    const dialogue = validInput();
    shotAt(dialogue, 0).generationRequirements = { preserveNarration: true, providerNeutral: true, generatedDialogue: true };
    expect(codes(runScenePlanQc(dialogue), "BLOCKER")).toContain("GENERATED_DIALOGUE_NOT_ALLOWED");

    const wrongRatio = validInput();
    shotAt(wrongRatio, 1).aspectRatio = "9:16";
    expect(codes(runScenePlanQc(wrongRatio), "BLOCKER")).toContain("ASPECT_RATIO_MISMATCH");

    const wrongOrder = validInput();
    sceneAt(wrongOrder, 1).ordinal = 3;
    shotAt(wrongOrder, 0).ordinal = 2;
    const orderCodes = codes(runScenePlanQc(wrongOrder), "BLOCKER");
    expect(orderCodes).toContain("SCENE_ORDER_INVALID");
    expect(orderCodes).toContain("SHOT_ORDER_INVALID");
  });

  it("blocks scene-duration mismatch and warns for camera conflict, duplicate ideas, and target-duration drift", () => {
    const sceneDuration = validInput();
    sceneAt(sceneDuration, 0).durationSeconds = 7;
    expect(codes(runScenePlanQc(sceneDuration), "BLOCKER")).toContain("SCENE_DURATION_MISMATCH");

    const camera = validInput();
    shotAt(camera, 0).cameraMotion = "locked static tripod with fast orbit around subject";
    expect(codes(runScenePlanQc(camera), "WARNING")).toContain("CAMERA_MOTION_CONFLICT");

    const duplicate = validInput();
    shotAt(duplicate, 1).creativeDirection = shotAt(duplicate, 0).creativeDirection;
    expect(codes(runScenePlanQc(duplicate), "WARNING")).toContain("DUPLICATE_VISUAL_IDEA");

    const duration = validInput();
    duration.targetDurationSeconds = 13;
    duration.durationToleranceSeconds = 1;
    expect(codes(runScenePlanQc(duration), "WARNING")).toContain("TARGET_DURATION_MISMATCH");
  });
});
