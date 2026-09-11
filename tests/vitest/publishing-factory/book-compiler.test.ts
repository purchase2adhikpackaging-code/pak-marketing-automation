import { existsSync, readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TextGenerationProvider } from "@/modules/ai/text/provider";
import type {
  TextGenerationRequest,
  TextGenerationResult,
} from "@/modules/ai/text/types";
import type { BookBlueprint } from "@/modules/publishing-factory/blueprint";
import {
  compileBook,
  type CompileBookResult,
} from "@/modules/publishing-factory/book-compiler";
import { FileCheckpointStore } from "@/modules/publishing-factory/checkpoint-store";
import type { BookJob } from "@/modules/publishing-factory/domain";
import type { ChapterManuscript } from "@/modules/publishing-factory/manuscript-domain";
import { loadKnowledgeRegistry } from "@/modules/publishing-factory/knowledge-registry";

interface FixtureFile {
  blueprint: BookBlueprint;
  chapters: Record<string, ChapterManuscript>;
}

const fixture = JSON.parse(
  readFileSync("publishing/fixtures/manuscript-provider-book.fixture.json", "utf8"),
) as FixtureFile;

function job(): BookJob {
  return {
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
}

class FixtureBookProvider implements TextGenerationProvider {
  readonly name = "fixture-book";
  readonly requests: TextGenerationRequest[] = [];
  readonly callsByArtifact = new Map<string, number>();
  private readonly invalidChapterId: string | undefined;

  constructor(options: { invalidChapterId?: string } = {}) {
    this.invalidChapterId = options.invalidChapterId;
  }

  async validateConfiguration(): Promise<void> {}

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    this.requests.push(request);
    const artifact = request.idempotencyKey.split(":").slice(-2).join(":");
    this.callsByArtifact.set(artifact, (this.callsByArtifact.get(artifact) ?? 0) + 1);

    if (request.idempotencyKey.endsWith(":blueprint")) {
      return {
        text: JSON.stringify(fixture.blueprint),
        provider: this.name,
        model: "deterministic-book-fixture-v1",
      };
    }

    const chapterId = request.idempotencyKey.split(":").at(-1);
    if (!chapterId) throw new Error("Fixture request has no chapter id.");
    if (chapterId === this.invalidChapterId) {
      return {
        text: JSON.stringify({ ...fixture.chapters[chapterId], sourceIds: ["invented-source"] }),
        provider: this.name,
        model: "deterministic-book-fixture-v1",
      };
    }
    const chapter = fixture.chapters[chapterId];
    if (!chapter) throw new Error(`No fixture chapter for ${chapterId}`);
    return {
      text: JSON.stringify(chapter),
      provider: this.name,
      model: "deterministic-book-fixture-v1",
    };
  }
}

async function roots(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  return {
    checkpointStore: new FileCheckpointStore(join(root, "checkpoints")),
    artifactRoot: join(root, "artifacts"),
  };
}

async function compile(provider: TextGenerationProvider, overrides: Partial<{
  checkpointStore: FileCheckpointStore;
  artifactRoot: string;
}> = {}): Promise<CompileBookResult> {
  const defaults = await roots("pak-book-compiler-");
  return compileBook({
    job: job(),
    curriculumText:
      "D01-102 | Applied Engineering Mathematics & Physics for Railways | applied units, mechanics, force and motion calculations for railway engineering training.",
    provider,
    registry: await loadKnowledgeRegistry(process.cwd()),
    checkpointStore: overrides.checkpointStore ?? defaults.checkpointStore,
    artifactRoot: overrides.artifactRoot ?? defaults.artifactRoot,
  });
}

describe("end-to-end governed book compiler", () => {
  it("compiles a deterministic D01-style book through HTML, searchable PDF and QA", async () => {
    const provider = new FixtureBookProvider();
    const result = await compile(provider);

    expect(result.job.status).toBe("QA_PASSED");
    expect(result.report?.passed).toBe(true);
    expect(result.manuscript?.chapters).toHaveLength(2);
    expect(result.generatedChapterIds).toEqual(["D01-102-CH01", "D01-102-CH02"]);
    expect(result.resumedChapterIds).toEqual([]);
    expect(result.html).toContain("D01-102 — Applied Engineering Mathematics &amp; Physics for Railways");
    expect(result.render?.pdfPath).toBeTruthy();
    expect(existsSync(result.render!.pdfPath)).toBe(true);
    expect(result.report?.findings.filter((finding) => finding.severity === "error")).toHaveLength(0);
  });

  it("resumes from completed chapter checkpoints without calling the provider again for them", async () => {
    const shared = await roots("pak-book-resume-");
    const store = shared.checkpointStore;
    const baseJob = job();
    await store.saveBlueprint(baseJob, fixture.blueprint);
    await store.saveChapter(baseJob, fixture.chapters["D01-102-CH01"]!);
    await store.saveStage(baseJob, "MANUSCRIPT_IN_PROGRESS");

    const provider = new FixtureBookProvider();
    const result = await compile(provider, shared);

    expect(result.job.status).toBe("QA_PASSED");
    expect(result.resumedChapterIds).toEqual(["D01-102-CH01"]);
    expect(result.generatedChapterIds).toEqual(["D01-102-CH02"]);
    expect(provider.requests.some((request) => request.idempotencyKey.endsWith(":blueprint"))).toBe(false);
    expect(
      provider.requests.some((request) => request.idempotencyKey.endsWith(":D01-102-CH01")),
    ).toBe(false);
    expect(
      provider.requests.filter((request) => request.idempotencyKey.endsWith(":D01-102-CH02")),
    ).toHaveLength(1);
  });

  it("blocks a book after three invalid chapter generations and preserves completed checkpoints", async () => {
    const shared = await roots("pak-book-blocked-");
    const provider = new FixtureBookProvider({ invalidChapterId: "D01-102-CH02" });
    const result = await compile(provider, shared);

    expect(result.job.status).toBe("BLOCKED");
    expect(result.generatedChapterIds).toEqual(["D01-102-CH01"]);
    expect(
      provider.requests.filter((request) => request.idempotencyKey.endsWith(":D01-102-CH02")),
    ).toHaveLength(3);
    expect(result.report).toBeUndefined();

    const checkpoint = await shared.checkpointStore.loadRun(
      job().bookId,
      job().edition,
      job().revision,
    );
    expect(checkpoint?.completedChapterIds).toEqual(["D01-102-CH01"]);
    expect(checkpoint?.nextChapterNumber).toBe(2);
  });
});
