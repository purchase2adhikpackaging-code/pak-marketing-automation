import type { ProgrammeRegistryEntry } from "./academic-index";
import type { BookJob, PublicationType } from "./domain";

export interface CurriculumSourceFile {
  path: string;
  content: string;
}

export interface EnumerateBookJobsInput {
  programme: ProgrammeRegistryEntry;
  sourceFiles: CurriculumSourceFile[];
  edition: string;
  revision: string;
}

export interface StableBookIdInput {
  programmeCode: string;
  academicPeriod: string;
  subjectCode: string;
  publicationType: PublicationType;
}

export function stableBookId(input: StableBookIdInput): string {
  return [
    input.programmeCode,
    input.academicPeriod,
    input.subjectCode,
    input.publicationType === "module-book" ? "MODULE-BOOK" : "TEXTBOOK",
  ].join("-");
}

function createJob(args: {
  programme: ProgrammeRegistryEntry;
  academicPeriod: string;
  subjectCode: string;
  subjectTitle: string;
  publicationType: PublicationType;
  sourcePath: string;
  edition: string;
  revision: string;
}): BookJob {
  return {
    bookId: stableBookId({
      programmeCode: args.programme.code,
      academicPeriod: args.academicPeriod,
      subjectCode: args.subjectCode,
      publicationType: args.publicationType,
    }),
    programmeCode: args.programme.code,
    programmeTitle: args.programme.programmeTitle,
    level: args.programme.level,
    academicPeriod: args.academicPeriod,
    subjectCode: args.subjectCode,
    subjectTitle: args.subjectTitle,
    publicationType: args.publicationType,
    edition: args.edition,
    revision: args.revision,
    curriculumSourcePaths: [args.sourcePath],
    status: args.programme.chapterStatus.toLowerCase() === "pending" ? "ARCHITECTURE_REQUIRED" : "PLANNED",
    repairAttempts: {},
  };
}

function enumerateSemesterProgramme(input: EnumerateBookJobsInput): BookJob[] {
  const familyPrefix = input.programme.code.replace(/^PAK-/, "");
  const subjectRow = new RegExp(`^\\|\\s*(${familyPrefix}-\\d{3})\\s*\\|\\s*([^|]+?)\\s*\\|`);
  const jobs: BookJob[] = [];

  for (const source of input.sourceFiles) {
    const semesterMatch = source.path.match(/\/S(\d+)\.md$/i);
    if (!semesterMatch?.[1]) continue;
    const academicPeriod = `S${semesterMatch[1]}`;

    for (const line of source.content.split(/\r?\n/)) {
      const match = line.match(subjectRow);
      if (!match?.[1] || !match[2]) continue;

      jobs.push(
        createJob({
          programme: input.programme,
          academicPeriod,
          subjectCode: match[1].trim(),
          subjectTitle: match[2].trim(),
          publicationType: "textbook",
          sourcePath: source.path,
          edition: input.edition,
          revision: input.revision,
        }),
      );
    }
  }

  return jobs;
}

function enumerateCertificateProgramme(input: EnumerateBookJobsInput): BookJob[] {
  const familyPrefix = input.programme.code.replace(/^PAK-/, "");
  const moduleRow = new RegExp(`^\\|\\s*(\\d+)\\s*\\|\\s*(${familyPrefix}-\\d{3})\\s*\\|\\s*([^|]+?)\\s*\\|`);
  const jobs: BookJob[] = [];

  for (const source of input.sourceFiles) {
    for (const line of source.content.split(/\r?\n/)) {
      const match = line.match(moduleRow);
      if (!match?.[1] || !match[2] || !match[3]) continue;

      jobs.push(
        createJob({
          programme: input.programme,
          academicPeriod: `W${match[1]}`,
          subjectCode: match[2].trim(),
          subjectTitle: match[3].trim(),
          publicationType: "module-book",
          sourcePath: source.path,
          edition: input.edition,
          revision: input.revision,
        }),
      );
    }
  }

  return jobs;
}

export function assertUniqueBookJobs(jobs: readonly BookJob[]): void {
  const seen = new Set<string>();
  for (const job of jobs) {
    if (seen.has(job.bookId)) {
      throw new Error(`Duplicate book ID detected: ${job.bookId}`);
    }
    seen.add(job.bookId);
  }
}

export function enumerateBookJobs(input: EnumerateBookJobsInput): BookJob[] {
  const jobs =
    input.programme.level === "certificate"
      ? enumerateCertificateProgramme(input)
      : enumerateSemesterProgramme(input);

  assertUniqueBookJobs(jobs);
  return jobs;
}
