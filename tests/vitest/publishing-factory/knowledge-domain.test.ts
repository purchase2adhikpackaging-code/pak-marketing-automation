import { describe, expect, it } from "vitest";
import {
  KnowledgePackSchema,
  KnowledgeSourceSchema,
} from "@/modules/publishing-factory/knowledge-domain";

const source = {
  id: "eu-dir-2016-797",
  title: "Directive (EU) 2016/797",
  publisher: "European Union",
  authority: "eu-law" as const,
  url: "https://eur-lex.europa.eu/eli/dir/2016/797/",
  accessedDate: "2026-09-11",
  scopeNote: "EU railway interoperability framework.",
};

const pack = {
  id: "railway-systems",
  domain: "railway-systems",
  title: "Railway Systems Fundamentals",
  revision: "1.0.0",
  status: "approved" as const,
  canonicalTerminology: [
    {
      term: "railway system",
      definition: "An integrated transport system whose subsystems and organisations interact to provide railway services.",
      sourceIds: [source.id],
    },
  ],
  claims: [
    {
      id: "rs-claim-001",
      text: "Railway interoperability depends on compatible technical and operational subsystems.",
      sourceIds: [source.id],
      safetyCritical: false,
      numeric: false,
    },
  ],
  equations: [],
  visualSpecs: [
    {
      id: "rs-visual-001",
      type: "block-diagram" as const,
      purpose: "Show railway subsystem interfaces.",
      labels: ["Infrastructure", "Rolling stock", "Energy", "Control-command", "Operations"],
      trainingOnly: true,
    },
  ],
  prohibitedUnsupportedClaims: ["Do not state operational acceptance limits without a governing source."],
  levelGuidance: {
    certificate: { depth: "awareness", maths: "minimal", practical: "recognition", assessment: "identify and explain" },
    diploma: { depth: "applied", maths: "supervised applied calculations", practical: "technician application", assessment: "apply and diagnose" },
    bachelors: { depth: "engineering analysis", maths: "engineering mathematics", practical: "analysis and design", assessment: "analyse and justify" },
    "postgraduate-diploma": { depth: "advanced applied", maths: "advanced applied analysis", practical: "asset and management integration", assessment: "evaluate and optimise" },
    masters: { depth: "advanced systems", maths: "advanced quantitative analysis", practical: "research and systems integration", assessment: "critique, model and optimise" },
  },
  sourceIds: [source.id],
};

describe("canonical knowledge domain contracts", () => {
  it("accepts a governed source and well-formed knowledge pack", () => {
    expect(KnowledgeSourceSchema.parse(source).id).toBe(source.id);
    expect(KnowledgePackSchema.parse(pack).id).toBe("railway-systems");
  });

  it("rejects a pack with an empty id", () => {
    expect(() => KnowledgePackSchema.parse({ ...pack, id: "" })).toThrow();
  });

  it("rejects a pack without canonical terminology", () => {
    expect(() => KnowledgePackSchema.parse({ ...pack, canonicalTerminology: [] })).toThrow();
  });

  it("rejects a pack without any source ids", () => {
    expect(() => KnowledgePackSchema.parse({ ...pack, sourceIds: [] })).toThrow();
  });
});
