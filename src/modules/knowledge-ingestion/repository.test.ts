import { describe, expect, it, vi } from "vitest";

import { MAX_SOURCE_BYTES } from "./extractors";
import {
  KnowledgeIngestionRepository,
  type KnowledgeIngestionPersistence,
} from "./repository";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG_ID = "22222222-2222-4222-8222-222222222222";
const ASSET_ID = "33333333-3333-4333-8333-333333333333";

function persistence(
  overrides: Partial<KnowledgeIngestionPersistence> = {},
): KnowledgeIngestionPersistence {
  return {
    findMediaDocument: vi.fn().mockResolvedValue({
      id: ASSET_ID,
      organizationId: ORG_ID,
      assetType: "DOCUMENT",
      status: "ACTIVE",
      mimeType: "application/pdf",
      displayName: "PAK Safety Manual.pdf",
      sizeBytes: 1024,
      storageBucket: "media-private",
      storagePath: `${ORG_ID}/document.pdf`,
    }),
    downloadMediaDocument: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    insertDocument: vi.fn(),
    compareAndSetDocument: vi.fn(),
    finalizeExtraction: vi.fn(),
    ...overrides,
  };
}

describe("KnowledgeIngestionRepository", () => {
  it("loads only a same-org ACTIVE DOCUMENT and never returns storage coordinates", async () => {
    const store = persistence();
    const repository = new KnowledgeIngestionRepository(store);

    const source = await repository.loadFileSource(ORG_ID, ASSET_ID);

    expect(store.findMediaDocument).toHaveBeenCalledWith(ORG_ID, ASSET_ID);
    expect(source).toMatchObject({
      id: ASSET_ID,
      organizationId: ORG_ID,
      mimeType: "application/pdf",
      displayName: "PAK Safety Manual.pdf",
      sizeBytes: 1024,
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(source).not.toHaveProperty("storageBucket");
    expect(source).not.toHaveProperty("storagePath");
  });

  it("rejects cross-org/non-document/inactive assets and oversized files before download", async () => {
    for (const invalid of [
      { organizationId: OTHER_ORG_ID, assetType: "DOCUMENT", status: "ACTIVE", sizeBytes: 10 },
      { organizationId: ORG_ID, assetType: "IMAGE", status: "ACTIVE", sizeBytes: 10 },
      { organizationId: ORG_ID, assetType: "DOCUMENT", status: "ARCHIVED", sizeBytes: 10 },
    ]) {
      const store = persistence({
        findMediaDocument: vi.fn().mockResolvedValue({
          id: ASSET_ID,
          mimeType: "application/pdf",
          displayName: "Invalid",
          storageBucket: "private",
          storagePath: "hidden/path",
          ...invalid,
        }),
      });
      const repository = new KnowledgeIngestionRepository(store);
      await expect(repository.loadFileSource(ORG_ID, ASSET_ID)).rejects.toThrow(/unavailable/i);
      expect(store.downloadMediaDocument).not.toHaveBeenCalled();
    }

    const oversizedStore = persistence({
      findMediaDocument: vi.fn().mockResolvedValue({
        id: ASSET_ID,
        organizationId: ORG_ID,
        assetType: "DOCUMENT",
        status: "ACTIVE",
        mimeType: "application/pdf",
        displayName: "Huge.pdf",
        sizeBytes: MAX_SOURCE_BYTES + 1,
        storageBucket: "private",
        storagePath: "hidden/path",
      }),
    });
    const repository = new KnowledgeIngestionRepository(oversizedStore);
    await expect(repository.loadFileSource(ORG_ID, ASSET_ID)).rejects.toThrow(/too large/i);
    expect(oversizedStore.downloadMediaDocument).not.toHaveBeenCalled();
  });

  it("persists PENDING then PROCESSING revisions and delegates atomic DRAFT finalization", async () => {
    const pending = {
      id: "44444444-4444-4444-8444-444444444444",
      organizationId: ORG_ID,
      sourceType: "FILE" as const,
      format: "PDF" as const,
      mediaAssetId: ASSET_ID,
      extractionStatus: "PENDING" as const,
      extractionMetadata: {},
      revision: 1,
      createdAt: "2026-09-13T00:00:00.000Z",
      updatedAt: "2026-09-13T00:00:00.000Z",
    };
    const processing = { ...pending, extractionStatus: "PROCESSING" as const, revision: 2 };
    const draftRecord = {
      id: "55555555-5555-4555-8555-555555555555",
      organizationId: ORG_ID,
      title: "PAK Safety Manual",
      content: "Safe railway operations",
      status: "DRAFT" as const,
      sourceType: "DOCUMENT" as const,
      revision: 1,
      createdAt: "2026-09-13T00:00:00.000Z",
      updatedAt: "2026-09-13T00:00:00.000Z",
    };
    const store = persistence({
      insertDocument: vi.fn().mockResolvedValue(pending),
      compareAndSetDocument: vi.fn().mockResolvedValue(processing),
      finalizeExtraction: vi.fn().mockResolvedValue({
        document: { ...processing, extractionStatus: "EXTRACTED", revision: 3 },
        record: draftRecord,
      }),
    });
    const repository = new KnowledgeIngestionRepository(store);

    const created = await repository.createFileDocument({
      organizationId: ORG_ID,
      mediaAssetId: ASSET_ID,
      format: "PDF",
      sourceLabel: "PAK Safety Manual",
      actorUserId: "66666666-6666-4666-8666-666666666666",
    });
    const started = await repository.markProcessing(created.id, ORG_ID, created.revision);
    const finalized = await repository.finalize({
      documentId: started.id,
      organizationId: ORG_ID,
      expectedRevision: started.revision,
      title: "PAK Safety Manual",
      content: "Safe railway operations",
      sourceType: "DOCUMENT",
      sourceReference: `media:${ASSET_ID}`,
      sourceFingerprint: "a".repeat(64),
      extractionMetadata: { format: "PDF" },
    });

    expect(store.insertDocument).toHaveBeenCalledWith(expect.objectContaining({
      extractionStatus: "PENDING",
      revision: 1,
    }));
    expect(store.compareAndSetDocument).toHaveBeenCalledWith(
      created.id,
      ORG_ID,
      1,
      expect.objectContaining({ extractionStatus: "PROCESSING", revision: 2 }),
    );
    expect(store.finalizeExtraction).toHaveBeenCalledWith(expect.objectContaining({
      expectedRevision: 2,
      status: "DRAFT",
    }));
    expect(finalized.record.status).toBe("DRAFT");
  });
});
