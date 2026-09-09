import type { VideoScene } from "./types";

export function canRenderFinalVideo(scenes: readonly VideoScene[]): boolean {
  if (scenes.length === 0) return false;

  return scenes
    .filter((scene) => scene.required)
    .every((scene) => scene.generationState === "COMPLETED" && scene.qaState === "PASSED");
}
