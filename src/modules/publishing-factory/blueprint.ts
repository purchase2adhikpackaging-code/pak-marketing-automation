import { z } from "zod";
import type { BookJob } from "./domain";
import { QualificationLevelSchema } from "./domain";

export const ChapterBlueprintSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  purpose: z.string().min(1),
  learningOutcomes: z.array(z.string().min(1)).min(1),
  requiredKnowledgePackIds: z.array(z.string().min(1)),
  requiredVisualIds: z.array(z.string().min(1)),
  workedExampleRequirements: z.array(z.string().min(1)),
  practicalRequirements: z.array(z.string().min(1)),
  assessmentRequirements: z.array(z.string().min(1)).min(1),
  safetyCritical: z.boolean(),
  referenceSourceIds: z.array(z.string().min(1)),
});

export const BookBlueprintSchema = z.object({
  bookId: z.string().min(1),
  programmeCode: z.string().regex(/^PAK-(?:C|D|B|PGD|M)\d{2}$/),
  subjectCode: z.string().min(1),
  subjectTitle: z.string().min(1),
  level: QualificationLevelSchema,
  purpose: z.string().min(1),
  prerequisites: z.array(z.string().min(1)),
  knowledgePackIds: z.array(z.string().min(1)).min(1),
  chapters: z.array(ChapterBlueprintSchema).min(1),
});

export type ChapterBlueprint = z.infer<typeof ChapterBlueprintSchema>;
export type BookBlueprint = z.infer<typeof BookBlueprintSchema>;

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate];
}

export function validateBookBlueprintForJob(
  job: BookJob,
  blueprint: BookBlueprint,
): string[] {
  const findings: string[] = [];

  if (blueprint.bookId !== job.bookId) {
    findings.push(`Book id mismatch: expected ${job.bookId}, received ${blueprint.bookId}.`);
  }
  if (blueprint.programmeCode !== job.programmeCode) {
    findings.push(
      `Programme code mismatch: expected ${job.programmeCode}, received ${blueprint.programmeCode}.`,
    );
  }
  if (blueprint.subjectCode !== job.subjectCode) {
    findings.push(
      `Subject code mismatch: expected ${job.subjectCode}, received ${blueprint.subjectCode}.`,
    );
  }
  if (blueprint.subjectTitle !== job.subjectTitle) {
    findings.push(
      `Subject title mismatch: expected ${job.subjectTitle}, received ${blueprint.subjectTitle}.`,
    );
  }
  if (blueprint.level !== job.level) {
    findings.push(`Qualification level mismatch: expected ${job.level}, received ${blueprint.level}.`);
  }

  const duplicatePacks = duplicates(blueprint.knowledgePackIds);
  if (duplicatePacks.length > 0) {
    findings.push(`Duplicate selected knowledge pack ids: ${duplicatePacks.join(", ")}.`);
  }

  const chapterIds = blueprint.chapters.map((chapter) => chapter.id);
  const duplicateChapterIds = duplicates(chapterIds);
  if (duplicateChapterIds.length > 0) {
    findings.push(`Duplicate chapter ids: ${duplicateChapterIds.join(", ")}.`);
  }

  const selectedPacks = new Set(blueprint.knowledgePackIds);
  blueprint.chapters.forEach((chapter, index) => {
    const expectedNumber = index + 1;
    if (chapter.number !== expectedNumber) {
      findings.push(
        `Chapter numbers must be contiguous from 1; expected ${expectedNumber}, received ${chapter.number} for ${chapter.id}.`,
      );
    }

    for (const packId of chapter.requiredKnowledgePackIds) {
      if (!selectedPacks.has(packId)) {
        findings.push(
          `Chapter ${chapter.id} requires knowledge pack ${packId}, which is not selected for the book.`,
        );
      }
    }

    const duplicateChapterPacks = duplicates(chapter.requiredKnowledgePackIds);
    if (duplicateChapterPacks.length > 0) {
      findings.push(
        `Chapter ${chapter.id} contains duplicate knowledge pack ids: ${duplicateChapterPacks.join(", ")}.`,
      );
    }

    if (chapter.safetyCritical && chapter.referenceSourceIds.length === 0) {
      findings.push(
        `Safety-critical chapter ${chapter.id} must identify at least one reference source.`,
      );
    }
  });

  return findings;
}
