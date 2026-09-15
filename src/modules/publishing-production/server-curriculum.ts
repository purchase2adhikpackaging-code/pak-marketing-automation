import "server-only";

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseAcademicIndex, type ProgrammeRegistryEntry } from "@/modules/publishing-factory/academic-index";
import type { CurriculumSourceFile } from "@/modules/publishing-factory/book-jobs";
import type { BookJob } from "@/modules/publishing-factory/domain";

const ACADEMIC_ROOT = join(process.cwd(), "docs/academic");

function programmeDirectory(programme: ProgrammeRegistryEntry): string {
  const suffix = programme.code.replace(/^PAK-/, "");
  switch (programme.level) {
    case "certificate":
      return join(ACADEMIC_ROOT, "certificates", suffix);
    case "diploma":
      return join(ACADEMIC_ROOT, "diplomas", suffix);
    case "bachelors":
      return join(ACADEMIC_ROOT, "bachelors", suffix);
    case "postgraduate-diploma":
      return join(ACADEMIC_ROOT, "postgraduate-diplomas", suffix);
    case "masters":
      return join(ACADEMIC_ROOT, "masters", suffix);
  }
}

function relativeRepoPath(path: string): string {
  return relative(process.cwd(), path).split("\\").join("/");
}

export async function loadAcademicRegistryFromDisk(): Promise<ProgrammeRegistryEntry[]> {
  return parseAcademicIndex(await readFile(join(ACADEMIC_ROOT, "ACADEMIC_INDEX.md"), "utf8"));
}

export async function loadProgrammeCurriculumFromDisk(
  programme: ProgrammeRegistryEntry,
): Promise<CurriculumSourceFile[]> {
  const directory = programmeDirectory(programme);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const fileNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .filter((name) => programme.level === "certificate" || /^S\d+\.md$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return Promise.all(
    fileNames.map(async (name) => {
      const path = join(directory, name);
      return { path: relativeRepoPath(path), content: await readFile(path, "utf8") };
    }),
  );
}

export function curriculumTextForJob(job: BookJob, sourceFiles: readonly CurriculumSourceFile[]): string {
  const expected = new Set(job.curriculumSourcePaths);
  const selected = sourceFiles.filter((source) => expected.has(source.path));
  if (selected.length === 0) {
    throw new Error(`No governed curriculum source text found for ${job.bookId}.`);
  }
  return selected.map((source) => `SOURCE: ${source.path}\n${source.content}`).join("\n\n");
}
