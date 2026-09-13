import { describe, expect, it, vi } from "vitest";

import type { ScriptArtifact } from "@/modules/content-studio/artifacts/types";
import type { ContentItem } from "@/modules/content-studio/types";
import type { OrganizationGenerationContext } from "@/modules/generation-context/types";
import { executeGenerateContentAction } from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const coreId = "33333333-3333-4333-8333-333333333333";
const selectedId = "44444444-4444-4444-8444-444444444444";

const context: OrganizationGenerationContext = {
  organizationId,
  profile: {
    organizationId,
    officialName: "Polish Railway Academy",
    shortName: "PAK",
    about: "Official railway education and training institution.",
    socialLinks: {},
    defaultLanguage: "en",
    timezone: "Europe/Warsaw",
    legalIdentifiers: {},
    revision: 7,
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
  },
  brandKit: {
    organizationId,
    primaryColor: "#102A43",
    secondaryColor: "#FFFFFF",
    brandVoice: "Authoritative, precise and institutional.",
    logoUsageRules: "Use only the official primary logo identity.",
    primaryLogoAssetId: "55555555-5555-4555-8555-555555555555",
    approvedImageryAssetIds: [],
    revision: 5,
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
  },
  coreKnowledge: [{
    id: coreId,
    organizationId,
    title: "Institution facts",
    content: "PAK provides railway education and professional training.",
    status: "ACTIVE",
    sourceType: "MANUAL",
    isCore: true,
    revision: 3,
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
  }],
  selectedKnowledge: [{
    id: selectedId,
    organizationId,
    title: "Safety programme",
    content: "The selected safety programme uses supervised practical instruction.",
    status: "ACTIVE",
    sourceType: "DOCUMENT",
    isCore: false,
    revision: 4,
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
  }],
  knowledgeContext:
    "[Core Knowledge: Institution facts]\nPAK provides railway education and professional training.\n\n" +
    "[Selected Knowledge: Safety programme]\nThe selected safety programme uses supervised practical instruction.\n\n" +
    "[Additional task context]\nEmphasize employer relevance.",
  additionalContext: "Emphasize employer relevance.",
  provenance: {
    profileRevision: 7,
    brandKitRevision: 5,
    knowledge: [
      { id: coreId, revision: 3, isCore: true },
      { id: selectedId, revision: 4, isCore: false },
    ],
  },
};

const item: ContentItem = {
  id: "66666666-6666-4666-8666-666666666666",
  organizationId,
  topic: "Railway safety careers",
  language: "EN",
  status: "GENERATED",
  generatedScript: "Generated script",
  provider: "fake",
  providerModel: "deterministic-v1",
  createdBy: actorId,
  createdAt: "2026-09-13T00:00:00.000Z",
  updatedAt: "2026-09-13T00:00:01.000Z",
};

const artifact: ScriptArtifact = {
  id: "77777777-7777-4777-8777-777777777777",
  organizationId,
  contentItemId: item.id,
  language: "EN",
  isSource: true,
  status: "GENERATED",
  scriptText: "Generated script",
  revision: 1,
  provider: "fake",
  providerModel: "deterministic-v1",
  createdBy: actorId,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
};

describe("Content Studio organization generation context", () => {
  it("automatically applies Profile, Brand Kit, Core Knowledge and selected Knowledge before generation, then persists one atomic provenance snapshot", async () => {
    const resolveContext = vi.fn().mockResolvedValue(context);
    const generate = vi.fn().mockResolvedValue(item);
    const persistProvenance = vi.fn().mockResolvedValue(undefined);
    const ensureSource = vi.fn().mockResolvedValue(artifact);

    const result = await executeGenerateContentAction({
      organizationId,
      topic: item.topic,
      knowledgeRecordIds: [selectedId],
      knowledgeContext: "Emphasize employer relevance.",
      language: "EN",
    }, {
      getActor: async () => ({ id: actorId }),
      getMembership: async () => ({ role: "EDITOR" }),
      resolveContext,
      generate,
      persistProvenance,
      ensureSource,
    });

    expect(resolveContext).toHaveBeenCalledWith({
      organizationId,
      selectedKnowledgeRecordIds: [selectedId],
      additionalContext: "Emphasize employer relevance.",
    });

    const generationRequest = generate.mock.calls[0]![0] as { knowledgeContext: string };
    const profileAt = generationRequest.knowledgeContext.indexOf("[Organization Profile]");
    const brandAt = generationRequest.knowledgeContext.indexOf("[Brand Kit]");
    const coreAt = generationRequest.knowledgeContext.indexOf("[Core Knowledge: Institution facts]");
    const selectedAt = generationRequest.knowledgeContext.indexOf("[Selected Knowledge: Safety programme]");
    const taskAt = generationRequest.knowledgeContext.indexOf("[Additional task context]");
    expect(profileAt).toBeGreaterThanOrEqual(0);
    expect(profileAt).toBeLessThan(brandAt);
    expect(brandAt).toBeLessThan(coreAt);
    expect(coreAt).toBeLessThan(selectedAt);
    expect(selectedAt).toBeLessThan(taskAt);
    expect(generationRequest.knowledgeContext).toContain("Polish Railway Academy");
    expect(generationRequest.knowledgeContext).toContain("Authoritative, precise and institutional.");

    expect(persistProvenance).toHaveBeenCalledWith(item.id, organizationId, context);
    expect(persistProvenance.mock.invocationCallOrder[0]!).toBeLessThan(ensureSource.mock.invocationCallOrder[0]!);
    expect(result).toEqual({ ok: true, item, artifact });
  });

  it("fails closed before provider generation if authoritative Profile or Brand Kit is unavailable", async () => {
    const generate = vi.fn();
    const missingIdentity = { ...context, profile: null };

    const result = await executeGenerateContentAction({
      organizationId,
      topic: item.topic,
      language: "EN",
    }, {
      getActor: async () => ({ id: actorId }),
      getMembership: async () => ({ role: "EDITOR" }),
      resolveContext: vi.fn().mockResolvedValue(missingIdentity),
      generate,
      persistProvenance: vi.fn(),
      ensureSource: vi.fn(),
    });

    expect(result).toEqual({ ok: false, error: "Content generation is temporarily unavailable." });
    expect(generate).not.toHaveBeenCalled();
  });

  it("fails closed before provider generation when authoritative Profile and Brand make the complete grounding context exceed the 12,000-character request contract", async () => {
    const generate = vi.fn();
    const oversizedContext: OrganizationGenerationContext = {
      ...context,
      profile: {
        ...context.profile!,
        about: "A".repeat(12000),
      },
    };

    const result = await executeGenerateContentAction({
      organizationId,
      topic: item.topic,
      language: "EN",
    }, {
      getActor: async () => ({ id: actorId }),
      getMembership: async () => ({ role: "EDITOR" }),
      resolveContext: vi.fn().mockResolvedValue(oversizedContext),
      generate,
      persistProvenance: vi.fn(),
      ensureSource: vi.fn(),
    });

    expect(result).toEqual({ ok: false, error: "Content generation is temporarily unavailable." });
    expect(generate).not.toHaveBeenCalled();
  });
});
