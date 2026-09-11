import { describe, expect, it, vi } from "vitest";
import {
  executeReorderSceneDraftAction,
  executeReorderShotDraftAction,
  executeUpdateSceneDraftAction,
  executeUpdateShotDraftAction,
} from "./draft-edit-actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const planVersionId = "22222222-2222-4222-8222-222222222222";
const sceneId = "33333333-3333-4333-8333-333333333333";
const shotId = "44444444-4444-4444-8444-444444444444";
const actorId = "55555555-5555-4555-8555-555555555555";

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    getActor: vi.fn().mockResolvedValue({ id: actorId }),
    authorize: vi.fn().mockResolvedValue(true),
    updateScene: vi.fn().mockResolvedValue(undefined),
    updateShot: vi.fn().mockResolvedValue(undefined),
    reorderScenes: vi.fn().mockResolvedValue(undefined),
    reorderShots: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("Scene Planning draft edit actions", () => {
  it("updates only explicit scene creative fields after authorization", async () => {
    const deps = dependencies();
    const result = await executeUpdateSceneDraftAction({
      organizationId,
      planVersionId,
      sceneId,
      title: "Updated hook",
      durationSeconds: 7,
      creativeDirection: "Open with a restrained technical reveal.",
    }, deps);

    expect(result).toEqual({ ok: true });
    expect(deps.authorize).toHaveBeenCalledWith(actorId, organizationId);
    expect(deps.updateScene).toHaveBeenCalledWith({
      organizationId,
      planVersionId,
      sceneId,
      title: "Updated hook",
      durationSeconds: 7,
      creativeDirection: "Open with a restrained technical reveal.",
    });
  });

  it("updates shot creative/generation fields without accepting narration fields", async () => {
    const deps = dependencies();
    const result = await executeUpdateShotDraftAction({
      organizationId,
      planVersionId,
      shotId,
      durationSeconds: 4.5,
      creativeDirection: "Track the trainer through the lab.",
      masterVisualPrompt: "Photorealistic railway laboratory, trainer moving through frame.",
      cameraMotion: "slow lateral track",
    }, deps);

    expect(result).toEqual({ ok: true });
    expect(deps.updateShot).toHaveBeenCalledWith(expect.not.objectContaining({ narrationText: expect.anything() }));

    const rejected = await executeUpdateShotDraftAction({
      organizationId,
      planVersionId,
      shotId,
      durationSeconds: 4.5,
      creativeDirection: "Track the trainer through the lab.",
      masterVisualPrompt: "Photorealistic railway laboratory, trainer moving through frame.",
      cameraMotion: "slow lateral track",
      narrationText: "Rewritten narration",
    }, deps);
    expect(rejected).toEqual({ ok: false, error: "Check the shot edit details and try again." });
  });

  it("denies unauthorized actors before any draft mutation", async () => {
    const deps = dependencies({ authorize: vi.fn().mockResolvedValue(false) });
    const result = await executeUpdateSceneDraftAction({
      organizationId,
      planVersionId,
      sceneId,
      title: "Updated hook",
      durationSeconds: 7,
      creativeDirection: "Updated direction",
    }, deps);
    expect(result).toEqual({ ok: false, error: "You do not have permission to edit Scene Planning content for this organization." });
    expect(deps.updateScene).not.toHaveBeenCalled();
  });

  it("reorders every scene with a unique ordered identifier list", async () => {
    const deps = dependencies();
    const secondSceneId = "66666666-6666-4666-8666-666666666666";
    const result = await executeReorderSceneDraftAction({
      organizationId,
      planVersionId,
      orderedSceneIds: [secondSceneId, sceneId],
    }, deps);
    expect(result).toEqual({ ok: true });
    expect(deps.reorderScenes).toHaveBeenCalledWith({
      organizationId,
      planVersionId,
      orderedSceneIds: [secondSceneId, sceneId],
    });

    const invalid = await executeReorderSceneDraftAction({
      organizationId,
      planVersionId,
      orderedSceneIds: [sceneId, sceneId],
    }, deps);
    expect(invalid).toEqual({ ok: false, error: "Check the scene reorder details and try again." });
  });

  it("reorders every shot within the specified scene", async () => {
    const deps = dependencies();
    const secondShotId = "77777777-7777-4777-8777-777777777777";
    const result = await executeReorderShotDraftAction({
      organizationId,
      planVersionId,
      sceneId,
      orderedShotIds: [secondShotId, shotId],
    }, deps);
    expect(result).toEqual({ ok: true });
    expect(deps.reorderShots).toHaveBeenCalledWith({
      organizationId,
      planVersionId,
      sceneId,
      orderedShotIds: [secondShotId, shotId],
    });
  });

  it("returns safe errors when the atomic mutation fails", async () => {
    const deps = dependencies({ updateScene: vi.fn().mockRejectedValue(new Error("database detail")) });
    const result = await executeUpdateSceneDraftAction({
      organizationId,
      planVersionId,
      sceneId,
      title: "Updated hook",
      durationSeconds: 7,
      creativeDirection: "Updated direction",
    }, deps);
    expect(result).toEqual({ ok: false, error: "Scene Planning draft update is temporarily unavailable." });
  });
});
