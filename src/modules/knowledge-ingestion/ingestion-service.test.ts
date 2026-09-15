import { describe, expect, it, vi } from "vitest";

import {
  KnowledgeIngestionService,
  type KnowledgeIngestionRepositoryPort,
} from "./ingestion-service";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_ID = "33333333-3333-4333-8333-333333333333";
const DOCUMENT_ID = "44444444-4444-4444-8444-444444444444";

function repository(): KnowledgeIngestionRepositoryPort {
  return {
    loadFileSource: vi.fn().mockResolvedValue({
      id: ASSET_ID,
      organizationId: ORG_ID,
      mimeType: "application/pdf",
      displayName: "PAK Safety Manual.pdf",
      sizeBytes: 3,
      bytes: new Uint8Array([1, 2, 3]),
    }),
    createFileDocument: vi.fn().mockResolvedValue({
      id: DOCUMENT_ID,
      organizationId: ORG_ID,
      sourceType: "FILE",
      format: "PDF",
      mediaAssetId: ASSET_ID,
      sourceLabel: "PAK Safety Manual",
      extractionStatus: "PENDING",
      extractionMetadata: {},
      revision: 1,
      createdAt: "2026-09-13T00:00:00.000Z",
      updatedAt: "2026-09-13T00:00:00.000Z",
    }),
    createUrlDocument: vi.fn().mockResolvedValue({
      id: DOCUMENT_ID,
      organizationId: ORG_ID,
      sourceType: "URL",
      format: "URL",
      sourceUrl: "https://example.org/programmes",
      sourceLabel: "PAK Programmes",
      extractionStatus: "PENDING",
      extractionMetadata: {},
      revision: 1,
      createdAt: "2026-09-13T00:00:00.000Z",
      updatedAt: "2026-09-13T00:00:00.000Z",
    }),
    markProcessing: vi.fn().mockImplementation(async (_id, _org, revision) => ({
      id: DOCUMENT_ID,
      organizationId: ORG_ID,
      sourceType: "FILE",
      format: "PDF",
      mediaAssetId: ASSET_ID,
      extractionStatus: "PROCESSING",
      extractionMetadata: {},
      revision: revision + 1,
      createdAt: "2026-09-13T00:00:00.000Z",
      updatedAt: "2026-09-13T00:00:01.000Z",
    })),
    markFailed: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue({
      document: {
        id: DOCUMENT_ID,
        organizationId: ORG_ID,
        sourceType: "FILE",
        format: "PDF",
        mediaAssetId: ASSET_ID,
        extractionStatus: "EXTRACTED",
        extractionMetadata: { format: "PDF" },
        revision: 3,
        createdAt: "2026-09-13T00:00:00.000Z",
        updatedAt: "2026-09-13T00:00:02.000Z",
      },
      record: {
        id: "55555555-5555-4555-8555-555555555555",
        organizationId: ORG_ID,
        title: "PAK Safety Manual",
        content: "Safe railway operations",
        status: "DRAFT",
        sourceType: "DOCUMENT",
        revision: 1,
        createdAt: "2026-09-13T00:00:02.000Z",
        updatedAt: "2026-09-13T00:00:02.000Z",
      },
    }),
  };
}

