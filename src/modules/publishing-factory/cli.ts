import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseAcademicIndex, type ProgrammeRegistryEntry } from "./academic-index";
import { enumerateBookJobs, type CurriculumSourceFile } from "./book-jobs";
import { QualificationLevelSchema, type BookJob } from "./domain";
import { runDeterministicBook } from "./orchestrator";
import { KnowledgeSourceSchema } from "./knowledge-domain";
import { validateKnowledgePack, validateSourceRegistry } from "./knowledge-validation";
import { getKnowledgePack, loadKnowledgeRegistry } from "./knowledge-registry";
import { assembleKnowledgeContext } from "./knowledge-context";

export interface PublishingCliIo {
  cwd: string;
  stdout: (message: string) => void;
  stderr: (message: string) => void;
}

function readUtf8(cwd: string, relativePath: string): string {
  return readFileSync(resolve(cwd, relativePath), "utf8");
}

function loadRegistry(cwd: string): ProgrammeRegistryEntry[] {
  return parseAcademicIndex(readUtf8(cwd, "docs/academic/ACADEMIC_INDEX.md"));
}

function loadKnowledgeSources(cwd: string) {
  const raw = JSON.parse(
    readUtf8(cwd, "publishing/knowledge/sources/eu-era-core.json"),
  ) as unknown;
  return KnowledgeSourceSchema.array().parse(raw);
}

function registrySummary(entries: readonly ProgrammeRegistryEntry[]) {
  return {
    total: entries.length,
    certificate: entries.filter((entry) => entry.level === "certificate").length,
    diploma: entries.filter((entry) => entry.level === "diploma").length,
    bachelors: entries.filter((entry) => entry.level === "bachelors").length,
    postgraduateDiploma: entries.filter((entry) => entry.level === "postgraduate-diploma").length,
    masters: entries.filter((entry) => entry.level === "masters").length,
  };
}

