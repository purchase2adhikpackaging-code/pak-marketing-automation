import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { validateVideoProbe } from "./ffprobe.js";
import { buildFfmpegArgs, buildRenderProfile } from "./render.js";

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${(result.stderr || result.stdout).slice(0, 4000)}`);
  }
  return result.stdout;
}

const directory = mkdtempSync(join(tmpdir(), "pak-render-smoke-"));
try {
  const first = join(directory, "first.mp4");
  const second = join(directory, "second.mp4");
  const output = join(directory, "final.mp4");

  for (const [path, color] of [[first, "blue"], [second, "green"]] as const) {
    run("ffmpeg", [
      "-hide_banner", "-loglevel", "error",
      "-f", "lavfi",
      "-i", `color=c=${color}:s=320x180:r=24:d=0.5`,
      "-an",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-y",
      path,
    ]);
  }

  const profile = buildRenderProfile({ aspectRatio: "16:9" });
  run("ffmpeg", buildFfmpegArgs(profile, [first, second], output));
  const probe = JSON.parse(run("ffprobe", [
    "-v", "error",
    "-show_streams",
    "-show_format",
    "-of", "json",
    output,
  ])) as unknown;
  const validated = validateVideoProbe(probe as never, profile);
  if (validated.durationSeconds <= 0) throw new Error("Smoke render has no positive duration");
  process.stdout.write(`render-smoke-ok ${validated.width}x${validated.height} ${validated.fps}fps ${validated.durationSeconds}s\n`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
