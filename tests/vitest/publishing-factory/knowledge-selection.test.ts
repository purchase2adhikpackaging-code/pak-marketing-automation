import { describe, expect, it } from "vitest";
import { selectKnowledgePacksForSubject } from "@/modules/publishing-factory/knowledge-selection";

const availablePackIds = [
  "railway-systems",
  "rolling-stock",
  "mechanical-fundamentals",
  "technical-drawing-documentation",
  "materials-metallurgy",
  "metrology-measurement",
  "safety-human-factors",
  "maintenance-ecm",
  "quality-compliance",
  "braking-pneumatics",
  "electrical-electronic",
];

function selected(title: string, orientation = ""): string[] {
  return selectKnowledgePacksForSubject({ title, orientation, availablePackIds });
}

describe("deterministic knowledge-pack selection", () => {
  it("selects railway and rolling-stock grounding for systems fundamentals", () => {
    expect(selected("Railway Systems & Rolling Stock Fundamentals")).toEqual(
      expect.arrayContaining(["railway-systems", "rolling-stock"]),
    );
  });

  it("selects mechanics grounding for applied engineering mathematics and physics", () => {
    expect(selected("Applied Engineering Mathematics & Physics for Railways")).toEqual(
      expect.arrayContaining(["railway-systems", "mechanical-fundamentals"]),
    );
  });

  it("selects documentation grounding for engineering drawing and CAD", () => {
    expect(selected("Engineering Drawing, CAD & Technical Documentation")).toContain(
      "technical-drawing-documentation",
    );
  });

  it("selects materials grounding for materials, manufacturing and corrosion", () => {
    expect(
      selected("Engineering Materials, Manufacturing Processes & Corrosion Control"),
    ).toContain("materials-metallurgy");
  });

  it("selects metrology grounding for workshop tools and measurement", () => {
    expect(selected("Workshop Practice, Tools, Metrology & Fastening Systems")).toContain(
      "metrology-measurement",
    );
  });

  it("selects safety grounding for railway safety and occupational health", () => {
    expect(
      selected("Railway Safety, Occupational Health & Safety and Technical Communication"),
    ).toEqual(expect.arrayContaining(["railway-systems", "safety-human-factors"]));
  });

  it("falls back to railway-systems for an unknown railway subject when available", () => {
    expect(selected("Special Topics in Railway Technology")).toEqual(["railway-systems"]);
  });

  it("never returns a pack id that is not in the governed available set", () => {
    const result = selectKnowledgePacksForSubject({
      title: "Advanced Braking and Electrical Diagnostics",
      orientation: "Rolling-stock maintenance and fault finding",
      availablePackIds,
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((packId) => availablePackIds.includes(packId))).toBe(true);
  });

  it("returns stable deterministic ordering", () => {
    const first = selected("Railway Safety and Rolling Stock Maintenance");
    const second = selected("Railway Safety and Rolling Stock Maintenance");
    expect(first).toEqual(second);
  });
});
