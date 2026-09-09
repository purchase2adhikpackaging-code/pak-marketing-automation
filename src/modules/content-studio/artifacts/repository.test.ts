import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors/app-error";
import { ArtifactRepository, type ArtifactPatch, type ArtifactPersistence } from "./repository";
import type { ScriptArtifact } from "./types";

const now = "2026-09-09T00:00:00.000Z";

function artifact(overrides: Partial<ScriptArtifact> = {}): ScriptArtifact {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    organizationId: "22222222-2222-4222-8222-222222222222",
    contentItemId: "33333333-3333-4333-8333-333333333333",
    language: "PL",
    isSource: false,
    status: "GENERATED",
    scriptText: "Polish script",
    revision: 1,
    sourceRevision: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class MemoryPersistence implements ArtifactPersistence {
  rows: ScriptArtifact[];

  constructor(rows: ScriptArtifact[]) {
    this.rows = rows;
  }

  async list(organizationId: string, contentItemId: string) {
    return this.rows.filter((row) => row.organizationId === organizationId && row.contentItemId === contentItemId);
  }

  async insert(row: ScriptArtifact) {
    this.rows.push(row);
    return row;
  }

  async compareAndSet(
    id: string,
    organizationId: string,
    expectedRevision: number,
    allowedStatuses: ScriptArtifact["status"][],
    patch: ArtifactPatch,
  ) {
    const index = this.rows.findIndex(
      (row) => row.id === id && row.organizationId === organizationId && row.revision === expectedRevision && allowedStatuses.includes(row.status),
    );
    if (index < 0) return null;

    const current = this.rows[index];
    const { failureMetadata, ...rest } = patch;
    const updated: ScriptArtifact = {
      ...current,
      ...rest,
      ...(failureMetadata === null ? {} : failureMetadata ? { failureMetadata } : current.failureMetadata ? { failureMetadata: current.failureMetadata } : {}),
    };
    if (failureMetadata === null) delete updated.failureMetadata;

    this.rows[index] = updated;
    return updated;
  }

  async markStale(organizationId: string, contentItemId: string, newerSourceRevision: number) {
    this.rows = this.rows.map((row) =>
      row.organizationId === organizationId &&
      row.contentItemId === contentItemId &&
      !row.isSource &&
      row.status === "GENERATED" &&
      (row.sourceRevision ?? 0) < newerSourceRevision
        ? { ...row, status: "STALE" as const }
        : row,
    );
  }
}

describe("ArtifactRepository", () => {
  it("scopes reads by organization and content item", async () => {
    const own = artifact();
    const otherOrg = artifact({ id: "44444444-4444-4444-8444-444444444444", organizationId: "55555555-5555-4555-8555-555555555555" });
    const repository = new ArtifactRepository(new MemoryPersistence([own, otherOrg]));

    await expect(repository.listForContent(own.organizationId, own.contentItemId)).resolves.toEqual([own]);
  });

  it("returns an existing target instead of inserting a duplicate", async () => {
    const existing = artifact();
    const persistence = new MemoryPersistence([existing]);
    const repository = new ArtifactRepository(persistence);

    const result = await repository.ensureTarget(existing.organizationId, existing.contentItemId, "PL", "actor");

    expect(result.id).toBe(existing.id);
    expect(persistence.rows).toHaveLength(1);
  });

  it("starts generation only from the expected revision and an allowed state", async () => {
    const existing = artifact({ status: "STALE", revision: 3 });
    const repository = new ArtifactRepository(new MemoryPersistence([existing]));

    const started = await repository.startGeneration({ id: existing.id, organizationId: existing.organizationId, expectedRevision: 3 });
    expect(started.status).toBe("GENERATING");
    await expect(repository.startGeneration({ id: existing.id, organizationId: existing.organizationId, expectedRevision: 3 })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("prevents a stale completion from overwriting a newer generation", async () => {
    const existing = artifact({ status: "GENERATING", revision: 4 });
    const repository = new ArtifactRepository(new MemoryPersistence([existing]));

    await expect(
      repository.completeGeneration({
        id: existing.id,
        organizationId: existing.organizationId,
        expectedRevision: 3,
        scriptText: "stale result",
        provider: "fake",
        providerModel: "deterministic-v1",
        sourceRevision: 2,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("increments revision exactly once on successful completion", async () => {
    const existing = artifact({ status: "GENERATING", revision: 4 });
    const repository = new ArtifactRepository(new MemoryPersistence([existing]));

    const completed = await repository.completeGeneration({
      id: existing.id,
      organizationId: existing.organizationId,
      expectedRevision: 4,
      scriptText: "fresh result",
      provider: "fake",
      providerModel: "deterministic-v1",
      sourceRevision: 2,
    });

    expect(completed.revision).toBe(5);
    expect(completed.status).toBe("GENERATED");
  });

  it("marks only older generated translations stale", async () => {
    const sourceBase = artifact({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", language: "EN", isSource: true, revision: 3 });
    const { sourceRevision: _ignored, ...sourceWithoutRevision } = sourceBase;
    const source: ScriptArtifact = sourceWithoutRevision;
    const oldPl = artifact({ sourceRevision: 2 });
    const currentHi = artifact({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", language: "HI", sourceRevision: 3 });
    const persistence = new MemoryPersistence([source, oldPl, currentHi]);
    const repository = new ArtifactRepository(persistence);

    await repository.markTranslationsStale(source.organizationId, source.contentItemId, 3);

    expect(persistence.rows.find((row) => row.id === source.id)?.status).toBe("GENERATED");
    expect(persistence.rows.find((row) => row.id === oldPl.id)?.status).toBe("STALE");
    expect(persistence.rows.find((row) => row.id === currentHi.id)?.status).toBe("GENERATED");
  });
});
