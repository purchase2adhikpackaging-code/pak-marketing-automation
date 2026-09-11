import type { TextGenerationProvider } from "../ai/text/provider";
import type { BookBlueprint, ChapterBlueprint } from "./blueprint";
import { BookBlueprintSchema, validateBookBlueprintForJob } from "./blueprint";
import type { BookJob } from "./domain";
import type { ManuscriptKnowledgeContext } from "./knowledge-context";
import type { ChapterManuscript } from "./manuscript-domain";
import {
  ChapterManuscriptSchema,
  validateChapterAgainstBlueprint,
} from "./manuscript-domain";

function parseStrictJson(text: string, artifactName: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(
      `${artifactName} provider output must be strict JSON with no prose or markdown wrapper: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function allowedSources(context: ManuscriptKnowledgeContext): Set<string> {
  return new Set(context.sourceRegister.map((source) => source.id));
}

function compactGrounding(context: ManuscriptKnowledgeContext): string {
  return JSON.stringify({
    level: context.level,
    levelProfile: context.levelProfile,
    selectedPacks: context.selectedPacks.map((pack) => ({
      packId: pack.packId,
      domain: pack.domain,
      title: pack.title,
      revision: pack.revision,
      sha256: pack.sha256,
      guidance: pack.guidance,
    })),
    terminology: context.canonicalTerminology,
    claimsByDomain: context.claimsByDomain,
    equations: context.equations,
    visualSpecs: context.visualSpecs,
    allowedSources: context.sourceRegister,
    prohibitedUnsupportedClaims: context.prohibitedUnsupportedClaims,
    safetyControls: context.safetyControls,
  });
}

function writerInstructions(
  job: BookJob,
  context: ManuscriptKnowledgeContext,
  artifact: "blueprint" | "chapter",
): string {
  return [
    "You are producing governed student-facing academic material for Polish Railway Academy (PAK).",
    `Artifact: ${artifact}.`,
    `Book identity: ${job.bookId}.`,
    `Programme: ${job.programmeCode} — ${job.programmeTitle}.`,
    `Subject: ${job.subjectCode} — ${job.subjectTitle}.`,
    `Qualification level: ${job.level}.`,
    `Safety boundary: ${context.safetyControls.levelBoundary}`,
    `Allowed source IDs only: ${context.sourceRegister.map((source) => source.id).join(", ")}.`,
    `Selected knowledge pack IDs only: ${context.selectedPacks.map((pack) => pack.packId).join(", ")}.`,
    `Prohibited unsupported claims: ${context.prohibitedUnsupportedClaims.join(" | ")}.`,
    "Never invent operational authority, maintenance acceptance limits, tolerances, settings, legal status or safety-critical numeric values that are not present in the supplied grounding context.",
    "Return exactly one valid JSON object. Do not use markdown fences. Do not add prose before or after the JSON.",
  ].join("\n");
}

function validateBlueprintAgainstContext(
  blueprint: BookBlueprint,
  context: ManuscriptKnowledgeContext,
): string[] {
  const findings: string[] = [];
  const allowedPackIds = new Set(context.selectedPacks.map((pack) => pack.packId));
  const allowedSourceIds = allowedSources(context);

  for (const packId of blueprint.knowledgePackIds) {
    if (!allowedPackIds.has(packId)) {
      findings.push(`Blueprint selected ungrounded knowledge pack ${packId}.`);
    }
  }
  for (const chapter of blueprint.chapters) {
    for (const sourceId of chapter.referenceSourceIds) {
      if (!allowedSourceIds.has(sourceId)) {
        findings.push(
          `Blueprint chapter ${chapter.id} references source ${sourceId}, which is outside the grounding context.`,
        );
      }
    }
  }
  return findings;
}

export async function generateBookBlueprint(input: {
  provider: TextGenerationProvider;
  job: BookJob;
  curriculumText: string;
  knowledgeContext: ManuscriptKnowledgeContext;
}): Promise<BookBlueprint> {
  const { provider, job, curriculumText, knowledgeContext } = input;
  await provider.validateConfiguration();
  const response = await provider.generate({
    topic: `Create the governed textbook blueprint for ${job.subjectCode} — ${job.subjectTitle}. Use the curriculum source verbatim as the academic boundary.\n\nCURRICULUM:\n${curriculumText}`,
    knowledgeContext: compactGrounding(knowledgeContext),
    language: "EN",
    systemInstructions: writerInstructions(job, knowledgeContext, "blueprint"),
    idempotencyKey: `${job.bookId}:${job.edition}:${job.revision}:blueprint`,
  });

  const parsed = BookBlueprintSchema.parse(
    parseStrictJson(response.text, "Book blueprint"),
  );
  const findings = [
    ...validateBookBlueprintForJob(job, parsed),
    ...validateBlueprintAgainstContext(parsed, knowledgeContext),
  ];
  if (findings.length > 0) {
    throw new Error(`Generated book blueprint failed governance validation:\n${findings.join("\n")}`);
  }
  return parsed;
}

export async function generateChapterManuscript(input: {
  provider: TextGenerationProvider;
  job: BookJob;
  blueprint: BookBlueprint;
  chapterBlueprint: ChapterBlueprint;
  knowledgeContext: ManuscriptKnowledgeContext;
}): Promise<ChapterManuscript> {
  const { provider, job, blueprint, chapterBlueprint, knowledgeContext } = input;
  await provider.validateConfiguration();
  const response = await provider.generate({
    topic: [
      `Write chapter ${chapterBlueprint.number}: ${chapterBlueprint.title} for ${job.subjectCode} — ${job.subjectTitle}.`,
      "Follow this chapter blueprint exactly:",
      JSON.stringify(chapterBlueprint),
      "Book purpose and prerequisites:",
      JSON.stringify({ purpose: blueprint.purpose, prerequisites: blueprint.prerequisites }),
      "Return a ChapterManuscript JSON object matching the governed schema.",
    ].join("\n\n"),
    knowledgeContext: compactGrounding(knowledgeContext),
    language: "EN",
    systemInstructions: writerInstructions(job, knowledgeContext, "chapter"),
    idempotencyKey: `${job.bookId}:${job.edition}:${job.revision}:chapter:${chapterBlueprint.id}`,
  });

  const parsed = ChapterManuscriptSchema.parse(
    parseStrictJson(response.text, `Chapter ${chapterBlueprint.id}`),
  );
  const findings = validateChapterAgainstBlueprint(
    parsed,
    chapterBlueprint,
    allowedSources(knowledgeContext),
  );
  if (findings.length > 0) {
    throw new Error(
      `Generated chapter ${chapterBlueprint.id} failed governance validation:\n${findings.join("\n")}`,
    );
  }
  return parsed;
}
