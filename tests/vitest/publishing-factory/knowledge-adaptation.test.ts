import { describe, expect, it } from "vitest";
import {
  adaptKnowledgePack,
  getLevelProfile,
} from "@/modules/publishing-factory/knowledge-adaptation";
import type { KnowledgePack } from "@/modules/publishing-factory/knowledge-domain";

const pack: KnowledgePack = {
  id: "braking-pneumatics",
  domain: "braking-pneumatics",
  title: "Railway Braking & Pneumatics",
  revision: "1.0.0",
  status: "approved",
  canonicalTerminology: [
    { term: "braking system", definition: "System used to control or reduce vehicle speed and secure vehicles as applicable.", sourceIds: ["src"] },
  ],
  claims: [
    { id: "c1", text: "Railway braking is safety-critical and must be treated using applicable controlled requirements.", sourceIds: ["src"], safetyCritical: true, numeric: false },
  ],
  equations: [],
  visualSpecs: [],
  prohibitedUnsupportedClaims: ["Do not invent brake acceptance limits."],
  levelGuidance: {
    certificate: { depth: "awareness", maths: "minimal", practical: "recognition only", assessment: "identify and explain" },
    diploma: { depth: "applied technician", maths: "supervised calculations", practical: "supervised inspection reasoning", assessment: "apply and diagnose" },
    bachelors: { depth: "engineering analysis", maths: "engineering mathematics", practical: "analysis and design reasoning", assessment: "analyse and justify" },
    "postgraduate-diploma": { depth: "advanced applied", maths: "advanced applied analysis", practical: "asset and maintenance integration", assessment: "evaluate and optimise" },
    masters: { depth: "advanced systems", maths: "advanced quantitative analysis", practical: "research and systems integration", assessment: "critique, model and optimise" },
  },
  sourceIds: ["src"],
};

describe("knowledge qualification adaptation", () => {
  it("provides progressively deeper level profiles", () => {
    expect(getLevelProfile("certificate").rank).toBeLessThan(getLevelProfile("diploma").rank);
    expect(getLevelProfile("diploma").rank).toBeLessThan(getLevelProfile("bachelors").rank);
    expect(getLevelProfile("bachelors").rank).toBeLessThan(getLevelProfile("postgraduate-diploma").rank);
    expect(getLevelProfile("postgraduate-diploma").rank).toBeLessThan(getLevelProfile("masters").rank);
  });

  it("preserves canonical claim text and provenance while adapting level guidance", () => {
    const adapted = adaptKnowledgePack(pack, "certificate");
    expect(adapted.claims[0]?.text).toBe(pack.claims[0]?.text);
    expect(adapted.claims[0]?.sourceIds).toEqual(["src"]);
    expect(adapted.level).toBe("certificate");
    expect(adapted.guidance.depth).toBe("awareness");
  });

  it("does not introduce procedures or claims absent from the canonical pack", () => {
    const adapted = adaptKnowledgePack(pack, "certificate");
    expect(adapted.claims).toHaveLength(pack.claims.length);
    expect(adapted.prohibitedUnsupportedClaims).toEqual(pack.prohibitedUnsupportedClaims);
  });
});
