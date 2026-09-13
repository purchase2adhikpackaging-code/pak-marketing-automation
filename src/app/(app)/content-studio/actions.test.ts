import { describe, expect, it, vi } from "vitest";

import type { AppRole } from "@/modules/auth/roles";
import type { ScriptArtifact } from "@/modules/content-studio/artifacts/types";
import type { ContentItem } from "@/modules/content-studio/types";
import type { OrganizationGenerationContext } from "@/modules/generation-context/types";
import { executeGenerateContentAction } from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const knowledgeRecordId = "55555555-5555-4555-8555-555555555555";
const request = {
  organizationId,
  topic: "Railway safety training",
  knowledgeContext: "Use a concise tone for recruitment managers.",
  knowledgeRecordIds: [knowledgeRecordId],
  language: "EN" as const,
};

const resolvedContext: OrganizationGenerationContext = {
  organizationId,
  profile: {
    organizationId,
    officialName: "Polish Railway Academy",
    shortName: "PAK",
    socialLinks: {},
    defaultLanguage: "en",
    timezone: "Europe/Warsaw",
    legalIdentifiers: {},
    revision: 2,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
  },
  brandKit: {
    organizationId,
    brandVoice: "Professional and factual.",
    approvedImageryAssetIds: [],
    revision: 3,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
  },
  coreKnowledge: [],
  selectedKnowledge: [{
    id: knowledgeRecordId,
    organizationId,
    title: "Safety standard",
    content: "Approved railway safety procedures.",
    status: "ACTIVE",
    sourceType: "DOCUMENT",
    sourceLabel: "PAK Safety Manual",
    sourceReference: "Section 4.2",
    isCore: false,
    revision: 7,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
  }],
  knowledgeContext:
    "[Selected Knowledge: Safety standard]\nApproved railway safety procedures.\n\n" +
    "[Additional task context]\nUse a concise tone for recruitment managers.",
  additionalContext: "Use a concise tone for recruitment managers.",
  provenance: {
    profileRevision: 2,
    brandKitRevision: 3,
    knowledge: [{ id: knowledgeRecordId, revision: 7, isCore: false }],
  },
};

const generatedItem: ContentItem = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId,
  topic: request.topic,
  language: request.language,
  status: "GENERATED",
  generatedScript: "Generated script",
  provider: "fake",
  providerModel: "deterministic-v1",
  createdBy: "33333333-3333-4333-8333-333333333333",
  createdAt: "2026-09-09T00:00:00.000Z",
  updatedAt: "2026-09-09T00:00:01.000Z",
};

const sourceArtifact: ScriptArtifact = {
  id: "44444444-4444-4444-8444-444444444444",
  organizationId: generatedItem.organizationId,
  contentItemId: generatedItem.id,
  language: "EN",
  isSource: true,
  status: "GENERATED",
  scriptText: "Generated script",
  revision: 1,
  provider: "fake",
  providerModel: "deterministic-v1",
  createdBy: generatedItem.createdBy,
  createdAt: generatedItem.createdAt,
  updatedAt: generatedItem.updatedAt,
};

type TestDependencies = {
  getActor(): Promise<{ id: string } | null>;
  getMembership(): Promise<{ role: AppRole } | null>;
  resolveContext: ReturnType<typeof vi.fn>;
  generate: ReturnType<typeof vi.fn>;
  persistProvenance: ReturnType<typeof vi.fn>;
  ensureSource: ReturnType<typeof vi.fn>;
  markFailed?: ReturnType<typeof vi.fn>;
};

function baseDependencies(): TestDependencies {
  return {
    getActor: async () => ({ id: generatedItem.createdBy! }),
    getMembership: async () => ({ role: "EDITOR" }),
    resolveContext: vi.fn().mockResolvedValue(resolvedContext),
    generate: vi.fn().mockResolvedValue(generatedItem),
    persistProvenance: vi.fn().mockResolvedValue(undefined),
    ensureSource: vi.fn().mockResolvedValue(sourceArtifact),
  };
}

