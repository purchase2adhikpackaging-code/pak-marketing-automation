import { describe, expect, it } from "vitest";
import { FakeVideoProvider } from "./fake-provider";
import type { VideoGenerationRequest } from "./types";

const request: VideoGenerationRequest = {
  organizationId: "org-1",
  sceneId: "scene-1",
  shotId: "shot-1",
  prompt: "Train maintenance workshop",
  durationSeconds: 8,
  aspectRatio: "16:9",
  continuity: { location: "PAK workshop" },
  cameraMotion: "slow push",
  generateAudio: false,
  idempotencyKey: "scene-1-shot-1-v1",
};

describe("FakeVideoProvider", () => {
  it("accepts the provider-neutral Phase 7 shot generation contract", () => {
    expect(request.shotId).toBe("shot-1");
    expect(request.cameraMotion).toBe("slow push");
    expect(request.generateAudio).toBe(false);
  });

  it("returns a deterministic completed generation result", async () => {
    const provider = new FakeVideoProvider();
    const handle = await provider.submit(request);

    expect(handle.provider).toBe("fake");
    await expect(provider.getStatus(handle)).resolves.toEqual({ state: "COMPLETED", progress: 100 });
    await expect(provider.getResult(handle)).resolves.toMatchObject({
      mimeType: "video/mp4",
      durationSeconds: 8,
    });
  });

  it("deduplicates submissions by idempotency key", async () => {
    const provider = new FakeVideoProvider();
    const first = await provider.submit(request);
    const second = await provider.submit(request);
    expect(second).toEqual(first);
  });
});
