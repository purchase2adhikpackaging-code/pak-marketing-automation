import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScenePlanEditor, type ScenePlanEditorProps } from "./scene-plan-editor";
import {
  reorderScenePlanScenesAction,
  reorderScenePlanShotsAction,
  updateScenePlanSceneDraftAction,
  updateScenePlanShotDraftAction,
} from "./draft-edit-actions";
import { granularReplanScenePlanAction } from "./granular-replan-actions";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./draft-edit-actions", () => ({
  reorderScenePlanScenesAction: vi.fn(),
  reorderScenePlanShotsAction: vi.fn(),
  updateScenePlanSceneDraftAction: vi.fn(),
  updateScenePlanShotDraftAction: vi.fn(),
}));
vi.mock("./granular-replan-actions", () => ({ granularReplanScenePlanAction: vi.fn() }));

function props(overrides: Partial<ScenePlanEditorProps> = {}): ScenePlanEditorProps {
  return {
    organizationId: "11111111-1111-4111-8111-111111111111",
    actorRole: "OWNER",
    planVersionId: "22222222-2222-4222-8222-222222222222",
    status: "REVIEW_REQUIRED",
    scenes: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        ordinal: 1,
        title: "Hook",
        narrativeRole: "HOOK",
        durationSeconds: 6,
        creativeDirection: "Open with technical credibility.",
        shots: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            ordinal: 1,
            durationSeconds: 3,
            narrationText: "Exact narration A",
            narrationStartChar: 0,
            narrationEndChar: 17,
            creativeDirection: "Trainer enters the lab.",
            masterVisualPrompt: "Photorealistic trainer entering railway lab.",
            cameraMotion: "slow push",
            humanModified: true,
          },
          {
            id: "55555555-5555-4555-8555-555555555555",
            ordinal: 2,
            durationSeconds: 3,
            narrationText: "Exact narration B",
            narrationStartChar: 17,
            narrationEndChar: 34,
            creativeDirection: "Reveal practical equipment.",
            masterVisualPrompt: "Photorealistic railway training equipment.",
            cameraMotion: "static",
            humanModified: false,
          },
        ],
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        ordinal: 2,
        title: "Proof",
        narrativeRole: "PROOF",
        durationSeconds: 5,
        creativeDirection: "Show practical proof.",
        shots: [
          {
            id: "77777777-7777-4777-8777-777777777777",
            ordinal: 1,
            durationSeconds: 5,
            narrationText: "Exact narration C",
            narrationStartChar: 34,
            narrationEndChar: 51,
            creativeDirection: "Trainees inspect the panel.",
            masterVisualPrompt: "Photorealistic trainees inspecting a rail control panel.",
            cameraMotion: "lateral track",
            humanModified: false,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("ScenePlanEditor", () => {
  beforeEach(() => {
    refresh.mockReset();
    for (const fn of [reorderScenePlanScenesAction, reorderScenePlanShotsAction, updateScenePlanSceneDraftAction, updateScenePlanShotDraftAction, granularReplanScenePlanAction]) {
      vi.mocked(fn).mockReset();
      vi.mocked(fn).mockResolvedValue({ ok: true } as never);
    }
  });

  it("shows draft-only manual edit, reorder, and granular replan controls while narration remains read-only", () => {
    render(<ScenePlanEditor {...props()} />);
    expect(screen.getByRole("button", { name: "Save Scene 1 changes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Shot 1.1 changes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move Scene 1 down" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move Shot 1.1 down" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replan Scene 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replan Shot 1.2" })).toBeTruthy();
    expect(screen.getByText("Exact narration A")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /narration/i })).toBeNull();
  });

  it("saves only editable shot fields and marks the operation through the server action", async () => {
    render(<ScenePlanEditor {...props()} />);
    fireEvent.change(screen.getByLabelText("Shot 1.1 creative direction"), { target: { value: "Updated human direction" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Shot 1.1 changes" }));
    await waitFor(() => expect(updateScenePlanShotDraftAction).toHaveBeenCalledWith({
      organizationId: props().organizationId,
      planVersionId: props().planVersionId,
      shotId: props().scenes[0]!.shots[0]!.id,
      durationSeconds: 3,
      creativeDirection: "Updated human direction",
      masterVisualPrompt: "Photorealistic trainer entering railway lab.",
      cameraMotion: "slow push",
    }));
    expect(JSON.stringify(vi.mocked(updateScenePlanShotDraftAction).mock.calls[0]?.[0])).not.toContain("narration");
  });

  it("reorders scenes and shots using complete ordered identifier lists", async () => {
    render(<ScenePlanEditor {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Move Scene 1 down" }));
    await waitFor(() => expect(reorderScenePlanScenesAction).toHaveBeenCalledWith({
      organizationId: props().organizationId,
      planVersionId: props().planVersionId,
      orderedSceneIds: [props().scenes[1]!.id, props().scenes[0]!.id],
    }));

    const moveShot = screen.getByRole("button", { name: "Move Shot 1.1 down" }) as HTMLButtonElement;
    await waitFor(() => expect(moveShot.disabled).toBe(false));
    fireEvent.click(moveShot);
    await waitFor(() => expect(reorderScenePlanShotsAction).toHaveBeenCalledWith({
      organizationId: props().organizationId,
      planVersionId: props().planVersionId,
      sceneId: props().scenes[0]!.id,
      orderedShotIds: [props().scenes[0]!.shots[1]!.id, props().scenes[0]!.shots[0]!.id],
    }));
  });

  it("requires explicit opt-in before AI can replace a human-modified target shot", async () => {
    render(<ScenePlanEditor {...props()} />);
    const humanReplan = screen.getByRole("button", { name: "Replan Shot 1.1" }) as HTMLButtonElement;
    expect(humanReplan.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Allow AI to replace human edits in Scene 1" }));
    expect(humanReplan.disabled).toBe(false);
    fireEvent.click(humanReplan);
    await waitFor(() => expect(granularReplanScenePlanAction).toHaveBeenCalledWith(expect.objectContaining({
      scope: "SHOT",
      targetSceneOrdinal: 1,
      targetShotOrdinal: 1,
      replaceHumanModifiedShots: true,
    })));
  });

  it("preserves human edits by default when replanning a scene", async () => {
    render(<ScenePlanEditor {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Replan Scene 1" }));
    await waitFor(() => expect(granularReplanScenePlanAction).toHaveBeenCalledWith(expect.objectContaining({
      scope: "SCENE",
      targetSceneOrdinal: 1,
      replaceHumanModifiedShots: false,
    })));
  });

  it("removes all mutation and replan controls for approved versions", () => {
    render(<ScenePlanEditor {...props({ status: "APPROVED" })} />);
    expect(screen.queryByRole("button", { name: /Save Scene/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Save Shot/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Move Scene/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Replan Scene/ })).toBeNull();
    expect(screen.getByText("Exact narration A")).toBeTruthy();
  });
});
