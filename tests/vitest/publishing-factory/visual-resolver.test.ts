import { describe, expect, it } from "vitest";
import {
  VisualAssetResolutionError,
  createBookVisualResolver,
  type VisualAssetSource,
} from "../../../src/modules/publishing-factory/visual-resolver";
import type { BookVisualPlan } from "../../../src/modules/publishing-factory/visual-production";

const plan: BookVisualPlan = {
  bookId: "book-1",
  requirements: [
    {
      id: "front-cover",
      placement: "front-cover",
      subjectPrompt: "Realistic railway cover",
      caption: "Front cover",
      altText: "Railway front cover",
      realistic: true,
      labelsRequired: false,
    },
  ],
};

function source(overrides: Partial<VisualAssetSource> = {}): VisualAssetSource {
  return {
    name: "approved-library",
    async resolve(requirement) {
      return {
        requirementId: requirement.id,
        assetId: "approved-asset-1",
        mimeType: "image/jpeg",
        width: 1800,
        height: 2700,
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3, 4]),
        sourceKind: "approved-library",
        provenance: "PAK approved textbook visual library",
        labelsPresent: false,
      };
    },
    ...overrides,
  };
}

describe("book visual resolver", () => {
  it("normalizes approved assets to renderer-safe data URIs with provenance", async () => {
    const resolver = createBookVisualResolver([source()]);
    const bundle = await resolver.resolve(plan);

    expect(bundle.visuals).toHaveLength(1);
    expect(bundle.visuals[0]?.dataUri).toMatch(/^data:image\/jpeg;base64,/);
    expect(bundle.visuals[0]?.provenance).toBe("PAK approved textbook visual library");
    expect(bundle.visuals[0]?.sourceKind).toBe("approved-library");
  });

  it("tries the next source when the first source has no approved asset", async () => {
    const first = source({ name: "empty", async resolve() { return null; } });
    const second = source({ name: "generated" });
    const bundle = await createBookVisualResolver([first, second]).resolve(plan);
    expect(bundle.visuals[0]?.assetId).toBe("approved-asset-1");
  });

  it("fails closed when no source resolves a requirement", async () => {
    const empty = source({ async resolve() { return null; } });
    await expect(createBookVisualResolver([empty]).resolve(plan)).rejects.toBeInstanceOf(
      VisualAssetResolutionError,
    );
  });

  it("rejects remote-only or malformed asset payloads instead of persisting URLs", async () => {
    const bad = source({
      async resolve(requirement) {
        return {
          requirementId: requirement.id,
          assetId: "remote-only",
          mimeType: "image/jpeg",
          width: 1800,
          height: 2700,
          bytes: new Uint8Array(),
          sourceKind: "licensed-source",
          provenance: "https://example.test/signed?token=secret",
          labelsPresent: false,
        };
      },
    });

    await expect(createBookVisualResolver([bad]).resolve(plan)).rejects.toBeInstanceOf(
      VisualAssetResolutionError,
    );
  });
});
