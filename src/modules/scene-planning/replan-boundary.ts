import { AppError } from "@/lib/errors/app-error";
import type { Scene, ScenePlanGeneration, Shot } from "./schema";

export type GranularReplanBoundary = {
  scope: "SHOT" | "SCENE";
  targetSceneOrdinal: number;
  targetShotOrdinal?: number;
  preserveHumanModifiedShots: boolean;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function sceneShell(scene: Scene): Omit<Scene, "shots"> {
  const { shots: _shots, ...shell } = scene;
  return shell;
}

function sceneByOrdinal(plan: ScenePlanGeneration, ordinal: number): Scene | undefined {
  return plan.scenes.find((scene) => scene.ordinal === ordinal);
}

function shotByOrdinal(scene: Scene, ordinal: number): Shot | undefined {
  return scene.shots.find((shot) => shot.ordinal === ordinal);
}

function conflict(message: string): never {
  throw new AppError("CONFLICT", message);
}

export function assertGranularReplanBoundary(
  current: ScenePlanGeneration,
  next: ScenePlanGeneration,
  boundary: GranularReplanBoundary,
): void {
  const currentTargetScene = sceneByOrdinal(current, boundary.targetSceneOrdinal);
  const nextTargetScene = sceneByOrdinal(next, boundary.targetSceneOrdinal);
  if (!currentTargetScene || !nextTargetScene) {
    conflict("Granular replan structure changed or the target scene is missing.");
  }

  if (current.scenes.length !== next.scenes.length) {
    conflict("Granular replan structure changed outside the requested scope.");
  }

  for (const currentScene of current.scenes) {
    const nextScene = sceneByOrdinal(next, currentScene.ordinal);
    if (!nextScene) conflict("Granular replan structure changed outside the requested scope.");

    if (currentScene.ordinal !== boundary.targetSceneOrdinal) {
      if (!equal(currentScene, nextScene)) {
        conflict("Granular replan attempted to change content outside the requested scope.");
      }
      continue;
    }

    if (boundary.scope === "SHOT") {
      if (!boundary.targetShotOrdinal) {
        conflict("Shot replan requires a target shot ordinal.");
      }
      if (currentScene.shots.length !== nextScene.shots.length) {
        conflict("Shot replan structure changed outside the requested scope.");
      }
      if (!equal(sceneShell(currentScene), sceneShell(nextScene))) {
        conflict("Shot replan attempted to change scene metadata outside the requested scope.");
      }

      const currentTargetShot = shotByOrdinal(currentScene, boundary.targetShotOrdinal);
      const nextTargetShot = shotByOrdinal(nextScene, boundary.targetShotOrdinal);
      if (!currentTargetShot || !nextTargetShot) {
        conflict("Shot replan structure changed or the target shot is missing.");
      }
      if (
        boundary.preserveHumanModifiedShots &&
        currentTargetShot.humanModified &&
        !equal(currentTargetShot, nextTargetShot)
      ) {
        conflict("Shot replan attempted to overwrite a human-modified target shot.");
      }

      for (const currentShot of currentScene.shots) {
        if (currentShot.ordinal === boundary.targetShotOrdinal) continue;
        const nextShot = shotByOrdinal(nextScene, currentShot.ordinal);
        if (!nextShot || !equal(currentShot, nextShot)) {
          conflict(
            currentShot.humanModified
              ? "Granular replan attempted to overwrite a human-modified shot."
              : "Granular replan attempted to change content outside the requested scope.",
          );
        }
      }
      return;
    }

    if (boundary.preserveHumanModifiedShots) {
      for (const currentShot of currentScene.shots.filter((shot) => shot.humanModified)) {
        const nextShot = shotByOrdinal(nextScene, currentShot.ordinal);
        if (!nextShot || !equal(currentShot, nextShot)) {
          conflict("Scene replan attempted to overwrite a human-modified shot.");
        }
      }
    }
  }
}
