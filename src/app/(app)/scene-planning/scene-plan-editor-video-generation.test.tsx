import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScenePlanEditor, type ScenePlanEditorProps } from "./scene-plan-editor";
import {
  enqueueShotVideoGenerationAction,
  reconcileShotVideoGenerationAction,
  retryShotVideoGenerationAction,
} from "./video-generation-actions";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./draft-edit-actions", () => ({
  reorderScenePlanScenesAction: vi.fn(),
  reorderScenePlanShotsAction: vi.fn(),
  updateScenePlanSceneDraftAction: vi.fn(),
  updateScenePlanShotDraftAction: vi.fn(),
}));
vi.mock("./granular-replan-actions", () => ({ granularReplanScenePlanAction: vi.fn() }));
vi.mock("./video-generation-actions", () => ({
  enqueueShotVideoGenerationAction: vi.fn(),
  reconcileShotVideoGenerationAction: vi.fn(),
  retryShotVideoGenerationAction: vi.fn(),
}));

const organizationId = "11111111-1111-4111-8111-111111111111";
const planVersionId = "22222222-2222-4222-8222-222222222222";
const shotId = "33333333-3333-4333-8333-333333333333";
const jobId = "44444444-4444-4444-8444-444444444444";
const attemptId = "55555555-5555-4555-8555-555555555555";

function props(overrides: Partial<ScenePlanEditorProps> = {}): ScenePlanEditorProps {
  return {
    organizationId,
    actorRole: "EDITOR",
    planVersionId,
    status: "APPROVED",
    sourceFresh: true,
    scenes: [{
      id: "66666666-6666-4666-8666-666666666666",
      ordinal: 1,
      title: "Approved Hook",
      narrativeRole: "HOOK",
      durationSeconds: 6,
      creativeDirection: "Approved scene",
      shots: [{
        id: shotId,
        ordinal: 1,
        durationSeconds: 6,
        narrationText: "Locked approved narration",
        narrationStartChar: 0,
        narrationEndChar: 25,
        creativeDirection: "Approved direction",
        masterVisualPrompt: "Approved generation specification",
        cameraMotion: "slow push",
        humanModified: false,
      }],
    }],
    ...overrides,
  };
}

describe("approved shot video generation controls", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.mocked(enqueueShotVideoGenerationAction).mockReset();
    vi.mocked(reconcileShotVideoGenerationAction).mockReset();
    vi.mocked(retryShotVideoGenerationAction).mockReset();
    vi.mocked(enqueueShotVideoGenerationAction).mockResolvedValue({ ok: true, state: "SUBMITTED", jobId, attemptId });
    vi.mocked(reconcileShotVideoGenerationAction).mockResolvedValue({ ok: true, state: "PROCESSING", jobId, attemptId });
    vi.mocked(retryShotVideoGenerationAction).mockResolvedValue({ ok: true, state: "QUEUED", jobId, attemptId });
  });

  it("generates only from an approved current shot using IDs only", async () => {
    render(<ScenePlanEditor {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate Shot 1.1 video" }));

    await waitFor(() => expect(enqueueShotVideoGenerationAction).toHaveBeenCalledWith({
      organizationId,
      planVersionId,
      shotId,
    }));
    expect(refresh).toHaveBeenCalled();
  });

  it("hides generation controls when source is stale or actor cannot edit", () => {
    const { rerender } = render(<ScenePlanEditor {...props({ sourceFresh: false })} />);
    expect(screen.queryByRole("button", { name: /Generate Shot/ })).toBeNull();

    rerender(<ScenePlanEditor {...props({ actorRole: "REVIEWER", sourceFresh: true })} />);
    expect(screen.queryByRole("button", { name: /Generate Shot/ })).toBeNull();
  });

  it("refreshes queued/generating/importing attempts through reconcile IDs only", async () => {
    const generating = props();
    generating.scenes[0]!.shots[0]!.videoGeneration = { jobId, attemptId, state: "GENERATING" };
    render(<ScenePlanEditor {...generating} />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh Shot 1.1 video status" }));
    await waitFor(() => expect(reconcileShotVideoGenerationAction).toHaveBeenCalledWith({
      organizationId,
      jobId,
      attemptId,
    }));
  });

  it("shows completed PAK media identity and never provider output URLs", () => {
    const completed = props();
    completed.scenes[0]!.shots[0]!.videoGeneration = {
      jobId,
      attemptId,
      state: "COMPLETED",
      mediaAssetId: "77777777-7777-4777-8777-777777777777",
    };
    render(<ScenePlanEditor {...completed} />);

    expect(screen.getByText(/Video ready in PAK Media/i)).toBeTruthy();
    expect(screen.getByText(/77777777-7777-4777-8777-777777777777/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/https?:\/\//);
  });

  it("offers retry only for normalized retryable failures", async () => {
    const failed = props();
    failed.scenes[0]!.shots[0]!.videoGeneration = {
      jobId,
      attemptId,
      state: "FAILED",
      retryable: true,
      errorCode: "LTX_RATE_LIMITED",
    };
    render(<ScenePlanEditor {...failed} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry Shot 1.1 video" }));
    await waitFor(() => expect(retryShotVideoGenerationAction).toHaveBeenCalledWith({
      organizationId,
      jobId,
      attemptId,
    }));
  });
});
