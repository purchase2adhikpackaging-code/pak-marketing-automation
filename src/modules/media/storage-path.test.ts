import { describe, expect, it } from "vitest";
import { buildMediaObjectIdentity, buildMediaStoragePath } from "./storage-path";

describe("buildMediaStoragePath", () => {
  it("scopes every asset beneath the organization prefix", () => {
    expect(buildMediaStoragePath("org-123", "video", "asset.mp4")).toBe("org-123/video/asset.mp4");
  });

  it("rejects traversal and slash injection", () => {
    expect(() => buildMediaStoragePath("../other", "video", "asset.mp4")).toThrow();
    expect(() => buildMediaStoragePath("org-123", "video", "../asset.mp4")).toThrow();
    expect(() => buildMediaStoragePath("org-123", "video/files", "asset.mp4")).toThrow();
  });

  it("normalizes unsafe filename characters without losing extension", () => {
    expect(buildMediaStoragePath("org-123", "image", "My Campus #1.png")).toBe("org-123/image/My-Campus-1.png");
  });
});

describe("buildMediaObjectIdentity", () => {
  it("returns a bucket plus the organization-scoped object path", () => {
    expect(buildMediaObjectIdentity("org-123", "generated-media", "final-video", "Master Film.mp4")).toEqual({
      bucket: "generated-media",
      path: "org-123/final-video/Master-Film.mp4",
    });
  });

  it("rejects unsafe bucket names", () => {
    expect(() => buildMediaObjectIdentity("org-123", "../bucket", "video", "asset.mp4")).toThrow();
    expect(() => buildMediaObjectIdentity("org-123", "generated/media", "video", "asset.mp4")).toThrow();
  });
});
