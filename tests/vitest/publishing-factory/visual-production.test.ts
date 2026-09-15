import { describe, expect, it } from "vitest";
import type { BookBlueprint } from "../../../src/modules/publishing-factory/blueprint";
import type { BookManuscript } from "../../../src/modules/publishing-factory/manuscript-domain";
import {
  createBookVisualPlan,
  validateResolvedBookVisualBundle,
  type ResolvedBookVisualBundle,
} from "../../../src/modules/publishing-factory/visual-production";

const blueprint: BookBlueprint = {
  bookId: "PAK-D01-S1-D01-101-TEXTBOOK",
  programmeCode: "PAK-D01",
  subjectCode: "D01-101",
  subjectTitle: "Railway Systems & Rolling Stock Fundamentals",
  level: "diploma",
  purpose: "Teach railway fundamentals.",
  prerequisites: [],
  knowledgePackIds: ["kp-1"],
  chapters: [
    {
      id: "ch-1",
      number: 1,
      title: "Railway system architecture",
      purpose: "Understand railway system architecture.",
      learningOutcomes: ["Explain the railway system."],
      requiredKnowledgePackIds: ["kp-1"],
      requiredVisualIds: ["bogie"],
      workedExampleRequirements: [],
      practicalRequirements: [],
      assessmentRequirements: ["Review questions"],
      safetyCritical: false,
      referenceSourceIds: ["src-1"],
    },
    {
      id: "ch-2",
      number: 2,
      title: "Rolling stock practical inspection",
      purpose: "Inspect railway vehicles safely.",
      learningOutcomes: ["Identify rolling stock components."],
      requiredKnowledgePackIds: ["kp-1"],
      requiredVisualIds: [],
      workedExampleRequirements: [],
      practicalRequirements: ["Inspect a bogie."],
      assessmentRequirements: ["Practical record"],
      safetyCritical: true,
      referenceSourceIds: ["src-1"],
    },
  ],
};

const manuscript: BookManuscript = {
  bookId: blueprint.bookId,
  programmeCode: blueprint.programmeCode,
  subjectCode: blueprint.subjectCode,
  subjectTitle: blueprint.subjectTitle,
  level: blueprint.level,
  edition: "2026",
  revision: "0.2.0",
  blueprintSha256: "a".repeat(64),
  knowledgePacks: [{ packId: "kp-1", sha256: "b".repeat(64) }],
  provider: { name: "openai", model: "gpt-5.6-luna" },
  chapters: blueprint.chapters.map((chapter) => ({
    chapterId: chapter.id,
    number: chapter.number,
    title: chapter.title,
    purpose: chapter.purpose,
    learningOutcomes: chapter.learningOutcomes,
    keyTerms: [{ term: "railway", explanation: "A guided transport system." }],
    sections: [{ heading: "Overview", paragraphs: ["Railway systems combine infrastructure, rolling stock and operations into one controlled transport system."] }],
    workedExamples: [],
    practicalActivities: chapter.practicalRequirements.length
      ? [{ title: "Inspection", objective: "Inspect components.", safety: ["Follow workshop rules."], tasks: ["Inspect bogie."], records: ["Record observations."] }]
      : [],
    safetyNotes: chapter.safetyCritical ? ["Use approved workshop controls."] : [],
    knowledgeChecks: ["What is rolling stock?"],
    summary: ["Railway subsystems interact."],
    reviewQuestions: ["Describe one subsystem."],
    sourceIds: ["src-1"],
  })),
};

function resolvePlan(): ResolvedBookVisualBundle {
  const plan = createBookVisualPlan(manuscript, blueprint);
  return {
    bookId: plan.bookId,
    visuals: plan.requirements.map((requirement) => {
      const cover = requirement.placement === "front-cover" || requirement.placement === "back-cover";
      return {
        ...requirement,
        assetId: `asset-${requirement.id}`,
        mimeType: "image/jpeg",
        width: cover ? 1800 : 1600,
        height: cover ? 2700 : 1200,
        byteLength: 250_000,
        sourceKind: "approved-library",
        provenance: "Polish Railway Academy approved visual library",
        dataUri: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD",
        labelsPresent: requirement.labelsRequired,
      };
    }),
  };
}

describe("textbook visual production contract", () => {
  it("plans exactly one front cover, one back cover, and at least one visual per chapter", () => {
    const plan = createBookVisualPlan(manuscript, blueprint);

    expect(plan.requirements.filter((visual) => visual.placement === "front-cover")).toHaveLength(1);
    expect(plan.requirements.filter((visual) => visual.placement === "back-cover")).toHaveLength(1);

    for (const chapter of manuscript.chapters) {
      expect(plan.requirements.some((visual) => visual.chapterId === chapter.chapterId)).toBe(true);
    }

    expect(plan.requirements.some((visual) => visual.placement === "technical-diagram" && visual.labelsRequired)).toBe(true);
    expect(plan.requirements.some((visual) => visual.placement === "practical-photo" && visual.chapterId === "ch-2")).toBe(true);
  });

  it("accepts a complete print-quality resolved bundle", () => {
    const plan = createBookVisualPlan(manuscript, blueprint);
    expect(validateResolvedBookVisualBundle(plan, resolvePlan())).toEqual([]);
  });

  it.each([
    ["missing front cover", (bundle: ResolvedBookVisualBundle) => ({ ...bundle, visuals: bundle.visuals.filter((visual) => visual.placement !== "front-cover") })],
    ["missing chapter visual", (bundle: ResolvedBookVisualBundle) => ({ ...bundle, visuals: bundle.visuals.filter((visual) => visual.chapterId !== "ch-1") })],
    ["unsupported MIME", (bundle: ResolvedBookVisualBundle) => ({ ...bundle, visuals: bundle.visuals.map((visual, index) => index === 0 ? { ...visual, mimeType: "image/svg+xml" } : visual) })],
    ["low resolution", (bundle: ResolvedBookVisualBundle) => ({ ...bundle, visuals: bundle.visuals.map((visual, index) => index === 0 ? { ...visual, width: 800, height: 1200 } : visual) })],
    ["missing provenance", (bundle: ResolvedBookVisualBundle) => ({ ...bundle, visuals: bundle.visuals.map((visual, index) => index === 0 ? { ...visual, provenance: "" } : visual) })],
    ["missing caption", (bundle: ResolvedBookVisualBundle) => ({ ...bundle, visuals: bundle.visuals.map((visual, index) => index === 0 ? { ...visual, caption: "" } : visual) })],
    ["missing alt text", (bundle: ResolvedBookVisualBundle) => ({ ...bundle, visuals: bundle.visuals.map((visual, index) => index === 0 ? { ...visual, altText: "" } : visual) })],
    ["missing required labels", (bundle: ResolvedBookVisualBundle) => ({ ...bundle, visuals: bundle.visuals.map((visual) => visual.labelsRequired ? { ...visual, labelsPresent: false } : visual) })],
    ["placeholder asset", (bundle: ResolvedBookVisualBundle) => ({ ...bundle, visuals: bundle.visuals.map((visual, index) => index === 0 ? { ...visual, provenance: "placeholder image" } : visual) })],
  ])("rejects %s", (_name, mutate) => {
    const plan = createBookVisualPlan(manuscript, blueprint);
    expect(validateResolvedBookVisualBundle(plan, mutate(resolvePlan())).length).toBeGreaterThan(0);
  });
});
