import { beforeAll, describe, expect, it } from "vitest";
import type { LoadedKnowledgeRegistry } from "@/modules/publishing-factory/knowledge-registry";
import { loadKnowledgeRegistry } from "@/modules/publishing-factory/knowledge-registry";
import { assembleKnowledgeContext } from "@/modules/publishing-factory/knowledge-context";

let registry: LoadedKnowledgeRegistry;

beforeAll(async () => {
  registry = await loadKnowledgeRegistry(process.cwd());
});

describe("manuscript knowledge context", () => {
  it("preserves pack hashes, qualification level and source provenance", () => {
    const context = assembleKnowledgeContext({
      packIds: ["railway-systems", "rolling-stock"],
      level: "diploma",
      registry,
    });

    expect(context.level).toBe("diploma");
    expect(context.levelProfile.rank).toBe(2);
    expect(context.selectedPacks.map((pack) => pack.packId)).toEqual([
      "railway-systems",
      "rolling-stock",
    ]);
    expect(context.selectedPacks.every((pack) => /^[a-f0-9]{64}$/.test(pack.sha256))).toBe(true);
    expect(context.canonicalTerminology.every((term) => term.sourceIds.length > 0)).toBe(true);
    expect(Object.keys(context.claimsByDomain)).toEqual([
      "railway-systems",
      "rolling-stock",
    ]);
  });

  it("de-duplicates shared sources and preserves prohibited-claim controls", () => {
    const context = assembleKnowledgeContext({
      packIds: ["railway-systems", "rolling-stock"],
      level: "bachelors",
      registry,
    });

    const sourceIds = context.sourceRegister.map((source) => source.id);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    expect(sourceIds).toContain("eu-dir-2016-797");
    expect(context.prohibitedUnsupportedClaims.length).toBeGreaterThan(0);
    expect(context.safetyControls.levelBoundary).toMatch(/approval|authority|operational/i);
  });

  it("rejects unknown packs", () => {
    expect(() =>
      assembleKnowledgeContext({
        packIds: ["not-a-real-pack"],
        level: "diploma",
        registry,
      }),
    ).toThrow(/unknown knowledge pack/i);
  });

  it("gives every manuscript using the same canonical pack the same fact hash", () => {
    const first = assembleKnowledgeContext({
      packIds: ["railway-systems"],
      level: "certificate",
      registry,
    });
    const second = assembleKnowledgeContext({
      packIds: ["railway-systems"],
      level: "masters",
      registry,
    });

    expect(first.selectedPacks[0]?.sha256).toBe(second.selectedPacks[0]?.sha256);
  });
});
