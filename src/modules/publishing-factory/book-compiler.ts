import { createHash } from "node:crypto";
import type { TextGenerationProvider } from "../ai/text/provider";
import type { BookBlueprint } from "./blueprint";
import type { FileCheckpointStore } from "./checkpoint-store";
import type { BookJob, QaReport } from "./domain";
import { assembleKnowledgeContext } from "./knowledge-context";
import type { LoadedKnowledgeRegistry } from "./knowledge-registry";
import { selectKnowledgePacksForSubject } from "./knowledge-selection";
import type { BookManuscript, ChapterManuscript } from "./manuscript-domain";
import {
  BookManuscriptSchema,
  validateChapterAgainstBlueprint,
} from "./manuscript-domain";
import { renderBookHtml } from "./manuscript-serializer";
import { generateBookBlueprint, generateChapterManuscript } from "./manuscript-writer";
import { runDeterministicBook } from "./orchestrator";
import { repairPolicy } from "./repair";
import type { RenderPublicationResult } from "./renderer";
import { transitionJob } from "./state-machine";

export interface CompileBookInput {
  job: BookJob;
  curriculumText: string;
  provider: TextGenerationProvider;
  registry: LoadedKnowledgeRegistry;
  checkpointStore: FileCheckpointStore;
  artifactRoot: string;
}

export interface CompileBookResult {
  job: BookJob;
  blueprint: BookBlueprint;
  manuscript?: BookManuscript;
  html?: string;
  report?: QaReport;
  render?: RenderPublicationResult;
  resumedChapterIds: string[];
  generatedChapterIds: string[];
  blockedReason?: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(object)
        .sort()
        .map((key) => [key, canonicalize(object[key])]),
    );
  }
  return value;
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)), "utf8")
    .digest("hex");
}

function expectedTitle(job: BookJob): string {
  return `${job.programmeCode} — ${job.subjectCode} ${job.subjectTitle}`;
}

function advanceToKnowledgeReady(job: BookJob): BookJob {
  let current = job;
  if (current.status === "PLANNED") current = transitionJob(current, "BLUEPRINT_READY");
  if (current.status === "ARCHITECTURE_REQUIRED") {
    current = transitionJob(current, "BLUEPRINT_READY");
  }
  if (current.status === "BLUEPRINT_READY") {
    current = transitionJob(current, "KNOWLEDGE_READY");
  }
  if (current.status !== "KNOWLEDGE_READY") {
    throw new Error(
      `Book compiler requires a pre-manuscript job state, received ${current.status}.`,
    );
  }
  return current;
}

function validateResumedChapter(
  chapter: ChapterManuscript,
  blueprint: BookBlueprint,
  allowedSourceIds: ReadonlySet<string>,
): void {
  const chapterBlueprint = blueprint.chapters.find(
    (candidate) => candidate.id === chapter.chapterId && candidate.number === chapter.number,
  );
  if (!chapterBlueprint) {
    throw new Error(
      `Checkpoint chapter ${chapter.chapterId} does not exist in the current governed blueprint.`,
    );
  }
  const findings = validateChapterAgainstBlueprint(
    chapter,
    chapterBlueprint,
    allowedSourceIds,
  );
  if (findings.length > 0) {
    throw new Error(
      `Checkpoint chapter ${chapter.chapterId} no longer validates against the governed blueprint:\n${findings.join("\n")}`,
    );
  }
}

function buildManuscript(input: {
  job: BookJob;
  blueprint: BookBlueprint;
  chapters: ChapterManuscript[];
  selectedPacks: Array<{ packId: string; sha256: string }>;
  providerName: string;
}): BookManuscript {
  return BookManuscriptSchema.parse({
    bookId: input.job.bookId,
    programmeCode: input.job.programmeCode,
    subjectCode: input.job.subjectCode,
    subjectTitle: input.job.subjectTitle,
    level: input.job.level,
    edition: input.job.edition,
    revision: input.job.revision,
    blueprintSha256: sha256(input.blueprint),
    knowledgePacks: input.selectedPacks,
    provider: {
      name: input.providerName,
      model: "provider-managed",
    },
    chapters: input.chapters,
  });
}

