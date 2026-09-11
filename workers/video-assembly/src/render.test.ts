import { describe, expect, it } from "vitest";

import { buildFfmpegArgs, buildRenderProfile } from "./render.js";

describe("final assembly ffmpeg render profile", () => {
  it("maps supported aspect ratios to the Phase 8 master profile", () => {
    expect(buildRenderProfile({ aspectRatio: "16:9" })).toEqual({
      width: 1920,
      height: 1080,
      fps: 24,
      videoCodec: "libx264",
      pixelFormat: "yuv420p",
    });
    expect(buildRenderProfile({ aspectRatio: "9:16" })).toMatchObject({
      width: 1080,
      height: 1920,
      fps: 24,
    });
  });

  it("builds a visual-only H.264 hard-cut render command", () => {
    const args = buildFfmpegArgs(
      buildRenderProfile({ aspectRatio: "16:9" }),
      ["/work/001.mp4", "/work/002.mp4"],
      "/work/final.mp4",
    );

    expect(args).toContain("libx264");
    expect(args).toContain("yuv420p");
    expect(args).toContain("+faststart");
    expect(args).toContain("-an");
    expect(args.join(" ")).toContain("concat=n=2:v=1:a=0");
    expect(args.join(" ")).toContain("1920:1080");
    expect(args.at(-1)).toBe("/work/final.mp4");
  });

  it("rejects empty input lists", () => {
    expect(() => buildFfmpegArgs(
      buildRenderProfile({ aspectRatio: "16:9" }),
      [],
      "/work/final.mp4",
    )).toThrow();
  });
});
