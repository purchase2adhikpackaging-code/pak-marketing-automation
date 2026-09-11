import { z } from "zod";
import type { ChapterBlueprint } from "./blueprint";
import { QualificationLevelSchema } from "./domain";
import { normalizeParagraph } from "./content-qa";

const NonBlankString = z.string().trim().min(1);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);

export const ChapterManuscriptSchema = z.object({
  chapterId: NonBlankString,
  number: z.number().int().positive(),
  title: NonBlankString,
  purpose: NonBlankString,
  learningOutcomes: z.array(NonBlankString).min(1),
  keyTerms: z
    .array(
      z.object({
        term: NonBlankString,
        explanation: NonBlankString,
      }),
    )
    .min(1),
  sections: z
    .array(
      z.object({
        heading: NonBlankString,
        paragraphs: z.array(NonBlankString).min(1),
      }),
    )
    .min(1),
  workedExamples: z.array(
    z.object({
      title: NonBlankString,
      problem: NonBlankString,
      solutionSteps: z.array(NonBlankString).min(1),
      conclusion: NonBlankString,
    }),
  ),
  practicalActivities: z.array(
    z.object({
      title: NonBlankString,
      objective: NonBlankString,
      safety: z.array(NonBlankString),
      tasks: z.array(NonBlankString).min(1),
      records: z.array(NonBlankString).min(1),
    }),
  ),
  safetyNotes: z.array(NonBlankString),
  knowledgeChecks: z.array(NonBlankString).min(1),
  summary: z.array(NonBlankString).min(1),
  reviewQuestions: z.array(NonBlankString).min(1),
  sourceIds: z.array(NonBlankString).min(1),
});

export type ChapterManuscript = z.infer<typeof ChapterManuscriptSchema>;

export const BookManuscriptSchema = z.object({
  bookId: NonBlankString,
  programmeCode: z.string().regex(/^PAK-(?:C|D|B|PGD|M)\d{2}$/),
  subjectCode: NonBlankString,
  subjectTitle: NonBlankString,
  level: QualificationLevelSchema,
  edition: NonBlankString,
  revision: NonBlankString,
  blueprintSha256: Sha256Schema,
  knowledgePacks: z
    .array(
      z.object({
        packId: NonBlankString,
        sha256: Sha256Schema,
      }),
    )
    .min(1),
  provider: z.object({
    name: NonBlankString,
    model: NonBlankString,
  }),
  chapters: z.array(ChapterManuscriptSchema).min(1),
});

export type BookManuscript = z.infer<typeof BookManuscriptSchema>;

const PLACEHOLDER_PATTERNS = [
  /^\s*TODO\s*$/i,
  /^\s*TBD\s*$/i,
  /\blorem\s+ipsum\b/i,
  /\bplaceholder\b/i,
  /\binsert\s+(?:text|image|content)\b/i,
];

function normalizedDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    const normalized = normalizeParagraph(value);
    if (!normalized) continue;
    if (seen.has(normalized)) duplicates.add(normalized);
    seen.add(normalized);
  }
  return [...duplicates];
}

function allText(chapter: ChapterManuscript): string[] {
  return [
    chapter.title,
    chapter.purpose,
    ...chapter.learningOutcomes,
    ...chapter.keyTerms.flatMap((term) => [term.term, term.explanation]),
    ...chapter.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    ...chapter.workedExamples.flatMap((example) => [
      example.title,
      example.problem,
      ...example.solutionSteps,
      example.conclusion,
    ]),
    ...chapter.practicalActivities.flatMap((activity) => [
      activity.title,
      activity.objective,
      ...activity.safety,
      ...activity.tasks,
      ...activity.records,
    ]),
    ...chapter.safetyNotes,
    ...chapter.knowledgeChecks,
    ...chapter.summary,
    ...chapter.reviewQuestions,
  ];
}

export function validateChapterAgainstBlueprint(
  chapter: ChapterManuscript,
  blueprint: ChapterBlueprint,
  allowedSourceIds: ReadonlySet<string>,
): string[] {
  const findings: string[] = [];

  if (chapter.chapterId !== blueprint.id) {
    findings.push(`Chapter id mismatch: expected ${blueprint.id}, received ${chapter.chapterId}.`);
  }
  if (chapter.number !== blueprint.number) {
    findings.push(
      `Chapter number mismatch: expected ${blueprint.number}, received ${chapter.number}.`,
    );
  }
  if (chapter.title !== blueprint.title) {
    findings.push(`Chapter title mismatch: expected ${blueprint.title}, received ${chapter.title}.`);
  }

  const actualOutcomes = chapter.learningOutcomes.map(normalizeParagraph);
  for (const expectedOutcome of blueprint.learningOutcomes) {
    if (!actualOutcomes.includes(normalizeParagraph(expectedOutcome))) {
      findings.push(`Required learning outcome is missing: ${expectedOutcome}`);
    }
  }

  const duplicateHeadings = normalizedDuplicates(
    chapter.sections.map((section) => section.heading),
  );
  if (duplicateHeadings.length > 0) {
    findings.push("Duplicate section heading detected in chapter manuscript.");
  }

  const substantiveParagraphs = chapter.sections
    .flatMap((section) => section.paragraphs)
    .filter((paragraph) => normalizeParagraph(paragraph).length >= 40);
  if (normalizedDuplicates(substantiveParagraphs).length > 0) {
    findings.push("Duplicate paragraph detected in chapter manuscript.");
  }

  if (allText(chapter).some((value) => PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value)))) {
    findings.push("Production placeholder or filler text detected in chapter manuscript.");
  }

  for (const sourceId of chapter.sourceIds) {
    if (!allowedSourceIds.has(sourceId)) {
      findings.push(
        `Source id ${sourceId} is not present in the grounding context supplied to the writer.`,
      );
    }
  }

  if (blueprint.safetyCritical && chapter.safetyNotes.length === 0) {
    findings.push("Safety-critical chapter must include at least one explicit safety note.");
  }

  if (
    blueprint.workedExampleRequirements.length > 0 &&
    chapter.workedExamples.length === 0
  ) {
    findings.push("Chapter blueprint requires at least one worked example.");
  }

  if (
    blueprint.practicalRequirements.length > 0 &&
    chapter.practicalActivities.length === 0
  ) {
    findings.push("Chapter blueprint requires at least one practical activity.");
  }

  return findings;
}
