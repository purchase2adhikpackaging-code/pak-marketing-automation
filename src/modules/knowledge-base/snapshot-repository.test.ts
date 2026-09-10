import { describe, expect, it, vi } from "vitest";

import {
  KnowledgeSnapshotStore,
  SupabaseKnowledgeSnapshotPersistence,
  type KnowledgeSnapshotInput,
  type KnowledgeSnapshotPersistence,
} from "./snapshot-repository";

const orgId = "11111111-1111-4111-8111-111111111111";
const contentItemId = "22222222-2222-4222-8222-222222222222";

function snapshot(overrides: Partial<KnowledgeSnapshotInput> = {}): KnowledgeSnapshotInput {
  return {
    organizationId: orgId,
    contentItemId,
    knowledgeRecordId: "33333333-3333-4333-8333-333333333333",
    knowledgeRevision: 4,
    titleSnapshot: "Safety standard",
    contentSnapshot: "Approved railway safety procedures.",
    sourceTypeSnapshot: "DOCUMENT",
    sourceLabelSnapshot: "PAK Safety Manual",
    sourceReferenceSnapshot: "Section 4.2",
    ...overrides,
  };
}

class MemorySnapshotPersistence implements KnowledgeSnapshotPersistence {
  rows = new Map<string, KnowledgeSnapshotInput>();
  writes: KnowledgeSnapshotInput[][] = [];

  async insertIgnoringConflicts(inputs: KnowledgeSnapshotInput[]) {
    this.writes.push(inputs.map((input) => ({ ...input })));
    for (const input of inputs) {
      const key = `${input.contentItemId}:${input.knowledgeRecordId}`;
      if (!this.rows.has(key)) {
        this.rows.set(key, { ...input });
      }
    }
  }
}

describe("KnowledgeSnapshotStore", () => {
  it("does nothing for zero sources", async () => {
    const persistence = new MemorySnapshotPersistence();
    const repository = new KnowledgeSnapshotStore(persistence);

    await repository.insertMany([]);

    expect(persistence.writes).toHaveLength(0);
  });

  it("persists exact resolved snapshot values without reloading source records", async () => {
    const persistence = new MemorySnapshotPersistence();
    const repository = new KnowledgeSnapshotStore(persistence);
    const input = snapshot();

    await repository.insertMany([input]);

    expect([...persistence.rows.values()]).toEqual([input]);
  });

  it("accepts multiple snapshots independent of insertion order", async () => {
    const first = snapshot({ knowledgeRecordId: "33333333-3333-4333-8333-333333333333" });
    const second = snapshot({
      knowledgeRecordId: "44444444-4444-4444-8444-444444444444",
      knowledgeRevision: 2,
      titleSnapshot: "Workshop capabilities",
      contentSnapshot: "PAK practical workshop training.",
      sourceTypeSnapshot: "MANUAL",
      sourceLabelSnapshot: undefined,
      sourceReferenceSnapshot: undefined,
    });
    const persistence = new MemorySnapshotPersistence();
    const repository = new KnowledgeSnapshotStore(persistence);

    await repository.insertMany([second, first]);

    expect([...persistence.rows.values()]).toHaveLength(2);
    expect(persistence.rows.get(`${contentItemId}:${first.knowledgeRecordId}`)).toEqual(first);
    expect(persistence.rows.get(`${contentItemId}:${second.knowledgeRecordId}`)).toEqual(second);
  });

  it("treats duplicate retry as idempotent and never overwrites the original snapshot", async () => {
    const original = snapshot();
    const retryWithChangedText = snapshot({ contentSnapshot: "Changed source text must not overwrite history." });
    const persistence = new MemorySnapshotPersistence();
    const repository = new KnowledgeSnapshotStore(persistence);

    await repository.insertMany([original]);
    await repository.insertMany([retryWithChangedText]);

    expect(persistence.rows.get(`${contentItemId}:${original.knowledgeRecordId}`)).toEqual(original);
  });

  it("routes production persistence through the guarded Supabase RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const persistence = new SupabaseKnowledgeSnapshotPersistence({ rpc });
    const input = snapshot();

    await persistence.insertIgnoringConflicts([input]);

    expect(rpc).toHaveBeenCalledWith("persist_content_knowledge_snapshots", {
      _organization_id: orgId,
      _content_item_id: contentItemId,
      _snapshots: [
        {
          knowledge_record_id: input.knowledgeRecordId,
          knowledge_revision: input.knowledgeRevision,
          title_snapshot: input.titleSnapshot,
          content_snapshot: input.contentSnapshot,
          source_type_snapshot: input.sourceTypeSnapshot,
          source_label_snapshot: input.sourceLabelSnapshot,
          source_reference_snapshot: input.sourceReferenceSnapshot,
        },
      ],
    });
  });

  it("rejects mixed organization or content-item batches before RPC invocation", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const persistence = new SupabaseKnowledgeSnapshotPersistence({ rpc });

    await expect(
      persistence.insertIgnoringConflicts([
        snapshot(),
        snapshot({ contentItemId: "55555555-5555-4555-8555-555555555555" }),
      ]),
    ).rejects.toThrow("same organization and content item");

    expect(rpc).not.toHaveBeenCalled();
  });

  it("exposes insertion only, with no snapshot update or overwrite method", () => {
    const repository = new KnowledgeSnapshotStore(new MemorySnapshotPersistence());
    const surface = repository as unknown as Record<string, unknown>;

    expect(surface.update).toBeUndefined();
    expect(surface.overwrite).toBeUndefined();
  });
});