describe("executeGenerateContentAction", () => {
  it("returns a safe authentication error when unauthenticated", async () => {
    const dependencies = baseDependencies();
    dependencies.getActor = async () => null;
    const result = await executeGenerateContentAction(request, dependencies);
    expect(result).toEqual({ ok: false, error: "You must be signed in to generate content." });
    expect(dependencies.resolveContext).not.toHaveBeenCalled();
    expect(dependencies.ensureSource).not.toHaveBeenCalled();
  });

  it("returns a safe permission error for a missing or unauthorized membership", async () => {
    const dependencies = baseDependencies();
    dependencies.getMembership = async () => ({ role: "REVIEWER" });
    const result = await executeGenerateContentAction(request, dependencies);
    expect(result).toEqual({ ok: false, error: "You do not have permission to generate content for this organization." });
    expect(dependencies.resolveContext).not.toHaveBeenCalled();
  });

  it("resolves authoritative organization context before generation and never accepts browser identity text", async () => {
    const dependencies = baseDependencies();
    await executeGenerateContentAction(request, dependencies);
    expect(dependencies.resolveContext).toHaveBeenCalledWith({
      organizationId,
      selectedKnowledgeRecordIds: [knowledgeRecordId],
      additionalContext: request.knowledgeContext,
    });
    const generationRequest = dependencies.generate.mock.calls[0]![0] as ContentItem & { knowledgeContext: string };
    expect(generationRequest.knowledgeContext).toContain("[Organization Profile]");
    expect(generationRequest.knowledgeContext).toContain("Polish Railway Academy");
    expect(generationRequest.knowledgeContext).toContain("[Brand Kit]");
    expect(generationRequest.knowledgeContext).toContain("Professional and factual.");
    expect(generationRequest.knowledgeContext).toContain("[Selected Knowledge: Safety standard]");
  });

  it("persists exact resolved provenance before creating the canonical source artifact", async () => {
    const dependencies = baseDependencies();
    const result = await executeGenerateContentAction(request, dependencies);
    expect(dependencies.persistProvenance).toHaveBeenCalledWith(
      generatedItem.id,
      organizationId,
      resolvedContext,
    );
    expect(dependencies.persistProvenance.mock.invocationCallOrder[0]!).toBeLessThan(
      dependencies.ensureSource.mock.invocationCallOrder[0]!,
    );
    expect(result).toEqual({ ok: true, item: generatedItem, artifact: sourceArtifact });
  });

  it("rejects invalid or stale organization context without invoking generation", async () => {
    const dependencies = baseDependencies();
    dependencies.resolveContext = vi.fn().mockRejectedValue(new Error("selected record is stale"));
    const result = await executeGenerateContentAction(request, dependencies);
    expect(result).toEqual({ ok: false, error: "Content generation is temporarily unavailable." });
    expect(dependencies.generate).not.toHaveBeenCalled();
    expect(dependencies.persistProvenance).not.toHaveBeenCalled();
  });

  it("preserves free-form task context while still applying organization identity", async () => {
    const dependencies = baseDependencies();
    const freeFormContext: OrganizationGenerationContext = {
      ...resolvedContext,
      selectedKnowledge: [],
      knowledgeContext: "[Additional task context]\nUse workshop context supplied by the editor.",
      additionalContext: "Use workshop context supplied by the editor.",
      provenance: { profileRevision: 2, brandKitRevision: 3, knowledge: [] },
    };
    dependencies.resolveContext = vi.fn().mockResolvedValue(freeFormContext);
    await executeGenerateContentAction({
      organizationId,
      topic: request.topic,
      knowledgeContext: "Use workshop context supplied by the editor.",
      language: request.language,
    }, dependencies);
    const generationRequest = dependencies.generate.mock.calls[0]![0] as { knowledgeContext: string };
    expect(generationRequest.knowledgeContext).toContain("[Organization Profile]");
    expect(generationRequest.knowledgeContext).toContain("[Additional task context]");
  });

  it("returns safe failure when atomic provenance persistence fails and does not create the source artifact", async () => {
    const dependencies = baseDependencies();
    dependencies.persistProvenance = vi.fn().mockRejectedValue(new Error("sk-secret-provenance-leak"));
    const result = await executeGenerateContentAction(request, dependencies);
    expect(result).toEqual({ ok: false, error: "Content generation is temporarily unavailable." });
    expect(dependencies.ensureSource).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("sk-secret-provenance-leak");
  });

  it("normalizes provider or canonical-artifact failure without exposing raw details", async () => {
    const providerFailure = baseDependencies();
    providerFailure.generate = vi.fn().mockRejectedValue(new Error("sk-secret-provider-leak"));
    expect(await executeGenerateContentAction(request, providerFailure)).toEqual({
      ok: false,
      error: "Content generation is temporarily unavailable.",
    });

    const artifactFailure = baseDependencies();
    artifactFailure.ensureSource = vi.fn().mockRejectedValue(new Error("sk-secret-artifact-leak"));
    expect(await executeGenerateContentAction(request, artifactFailure)).toEqual({
      ok: false,
      error: "Content generation is temporarily unavailable.",
    });
  });
});
