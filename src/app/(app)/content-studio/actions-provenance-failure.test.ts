import { describe, expect, it, vi } from "vitest";

import type { ScriptArtifact } from "@/modules/content-studio/artifacts/types";
import type { ContentItem } from "@/modules/content-studio/types";
import type { OrganizationGenerationContext } from "@/modules/generation-context/types";
import { executeGenerateContentAction } from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const knowledgeRecordId = "33333333-3333-4333-8333-333333333333";

const context: OrganizationGenerationContext = {
  organizationId,
  profile: {
    organizationId,
    officialName: "Polish Railway Academy",
    socialLinks: {},
    defaultLanguage: "en",
    timezone: "Europe/Warsaw",
    legalIdentifiers: {},
    revision: 1,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
  },
  brandKit: {
    organizationId,
    approvedImageryAssetIds: [],
    revision: 1,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
  },
  coreKnowledge: [],
  selectedKnowledge: [{
    id: knowledgeRecordId,
    organizationId,
    title: "Safety",
    content: "Approved safety source.",
    status: "ACTIVE",
    sourceType: "MANUAL",
    isCore: false,
    revision: 1,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
  }],
  knowledgeContext: "[Selected Knowledge: Safety]\nApproved safety source.",
  provenance: {
    profileRevision: 1,
    brandKitRevision: 1,
    knowledge: [{ id: knowledgeRecordId, revision: 1, isCore: false }],
  },
};

const item: ContentItem = {
  id: "44444444-4444-4444-8444-444444444444",
  organizationId,
  topic: "Railway safety",
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
  it("marks an already-generated item FAILED when immutable atomic provenance persistence fails", async () => {
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
        resolveContext: async () => context,
        generate: async () => item,
        persistProvenance: async () => {
          throw new Error("provenance persistence failed");
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
