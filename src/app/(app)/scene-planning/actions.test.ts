import { describe, expect, it, vi } from "vitest";
import { executeCreateScenePlanningProjectAction } from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const sourceArtifactId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";

describe("executeCreateScenePlanningProjectAction", () => {
  it("rejects invalid identifiers before touching dependencies", async () => {
    const dependencies = {
      getActor: vi.fn(),
      createProject: vi.fn(),
    };
    await expect(
      executeCreateScenePlanningProjectAction({ organizationId: "bad", sourceArtifactId }, dependencies),
    ).resolves.toEqual({ ok: false, error: "Please check the Scene Planning source and try again." });
    expect(dependencies.getActor).not.toHaveBeenCalled();
  });

  it("requires an authenticated actor", async () => {
    const dependencies = {
      getActor: vi.fn().mockResolvedValue(null),
      createProject: vi.fn(),
    };
    await expect(
      executeCreateScenePlanningProjectAction({ organizationId, sourceArtifactId }, dependencies),
    ).resolves.toEqual({ ok: false, error: "You must be signed in to create a Scene Planning project." });
    expect(dependencies.createProject).not.toHaveBeenCalled();
  });

  it("passes only persisted identifiers plus server actor to project creation", async () => {
    const dependencies = {
      getActor: vi.fn().mockResolvedValue({ id: actorId }),
      createProject: vi.fn().mockResolvedValue({ id: "project-1" }),
    };
    const result = await executeCreateScenePlanningProjectAction(
      { organizationId, sourceArtifactId },
      dependencies,
    );
    expect(result).toEqual({ ok: true, projectId: "project-1" });
    expect(dependencies.createProject).toHaveBeenCalledWith({
      organizationId,
      actorUserId: actorId,
      sourceArtifactId,
      title: "New Scene Planning project",
      targetPlatforms: [],
      aspectRatio: "16:9",
      targetDurationSeconds: 60,
      qualityProfile: "PREMIUM",
    });
  });

  it("returns a safe error instead of repository/provider details", async () => {
    const dependencies = {
      getActor: vi.fn().mockResolvedValue({ id: actorId }),
      createProject: vi.fn().mockRejectedValue(new Error("sensitive database details")),
    };
    await expect(
      executeCreateScenePlanningProjectAction({ organizationId, sourceArtifactId }, dependencies),
    ).resolves.toEqual({ ok: false, error: "Scene Planning project creation is temporarily unavailable." });
  });
});
