import { describe, expect, it } from "vitest";

import { validateVideoProbe } from "./ffprobe.js";

describe("validateVideoProbe", () => {
  it("accepts a valid 1080p 24fps visual master", () => {
    expect(validateVideoProbe({
      streams: [{ codec_type: "video", width: 1920, height: 1080, r_frame_rate: "24/1" }],
      format: { duration: "12.000", size: "1500000" },
    }, { width: 1920, height: 1080, fps: 24 })).toEqual({
      durationSeconds: 12,
      width: 1920,
      height: 1080,
      fps: 24,
      sizeBytes: 1500000,
    });
  });

  it("rejects missing video streams and invalid dimensions", () => {
    expect(() => validateVideoProbe({
      streams: [],
      format: { duration: "12", size: "100" },
    }, { width: 1920, height: 1080, fps: 24 })).toThrow();

    expect(() => validateVideoProbe({
      streams: [{ codec_type: "video", width: 1280, height: 720, r_frame_rate: "24/1" }],
      format: { duration: "12", size: "100" },
    }, { width: 1920, height: 1080, fps: 24 })).toThrow();
  });

  it("rejects empty or non-positive output metadata", () => {
    expect(() => validateVideoProbe({
      streams: [{ codec_type: "video", width: 1920, height: 1080, r_frame_rate: "24/1" }],
      format: { duration: "0", size: "0" },
    }, { width: 1920, height: 1080, fps: 24 })).toThrow();
  });
});
