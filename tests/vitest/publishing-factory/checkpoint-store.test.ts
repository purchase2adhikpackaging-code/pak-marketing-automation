import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BookBlueprint } from "@/modules/publishing-factory/blueprint";
import type { BookJob } from "@/modules/publishing-factory/domain";
import type { ChapterManuscript } from "@/modules/publishing-factory/manuscript-domain";
import { FileCheckpointStore } from "@/modules/publishing-factory/checkpoint-store";

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

const blueprint: BookBlueprint = {
  bookId: job.bookId,
  programmeCode: job.programmeCode,
  subjectCode: job.subjectCode,
  subjectTitle: job.subjectTitle,
  level: job.level,
  purpose: "Applied calculations.",
  prerequisites: [],
  knowledgePackIds: ["mechanical-fundamentals"],
  chapters: [1, 2, 3].map((number) => ({
    id: `D01-102-CH0${number}`,
    number,
    title: `Chapter ${number}`,
    purpose: `Purpose ${number}`,
    learningOutcomes: [`Outcome ${number}`],
    requiredKnowledgePackIds: ["mechanical-fundamentals"],
    requiredVisualIds: [],
    workedExampleRequirements: [],
    practicalRequirements: [],
    assessmentRequirements: [`Assessment ${number}`],
    safetyCritical: false,
    referenceSourceIds: [],
  })),
};

function chapter(number: number, suffix = ""): ChapterManuscript {
  return {
    chapterId: `D01-102-CH0${number}`,
    number,
    title: `Chapter ${number}`,
    purpose: `Purpose ${number}`,
    learningOutcomes: [`Outcome ${number}`],
    keyTerms: [{ term: `Term ${number}`, explanation: `Explanation ${number}${suffix}` }],
    sections: [
      {
        heading: `Section ${number}`,
        paragraphs: [
          `Substantive railway engineering teaching paragraph for chapter ${number}${suffix} with enough detail to be a stable checkpoint artifact.`,
        ],
      },
    ],
    workedExamples: [],
    practicalActivities: [],
    safetyNotes: [],
    knowledgeChecks: [`Check ${number}`],
    summary: [`Summary ${number}`],
    reviewQuestions: [`Question ${number}`],
    sourceIds: ["eu-2016-797"],
  };
}

function makeStore() {
  const root = mkdtempSync(join(tmpdir(), "pak-checkpoints-"));
  return { root, store: new FileCheckpointStore(root) };
}

describe("file checkpoint store", () => {
  it("resumes after completed chapters instead of starting from chapter 1", async () => {
    const { store } = makeStore();
    await store.saveBlueprint(job, blueprint);
    await store.saveChapter(job, chapter(1));
    await store.saveChapter(job, chapter(2));
    await store.saveStage(job, "MANUSCRIPT_IN_PROGRESS");

    const resumed = await store.loadRun(job.bookId, job.edition, job.revision);
    expect(resumed?.completedChapterIds).toEqual(["D01-102-CH01", "D01-102-CH02"]);
    expect(resumed?.nextChapterNumber).toBe(3);
    expect(resumed?.stage).toBe("MANUSCRIPT_IN_PROGRESS");
  });

  it("treats an identical repeated chapter save as idempotent", async () => {
    const { store } = makeStore();
    const first = await store.saveChapter(job, chapter(1));
    const second = await store.saveChapter(job, chapter(1));
    expect(second.sha256).toBe(first.sha256);
    expect(second.created).toBe(false);
  });

  it("rejects conflicting content for a completed chapter", async () => {
    const { store } = makeStore();
    await store.saveChapter(job, chapter(1));
    await expect(store.saveChapter(job, chapter(1, " changed"))).rejects.toThrow(
      /conflict|different/i,
    );
  });

  it("fails closed when checkpoint JSON is corrupted", async () => {
    const { root, store } = makeStore();
    await store.saveChapter(job, chapter(1));
    const run = await store.loadRun(job.bookId, job.edition, job.revision);
    expect(run?.directory).toBeTruthy();
    const chapterPath = join(run!.directory, "chapters", "001-D01-102-CH01.json");
    expect(readFileSync(chapterPath, "utf8")).toContain("chapterId");
    writeFileSync(chapterPath, "{not-json", "utf8");
    await expect(store.loadRun(job.bookId, job.edition, job.revision)).rejects.toThrow(
      /corrupt|json|checkpoint/i,
    );
  });
});
