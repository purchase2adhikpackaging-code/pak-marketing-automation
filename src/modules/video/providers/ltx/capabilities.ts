import type { VideoGenerationRequest } from "../types";

export const LTX_TEXT_TO_VIDEO_ENDPOINT = "https://api.ltx.io/v2/text-to-video";
export const LTX_DEFAULT_MODEL = "ltx-2-3-pro" as const;
export const LTX_DEFAULT_FPS = 24 as const;

export type LtxCameraMotion =
  | "dolly_in"
  | "dolly_out"
  | "dolly_left"
  | "dolly_right"
  | "jib_up"
  | "jib_down"
  | "static"
  | "focus_shift";

const LTX_PRO_DURATIONS = [6, 8, 10] as const;

export function normalizeLtxDuration(durationSeconds: number): 6 | 8 | 10 {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 4 || durationSeconds > 12) {
    throw new Error("LTX duration must be within the supported 4–12 second planning envelope.");
  }

  let selected: 6 | 8 | 10 = LTX_PRO_DURATIONS[0];
  let selectedDistance = Math.abs(durationSeconds - selected);
  for (const candidate of LTX_PRO_DURATIONS.slice(1)) {
    const distance = Math.abs(durationSeconds - candidate);
    if (distance < selectedDistance || (distance === selectedDistance && candidate > selected)) {
      selected = candidate;
      selectedDistance = distance;
    }
  }
  return selected;
}

export function resolveLtxResolution(
  aspectRatio: VideoGenerationRequest["aspectRatio"],
): "1920x1080" | "1080x1920" {
  if (aspectRatio === "16:9") return "1920x1080";
  if (aspectRatio === "9:16") return "1080x1920";
  throw new Error(`UNSUPPORTED_ASPECT_RATIO: ${aspectRatio}`);
}

export function mapLtxCameraMotion(cameraMotion?: string): LtxCameraMotion | undefined {
  if (!cameraMotion?.trim()) return undefined;
  const normalized = cameraMotion.trim().toLowerCase().replace(/[\s-]+/g, "_");

  const aliases: Record<string, LtxCameraMotion> = {
    dolly_in: "dolly_in",
    push_in: "dolly_in",
    slow_push: "dolly_in",
    slow_push_in: "dolly_in",
    dolly_out: "dolly_out",
    pull_out: "dolly_out",
    pull_back: "dolly_out",
    dolly_left: "dolly_left",
    track_left: "dolly_left",
    dolly_right: "dolly_right",
    track_right: "dolly_right",
    jib_up: "jib_up",
    crane_up: "jib_up",
    jib_down: "jib_down",
    crane_down: "jib_down",
    static: "static",
    locked_off: "static",
    focus_shift: "focus_shift",
    rack_focus: "focus_shift",
  };

  return aliases[normalized];
}
