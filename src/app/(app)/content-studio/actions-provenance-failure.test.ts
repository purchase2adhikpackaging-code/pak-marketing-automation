import { describe, expect, it, vi } from "vitest";

import type { ScriptArtifact } from "@/modules/content-studio/artifacts/types";
import type { ContentItem } from "@/modules/content-studio/types";
import type { ResolvedGrounding } from "@/modules/knowledge-base/grounding-service";
import { executeGenerateContentAction } from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const knowledgeRecordId = "33333333-3333-4333-8333-333333333333";
const groundingContext = "[Knowledge Source 1: Safety]\nApproved safety source.";

const grounding: ResolvedGrounding = {
  knowledgeContext: groundingContext,
  sources: [
    {
      record: {
        id: knowledgeRecordId,
        organizationId,
        title: "Safety",
        content: "Approved safety source.",
        status: "ACTIVE",
        sourceType: "MANUAL",
        revision: 1,
        createdAt: "2026-09-10T00:00:00.000Z",
        updatedAt: "2026-09-10T00:00:00.000Z",
      },
      snapshot: {
        knowledgeRecordId,
        knowledgeRevision: 1,
        titleSnapshot: "Safety",
        contentSnapshot: "Approved safety source.",
        sourceTypeSnapshot: "MANUAL",
      },
    },
  ],
};

const item: ContentItem = {
  id: "44444444-4444-4444-8444-444444444444",
  organizationId,
  topic: "Railway safety",
  knowledgeContext: groundingContext,
  language: "EN",
  status: "GENERATED",
  generatedScript: "Generated script",
  provider: "fake",
  providerModel: "deterministic-v1",
  createdBy: actorId,
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:01.000Z",
};

describe("executeGenerateContentAction provenance recovery", () => {
  it("marks an already-generated item FAILED when immutable provenance persistence fails", async () => {
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const ensureSource = vi.fn<() => Promise<ScriptArtifact>>();

    const result = await executeGenerateContentAction(
      {
        organizationId,
        topic: "Railway safety",
        knowledgeRecordIds: [knowledgeRecordId],
        language: "EN",
      },
      {
        getActor: async () => ({ id: actorId }),
        getMembership: async () => ({ role: "EDITOR" }),
        resolveGrounding: async () => grounding,
        generate: async () => item,
        persistSnapshots: async () => {
          throw new Error("snapshot persistence failed");
        },
        markFailed,
        ensureSource,
      },
    );

    expect(result).toEqual({ ok: false, error: "Content generation is temporarily unavailable." });
    expect(markFailed).toHaveBeenCalledWith(
      item,
      expect.objectContaining({ code: "PROVENANCE_PERSISTENCE_FAILED" }),
    );
    expect(ensureSource).not.toHaveBeenCalled();
  });
});
