import type { ProgrammeRegistryEntry } from "@/modules/publishing-factory/academic-index";
import {
  enumerateBookJobs,
  type CurriculumSourceFile,
} from "@/modules/publishing-factory/book-jobs";
import type { BookJob } from "@/modules/publishing-factory/domain";
import { ProductionScopeSchema, type ProductionScope } from "./domain";

export type ProductionPlanExclusionReason =
  | "ARCHITECTURE_REQUIRED"
  | "ALREADY_RELEASED"
  | "SUBJECT_NOT_FOUND";

export interface ProductionPlanExclusion {
  programmeCode: string;
  subjectCode?: string;
  reason: ProductionPlanExclusionReason;
}

export interface ProductionRunPlan {
  jobs: BookJob[];
  exclusions: ProductionPlanExclusion[];
}

export type CurriculumLoader = (
  programme: ProgrammeRegistryEntry,
) => Promise<CurriculumSourceFile[]>;

function releaseIdentity(job: BookJob): string {
  return `${job.bookId}:${job.edition}:${job.revision}`;
}

function architectureReady(programme: ProgrammeRegistryEntry): boolean {
  const status = programme.curriculumStatus.trim().toLowerCase();
  return status.includes("architecture complete") && !status.includes("catalogue only");
}

function programmeFor(
  registry: readonly ProgrammeRegistryEntry[],
  programmeCode: string,
): ProgrammeRegistryEntry {
  const programme = registry.find((candidate) => candidate.code === programmeCode);
  if (!programme) throw new Error(`Unknown programme: ${programmeCode}`);
  return programme;
}

async function enumerateProgrammeJobs(
  programme: ProgrammeRegistryEntry,
  curriculumLoader: CurriculumLoader,
): Promise<BookJob[]> {
  if (!architectureReady(programme)) return [];
  const sourceFiles = await curriculumLoader(programme);
  if (sourceFiles.length === 0) return [];
  return enumerateBookJobs({
    programme,
    sourceFiles,
    edition: "2026",
    revision: "0.1.0",
  });
}

export async function planProductionRun(input: {
  scope: ProductionScope;
  registry: readonly ProgrammeRegistryEntry[];
  curriculumLoader: CurriculumLoader;
  releasedIdentities: ReadonlySet<string>;
}): Promise<ProductionRunPlan> {
  const scope = ProductionScopeSchema.parse(input.scope);
  const exclusions: ProductionPlanExclusion[] = [];
  const planned: BookJob[] = [];

  const selectedProgrammes: ProgrammeRegistryEntry[] =
    scope.type === "PORTFOLIO"
      ? [...input.registry]
      : [programmeFor(input.registry, scope.programmeCode)];

  for (const programme of selectedProgrammes) {
    if (!architectureReady(programme)) {
      exclusions.push({
        programmeCode: programme.code,
        reason: "ARCHITECTURE_REQUIRED",
      });
      continue;
    }

    const jobs = await enumerateProgrammeJobs(programme, input.curriculumLoader);
    if (jobs.length === 0) {
      exclusions.push({
        programmeCode: programme.code,
        reason: "ARCHITECTURE_REQUIRED",
      });
      continue;
    }

    let scopedJobs = jobs;
    if (scope.type === "SUBJECT") {
      scopedJobs = jobs.filter((job) => job.subjectCode === scope.subjectCode);
      if (scopedJobs.length === 0) {
        exclusions.push({
          programmeCode: programme.code,
          subjectCode: scope.subjectCode,
          reason: "SUBJECT_NOT_FOUND",
        });
      }
    } else if (scope.type === "PILOT") {
      scopedJobs = jobs.slice(0, scope.limit);
    }

    for (const job of scopedJobs) {
      if (input.releasedIdentities.has(releaseIdentity(job))) {
        exclusions.push({
          programmeCode: job.programmeCode,
          subjectCode: job.subjectCode,
          reason: "ALREADY_RELEASED",
        });
        continue;
      }
      planned.push(job);
    }
  }

  return { jobs: planned, exclusions };
}
