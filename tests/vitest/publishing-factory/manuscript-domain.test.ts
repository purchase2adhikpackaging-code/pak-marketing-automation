import { describe, expect, it } from "vitest";
import type { ChapterBlueprint } from "@/modules/publishing-factory/blueprint";
import {
  BookManuscriptSchema,
  ChapterManuscriptSchema,
  validateChapterAgainstBlueprint,
} from "@/modules/publishing-factory/manuscript-domain";

const chapterBlueprint: ChapterBlueprint = {
  id: "D01-102-CH01",
  number: 1,
  title: "Engineering quantities and units",
  purpose: "Establish controlled calculation conventions.",
  learningOutcomes: ["Apply units consistently in railway calculations."],
  requiredKnowledgePackIds: ["mechanical-fundamentals"],
  requiredVisualIds: [],
  workedExampleRequirements: ["Unit conversion exercise"],
  practicalRequirements: [],
  assessmentRequirements: ["Short calculation set"],
  safetyCritical: false,
  referenceSourceIds: [],
};

const validChapter = {
  chapterId: chapterBlueprint.id,
  number: chapterBlueprint.number,
  title: chapterBlueprint.title,
  purpose: chapterBlueprint.purpose,
  learningOutcomes: [...chapterBlueprint.learningOutcomes],
  keyTerms: [
    {
      term: "SI unit",
      explanation: "A unit belonging to the International System of Units used consistently in engineering calculations.",
    },
  ],
  sections: [
    {
      heading: "Engineering quantities",
      paragraphs: [
        "Railway engineering calculations depend on explicit quantities, units and conversion steps so that technical reasoning can be checked by another competent person.",
      ],
    },
    {
      heading: "Unit consistency",
      paragraphs: [
        "Before substituting values into an equation, convert them to a consistent unit system and retain the unit through each intermediate calculation step.",
      ],
    },
  ],
  workedExamples: [
    {
      title: "Convert train speed",
      problem: "Convert a stated train speed from kilometres per hour to metres per second for use in a calculation.",
      solutionSteps: [
        "Write the given value and unit.",
        "Apply the kilometre-to-metre and hour-to-second conversion factors.",
        "Check the resulting dimensional unit before using the value.",
      ],
      conclusion: "The converted value is now expressed in the unit required by the downstream equation.",
    },
  ],
  practicalActivities: [],
  safetyNotes: [
    "Training calculations do not replace controlled operating or maintenance limits applicable to a real vehicle or infrastructure asset.",
  ],
  knowledgeChecks: ["Why should units be retained through intermediate calculation steps?"],
  summary: ["Use explicit, consistent units throughout railway engineering calculations."],
  reviewQuestions: ["Describe a reliable method for checking a unit conversion."],
  sourceIds: ["era-technical-docs"],
};

describe("structured textbook manuscript contracts", () => {
  it("accepts a substantive governed chapter", () => {
    const parsed = ChapterManuscriptSchema.parse(validChapter);
    expect(
      validateChapterAgainstBlueprint(parsed, chapterBlueprint, new Set(["era-technical-docs"])),
    ).toEqual([]);
  });

  it("rejects chapter identity and learning-outcome mismatch", () => {
    const parsed = ChapterManuscriptSchema.parse({
      ...validChapter,
      chapterId: "WRONG",
      learningOutcomes: ["Different outcome"],
    });
    expect(
      validateChapterAgainstBlueprint(parsed, chapterBlueprint, new Set(["era-technical-docs"]))
        .join("\n"),
    ).toMatch(/chapter id|learning outcome/i);
  });

  it("rejects duplicate headings and repeated substantive paragraphs", () => {
    const paragraph = validChapter.sections[0]!.paragraphs[0]!;
    const parsed = ChapterManuscriptSchema.parse({
      ...validChapter,
      sections: [
        validChapter.sections[0],
        { heading: validChapter.sections[0]!.heading, paragraphs: [paragraph] },
      ],
    });
    expect(
      validateChapterAgainstBlueprint(parsed, chapterBlueprint, new Set(["era-technical-docs"]))
        .join("\n"),
    ).toMatch(/duplicate section heading|duplicate paragraph/i);
  });

  it("rejects placeholders and ungrounded source ids", () => {
    const parsed = ChapterManuscriptSchema.parse({
      ...validChapter,
      sections: [
        {
          heading: "Engineering quantities",
          paragraphs: ["TODO"],
        },
      ],
      sourceIds: ["invented-source"],
    });
    expect(
      validateChapterAgainstBlueprint(parsed, chapterBlueprint, new Set(["era-technical-docs"]))
        .join("\n"),
    ).toMatch(/placeholder|not present in the grounding context/i);
  });

  it("accepts an exact book manuscript with hashes and provider metadata", () => {
    const parsed = BookManuscriptSchema.parse({
      bookId: "PAK-D01-S1-D01-102-TEXTBOOK",
      programmeCode: "PAK-D01",
      subjectCode: "D01-102",
      subjectTitle: "Applied Engineering Mathematics & Physics for Railways",
      level: "diploma",
      edition: "2026",
      revision: "0.1.0",
      blueprintSha256: "a".repeat(64),
      knowledgePacks: [
        { packId: "mechanical-fundamentals", sha256: "b".repeat(64) },
      ],
      provider: { name: "fake", model: "deterministic-fixture" },
      chapters: [validChapter],
    });
    expect(parsed.chapters).toHaveLength(1);
  });
});
