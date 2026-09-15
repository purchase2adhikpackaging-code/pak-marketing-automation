import { describe, expect, it } from "vitest";
import { runVisualQa } from "@/modules/publishing-factory/visual-qa";
import type { BookVisualPlan, ResolvedBookVisualBundle } from "@/modules/publishing-factory/visual-production";

const plan: BookVisualPlan = {
  bookId: "book-1",
  requirements: [
    { id: "front", placement: "front-cover", subjectPrompt: "front", caption: "Front cover", altText: "Realistic railway front cover", realistic: true, labelsRequired: false },
    { id: "technical", placement: "technical-diagram", chapterId: "ch-1", subjectPrompt: "bogie", caption: "Bogie components", altText: "Labeled bogie", realistic: true, labelsRequired: true },
    { id: "back", placement: "back-cover", subjectPrompt: "back", caption: "Back cover", altText: "Realistic railway back cover", realistic: true, labelsRequired: false },
  ],
};

function bundle(): ResolvedBookVisualBundle {
  return {
    bookId: "book-1",
    visuals: plan.requirements.map((requirement) => ({
      ...requirement,
      assetId: `asset-${requirement.id}`,
      mimeType: "image/jpeg",
      width: requirement.chapterId ? 1600 : 1800,
      height: requirement.chapterId ? 1200 : 2700,
      byteLength: 250000,
      sourceKind: "approved-library",
      provenance: "PAK approved visual library",
      dataUri: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD",
      realismVerified: true,
      labelsPresent: requirement.labelsRequired,
    })),
  };
}

function htmlFor(visuals: ResolvedBookVisualBundle): string {
  return `<main>${visuals.visuals.map((visual) => `<figure data-visual-id="${visual.id}"><img src="${visual.dataUri}" alt="${visual.altText}"></figure>`).join("")}</main>`;
}

describe("visual QA", () => {
  it("passes a complete benchmark-compliant visual bundle", () => { const visuals = bundle(); expect(runVisualQa({ plan, bundle: visuals, html: htmlFor(visuals) })).toEqual([]); });
  it.each([
    ["VISUAL_FRONT_COVER_MISSING", (visuals: ResolvedBookVisualBundle) => ({ ...visuals, visuals: visuals.visuals.filter((visual) => visual.placement !== "front-cover") })],
    ["VISUAL_BACK_COVER_MISSING", (visuals: ResolvedBookVisualBundle) => ({ ...visuals, visuals: visuals.visuals.filter((visual) => visual.placement !== "back-cover") })],
    ["VISUAL_CHAPTER_COVERAGE_MISSING", (visuals: ResolvedBookVisualBundle) => ({ ...visuals, visuals: visuals.visuals.filter((visual) => visual.chapterId !== "ch-1") })],
    ["VISUAL_LABELS_MISSING", (visuals: ResolvedBookVisualBundle) => ({ ...visuals, visuals: visuals.visuals.map((visual) => visual.labelsRequired ? { ...visual, labelsPresent: false } : visual) })],
    ["VISUAL_ASSET_INVALID", (visuals: ResolvedBookVisualBundle) => ({ ...visuals, visuals: visuals.visuals.map((visual, index) => index === 0 ? { ...visual, width: 500 } : visual) })],
    ["VISUAL_ASSET_INVALID", (visuals: ResolvedBookVisualBundle) => ({ ...visuals, visuals: visuals.visuals.map((visual, index) => index === 0 ? { ...visual, realismVerified: false } : visual) })],
  ])("emits blocking %s finding", (code, mutate) => { const mutated = mutate(bundle()); const findings = runVisualQa({ plan, bundle: mutated, html: htmlFor(mutated) }); expect(findings.some((finding) => finding.defectClass === code && finding.severity === "error")).toBe(true); });
  it("fails when a planned visual is missing from serialized HTML", () => { const visuals = bundle(); const html = htmlFor(visuals).replace('data-visual-id="technical"', 'data-visual-id="missing"'); const findings = runVisualQa({ plan, bundle: visuals, html }); expect(findings.some((finding) => finding.defectClass === "VISUAL_HTML_MISSING")).toBe(true); });
});
