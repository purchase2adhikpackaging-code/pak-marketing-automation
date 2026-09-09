import { describe, expect, it } from "vitest";
import { canRenderFinalVideo } from "./readiness";
import type { VideoScene } from "./types";

function scene(overrides: Partial<VideoScene> = {}): VideoScene {
  return {
    id: "scene-1",
    organizationId: "org-1",
    contentItemId: "content-1",
    order: 1,
    required: true,
    script: "script",
    visualPrompt: "prompt",
    durationSeconds: 8,
    aspectRatio: "16:9",
    continuity: {},
    generationState: "COMPLETED",
    qaState: "PASSED",
    retryCount: 0,
    ...overrides,
  };
}

describe("canRenderFinalVideo", () => {
  it("allows rendering only when every required scene completed and passed QA", () => {
    expect(canRenderFinalVideo([scene(), scene({ id: "scene-2", order: 2 })])).toBe(true);
  });

  it("blocks rendering when a required scene failed generation", () => {
    expect(canRenderFinalVideo([scene(), scene({ id: "scene-2", generationState: "FAILED" })])).toBe(false);
  });

  it("blocks rendering when a required scene has not passed QA", () => {
    expect(canRenderFinalVideo([scene({ qaState: "PENDING" })])).toBe(false);
  });

  it("ignores failed optional scenes", () => {
    expect(canRenderFinalVideo([scene(), scene({ id: "optional", required: false, generationState: "FAILED", qaState: "FAILED" })])).toBe(true);
  });

  it("does not render an empty video", () => {
    expect(canRenderFinalVideo([])).toBe(false);
  });
});
