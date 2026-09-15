import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import type { BookBlueprint } from "./blueprint";
import { BookBlueprintSchema } from "./blueprint";
import type { BookJob } from "./domain";
import type { BookManuscript, ChapterManuscript } from "./manuscript-domain";
import { BookManuscriptSchema, ChapterManuscriptSchema } from "./manuscript-domain";
import type {
  BookVisualPlan,
  ResolvedBookVisualBundle,
} from "./visual-production";

export interface CheckpointSaveResult {
  path: string;
  sha256: string;
  created: boolean;
}

export interface LoadedCheckpointRun {
  directory: string;
  blueprint?: BookBlueprint;
  manuscript?: BookManuscript;
  visualPlan?: BookVisualPlan;
  visualAssets?: ResolvedBookVisualBundle;
  chapters: ChapterManuscript[];
  completedChapterIds: string[];
  nextChapterNumber: number;
  stage?: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseVisualPlan(value: unknown): BookVisualPlan {
  if (!isRecord(value) || typeof value.bookId !== "string" || !Array.isArray(value.requirements)) {
    throw new Error("Invalid visual plan checkpoint.");
  }
  for (const requirement of value.requirements) {
    if (
      !isRecord(requirement) ||
      typeof requirement.id !== "string" ||
      typeof requirement.placement !== "string" ||
      typeof requirement.subjectPrompt !== "string" ||
      typeof requirement.caption !== "string" ||
      typeof requirement.altText !== "string" ||
      typeof requirement.realistic !== "boolean" ||
      typeof requirement.labelsRequired !== "boolean"
    ) {
      throw new Error("Invalid visual plan requirement checkpoint.");
    }
  }
  return value as unknown as BookVisualPlan;
}

function parseVisualAssets(value: unknown): ResolvedBookVisualBundle {
  if (!isRecord(value) || typeof value.bookId !== "string" || !Array.isArray(value.visuals)) {
    throw new Error("Invalid visual assets checkpoint.");
  }
  for (const visual of value.visuals) {
    if (
      !isRecord(visual) ||
      typeof visual.id !== "string" ||
      typeof visual.assetId !== "string" ||
      typeof visual.mimeType !== "string" ||
      typeof visual.width !== "number" ||
      typeof visual.height !== "number" ||
      typeof visual.byteLength !== "number" ||
      typeof visual.provenance !== "string" ||
      typeof visual.dataUri !== "string" ||
      !visual.dataUri.startsWith(`data:${visual.mimeType};base64,`) ||
      /https?:\/\//i.test(visual.dataUri)
    ) {
      throw new Error("Invalid visual asset checkpoint: renderer-safe data URI is required.");
    }
  }
  return value as unknown as ResolvedBookVisualBundle;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function atomicWrite(path: string, content: string): Promise<void> {
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, path);
}

export class FileCheckpointStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private directory(bookId: string, edition: string, revision: string): string {
    const directory = resolve(this.root, bookId, edition, revision);
    const rootPrefix = `${this.root}/`;
    if (!directory.startsWith(rootPrefix)) {
      throw new Error(`Checkpoint directory escaped configured root: ${directory}`);
    }
    return directory;
  }

  private jobDirectory(job: Pick<BookJob, "bookId" | "edition" | "revision">): string {
    return this.directory(job.bookId, job.edition, job.revision);
  }

  private async saveImmutableJson(
    path: string,
    value: unknown,
    label: string,
  ): Promise<CheckpointSaveResult> {
    const content = json(value);
    const nextHash = sha256(content);
    await mkdir(resolve(path, ".."), { recursive: true });

    if (await exists(path)) {
      const current = await readFile(path, "utf8");
      const currentHash = sha256(current);
      if (currentHash === nextHash) {
        return { path, sha256: currentHash, created: false };
      }
      throw new Error(
        `Checkpoint conflict: ${label} already exists with different content at ${path}.`,
      );
    }

    await atomicWrite(path, content);
    return { path, sha256: nextHash, created: true };
  }

  async saveBlueprint(job: BookJob, blueprint: BookBlueprint): Promise<CheckpointSaveResult> {
    const parsed = BookBlueprintSchema.parse(blueprint);
    const directory = this.jobDirectory(job);
    await mkdir(directory, { recursive: true });
    return this.saveImmutableJson(join(directory, "blueprint.json"), parsed, "blueprint");
  }

  async saveChapter(job: BookJob, chapter: ChapterManuscript): Promise<CheckpointSaveResult> {
    const parsed = ChapterManuscriptSchema.parse(chapter);
    const chaptersDirectory = join(this.jobDirectory(job), "chapters");
    await mkdir(chaptersDirectory, { recursive: true });
    const filename = `${String(parsed.number).padStart(3, "0")}-${parsed.chapterId}.json`;
    return this.saveImmutableJson(
      join(chaptersDirectory, filename),
      parsed,
      `chapter ${parsed.chapterId}`,
    );
  }

