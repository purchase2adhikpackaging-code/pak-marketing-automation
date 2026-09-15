import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KnowledgePackRegistrySchema,
  KnowledgePackSchema,
  KnowledgeSourceSchema,
} from "@/modules/publishing-factory/knowledge-domain";
import {
  validateKnowledgePack,
  validateSourceRegistry,
} from "@/modules/publishing-factory/knowledge-validation";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as unknown;
}

describe("canonical railway knowledge pack library", () => {
  it("contains exactly 24 unique governed seed packs and every pack validates", () => {
    const registry = KnowledgePackRegistrySchema.parse(
      readJson("publishing/knowledge/registry.json"),
    );
    const sources = KnowledgeSourceSchema.array().parse(
      readJson("publishing/knowledge/sources/eu-era-core.json"),
    );

    expect(validateSourceRegistry(sources)).toEqual([]);
    expect(registry.packs).toHaveLength(24);
    expect(new Set(registry.packs.map((entry) => entry.packId)).size).toBe(24);

    for (const entry of registry.packs) {
      const pack = KnowledgePackSchema.parse(readJson(entry.path));
      expect(pack.id).toBe(entry.packId);
      expect(pack.revision).toBe(entry.revision);
      expect(pack.status).toBe(entry.status);
      expect(validateKnowledgePack(pack, sources)).toEqual([]);
    }
  });
});
