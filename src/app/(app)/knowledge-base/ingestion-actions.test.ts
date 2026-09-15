import { describe, expect, it, vi } from "vitest";

import {
  executeIngestKnowledgeFileAction,
  executeIngestKnowledgeUrlAction,
  type KnowledgeIngestionActionDependencies,
} from "./actions";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_ID = "33333333-3333-4333-8333-333333333333";

const draftRecord = {
  id: "44444444-4444-4444-8444-444444444444",
  organizationId: ORG_ID,
  title: "PAK Safety Manual",
  content: "Safe railway operations",
  status: "DRAFT" as const,
  sourceType: "DOCUMENT" as const,
  revision: 1,
  createdAt: "2026-09-13T00:00:00.000Z",
  updatedAt: "2026-09-13T00:00:00.000Z",
};

function dependencies(
  role: "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "ANALYST" = "EDITOR",
): KnowledgeIngestionActionDependencies {
  return {
    getActor: vi.fn().mockResolvedValue({ id: ACTOR_ID }),
    getMembership: vi.fn().mockResolvedValue({ role }),
    ingestFile: vi.fn().mockResolvedValue({
      documentId: "55555555-5555-4555-8555-555555555555",
      record: draftRecord,
    }),
    ingestUrl: vi.fn().mockResolvedValue({
      documentId: "66666666-6666-4666-8666-666666666666",
      record: { ...draftRecord, sourceType: "URL" as const },
    }),
  };
}

describe("knowledge ingestion actions", () => {
  it("accepts only an existing media asset ID for file ingestion and never a browser storage path", async () => {
    const deps = dependencies();

    const invalid = await executeIngestKnowledgeFileAction({
      organizationId: ORG_ID,
      mediaAssetId: ASSET_ID,
      format: "PDF",
      storagePath: `${ORG_ID}/private/document.pdf`,
    }, deps);

    expect(invalid.ok).toBe(false);
    expect(deps.ingestFile).not.toHaveBeenCalled();

    const valid = await executeIngestKnowledgeFileAction({
      organizationId: ORG_ID,
      mediaAssetId: ASSET_ID,
      format: "PDF",
      sourceLabel: "PAK Safety Manual",
    }, deps);

    expect(valid.ok).toBe(true);
    expect(deps.ingestFile).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      mediaAssetId: ASSET_ID,
      format: "PDF",
      sourceLabel: "PAK Safety Manual",
      actorUserId: ACTOR_ID,
    });
  });

  it("requires knowledge:manage permission for file and URL ingestion", async () => {
    for (const role of ["REVIEWER", "ANALYST"] as const) {
      const deps = dependencies(role);
      const file = await executeIngestKnowledgeFileAction({
        organizationId: ORG_ID,
        mediaAssetId: ASSET_ID,
        format: "PDF",
      }, deps);
      const url = await executeIngestKnowledgeUrlAction({
        organizationId: ORG_ID,
        sourceUrl: "https://example.org/programmes",
      }, deps);

      expect(file).toEqual(expect.objectContaining({ ok: false }));
      expect(url).toEqual(expect.objectContaining({ ok: false }));
      expect(deps.ingestFile).not.toHaveBeenCalled();
      expect(deps.ingestUrl).not.toHaveBeenCalled();
    }
  });

  it("returns only a reviewable DRAFT result and never auto-activates ingested knowledge", async () => {
    const deps = dependencies("OWNER");

    const result = await executeIngestKnowledgeUrlAction({
      organizationId: ORG_ID,
      sourceUrl: "https://example.org/programmes#overview",
      sourceLabel: "PAK Programmes",
    }, deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected successful ingestion");
    expect(result.record.status).toBe("DRAFT");
    expect(deps.ingestUrl).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      sourceUrl: "https://example.org/programmes#overview",
      sourceLabel: "PAK Programmes",
      actorUserId: ACTOR_ID,
    });
  });

  it("does not expose parser, storage, network or database failure details", async () => {
    const deps = dependencies();
    vi.mocked(deps.ingestFile).mockRejectedValue(
      new Error("storage/media-private/secret-path.pdf pdf parser stack 10.0.0.4"),
    );

    const result = await executeIngestKnowledgeFileAction({
      organizationId: ORG_ID,
      mediaAssetId: ASSET_ID,
      format: "PDF",
    }, deps);

    expect(result).toEqual({
      ok: false,
      error: "Knowledge source could not be ingested. Check the source and try again.",
    });
  });
});