  async saveManuscript(job: BookJob, manuscript: BookManuscript): Promise<CheckpointSaveResult> {
    const parsed = BookManuscriptSchema.parse(manuscript);
    const directory = this.jobDirectory(job);
    await mkdir(directory, { recursive: true });
    return this.saveImmutableJson(
      join(directory, "manuscript.json"),
      parsed,
      "compiled manuscript",
    );
  }

  async saveVisualPlan(job: BookJob, visualPlan: BookVisualPlan): Promise<CheckpointSaveResult> {
    const parsed = parseVisualPlan(visualPlan);
    if (parsed.bookId !== job.bookId) {
      throw new Error(`Visual plan book id mismatch: expected ${job.bookId}, received ${parsed.bookId}.`);
    }
    const directory = this.jobDirectory(job);
    await mkdir(directory, { recursive: true });
    return this.saveImmutableJson(
      join(directory, "visual-plan.json"),
      parsed,
      "visual plan",
    );
  }

  async saveVisualAssets(
    job: BookJob,
    visualAssets: ResolvedBookVisualBundle,
  ): Promise<CheckpointSaveResult> {
    const parsed = parseVisualAssets(visualAssets);
    if (parsed.bookId !== job.bookId) {
      throw new Error(
        `Visual assets book id mismatch: expected ${job.bookId}, received ${parsed.bookId}.`,
      );
    }
    const directory = this.jobDirectory(job);
    await mkdir(directory, { recursive: true });
    return this.saveImmutableJson(
      join(directory, "visual-assets.json"),
      parsed,
      "resolved visual assets",
    );
  }

  async saveStage(job: BookJob, stage: string): Promise<CheckpointSaveResult> {
    if (!stage.trim()) throw new Error("Checkpoint stage must not be blank.");
    const directory = this.jobDirectory(job);
    await mkdir(directory, { recursive: true });
    const path = join(directory, "stage.json");
    const content = json({ stage: stage.trim() });
    await atomicWrite(path, content);
    return { path, sha256: sha256(content), created: true };
  }

  async loadRun(
    bookId: string,
    edition: string,
    revision: string,
  ): Promise<LoadedCheckpointRun | null> {
    const directory = this.directory(bookId, edition, revision);
    if (!(await exists(directory))) return null;

    const blueprintPath = join(directory, "blueprint.json");
    const manuscriptPath = join(directory, "manuscript.json");
    const visualPlanPath = join(directory, "visual-plan.json");
    const visualAssetsPath = join(directory, "visual-assets.json");
    const stagePath = join(directory, "stage.json");
    const chaptersDirectory = join(directory, "chapters");

    try {
      const blueprint = (await exists(blueprintPath))
        ? BookBlueprintSchema.parse(JSON.parse(await readFile(blueprintPath, "utf8")))
        : undefined;
      const manuscript = (await exists(manuscriptPath))
        ? BookManuscriptSchema.parse(JSON.parse(await readFile(manuscriptPath, "utf8")))
        : undefined;
      const visualPlan = (await exists(visualPlanPath))
        ? parseVisualPlan(JSON.parse(await readFile(visualPlanPath, "utf8")))
        : undefined;
      const visualAssets = (await exists(visualAssetsPath))
        ? parseVisualAssets(JSON.parse(await readFile(visualAssetsPath, "utf8")))
        : undefined;

      const chapters: ChapterManuscript[] = [];
      if (await exists(chaptersDirectory)) {
        const files = (await readdir(chaptersDirectory))
          .filter((filename) => filename.endsWith(".json"))
          .sort();
        for (const filename of files) {
          chapters.push(
            ChapterManuscriptSchema.parse(
              JSON.parse(await readFile(join(chaptersDirectory, filename), "utf8")),
            ),
          );
        }
      }

      let stage: string | undefined;
      if (await exists(stagePath)) {
        const parsedStage = JSON.parse(await readFile(stagePath, "utf8")) as {
          stage?: unknown;
        };
        if (typeof parsedStage.stage !== "string" || !parsedStage.stage.trim()) {
          throw new Error("Invalid stage checkpoint.");
        }
        stage = parsedStage.stage;
      }

      const completed = new Set(chapters.map((chapter) => chapter.number));
      const nextChapterNumber = blueprint
        ? (blueprint.chapters.find((chapter) => !completed.has(chapter.number))?.number ??
          blueprint.chapters.length + 1)
        : (chapters.at(-1)?.number ?? 0) + 1;

      return {
        directory,
        ...(blueprint ? { blueprint } : {}),
        ...(manuscript ? { manuscript } : {}),
        ...(visualPlan ? { visualPlan } : {}),
        ...(visualAssets ? { visualAssets } : {}),
        chapters,
        completedChapterIds: chapters.map((chapter) => chapter.chapterId),
        nextChapterNumber,
        ...(stage ? { stage } : {}),
      };
    } catch (error) {
      throw new Error(
        `Corrupt checkpoint data for ${bookId}/${edition}/${revision}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
