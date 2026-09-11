import { describe, expect, it } from "vitest";
import {
  BookBlueprintSchema,
  validateBookBlueprintForJob,
} from "@/modules/publishing-factory/blueprint";
import type { BookJob } from "@/modules/publishing-factory/domain";

const job: BookJob = {
  bookId: "PAK-D01-S1-D01-102-TEXTBOOK",
  programmeCode: "PAK-D01",
  programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
  level: "diploma",
  academicPeriod: "S1",
  subjectCode: "D01-102",
  subjectTitle: "Applied Engineering Mathematics & Physics for Railways",
  publicationType: "textbook",
  edition: "2026",
  revision: "0.1.0",
  curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
  status: "PLANNED",
  repairAttempts: {},
};

const blueprint = {
  bookId: job.bookId,
  programmeCode: job.programmeCode,
  subjectCode: job.subjectCode,
  subjectTitle: job.subjectTitle,
  level: job.level,
  purpose: "Build applied railway engineering calculation competence.",
  prerequisites: [],
  knowledgePackIds: ["railway-systems", "mechanical-fundamentals"],
  chapters: [
    {
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
    },
    {
      id: "D01-102-CH02",
      number: 2,
      title: "Forces and motion",
      purpose: "Relate force and motion to railway systems.",
      learningOutcomes: ["Solve supervised force and motion problems."],
      requiredKnowledgePackIds: ["railway-systems", "mechanical-fundamentals"],
      requiredVisualIds: ["railway-system-boundary"],
      workedExampleRequirements: ["Force balance example"],
      practicalRequirements: ["Measurement exercise"],
      assessmentRequirements: ["Applied problem"],
      safetyCritical: true,
      referenceSourceIds: ["eu-2016-797"],
    },
  ],
};

const firstChapter = blueprint.chapters[0]!;
const secondChapter = blueprint.chapters[1]!;

describe("book blueprint contract", () => {
  it("accepts a governed blueprint matching the book job", () => {
    const parsed = BookBlueprintSchema.parse(blueprint);
    expect(validateBookBlueprintForJob(job, parsed)).toEqual([]);
  });

  it("rejects mismatched identity and non-contiguous chapters", () => {
    const parsed = BookBlueprintSchema.parse({
      ...blueprint,
      subjectCode: "D01-999",
      chapters: [firstChapter, { ...secondChapter, number: 3 }],
    });
    expect(validateBookBlueprintForJob(job, parsed).join("\n")).toMatch(
      /subject code|contiguous/i,
    );
  });

  it("rejects duplicate chapter ids and duplicate selected pack ids", () => {
    const parsed = BookBlueprintSchema.parse({
      ...blueprint,
      knowledgePackIds: ["railway-systems", "railway-systems"],
      chapters: [firstChapter, { ...secondChapter, id: firstChapter.id }],
    });
    expect(validateBookBlueprintForJob(job, parsed).join("\n")).toMatch(
      /duplicate/i,
    );
  });

  it("rejects a safety-critical chapter without reference sources", () => {
    const parsed = BookBlueprintSchema.parse({
      ...blueprint,
      chapters: [firstChapter, { ...secondChapter, referenceSourceIds: [] }],
    });
    expect(validateBookBlueprintForJob(job, parsed).join("\n")).toMatch(
      /safety-critical.*source/i,
    );
  });

  it("rejects required chapter packs outside the selected pack set", () => {
    const parsed = BookBlueprintSchema.parse({
      ...blueprint,
      chapters: [
        { ...firstChapter, requiredKnowledgePackIds: ["not-selected"] },
        secondChapter,
      ],
    });
    expect(validateBookBlueprintForJob(job, parsed).join("\n")).toMatch(
      /not selected/i,
    );
  });
});
