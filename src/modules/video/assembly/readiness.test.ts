import { describe, expect, it } from "vitest";
import { computeFinalAssemblyReadiness, type FinalAssemblyReadinessInput } from "./readiness";

const readyInput: FinalAssemblyReadinessInput = {
  planStatus: "APPROVED",
  sourceFresh: true,
  hasBlocker: false,
  aspectRatio: "16:9",
  assemblyAlreadyRunning: false,
  shots: [
    {
      shotId: "shot-1",
      media: {
        mediaAssetId: "media-1",
        assetType: "VIDEO",
        status: "ACTIVE",
        checksum: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    },
  ],
};

describe("computeFinalAssemblyReadiness", () => {
  it("accepts an approved current blocker-free plan with active video media for every shot", () => {
    expect(computeFinalAssemblyReadiness(readyInput)).toEqual({ ready: true, reasons: [] });
  });

  it("reports lifecycle, freshness and QC blockers deterministically", () => {
    expect(
      computeFinalAssemblyReadiness({
        ...readyInput,
        planStatus: "DRAFT",
        sourceFresh: false,
        hasBlocker: true,
      }),
    ).toEqual({
      ready: false,
      reasons: ["PLAN_NOT_APPROVED", "SOURCE_STALE", "QC_BLOCKER_PRESENT"],
    });
  });

  it("rejects plans without shots", () => {
    expect(computeFinalAssemblyReadiness({ ...readyInput, shots: [] })).toEqual({
      ready: false,
      reasons: ["NO_SHOTS"],
    });
  });

  it("rejects any shot without imported PAK media", () => {
    expect(
      computeFinalAssemblyReadiness({
        ...readyInput,
        shots: [{ shotId: "shot-1", media: null }],
      }).reasons,
    ).toContain("SHOT_MEDIA_MISSING");
  });

  it("rejects archived/failed or non-video media", () => {
    expect(
      computeFinalAssemblyReadiness({
        ...readyInput,
        shots: [
          {
            shotId: "shot-1",
            media: {
              mediaAssetId: "media-1",
              assetType: "VIDEO",
              status: "ARCHIVED",
              checksum: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            },
          },
        ],
      }).reasons,
    ).toContain("MEDIA_NOT_ACTIVE");

    expect(
      computeFinalAssemblyReadiness({
        ...readyInput,
        shots: [
          {
            shotId: "shot-1",
            media: {
              mediaAssetId: "media-1",
              assetType: "AUDIO",
              status: "ACTIVE",
              checksum: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            },
          },
        ],
      }).reasons,
    ).toContain("MEDIA_NOT_ACTIVE");
  });

  it("rejects unsupported aspect ratios and duplicate active assembly execution", () => {
    expect(
      computeFinalAssemblyReadiness({
        ...readyInput,
        aspectRatio: "4:5",
        assemblyAlreadyRunning: true,
      }),
    ).toEqual({
      ready: false,
      reasons: ["UNSUPPORTED_ASPECT_RATIO", "ASSEMBLY_ALREADY_RUNNING"],
    });
  });
});
