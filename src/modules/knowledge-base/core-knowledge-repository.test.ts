import { describe, expect, it } from "vitest";

import {
  KnowledgeBaseRepository,
  type KnowledgePersistence,
  type KnowledgePersistencePatch,
} from "./repository";
import type { KnowledgeRecord } from "./types";

const organizationId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";

function record(overrides: Partial<KnowledgeRecord> = {}): KnowledgeRecord {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    organizationId,
    title: "PAK institutional facts",
    content: "Official institutional facts.",
    status: "ACTIVE",
    sourceType: "MANUAL",
    isCore: false,
    revision: 4,
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  };
}

class MemoryKnowledgePersistence implements KnowledgePersistence {
  constructor(readonly rows: KnowledgeRecord[]) {}

  async list(organizationId: string, mode: "selectable" | "manageable") {
    return this.rows.filter(
      (row) => row.organizationId === organizationId && (mode === "manageable" || row.status === "ACTIVE"),
    );
  }

  async getByIds(organizationId: string, ids: string[]) {
    return this.rows.filter((row) => row.organizationId === organizationId && ids.includes(row.id));
  }

  async insert(row: KnowledgeRecord) {
    this.rows.push(row);
    return row;
  }

  async compareAndSet(
    id: string,
    organizationId: string,
    expectedRevision: number,
    patch: KnowledgePersistencePatch,
  ) {
    const index = this.rows.findIndex(
      (row) => row.id === id && row.organizationId === organizationId && row.revision === expectedRevision,
    );
    if (index < 0) return null;
    const updated = { ...this.rows[index]!, ...patch };
    this.rows[index] = updated;
    return updated;
  }

  async delete(id: string, organizationId: string) {
    const index = this.rows.findIndex((row) => row.id === id && row.organizationId === organizationId);
    if (index < 0) return false;
    this.rows.splice(index, 1);
    return true;
  }
}

describe("Core Knowledge repository", () => {
  it("changes only Core state through CAS and increments revision exactly once", async () => {
    const existing = record();
    const repository = new KnowledgeBaseRepository(new MemoryKnowledgePersistence([existing]));

    const updated = await repository.setCore(
      existing.id,
      existing.organizationId,
      4,
      true,
      actorId,
    );

    expect(updated).toMatchObject({
      id: existing.id,
      organizationId,
      title: existing.title,
      content: existing.content,
      status: existing.status,
      isCore: true,
      revision: 5,
      updatedBy: actorId,
    });
  });

  it("rejects a stale Core mutation instead of overwriting a newer revision", async () => {
    const existing = record({ revision: 5 });
    const repository = new KnowledgeBaseRepository(new MemoryKnowledgePersistence([existing]));

    await expect(
      repository.setCore(existing.id, existing.organizationId, 4, true, actorId),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
