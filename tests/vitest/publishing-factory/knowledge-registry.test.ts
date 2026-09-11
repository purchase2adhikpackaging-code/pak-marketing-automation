import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { KnowledgePack } from "@/modules/publishing-factory/knowledge-domain";
import {
  getKnowledgePack,
  hashKnowledgePack,
  loadKnowledgeRegistry,
} from "@/modules/publishing-factory/knowledge-registry";

const roots: string[] = [];

const guidance = {
  certificate: { depth: "awareness", maths: "minimal", practical: "recognition", assessment: "identify" },
  diploma: { depth: "applied", maths: "applied", practical: "supervised", assessment: "apply" },
  bachelors: { depth: "analysis", maths: "engineering", practical: "analyse", assessment: "justify" },
  "postgraduate-diploma": { depth: "advanced applied", maths: "advanced", practical: "integrate", assessment: "evaluate" },
  masters: { depth: "systems", maths: "advanced quantitative", practical: "research", assessment: "critique" },
} as const;

function makePack(id: string): KnowledgePack {
  return {
    id,
    domain: id,
    title: `Pack ${id}`,
    revision: "1.0.0",
    status: "approved",
    canonicalTerminology: [
      { term: `${id} term`, definition: "Canonical definition", sourceIds: ["source-1"] },
    ],
    claims: [
      {
        id: `${id}-claim-1`,
        text: "Canonical claim",
        sourceIds: ["source-1"],
        safetyCritical: false,
        numeric: false,
      },
    ],
    equations: [],
    visualSpecs: [],
    prohibitedUnsupportedClaims: ["Do not invent limits."],
    levelGuidance: guidance,
    sourceIds: ["source-1"],
  };
}

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pak-knowledge-registry-"));
  roots.push(root);
  await mkdir(join(root, "publishing/knowledge/packs"), { recursive: true });
  return root;
}

async function writePack(root: string, pack: KnowledgePack): Promise<string> {
  const path = `publishing/knowledge/packs/${pack.id}.json`;
  await writeFile(join(root, path), JSON.stringify(pack, null, 2));
  return path;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("governed knowledge registry", () => {
  it("hashes canonical pack content deterministically independent of object key order", () => {
    const pack = makePack("alpha");
    const reordered = Object.fromEntries(Object.entries(pack).reverse()) as KnowledgePack;
    expect(hashKnowledgePack(pack)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashKnowledgePack(pack)).toBe(hashKnowledgePack(reordered));
  });

  it("loads packs in registry order, verifies hashes, and deep-freezes canonical data", async () => {
    const root = await makeRoot();
    const beta = makePack("beta");
    const alpha = makePack("alpha");
    const betaPath = await writePack(root, beta);
    const alphaPath = await writePack(root, alpha);
    await writeFile(
      join(root, "publishing/knowledge/registry.json"),
      JSON.stringify({
        version: "1.0.0",
        packs: [
          { packId: "beta", path: betaPath, revision: "1.0.0", sha256: hashKnowledgePack(beta), status: "approved" },
          { packId: "alpha", path: alphaPath, revision: "1.0.0", sha256: hashKnowledgePack(alpha), status: "approved" },
        ],
      }),
    );

    const loaded = await loadKnowledgeRegistry(root);
    expect(loaded.orderedPackIds).toEqual(["beta", "alpha"]);
    expect(getKnowledgePack(loaded, "alpha").title).toBe("Pack alpha");
    expect(Object.isFrozen(getKnowledgePack(loaded, "alpha"))).toBe(true);
    expect(Object.isFrozen(getKnowledgePack(loaded, "alpha").claims)).toBe(true);
    expect(() => {
      (getKnowledgePack(loaded, "alpha").claims as unknown as unknown[]).push({});
    }).toThrow();
  });

  it("rejects duplicate registry entries", async () => {
    const root = await makeRoot();
    const pack = makePack("alpha");
    const path = await writePack(root, pack);
    const entry = { packId: "alpha", path, revision: "1.0.0", sha256: hashKnowledgePack(pack), status: "approved" };
    await writeFile(join(root, "publishing/knowledge/registry.json"), JSON.stringify({ version: "1.0.0", packs: [entry, entry] }));
    await expect(loadKnowledgeRegistry(root)).rejects.toThrow(/duplicate knowledge pack registry entry/i);
  });

  it("rejects a missing pack file and a stored hash mismatch", async () => {
    const missingRoot = await makeRoot();
    await writeFile(
      join(missingRoot, "publishing/knowledge/registry.json"),
      JSON.stringify({ version: "1.0.0", packs: [{ packId: "missing", path: "publishing/knowledge/packs/missing.json", revision: "1.0.0", sha256: "0".repeat(64), status: "approved" }] }),
    );
    await expect(loadKnowledgeRegistry(missingRoot)).rejects.toThrow(/missing knowledge pack file/i);

    const mismatchRoot = await makeRoot();
    const pack = makePack("alpha");
    const path = await writePack(mismatchRoot, pack);
    await writeFile(
      join(mismatchRoot, "publishing/knowledge/registry.json"),
      JSON.stringify({ version: "1.0.0", packs: [{ packId: "alpha", path, revision: "1.0.0", sha256: "0".repeat(64), status: "approved" }] }),
    );
    await expect(loadKnowledgeRegistry(mismatchRoot)).rejects.toThrow(/hash mismatch/i);
  });
});
