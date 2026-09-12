export type RenderAspectRatio = "16:9" | "9:16";

export type RenderProfile = {
  width: number;
  height: number;
  fps: 24;
  videoCodec: "libx264";
  pixelFormat: "yuv420p";
};

export function buildRenderProfile(input: { aspectRatio: RenderAspectRatio }): RenderProfile {
  return input.aspectRatio === "16:9"
    ? { width: 1920, height: 1080, fps: 24, videoCodec: "libx264", pixelFormat: "yuv420p" }
    : { width: 1080, height: 1920, fps: 24, videoCodec: "libx264", pixelFormat: "yuv420p" };
}

export function buildFfmpegArgs(
  profile: RenderProfile,
  inputPaths: string[],
  outputPath: string,
): string[] {
  if (inputPaths.length < 1) throw new Error("At least one render input is required");
  if (!outputPath) throw new Error("Output path is required");

  const args: string[] = ["-hide_banner", "-loglevel", "error"];
  for (const inputPath of inputPaths) {
    if (!inputPath) throw new Error("Render input path is required");
    args.push("-i", inputPath);
  }

  const filters = inputPaths.map((_, index) =>
    `[${index}:v]scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease,`
      + `pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2:black,`
      + `fps=${profile.fps},setsar=1,format=${profile.pixelFormat}[v${index}]`,
  );
  const inputs = inputPaths.map((_, index) => `[v${index}]`).join("");
  filters.push(`${inputs}concat=n=${inputPaths.length}:v=1:a=0[outv]`);

  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[outv]",
    "-an",
    "-c:v", profile.videoCodec,
    "-pix_fmt", profile.pixelFormat,
    "-r", String(profile.fps),
    "-movflags", "+faststart",
    "-y",
    outputPath,
  );

  return args;
}