describe("KnowledgeIngestionService", () => {
  it("verifies file MIME/format, extracts server-side bytes and finalizes only a DRAFT record", async () => {
    const repo = repository();
    const extractSource = vi.fn().mockResolvedValue({
      text: "Safe railway operations",
      sourceFingerprint: "a".repeat(64),
    });
    const service = new KnowledgeIngestionService(repo, {
      extractSource,
      validateUrl: vi.fn(),
    });

    const result = await service.ingestFile({
      organizationId: ORG_ID,
      mediaAssetId: ASSET_ID,
      format: "PDF",
      sourceLabel: "PAK Safety Manual",
      actorUserId: ACTOR_ID,
    });

    expect(extractSource).toHaveBeenCalledWith({
      sourceType: "FILE",
      format: "PDF",
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(repo.finalize).toHaveBeenCalledWith(expect.objectContaining({
      documentId: DOCUMENT_ID,
      title: "PAK Safety Manual",
      content: "Safe railway operations",
      sourceType: "DOCUMENT",
      sourceReference: `media:${ASSET_ID}`,
      sourceFingerprint: "a".repeat(64),
    }));
    expect(result.record.status).toBe("DRAFT");
  });

  it("rejects browser format claims that do not match the server-side media MIME", async () => {
    const repo = repository();
    vi.mocked(repo.loadFileSource).mockResolvedValue({
      id: ASSET_ID,
      organizationId: ORG_ID,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      displayName: "Manual.docx",
      sizeBytes: 3,
      bytes: new Uint8Array([1, 2, 3]),
    });
    const extractSource = vi.fn();
    const service = new KnowledgeIngestionService(repo, {
      extractSource,
      validateUrl: vi.fn(),
    });

    await expect(service.ingestFile({
      organizationId: ORG_ID,
      mediaAssetId: ASSET_ID,
      format: "PDF",
      actorUserId: ACTOR_ID,
    })).rejects.toThrow(/format|mime/i);

    expect(repo.createFileDocument).not.toHaveBeenCalled();
    expect(extractSource).not.toHaveBeenCalled();
  });

  it("validates URL before persistence and finalizes canonical provenance as DRAFT", async () => {
    const repo = repository();
    vi.mocked(repo.markProcessing).mockResolvedValue({
      id: DOCUMENT_ID,
      organizationId: ORG_ID,
      sourceType: "URL",
      format: "URL",
      sourceUrl: "https://example.org/programmes",
      extractionStatus: "PROCESSING",
      extractionMetadata: {},
      revision: 2,
      createdAt: "2026-09-13T00:00:00.000Z",
      updatedAt: "2026-09-13T00:00:01.000Z",
    });
    vi.mocked(repo.finalize).mockResolvedValue({
      document: {
        id: DOCUMENT_ID,
        organizationId: ORG_ID,
        sourceType: "URL",
        format: "URL",
        sourceUrl: "https://example.org/programmes",
        extractionStatus: "EXTRACTED",
        extractionMetadata: {},
        revision: 3,
        createdAt: "2026-09-13T00:00:00.000Z",
        updatedAt: "2026-09-13T00:00:02.000Z",
      },
      record: {
        id: "55555555-5555-4555-8555-555555555555",
        organizationId: ORG_ID,
        title: "PAK Programmes",
        content: "Railway programmes",
        status: "DRAFT",
        sourceType: "URL",
        revision: 1,
        createdAt: "2026-09-13T00:00:02.000Z",
        updatedAt: "2026-09-13T00:00:02.000Z",
      },
    });
    const validateUrl = vi.fn().mockResolvedValue("https://example.org/programmes");
    const extractSource = vi.fn().mockResolvedValue({
      text: "Railway programmes",
      sourceFingerprint: "b".repeat(64),
      canonicalUrl: "https://example.org/programmes",
    });
    const service = new KnowledgeIngestionService(repo, { extractSource, validateUrl });

    const result = await service.ingestUrl({
      organizationId: ORG_ID,
      sourceUrl: "https://example.org/programmes#overview",
      sourceLabel: "PAK Programmes",
      actorUserId: ACTOR_ID,
    });

    expect(validateUrl).toHaveBeenCalledWith("https://example.org/programmes#overview");
    expect(repo.createUrlDocument).toHaveBeenCalledWith(expect.objectContaining({
      sourceUrl: "https://example.org/programmes",
    }));
    expect(repo.finalize).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: "URL",
      sourceReference: "https://example.org/programmes",
    }));
    expect(result.record.status).toBe("DRAFT");
  });

  it("marks a started document FAILED with a bounded generic summary when extraction fails", async () => {
    const repo = repository();
    const extractSource = vi.fn().mockRejectedValue(new Error("secret parser internals"));
    const service = new KnowledgeIngestionService(repo, {
      extractSource,
      validateUrl: vi.fn(),
    });

    await expect(service.ingestFile({
      organizationId: ORG_ID,
      mediaAssetId: ASSET_ID,
      format: "PDF",
      actorUserId: ACTOR_ID,
    })).rejects.toThrow();

    expect(repo.markFailed).toHaveBeenCalledWith(
      DOCUMENT_ID,
      ORG_ID,
      2,
      "Extraction failed.",
    );
  });
});
