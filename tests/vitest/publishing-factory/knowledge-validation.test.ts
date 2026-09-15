import { describe, expect, it } from "vitest";
import {
  validateKnowledgePack,
  validateSourceRegistry,
} from "@/modules/publishing-factory/knowledge-validation";
import type {
  KnowledgePack,
  KnowledgeSource,
} from "@/modules/publishing-factory/knowledge-domain";

const sources: KnowledgeSource[] = [
  {
    id: "eu-dir-2016-797",
    title: "Directive (EU) 2016/797",
    publisher: "European Union",
    authority: "eu-law",
    url: "https://eur-lex.europa.eu/eli/dir/2016/797/",
    accessedDate: "2026-09-11",
    scopeNote: "EU railway interoperability framework.",
  },
  {
    id: "academic-reference",
    title: "Academic railway engineering reference",
    publisher: "Academic Publisher",
    authority: "academic",
    accessedDate: "2026-09-11",
    scopeNote: "General educational background only.",
  },
];

function basePack(): KnowledgePack {
  return {
    id: "railway-systems",
    domain: "railway-systems",
    title: "Railway Systems Fundamentals",
    revision: "1.0.0",
    status: "approved",
    canonicalTerminology: [
      {
        term: "interoperability",
        definition: "Ability of the rail system to allow safe and uninterrupted movement meeting required performance.",
        sourceIds: ["eu-dir-2016-797"],
      },
    ],
    claims: [
      {
        id: "claim-1",
        text: "Interoperability depends on compatible railway subsystems.",
        sourceIds: ["eu-dir-2016-797"],
        safetyCritical: false,
        numeric: false,
      },
    ],
    equations: [],
    visualSpecs: [],
    prohibitedUnsupportedClaims: ["No unsupported operational limits."],
    levelGuidance: {
      certificate: { depth: "awareness", maths: "minimal", practical: "recognition", assessment: "identify" },
      diploma: { depth: "applied", maths: "applied", practical: "supervised", assessment: "apply" },
      bachelors: { depth: "analysis", maths: "engineering", practical: "analyse", assessment: "justify" },
      "postgraduate-diploma": { depth: "advanced applied", maths: "advanced", practical: "integrate", assessment: "evaluate" },
      masters: { depth: "advanced systems", maths: "advanced quantitative", practical: "research", assessment: "critique" },
    },
    sourceIds: ["eu-dir-2016-797"],
  };
}

describe("canonical knowledge validation", () => {
  it("rejects duplicate source ids", () => {
    const findings = validateSourceRegistry([sources[0]!, sources[0]!]);
    expect(findings.some((finding) => finding.code === "duplicate-source-id")).toBe(true);
  });

  it("rejects unknown source references", () => {
    const pack = basePack();
    pack.claims[0]!.sourceIds = ["missing-source"];
    const findings = validateKnowledgePack(pack, sources);
    expect(findings.some((finding) => finding.code === "unknown-source-id")).toBe(true);
  });

  it("rejects safety-critical numeric claims sourced only to academic material", () => {
    const pack = basePack();
    pack.claims = [
      {
        id: "claim-limit",
        text: "Illustrative acceptance limit is 10 units.",
        sourceIds: ["academic-reference"],
        safetyCritical: true,
        numeric: true,
      },
    ];
    pack.sourceIds = ["academic-reference"];
    const findings = validateKnowledgePack(pack, sources);
    expect(
      findings.some((finding) => finding.code === "unsafe-numeric-source-authority"),
    ).toBe(true);
  });

  it("accepts a non-numeric governed claim backed by EU law", () => {
    expect(validateKnowledgePack(basePack(), sources)).toEqual([]);
  });
});
