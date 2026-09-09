import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors/app-error";
import {
  KnowledgeBaseRepository,
  type KnowledgePersistence,
  type KnowledgePersistencePatch,
} from "./repository";
import type { KnowledgeRecord } from "./types";

const now = "2026-09-09T00:00:00.000Z";
const orgId = "11111111-1111-4111-8111-111111111111";

function record(overrides: Partial<KnowledgeRecord> = {}): KnowledgeRecord {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    organizationId: orgId,
    title: "Workshop safety standard",
    content: "Approved PAK workshop safety information.",
    status: "ACTIVE",
    sourceType: "MANUAL",
    revision: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class MemoryKnowledgePersistence implements KnowledgePersistence {
  rows: KnowledgeRecord[];

  constructor(rows: KnowledgeRecord[] = []) {
    this.rows = rows;
  }

  async list(organizationId: string, mode: "selectable" | "manageable") {
    return this.rows.filter(
      (row) =>
        row.organizationId === organizationId &&
        (mode === "manageable" || row.status === "ACTIVE"),
    );
  }

  async getByIds(organizationId: string, ids: string[]) {
    return ids
      .map((id) => this.rows.find((row) => row.id === id && row.organizationId === organizationId))
      .filter((row): row is KnowledgeRecord => Boolean(row));
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

    const current = this.rows[index]!;
    const updated: KnowledgeRecord = { ...current, ...patch };
    this.rows[index] = updated;
    return updated;
  }

  async delete(id: string, organizationId: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !(row.id === id && row.organizationId === organizationId));
    return this.rows.length < before;
  }
}

describe("KnowledgeBaseRepository", () => {
  it("returns only ACTIVE records for selectable reads", async () => {
    const active = record();
    const draft = record({ id: "33333333-3333-4333-8333-333333333333", status: "DRAFT" });
    const repository = new KnowledgeBaseRepository(new MemoryKnowledgePersistence([active, draft]));

    await expect(repository.listSelectable(orgId)).resolves.toEqual([active]);
  });

  it("returns all tenant records for manageable reads", async () => {
    const active = record();
    const archived = record({ id: "33333333-3333-4333-8333-333333333333", status: "ARCHIVED" });
    const otherOrg = record({
      id: "44444444-4444-4444-8444-444444444444",
      organizationId: "55555555-5555-4555-8555-555555555555",
    });
    const repository = new KnowledgeBaseRepository(new MemoryKnowledgePersistence([active, archived, otherOrg]));

    await expect(repository.listManageable(orgId)).resolves.toEqual([active, archived]);
  });

  it("scopes getByIds by organization and preserves requested order", async () => {
    const first = record({ id: "33333333-3333-4333-8333-333333333333", title: "First" });
    const second = record({ id: "44444444-4444-4444-8444-444444444444", title: "Second" });
    const otherOrg = record({
      id: "55555555-5555-4555-8555-555555555555",
      organizationId: "66666666-6666-4666-8666-666666666666",
    });
    const repository = new KnowledgeBaseRepository(new MemoryKnowledgePersistence([first, second, otherOrg]));

    await expect(repository.getByIds(orgId, [second.id, first.id, otherOrg.id])).resolves.toEqual([second, first]);
  });

  it("creates DRAFT records at revision 1", async () => {
    const persistence = new MemoryKnowledgePersistence();
    const repository = new KnowledgeBaseRepository(persistence);

    const created = await repository.create({
      organizationId: orgId,
      title: "Campus capability",
      content: "Approved capability statement.",
      sourceType: "DOCUMENT",
      sourceLabel: "PAK capability note",
      actorUserId: "77777777-7777-4777-8777-777777777777",
    });

    expect(created.status).toBe("DRAFT");
    expect(created.revision).toBe(1);
    expect(created.createdBy).toBe("77777777-7777-4777-8777-777777777777");
    expect(created.updatedBy).toBe("77777777-7777-4777-8777-777777777777");
  });

  it("increments revision exactly once on successful update", async () => {
    const existing = record({ revision: 3 });
    const repository = new KnowledgeBaseRepository(new MemoryKnowledgePersistence([existing]));

    const updated = await repository.update({
      id: existing.id,
      organizationId: existing.organizationId,
      expectedRevision: 3,
      title: "Updated workshop standard",
      content: existing.content,
      status: "ACTIVE",
      sourceType: existing.sourceType,
      actorUserId: "77777777-7777-4777-8777-777777777777",
    });

    expect(updated.revision).toBe(4);
    expect(updated.title).toBe("Updated workshop standard");
  });

  it("rejects stale updates with a CONFLICT", async () => {
    const existing = record({ revision: 4 });
    const repository = new KnowledgeBaseRepository(new MemoryKnowledgePersistence([existing]));

    await expect(
      repository.update({
        id: existing.id,
        organizationId: existing.organizationId,
        expectedRevision: 3,
        title: existing.title,
        content: existing.content,
        status: existing.status,
        sourceType: existing.sourceType,
        actorUserId: "77777777-7777-4777-8777-777777777777",
      }),
    ).rejects.toMatchObject<AppError>({ code: "CONFLICT" });
  });

  it("archives with the same compare-and-set revision rule", async () => {
    const existing = record({ revision: 2 });
    const repository = new KnowledgeBaseRepository(new MemoryKnowledgePersistence([existing]));

    const archived = await repository.archive(
      existing.id,
      existing.organizationId,
      2,
      "77777777-7777-4777-8777-777777777777",
    );

    expect(archived.status).toBe("ARCHIVED");
    expect(archived.revision).toBe(3);
  });

  it("scopes delete by both id and organization", async () => {
    const own = record();
    const otherOrg = record({
      organizationId: "55555555-5555-4555-8555-555555555555",
    });
    const persistence = new MemoryKnowledgePersistence([own, otherOrg]);
    const repository = new KnowledgeBaseRepository(persistence);

    await repository.delete(own.id, own.organizationId);

    expect(persistence.rows).toEqual([otherOrg]);
  });
});