export async function compileBook(input: CompileBookInput): Promise<CompileBookResult> {
  const { job, curriculumText, provider, registry, checkpointStore, artifactRoot } = input;
  const loaded = await checkpointStore.loadRun(job.bookId, job.edition, job.revision);

  let blueprint = loaded?.blueprint;
  if (!blueprint) {
    const selectedPackIds = selectKnowledgePacksForSubject({
      title: job.subjectTitle,
      orientation: curriculumText,
      availablePackIds: registry.orderedPackIds,
    });
    if (selectedPackIds.length === 0) {
      throw new Error(`No governed knowledge packs selected for ${job.subjectCode}.`);
    }
    const planningContext = assembleKnowledgeContext({
      packIds: selectedPackIds,
      level: job.level,
      registry,
    });
    blueprint = await generateBookBlueprint({
      provider,
      job,
      curriculumText,
      knowledgeContext: planningContext,
    });
    await checkpointStore.saveBlueprint(job, blueprint);
    await checkpointStore.saveStage(job, "BLUEPRINT_READY");
  }

  const knowledgeContext = assembleKnowledgeContext({
    packIds: blueprint.knowledgePackIds,
    level: job.level,
    registry,
  });
  const allowedSourceIds = new Set(
    knowledgeContext.sourceRegister.map((source) => source.id),
  );

  let currentJob = advanceToKnowledgeReady(job);
  await checkpointStore.saveStage(job, "KNOWLEDGE_READY");

  const resumedChapterIds: string[] = [];
  const generatedChapterIds: string[] = [];
  const chaptersById = new Map<string, ChapterManuscript>();

  for (const chapter of loaded?.chapters ?? []) {
    validateResumedChapter(chapter, blueprint, allowedSourceIds);
    chaptersById.set(chapter.chapterId, chapter);
    resumedChapterIds.push(chapter.chapterId);
  }

  for (const chapterBlueprint of blueprint.chapters) {
    if (chaptersById.has(chapterBlueprint.id)) continue;

    let generated: ChapterManuscript | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= repairPolicy.maxAutomaticAttempts; attempt += 1) {
      try {
        generated = await generateChapterManuscript({
          provider,
          job,
          blueprint,
          chapterBlueprint,
          knowledgeContext,
        });
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!generated) {
      currentJob = transitionJob(currentJob, "BLOCKED");
      const blockedReason = `Chapter ${chapterBlueprint.id} failed after ${repairPolicy.maxAutomaticAttempts} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`;
      await checkpointStore.saveStage(job, "BLOCKED");
      return {
        job: currentJob,
        blueprint,
        resumedChapterIds,
        generatedChapterIds,
        blockedReason,
      };
    }

    await checkpointStore.saveChapter(job, generated);
    await checkpointStore.saveStage(job, "MANUSCRIPT_IN_PROGRESS");
    chaptersById.set(generated.chapterId, generated);
    generatedChapterIds.push(generated.chapterId);
  }

  const orderedChapters = blueprint.chapters.map((chapter) => {
    const manuscriptChapter = chaptersById.get(chapter.id);
    if (!manuscriptChapter) {
      throw new Error(`Missing compiled chapter checkpoint: ${chapter.id}`);
    }
    return manuscriptChapter;
  });

  const manuscript =
    loaded?.manuscript ??
    buildManuscript({
      job,
      blueprint,
      chapters: orderedChapters,
      selectedPacks: knowledgeContext.selectedPacks.map((pack) => ({
        packId: pack.packId,
        sha256: pack.sha256,
      })),
      providerName: provider.name,
    });

  if (!loaded?.manuscript) {
    await checkpointStore.saveManuscript(job, manuscript);
  }
  await checkpointStore.saveStage(job, "MANUSCRIPT_READY");

  currentJob = transitionJob(currentJob, "MANUSCRIPT_READY");
  currentJob = transitionJob(currentJob, "TYPESET_READY");
  await checkpointStore.saveStage(job, "TYPESET_READY");

  const html = renderBookHtml({ job: currentJob, manuscript });
  const deterministic = await runDeterministicBook({
    job: currentJob,
    html,
    artifactRoot,
    expectedTitle: expectedTitle(job),
    requireBookmarks: false,
  });
  await checkpointStore.saveStage(job, deterministic.job.status);

  return {
    job: deterministic.job,
    blueprint,
    manuscript,
    html,
    report: deterministic.report,
    ...(deterministic.render ? { render: deterministic.render } : {}),
    resumedChapterIds,
    generatedChapterIds,
  };
}
