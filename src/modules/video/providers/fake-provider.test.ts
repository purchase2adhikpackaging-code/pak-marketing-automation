import { describe, expect, it } from "vitest";
import { FakeVideoProvider } from "./fake-provider";

const request = {
  organizationId: "org-1",
  sceneId: "scene-1",
  prompt: "Train maintenance workshop",
  durationSeconds: 8,
  aspectRatio: "16:9" as const,
  continuity: { location: "PAK workshop" },
  idempotencyKey: "scene-1-v1",
};

describe("FakeVideoProvider", () => {
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
