import { describe, expect, it, vi } from "vitest";
import type { VideoGenerationRequest } from "../types";
import {
  LtxVideoProvider,
  normalizeLtxDuration,
  resolveLtxResolution,
} from "./adapter";

const request: VideoGenerationRequest = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  sceneId: "22222222-2222-4222-8222-222222222222",
  shotId: "33333333-3333-4333-8333-333333333333",
  prompt: "A railway trainer crosses a modern systems laboratory, restrained cinematic motion.",
  durationSeconds: 7,
  aspectRatio: "16:9",
  continuity: { location: "railway systems laboratory" },
  cameraMotion: "slow push",
  generateAudio: false,
  idempotencyKey: "plan-1:shot-1:pro-1080p",
};

describe("LTX adapter capabilities", () => {
  it("normalizes approved shot durations only within the bounded Pro envelope", () => {
    expect(normalizeLtxDuration(4)).toBe(6);
    expect(normalizeLtxDuration(5)).toBe(6);
    expect(normalizeLtxDuration(7)).toBe(8);
    expect(normalizeLtxDuration(9)).toBe(10);
    expect(normalizeLtxDuration(12)).toBe(10);
    expect(() => normalizeLtxDuration(3)).toThrow(/duration/i);
    expect(() => normalizeLtxDuration(13)).toThrow(/duration/i);
  });

  it("maps only LTX text-to-video supported aspect ratios", () => {
    expect(resolveLtxResolution("16:9")).toBe("1920x1080");
    expect(resolveLtxResolution("9:16")).toBe("1080x1920");
    expect(() => resolveLtxResolution("1:1")).toThrow(/UNSUPPORTED_ASPECT_RATIO/);
    expect(() => resolveLtxResolution("4:5")).toThrow(/UNSUPPORTED_ASPECT_RATIO/);
  });

  it("submits the current async V2 LTX-2.5 Pro request without provider-generated audio", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "ltx-job-1", created_at: "2026-09-11T12:00:00Z" }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    const provider = new LtxVideoProvider({ apiKey: "secret-ltx-key", fetchFn });

    await expect(provider.submit(request)).resolves.toEqual({ provider: "ltx", externalId: "ltx-job-1" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://api.ltx.io/v2/text-to-video");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer secret-ltx-key");
    expect(JSON.parse(String(init.body))).toEqual({
      prompt: request.prompt,
      model: "ltx-2-5-pro",
      duration: 8,
      resolution: "1920x1080",
      fps: 24,
      generate_audio: false,
    });
  });

  it("normalizes async provider status without exposing LTX status strings to callers", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "pending", id: "ltx-job-1", created_at: "2026-09-11T12:00:00Z" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "processing", id: "ltx-job-1", progress: 42, created_at: "2026-09-11T12:00:00Z" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed", id: "ltx-job-1", result: { video_url: "https://provider.invalid/temporary.mp4" }, created_at: "2026-09-11T12:00:00Z" }), { status: 200 }));
    const provider = new LtxVideoProvider({ apiKey: "secret-ltx-key", fetchFn });
    const handle = { provider: "ltx", externalId: "ltx-job-1" };

    await expect(provider.getStatus(handle)).resolves.toEqual({ state: "QUEUED" });
    await expect(provider.getStatus(handle)).resolves.toEqual({ state: "PROCESSING", progress: 42 });
    await expect(provider.getStatus(handle)).resolves.toEqual({ state: "COMPLETED", progress: 100 });
  });

  it("returns the completed video result only from a completed job payload", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          id: "ltx-job-1",
          result: { video_url: "https://provider.invalid/temporary.mp4" },
          created_at: "2026-09-11T12:00:00Z",
        }),
        { status: 200 },
      ),
    );
    const provider = new LtxVideoProvider({ apiKey: "secret-ltx-key", fetchFn });

    await expect(provider.getResult({ provider: "ltx", externalId: "ltx-job-1" })).resolves.toEqual({
      outputUrl: "https://provider.invalid/temporary.mp4",
      mimeType: "video/mp4",
    });
  });
});
