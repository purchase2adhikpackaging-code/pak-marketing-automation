import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { TextGenerationProvider } from "../ai/text/provider";
import type {
  TextGenerationRequest,
  TextGenerationResult,
} from "../ai/text/types";
import { parseAcademicIndex, type ProgrammeRegistryEntry } from "./academic-index";
import { enumerateBookJobs, type CurriculumSourceFile } from "./book-jobs";
import type { BookJob } from "./domain";
import { selectKnowledgePacksForSubject } from "./knowledge-selection";
import { loadKnowledgeRegistry, type LoadedKnowledgeRegistry } from "./knowledge-registry";
import { FileCheckpointStore } from "./checkpoint-store";
import { compileBook, type CompileBookResult } from "./book-compiler";
import {
  ProductionQueue,
  resolveWorkerConcurrency,
  runWorkerPool,
} from "./worker-queue";
import type { BookBlueprint, ChapterBlueprint } from "./blueprint";

export interface ProductionCliIo {
  cwd: string;
  stdout: (message: string) => void;
  stderr: (message: string) => void;
}

type ProviderName = "fake" | "openai";

type GroundingShape = {
  selectedPacks?: Array<{ packId?: unknown }>;
  allowedSources?: Array<{ id?: unknown }>;
};

function getFlag(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requireFlag(args: readonly string[], name: string): string {
  const value = getFlag(args, name);
  if (!value?.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function readUtf8(cwd: string, path: string): string {
  return readFileSync(resolve(cwd, path), "utf8");
}

function loadProgrammeRegistry(cwd: string): ProgrammeRegistryEntry[] {
  return parseAcademicIndex(readUtf8(cwd, "docs/academic/ACADEMIC_INDEX.md"));
}

function firstModularPath(entry: ProgrammeRegistryEntry): string {
  const match = entry.modularPath.match(/`([^`]+)`/);
  if (!match?.[1]) throw new Error(`Programme ${entry.code} has no resolvable modular path.`);
  return match[1];
}

function programmeSourceFiles(cwd: string, entry: ProgrammeRegistryEntry): CurriculumSourceFile[] {
  const firstPath = firstModularPath(entry);
  if (entry.level === "certificate") {
    const path = `docs/academic/${firstPath}`;
    return [{ path, content: readUtf8(cwd, path) }];
  }

  const semesterMatch = entry.academicStructure.match(/(\d+)\s+semesters?/i);
  if (!semesterMatch?.[1]) {
    throw new Error(`Programme ${entry.code} has no semester count in academic structure.`);
  }

  const root = dirname(firstPath);
  const semesterCount = Number.parseInt(semesterMatch[1], 10);
  const sources: CurriculumSourceFile[] = [];
  for (let semester = 1; semester <= semesterCount; semester += 1) {
    const path = `docs/academic/${root}/S${semester}.md`;
    if (!existsSync(resolve(cwd, path))) {
      throw new Error(`Programme ${entry.code} source is not yet available: ${path}`);
    }
    sources.push({ path, content: readUtf8(cwd, path) });
  }
  return sources;
}

function enumerateProgramme(cwd: string, programmeCode: string): {
  programme: ProgrammeRegistryEntry;
  sources: CurriculumSourceFile[];
  jobs: BookJob[];
} {
  const programme = loadProgrammeRegistry(cwd).find((entry) => entry.code === programmeCode);
  if (!programme) throw new Error(`Unknown programme: ${programmeCode}`);
  const sources = programmeSourceFiles(cwd, programme);
  const jobs = enumerateBookJobs({
    programme,
    sourceFiles: sources,
    edition: "2026",
    revision: "0.1.0",
  });
  return { programme, sources, jobs };
}

function findSubjectJob(cwd: string, programmeCode: string, subjectCode: string): {
  job: BookJob;
  sources: CurriculumSourceFile[];
} {
  const { jobs, sources } = enumerateProgramme(cwd, programmeCode);
  const job = jobs.find((candidate) => candidate.subjectCode === subjectCode);
  if (!job) throw new Error(`Unknown subject ${subjectCode} in ${programmeCode}.`);
  return { job, sources };
}

function curriculumForJob(job: BookJob, sources: readonly CurriculumSourceFile[]): string {
  const sourceMap = new Map(sources.map((source) => [source.path, source.content]));
  return job.curriculumSourcePaths
    .map((path) => {
      const content = sourceMap.get(path);
      if (!content) throw new Error(`Curriculum source is unavailable for ${job.bookId}: ${path}`);
      return content;
    })
    .join("\n\n");
}

function parseProvider(args: readonly string[]): ProviderName {
  const value = (getFlag(args, "--provider") ?? "fake").trim().toLowerCase();
  if (value !== "fake" && value !== "openai") {
    throw new Error(`Unknown provider ${value}; expected fake or openai.`);
  }
  return value;
}

function parseExplicitConcurrency(args: readonly string[]): number {
  const value = getFlag(args, "--concurrency");
  if (value === undefined) return resolveWorkerConcurrency();
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 32) {
    throw new Error("Publishing worker concurrency must be an integer from 1 to 32.");
  }
  return parsed;
}

function stateRoot(cwd: string, args: readonly string[]): string {
  return resolve(getFlag(args, "--state-root") ?? join(cwd, "artifacts/publishing/production"));
}

function queueFor(root: string): ProductionQueue {
  return new ProductionQueue({ snapshotPath: join(root, "queue.json") });
}

function checkpointStoreFor(root: string): FileCheckpointStore {
  return new FileCheckpointStore(join(root, "checkpoints"));
}

function artifactRootFor(root: string): string {
  return join(root, "books");
}

function parseGrounding(request: TextGenerationRequest): {
  packIds: string[];
  sourceIds: string[];
} {
  let parsed: GroundingShape = {};
  if (request.knowledgeContext) {
    parsed = JSON.parse(request.knowledgeContext) as GroundingShape;
  }
  const packIds = (parsed.selectedPacks ?? [])
    .map((pack) => pack.packId)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const sourceIds = (parsed.allowedSources ?? [])
    .map((source) => source.id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  if (packIds.length === 0) throw new Error("Deterministic publishing provider received no governed knowledge packs.");
  if (sourceIds.length === 0) throw new Error("Deterministic publishing provider received no governed source IDs.");
  return { packIds, sourceIds };
}

function deterministicBlueprint(job: BookJob, packIds: readonly string[]): BookBlueprint {
  const chapter = (
    number: number,
    title: string,
    purpose: string,
    outcome: string,
  ): ChapterBlueprint => ({
    id: `${job.subjectCode}-CH${String(number).padStart(2, "0")}`,
    number,
    title,
    purpose,
    learningOutcomes: [outcome],
    requiredKnowledgePackIds: [...packIds],
    requiredVisualIds: [],
    workedExampleRequirements: ["One governed railway application example"],
    practicalRequirements: [],
    assessmentRequirements: ["Knowledge check and applied review questions"],
    safetyCritical: false,
    referenceSourceIds: [],
  });

  return {
    bookId: job.bookId,
    programmeCode: job.programmeCode,
    subjectCode: job.subjectCode,
    subjectTitle: job.subjectTitle,
    level: job.level,
    purpose: `Develop governed student competence in ${job.subjectTitle} for the ${job.programmeCode} curriculum.`,
    prerequisites: [],
    knowledgePackIds: [...packIds],
    chapters: [
      chapter(
        1,
        `Foundations of ${job.subjectTitle}`,
        `Establish the terminology, system context and engineering reasoning required for ${job.subjectTitle}.`,
        `Explain the governed foundations of ${job.subjectTitle} in railway context.`,
      ),
      chapter(
        2,
        `Applied ${job.subjectTitle}`,
        `Apply the governed concepts of ${job.subjectTitle} to controlled railway engineering examples.`,
        `Apply ${job.subjectTitle} concepts to a documented railway engineering problem.`,
      ),
    ],
  };
}

class DeterministicPublishingProvider implements TextGenerationProvider {
  readonly name = "fake";
  private readonly job: BookJob;

  constructor(job: BookJob) {
    this.job = job;
  }

  async validateConfiguration(): Promise<void> {}

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const { packIds, sourceIds } = parseGrounding(request);
    const blueprint = deterministicBlueprint(this.job, packIds);
    const chapterId = request.idempotencyKey?.split(":chapter:")[1];

    if (!chapterId) {
      return {
        text: JSON.stringify(blueprint),
        provider: this.name,
        model: "deterministic-publishing-v1",
      };
    }

    const chapter = blueprint.chapters.find((candidate) => candidate.id === chapterId);
    if (!chapter) throw new Error(`Unknown deterministic chapter request: ${chapterId}`);
    const sourceId = sourceIds[0]!;
    const subject = this.job.subjectTitle;
    const ordinal = chapter.number === 1 ? "foundation" : "application";

    return {
      text: JSON.stringify({
        chapterId: chapter.id,
        number: chapter.number,
        title: chapter.title,
        purpose: chapter.purpose,
        learningOutcomes: chapter.learningOutcomes,
        keyTerms: [
          {
            term: "governed evidence",
            explanation: `Approved curriculum, canonical knowledge and registered sources used to support ${subject} teaching content.`,
          },
        ],
        sections: [
          {
            heading: `${chapter.title} — system context`,
            paragraphs: [
              `${subject} is taught as part of an integrated railway engineering system. This ${ordinal} chapter keeps terminology, assumptions and technical claims traceable to the governed knowledge supplied for the book.`,
              `Students should distinguish educational models from controlled operational limits. Railway decisions depend on asset context, documented evidence, competent authority and the current procedures applicable to the real system.`,
            ],
          },
          {
            heading: `${chapter.title} — applied reasoning`,
            paragraphs: [
              `A reliable engineering method states the problem, identifies known information, records assumptions, applies the appropriate concept and checks the result against the intended railway context before drawing a conclusion.`,
              `The worked material in this chapter is deliberately educational. It develops disciplined reasoning without inventing maintenance tolerances, acceptance limits, operating authority or safety-critical numeric settings.`,
            ],
          },
        ],
        workedExamples: [
          {
            title: `Governed ${subject} application`,
            problem: `Use the supplied railway context to structure a traceable ${subject} engineering assessment without introducing unsupported operational limits.`,
            solutionSteps: [
              "State the engineering objective and the railway system boundary.",
              "Identify the governed knowledge and registered source supporting each technical statement.",
              "Apply the subject concept while keeping assumptions explicit.",
              "Check the conclusion against the educational scope and safety boundary.",
            ],
            conclusion: `The assessment remains traceable, educational and bounded by the governed ${subject} evidence supplied to the student.`,
          },
        ],
        practicalActivities: [],
        safetyNotes: [
          "Training material does not confer operational, inspection or maintenance authorization and does not replace current controlled railway procedures.",
        ],
        knowledgeChecks: [
          `Why must a ${subject} conclusion remain traceable to governed evidence and explicit assumptions?`,
        ],
        summary: [
          `${subject} should be learned through explicit system context, controlled terminology, traceable evidence and checked engineering reasoning.`,
        ],
        reviewQuestions: [
          `Describe a disciplined method for applying ${subject} knowledge to a railway engineering problem.`,
        ],
        sourceIds: [sourceId],
      }),
      provider: this.name,
      model: "deterministic-publishing-v1",
    };
  }
}

async function providerFor(args: readonly string[], job: BookJob): Promise<TextGenerationProvider> {
  const name = parseProvider(args);
  if (name === "fake") return new DeterministicPublishingProvider(job);

  const organizationId =
    getFlag(args, "--organization-id")?.trim() || process.env.PAK_ORGANIZATION_ID?.trim();
  if (!organizationId) {
    throw new Error(
      "OpenAI production generation requires organization context via --organization-id or PAK_ORGANIZATION_ID.",
    );
  }

  // Keep production generation on the existing integration-backed provider. The
  // dynamic import prevents CLI-only fake/status commands from touching the
  // server integration runtime or requiring any raw provider credential.
  const { createTextGenerationProvider } = await import("../ai/text/provider-factory");
  return createTextGenerationProvider({ provider: "openai", organizationId });
}

function selectedPacks(job: BookJob, registry: LoadedKnowledgeRegistry): string[] {
  return selectKnowledgePacksForSubject({
    title: job.subjectTitle,
    availablePackIds: registry.orderedPackIds,
  });
}

async function compileOne(input: {
  args: readonly string[];
  io: ProductionCliIo;
  job: BookJob;
  sources: readonly CurriculumSourceFile[];
  registry: LoadedKnowledgeRegistry;
  root: string;
}): Promise<CompileBookResult> {
  const provider = await providerFor(input.args, input.job);
  return compileBook({
    job: input.job,
    curriculumText: curriculumForJob(input.job, input.sources),
    provider,
    registry: input.registry,
    checkpointStore: checkpointStoreFor(input.root),
    artifactRoot: artifactRootFor(input.root),
  });
}

function resultJson(result: CompileBookResult): Record<string, unknown> {
  return {
    bookId: result.job.bookId,
    status: result.job.status,
    qaPassed: result.report?.passed ?? false,
    resumed: result.resumed,
    generatedChapterIds: result.generatedChapterIds,
    pdfPath: result.render?.pdfPath ?? null,
    htmlPath: result.render?.htmlPath ?? null,
    findings: result.report?.findings.map((finding) => finding.defectClass) ?? [],
  };
}

function programmeCodeFromBookId(bookId: string): string {
  const match = bookId.match(/^(PAK-(?:C|D|B|PGD|M)\d{2})-/);
  if (!match?.[1]) throw new Error(`Unable to infer programme from book id: ${bookId}`);
  return match[1];
}

export async function runProductionCli(
  args: readonly string[],
  io: ProductionCliIo,
): Promise<number> {
  const command = args[0];
  const root = stateRoot(io.cwd, args);

  try {
    if (command === "book-plan") {
      const programmeCode = requireFlag(args, "--programme");
      const subjectCode = requireFlag(args, "--subject");
      const { job } = findSubjectJob(io.cwd, programmeCode, subjectCode);
      const registry = await loadKnowledgeRegistry(io.cwd);
      io.stdout(
        JSON.stringify(
          {
            bookId: job.bookId,
            programmeCode: job.programmeCode,
            programmeTitle: job.programmeTitle,
            subjectCode: job.subjectCode,
            subjectTitle: job.subjectTitle,
            level: job.level,
            edition: job.edition,
            revision: job.revision,
            selectedKnowledgePackIds: selectedPacks(job, registry),
          },
          null,
          2,
        ),
      );
      return 0;
    }

    if (command === "book-write") {
      const programmeCode = requireFlag(args, "--programme");
      const subjectCode = requireFlag(args, "--subject");
      const { job, sources } = findSubjectJob(io.cwd, programmeCode, subjectCode);
      const registry = await loadKnowledgeRegistry(io.cwd);
      const result = await compileOne({ args, io, job, sources, registry, root });
      io.stdout(JSON.stringify(resultJson(result), null, 2));
      return result.job.status === "QA_PASSED" ? 0 : 1;
    }

    if (command === "workers") {
      const programmeCode = requireFlag(args, "--programme");
      const subjectFilter = getFlag(args, "--subject")?.trim();
      const concurrency = parseExplicitConcurrency(args);
      const { jobs, sources } = enumerateProgramme(io.cwd, programmeCode);
      const selectedJobs = subjectFilter
        ? jobs.filter((job) => job.subjectCode === subjectFilter)
        : jobs;
      if (selectedJobs.length === 0) {
        throw new Error(
          subjectFilter
            ? `Unknown subject ${subjectFilter} in ${programmeCode}.`
            : `No book jobs are available for ${programmeCode}.`,
        );
      }

      const providerName = parseProvider(args);
      if (providerName === "openai") {
        const organizationId =
          getFlag(args, "--organization-id")?.trim() || process.env.PAK_ORGANIZATION_ID?.trim();
        if (!organizationId) {
          throw new Error(
            "OpenAI production generation requires organization context via --organization-id or PAK_ORGANIZATION_ID.",
          );
        }
      }

      const registry = await loadKnowledgeRegistry(io.cwd);
      const queue = queueFor(root);
      for (const job of selectedJobs) {
        await queue.enqueue({
          bookId: job.bookId,
          edition: job.edition,
          revision: job.revision,
          payload: { programmeCode: job.programmeCode, subjectCode: job.subjectCode },
        });
      }
      const jobById = new Map(selectedJobs.map((job) => [job.bookId, job]));
      const pool = await runWorkerPool({
        queue,
        concurrency,
        worker: async (queueJob) => {
          const job = jobById.get(queueJob.bookId);
          if (!job) throw new Error(`Queued book is outside the current worker scope: ${queueJob.bookId}`);
          const result = await compileOne({ args, io, job, sources, registry, root });
          if (result.job.status !== "QA_PASSED") {
            const defects = result.report?.findings.map((finding) => finding.defectClass).join(", ");
            throw new Error(`Book ${job.bookId} did not pass QA${defects ? `: ${defects}` : "."}`);
          }
        },
      });
      io.stdout(
        JSON.stringify(
          {
            programmeCode,
            subject: subjectFilter ?? null,
            provider: providerName,
            concurrency,
            enqueued: selectedJobs.length,
            ...pool,
          },
          null,
          2,
        ),
      );
      return pool.blocked === 0 ? 0 : 1;
    }

    if (command === "resume") {
      const bookId = requireFlag(args, "--book-id");
      const programmeCode = programmeCodeFromBookId(bookId);
      const { jobs, sources } = enumerateProgramme(io.cwd, programmeCode);
      const job = jobs.find((candidate) => candidate.bookId === bookId);
      if (!job) throw new Error(`Unknown governed book id: ${bookId}`);
      const registry = await loadKnowledgeRegistry(io.cwd);
      const result = await compileOne({ args, io, job, sources, registry, root });
      io.stdout(JSON.stringify(resultJson(result), null, 2));
      return result.job.status === "QA_PASSED" ? 0 : 1;
    }

    if (command === "production-status") {
      const jobs = await queueFor(root).list();
      const count = (status: string) => jobs.filter((job) => job.status === status).length;
      io.stdout(
        JSON.stringify(
          {
            configuredConcurrency: resolveWorkerConcurrency(),
            total: jobs.length,
            queued: count("QUEUED"),
            running: count("RUNNING"),
            completed: count("COMPLETED"),
            blocked: count("BLOCKED"),
            jobs: jobs.map((job) => ({
              bookId: job.bookId,
              edition: job.edition,
              revision: job.revision,
              status: job.status,
              attemptCount: job.attemptCount,
              maxAttempts: job.maxAttempts,
              lastError: job.lastError,
            })),
          },
          null,
          2,
        ),
      );
      return 0;
    }

    io.stderr(`Unknown production publishing command: ${command ?? "<none>"}`);
    return 2;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  void runProductionCli(process.argv.slice(2), {
    cwd: process.cwd(),
    stdout: (message) => console.log(message),
    stderr: (message) => console.error(message),
  }).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
