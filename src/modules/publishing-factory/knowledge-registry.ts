import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import {
  KnowledgePackRegistrySchema,
  KnowledgePackSchema,
  type KnowledgePack,
  type KnowledgePackRegistryEntry,
} from "./knowledge-domain";

export type LockedKnowledgePackRegistryEntry = Omit<
  KnowledgePackRegistryEntry,
  "sha256"
> & { sha256: string };

export interface LoadedKnowledgePack {
  entry: LockedKnowledgePackRegistryEntry;
  pack: KnowledgePack;
  sha256: string;
}

export interface LoadedKnowledgeRegistry {
  root: string;
  version: string;
  orderedPackIds: readonly string[];
  entries: readonly LockedKnowledgePackRegistryEntry[];
  packs: Readonly<Record<string, LoadedKnowledgePack>>;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
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

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested);
  }
  return Object.freeze(value);
}

function resolveInsideRoot(root: string, path: string): string {
  const absoluteRoot = resolve(root);
  const resolvedPath = resolve(absoluteRoot, path);
  const pathFromRoot = relative(absoluteRoot, resolvedPath);
  if (
    pathFromRoot === "" ||
    pathFromRoot.startsWith("..") ||
    isAbsolute(pathFromRoot)
  ) {
    throw new Error(`Knowledge pack path escapes the registry root: ${path}`);
  }
  return resolvedPath;
}

export function hashKnowledgePack(pack: KnowledgePack): string {
  const canonical = JSON.stringify(canonicalize(pack));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export async function loadKnowledgeRegistry(
  root: string,
): Promise<LoadedKnowledgeRegistry> {
  const absoluteRoot = resolve(root);
  const registryPath = resolve(
    absoluteRoot,
    "publishing/knowledge/registry.json",
  );
  const rawRegistry = JSON.parse(await readFile(registryPath, "utf8")) as unknown;
  const registry = KnowledgePackRegistrySchema.parse(rawRegistry);

  const seen = new Set<string>();
  const orderedPackIds: string[] = [];
  const entries: LockedKnowledgePackRegistryEntry[] = [];
  const packs: Record<string, LoadedKnowledgePack> = {};

  for (const entry of registry.packs) {
    if (seen.has(entry.packId)) {
      throw new Error(
        `Duplicate knowledge pack registry entry: ${entry.packId}`,
      );
    }
    seen.add(entry.packId);

    const packPath = resolveInsideRoot(absoluteRoot, entry.path);
    let rawPack: string;
    try {
      rawPack = await readFile(packPath, "utf8");
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (code === "ENOENT") {
        throw new Error(`Missing knowledge pack file: ${entry.path}`);
      }
      throw error;
    }

    const pack = KnowledgePackSchema.parse(JSON.parse(rawPack) as unknown);
    if (pack.id !== entry.packId) {
      throw new Error(
        `Knowledge pack identity mismatch: registry=${entry.packId}, pack=${pack.id}`,
      );
    }
    if (pack.revision !== entry.revision) {
      throw new Error(
        `Knowledge pack revision mismatch for ${entry.packId}: registry=${entry.revision}, pack=${pack.revision}`,
      );
    }
    if (pack.status !== entry.status) {
      throw new Error(
        `Knowledge pack status mismatch for ${entry.packId}: registry=${entry.status}, pack=${pack.status}`,
      );
    }

    const sha256 = hashKnowledgePack(pack);
    if (entry.sha256 && entry.sha256 !== sha256) {
      throw new Error(
        `Knowledge pack hash mismatch for ${entry.packId}: registry=${entry.sha256}, actual=${sha256}`,
      );
    }

    const lockedEntry = deepFreeze({ ...entry, sha256 });
    const lockedPack = deepFreeze(pack);
    const loadedPack = deepFreeze({
      entry: lockedEntry,
      pack: lockedPack,
      sha256,
    });

    orderedPackIds.push(entry.packId);
    entries.push(lockedEntry);
    packs[entry.packId] = loadedPack;
  }

  return deepFreeze({
    root: absoluteRoot,
    version: registry.version,
    orderedPackIds,
    entries,
    packs,
  });
}

export function getKnowledgePack(
  registry: LoadedKnowledgeRegistry,
  id: string,
): KnowledgePack {
  const loaded = registry.packs[id];
  if (!loaded) {
    throw new Error(`Unknown knowledge pack id: ${id}`);
  }
  return loaded.pack;
}
