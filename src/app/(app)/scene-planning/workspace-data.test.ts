import { describe, expect, it } from "vitest";
import { assembleScenePlanningWorkspace, descriptionsFromJsonEntries } from "./workspace-data";

describe("Scene Planning workspace data", () => {
  it("extracts stable descriptions from persisted reference entries", () => {
    expect(descriptionsFromJsonEntries([
      { id: "person:1", description: "Railway trainer" },
      "Legacy trainee description",
      { id: "person:2" },
      null,
    ])).toEqual(["Railway trainer", "Legacy trainee description"]);
  });

  it("assembles ordered scenes, shots, QC state, and source freshness", () => {
    const result = assembleScenePlanningWorkspace({
      organizationId: "11111111-1111-4111-8111-111111111111",
      actorRole: "OWNER",
      project: {
        id: "22222222-2222-4222-8222-222222222222",
        title: "PAK Film",
        purpose: "Institutional credibility",
        target_duration_seconds: 55,
        aspect_ratio: "16:9",
        quality_profile: "CINEMATIC",
        target_platform: ["youtube"],
        language: "EN",
        source_integrity_hash: "hash-current",
      },
      visualBible: {
        characters: [{ id: "person:1", description: "Trainer" }],
        locations: [{ id: "location:1", description: "Rail lab" }],
        global_negative_constraints: ["no plastic faces"],
        realism_level: "photorealistic",
        cinematography_language: "restrained movement",
        lighting_language: "natural daylight",
      },
      plan: {
        id: "33333333-3333-4333-8333-333333333333",
        version_number: 2,
        status: "REVIEW_REQUIRED",
        source_integrity_hash: "hash-current",
      },
      currentSourceIntegrityHash: "hash-current",
      findings: [
        { id: "f2", severity: "INFO", code: "INFO", message: "Info", acknowledged_at: null },
        { id: "f1", severity: "WARNING", code: "PACE", message: "Review pace", acknowledged_at: "2026-09-11T00:00:00Z" },
      ],
      scenes: [
        { id: "scene-2", ordinal: 2, title: "Proof", narrative_role: "PROOF", duration_seconds: 5, creative_direction: "Proof scene" },
        { id: "scene-1", ordinal: 1, title: "Hook", narrative_role: "HOOK", duration_seconds: 6, creative_direction: "Hook scene" },
      ],
      shots: [
        { id: "shot-2", scene_id: "scene-1", ordinal: 2, duration_seconds: 3, narration_text: "B", narration_start_char: 1, narration_end_char: 2, creative_direction: "Second", master_visual_prompt: "Second prompt", camera_motion: "static", human_modified: true },
        { id: "shot-1", scene_id: "scene-1", ordinal: 1, duration_seconds: 3, narration_text: "A", narration_start_char: 0, narration_end_char: 1, creative_direction: "First", master_visual_prompt: "First prompt", camera_motion: "push", human_modified: false },
      ],
    });

    expect(result.project.targetDurationSeconds).toBe(55);
    expect(result.visualBible.characters).toEqual(["Trainer"]);
    expect(result.plan?.sourceFresh).toBe(true);
    expect(result.plan?.qcSummary).toEqual({ blockerCount: 0, warningCount: 1, infoCount: 1 });
    expect(result.plan?.findings[0]?.acknowledged).toBe(false);
    expect(result.plan?.scenes.map((scene) => scene.ordinal)).toEqual([1, 2]);
    expect(result.plan?.scenes[0]?.shots.map((shot) => shot.ordinal)).toEqual([1, 2]);
    expect(result.plan?.scenes[0]?.shots[1]?.humanModified).toBe(true);
  });

  it("marks the plan stale when the persisted source hash no longer matches", () => {
    const result = assembleScenePlanningWorkspace({
      organizationId: "11111111-1111-4111-8111-111111111111",
      actorRole: "REVIEWER",
      project: {
        id: "22222222-2222-4222-8222-222222222222",
        title: "PAK Film",
        purpose: "",
        target_duration_seconds: 30,
        aspect_ratio: "9:16",
        quality_profile: "PREMIUM",
        target_platform: [],
        language: "PL",
        source_integrity_hash: "hash-old",
      },
      visualBible: null,
      plan: {
        id: "33333333-3333-4333-8333-333333333333",
        version_number: 1,
        status: "REVIEW_REQUIRED",
        source_integrity_hash: "hash-old",
      },
      currentSourceIntegrityHash: "hash-new",
      findings: [],
      scenes: [],
      shots: [],
    });

    expect(result.plan?.sourceFresh).toBe(false);
    expect(result.visualBible.locations).toEqual([]);
  });
});