function firstModularPath(entry: ProgrammeRegistryEntry): string {
  const match = entry.modularPath.match(/`([^`]+)`/);
  if (!match?.[1]) {
    throw new Error(`Programme ${entry.code} has no resolvable modular path.`);
  }
  return match[1];
}

function programmeSourceFiles(cwd: string, entry: ProgrammeRegistryEntry): CurriculumSourceFile[] {
  const firstPath = firstModularPath(entry);
  if (entry.level === "certificate") {
    const relativePath = `docs/academic/${firstPath}`;
    return [{ path: relativePath, content: readUtf8(cwd, relativePath) }];
  }

  const semesterMatch = entry.academicStructure.match(/(\d+)\s+semesters?/i);
  if (!semesterMatch?.[1]) {
    throw new Error(`Programme ${entry.code} has no semester count in academic structure.`);
  }

  const semesterCount = Number.parseInt(semesterMatch[1], 10);
  const root = dirname(firstPath);
  const sources: CurriculumSourceFile[] = [];
  for (let semester = 1; semester <= semesterCount; semester += 1) {
    const relativePath = `docs/academic/${root}/S${semester}.md`;
    const absolutePath = resolve(cwd, relativePath);
    if (!existsSync(absolutePath)) {
      throw new Error(`Programme ${entry.code} source is not yet available: ${relativePath}`);
    }
    sources.push({ path: relativePath, content: readFileSync(absolutePath, "utf8") });
  }
  return sources;
}

function getFlag(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function fixtureJob(): BookJob {
  return {
    bookId: "PAK-D01-S1-D01-101-TEXTBOOK",
    programmeCode: "PAK-D01",
    programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
    level: "diploma",
    academicPeriod: "S1",
    subjectCode: "D01-101",
    subjectTitle: "Railway Fundamentals",
    publicationType: "textbook",
    edition: "2026",
    revision: "0.1.0",
    curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
    status: "TYPESET_READY",
    repairAttempts: {},
  };
}

export async function runCli(args: readonly string[], io: PublishingCliIo): Promise<number> {
  const command = args[0];

  try {
    if (command === "registry") {
      io.stdout(JSON.stringify(registrySummary(loadRegistry(io.cwd)), null, 2));
      return 0;
    }

    if (command === "enumerate") {
      const programmeCode = getFlag(args, "--programme");
      if (!programmeCode) {
        io.stderr("enumerate requires --programme PAK-XXX");
        return 2;
      }
      const programme = loadRegistry(io.cwd).find((entry) => entry.code === programmeCode);
      if (!programme) {
        io.stderr(`Unknown programme: ${programmeCode}`);
        return 2;
      }
      const jobs = enumerateBookJobs({
        programme,
        sourceFiles: programmeSourceFiles(io.cwd, programme),
        edition: "2026",
        revision: "0.1.0",
      });
      io.stdout(
        JSON.stringify(
          {
            programmeCode,
            count: jobs.length,
            bookIds: jobs.map((job) => job.bookId),
          },
          null,
          2,
        ),
      );
      return 0;
    }

    if (command === "knowledge-validate") {
      const sources = loadKnowledgeSources(io.cwd);
      const registry = await loadKnowledgeRegistry(io.cwd);
      const findings = [...validateSourceRegistry(sources)];
      for (const packId of registry.orderedPackIds) {
        findings.push(...validateKnowledgePack(getKnowledgePack(registry, packId), sources));
      }
      io.stdout(
        JSON.stringify(
          {
            valid: findings.length === 0,
            packCount: registry.orderedPackIds.length,
            sourceCount: sources.length,
            findings,
          },
          null,
          2,
        ),
      );
      return findings.length === 0 ? 0 : 1;
    }

    if (command === "knowledge-list") {
      const registry = await loadKnowledgeRegistry(io.cwd);
      io.stdout(
        JSON.stringify(
          {
            version: registry.version,
            count: registry.orderedPackIds.length,
            packs: registry.orderedPackIds.map((packId) => {
              const loaded = registry.packs[packId];
              if (!loaded) throw new Error(`Unknown knowledge pack id: ${packId}`);
              return {
                packId,
                title: loaded.pack.title,
                domain: loaded.pack.domain,
                revision: loaded.pack.revision,
                status: loaded.pack.status,
                sha256: loaded.sha256,
              };
            }),
          },
          null,
          2,
        ),
      );
      return 0;
    }

    if (command === "knowledge-context") {
      const rawLevel = getFlag(args, "--level");
      const rawPacks = getFlag(args, "--packs");
      if (!rawLevel || !rawPacks) {
        io.stderr("knowledge-context requires --level <level> --packs <pack-a,pack-b>");
        return 2;
      }
      const parsedLevel = QualificationLevelSchema.safeParse(rawLevel);
      if (!parsedLevel.success) {
        io.stderr(`Unknown qualification level: ${rawLevel}`);
        return 2;
      }
      const packIds = rawPacks
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (packIds.length === 0) {
        io.stderr("knowledge-context requires at least one knowledge pack id");
        return 2;
      }
      const registry = await loadKnowledgeRegistry(io.cwd);
      const context = assembleKnowledgeContext({
        packIds,
        level: parsedLevel.data,
        registry,
      });
      io.stdout(JSON.stringify(context, null, 2));
      return 0;
    }

    if (command === "qa-fixture") {
      const fixture = getFlag(args, "--fixture") ?? "good";
      if (fixture !== "good" && fixture !== "overflow") {
        io.stderr(`Unknown QA fixture: ${fixture}`);
        return 2;
      }
      const fixturePath = `publishing/fixtures/manuscript-${fixture}.fixture.html`;
      const html = readUtf8(io.cwd, fixturePath);
      const result = await runDeterministicBook({
        job: fixtureJob(),
        html,
        artifactRoot: resolve(io.cwd, "artifacts/publishing/fixtures"),
        expectedTitle: "PAK-D01 — D01-101 Railway Fundamentals",
        requireBookmarks: false,
      });
      io.stdout(
        JSON.stringify(
          {
            fixture,
            status: result.job.status,
            passed: result.report.passed,
            findings: result.report.findings.map((finding) => finding.defectClass),
            pdfPath: result.render?.pdfPath ?? null,
          },
          null,
          2,
        ),
      );
      return result.report.passed ? 0 : 1;
    }

    io.stderr(`Unknown publishing command: ${command ?? "<none>"}`);
    return 2;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  void runCli(process.argv.slice(2), {
    cwd: process.cwd(),
    stdout: (message) => console.log(message),
    stderr: (message) => console.error(message),
  }).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
