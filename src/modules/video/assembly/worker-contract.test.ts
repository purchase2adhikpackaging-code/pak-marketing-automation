import { describe, expect, it } from "vitest";

import {
  FINAL_ASSEMBLY_MANIFEST_SCHEMA_VERSION,
  FINAL_ASSEMBLY_MAX_COMPONENTS,
  FINAL_ASSEMBLY_SIGNED_URL_TTL_SECONDS,
  parseFinalAssemblyRenderManifest,
  type FinalAssemblyRenderManifest,
} from "./worker-contract";

const manifest: FinalAssemblyRenderManifest = {
  schemaVersion: "final-assembly-render-v1",
  assemblyId: "11111111-1111-4111-8111-111111111111",
  jobId: "22222222-2222-4222-8222-222222222222",
  organizationId: "33333333-3333-4333-8333-333333333333",
  renderProfile: "PAK_MASTER_1080P_V1",
  aspectRatio: "16:9",
  expiresAt: "2026-09-12T02:30:00.000Z",
  output: {
    signedUploadUrl: "https://storage.example/upload/final",
    bucket: "generated-media",
    path: "33333333-3333-4333-8333-333333333333/final-video/11111111-final.mp4",
  },
  components: [
    {
      ordinal: 1,
      shotId: "44444444-4444-4444-8444-444444444444",
      mediaAssetId: "55555555-5555-4555-8555-555555555555",
      signedDownloadUrl: "https://storage.example/download/shot-1",
      checksum: `sha256:${"a".repeat(64)}`,
      durationSeconds: 6,
    },
  ],
};

describe("final assembly worker contract", () => {
  it("keeps the render protocol versioned and bounded", () => {
    expect(FINAL_ASSEMBLY_MANIFEST_SCHEMA_VERSION).toBe("final-assembly-render-v1");
    expect(FINAL_ASSEMBLY_MAX_COMPONENTS).toBeGreaterThan(0);
    expect(FINAL_ASSEMBLY_MAX_COMPONENTS).toBeLessThanOrEqual(500);
    expect(FINAL_ASSEMBLY_SIGNED_URL_TTL_SECONDS).toBeGreaterThanOrEqual(60);
    expect(FINAL_ASSEMBLY_SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(3600);
  });

  it("accepts a safe immutable manifest shape", () => {
    const parsed = parseFinalAssemblyRenderManifest(manifest);
    expect(parsed).toEqual(manifest);
    expect(parsed.output.bucket).toBe("generated-media");
  });

  it("rejects unbounded component lists", () => {
    expect(() => parseFinalAssemblyRenderManifest({
      ...manifest,
      components: Array.from({ length: FINAL_ASSEMBLY_MAX_COMPONENTS + 1 }, (_, index) => ({
        ...manifest.components[0]!,
        ordinal: index + 1,
      })),
    })).toThrow();
  });

  it("rejects arbitrary output buckets and malformed checksums", () => {
    expect(() => parseFinalAssemblyRenderManifest({
      ...manifest,
      output: { ...manifest.output, bucket: "public-assets" },
    })).toThrow();

    expect(() => parseFinalAssemblyRenderManifest({
      ...manifest,
      components: [{ ...manifest.components[0]!, checksum: "not-a-sha256" }],
    })).toThrow();
  });
});
