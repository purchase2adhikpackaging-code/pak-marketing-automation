import { describe, expect, it } from "vitest";
import { computeAssemblyReadinessHash, type AssemblyReadinessHashInput } from "./hash";

const fixture: AssemblyReadinessHashInput = {
  organizationId: "org-1",
  planVersionId: "plan-1",
  sourceIntegrityHash: "sha256:source",
  aspectRatio: "16:9",
  renderProfile: "PAK_MASTER_1080P_V1",
  components: [
    {
      sceneId: "scene-1",
      shotId: "shot-1",
      mediaAssetId: "media-1",
      mediaChecksum: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      durationSeconds: 6,
    },
    {
      sceneId: "scene-1",
      shotId: "shot-2",
      mediaAssetId: "media-2",
      mediaChecksum: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      durationSeconds: 8,
    },
  ],
};

describe("computeAssemblyReadinessHash", () => {
  it("returns a stable sha256 identity for identical ordered inputs", () => {
    const first = computeAssemblyReadinessHash(fixture);
    const second = computeAssemblyReadinessHash(structuredClone(fixture));

    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(second).toBe(first);
  });

  it("changes when ordered component identity changes", () => {
    const reversed = { ...fixture, components: [...fixture.components].reverse() };
    expect(computeAssemblyReadinessHash(reversed)).not.toBe(computeAssemblyReadinessHash(fixture));
  });

  it("changes when media checksum or render profile input changes", () => {
    const changedChecksum = {
      ...fixture,
      components: fixture.components.map((component, index) =>
        index === 0
          ? {
              ...component,
              mediaChecksum: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            }
          : component,
      ),
    };

    expect(computeAssemblyReadinessHash(changedChecksum)).not.toBe(computeAssemblyReadinessHash(fixture));
    expect(
      computeAssemblyReadinessHash({ ...fixture, aspectRatio: "9:16" }),
    ).not.toBe(computeAssemblyReadinessHash(fixture));
  });
});
