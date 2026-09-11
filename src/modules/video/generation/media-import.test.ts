import { describe, expect, it } from "vitest";
import {
  assertGeneratedVideoResponse,
  buildGeneratedVideoObjectPath,
} from "./media-import";

describe("generated video media import", () => {
  it("builds a deterministic organization-scoped object path", () => {
    expect(
      buildGeneratedVideoObjectPath({
        organizationId: "11111111-1111-4111-8111-111111111111",
        planVersionId: "22222222-2222-4222-8222-222222222222",
        shotId: "33333333-3333-4333-8333-333333333333",
        attemptId: "44444444-4444-4444-8444-444444444444",
      }),
    ).toBe(
      "11111111-1111-4111-8111-111111111111/generated-video/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444.mp4",
    );
  });

  it("accepts only non-empty successful video responses", async () => {
    const response = new Response(new Uint8Array([0, 1, 2, 3]), {
      status: 200,
      headers: { "content-type": "video/mp4" },
    });

    await expect(assertGeneratedVideoResponse(response)).resolves.toMatchObject({
      mimeType: "video/mp4",
      byteLength: 4,
    });
  });

  it("rejects non-2xx, non-video, and empty provider downloads", async () => {
    await expect(
      assertGeneratedVideoResponse(new Response("provider error", { status: 503 })),
    ).rejects.toThrow(/download/i);

    await expect(
      assertGeneratedVideoResponse(
        new Response("not video", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
      ),
    ).rejects.toThrow(/video/i);

    await expect(
      assertGeneratedVideoResponse(
        new Response(new Uint8Array(), {
          status: 200,
          headers: { "content-type": "video/mp4" },
        }),
      ),
    ).rejects.toThrow(/empty/i);
  });
});
