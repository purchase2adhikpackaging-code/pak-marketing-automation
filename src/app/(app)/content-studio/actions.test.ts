import { describe, expect, it, vi } from "vitest";

import type { AppRole } from "@/modules/auth/roles";
import type { ScriptArtifact } from "@/modules/content-studio/artifacts/types";
import type { ContentItem } from "@/modules/content-studio/types";
import type { ResolvedGrounding } from "@/modules/knowledge-base/grounding-service";
import { executeGenerateContentAction } from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const knowledgeRecordId = "55555555-5555-4555-8555-555555555555";
const groundingContext =
  "[Knowledge Source 1: Safety standard]\nApproved railway safety procedures.\n\n" +
  "[Additional user-provided context]\nUse a concise tone for recruitment managers.";

const request = {
  organizationId,
  topic: "Railway safety training",
  knowledgeContext: "Use a concise tone for recruitment managers.",
  knowledgeRecordIds: [knowledgeRecordId],
  language: "EN" as const,
};

const resolvedGrounding: ResolvedGrounding = {
  knowledgeContext: groundingContext,
  sources: [
    {
      record: {
        id: knowledgeRecordId,
        organizationId,
        title: "Safety standard",
        content: "Approved railway safety procedures.",
        status: "ACTIVE",
        sourceType: "DOCUMENT",
        sourceLabel: "PAK Safety Manual",
        sourceReference: "Section 4.2",
        revision: 7,
        createdAt: "2026-09-09T00:00:00.000Z",
        updatedAt: "2026-09-09T00:00:00.000Z",
      },
      snapshot: {
        knowledgeRecordId,
        knowledgeRevision: 7,
        titleSnapshot: "Safety standard",
        contentSnapshot: "Approved railway safety procedures.",
        sourceTypeSnapshot: "DOCUMENT",
        sourceLabelSnapshot: "PAK Safety Manual",
        sourceReferenceSnapshot: "Section 4.2",
      },
    },
  ],
};

const generatedItem: ContentItem = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId,
  topic: request.topic,
  knowledgeContext: groundingContext,
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
  createdBy: "33333333-3333-4333-8333-333333333333",
  createdAt: generatedItem.createdAt,
  updatedAt: generatedItem.updatedAt,
};

type TestDependencies = {
  getActor(): Promise<{ id: string } | null>;
  getMembership(): Promise<{ role: AppRole } | null>;
  resolveGrounding: ReturnType<typeof vi.fn>;
  generate: ReturnType<typeof vi.fn>;
  persistSnapshots: ReturnType<typeof vi.fn>;
  ensureSource: ReturnType<typeof vi.fn>;
};

function baseDependencies(): TestDependencies {
  return {
    getActor: async () => ({ id: generatedItem.createdBy! }),
    getMembership: async () => ({ role: "EDITOR" }),
    resolveGrounding: vi.fn().mockResolvedValue(resolvedGrounding),
    generate: vi.fn().mockResolvedValue(generatedItem),
    persistSnapshots: vi.fn().mockResolvedValue(undefined),
    ensureSource: vi.fn().mockResolvedValue(sourceArtifact),
  };
}

describe("executeGenerateContentAction", () => {
  it("returns a safe authentication error when unauthenticated", async () => {
    const dependencies = baseDependencies();
    dependencies.getActor = async () => null;

    const result = await executeGenerateContentAction(request, dependencies);

    expect(result).toEqual({ ok: false, error: "You must be signed in to generate content." });
    expect(dependencies.resolveGrounding).not.toHaveBeenCalled();
    expect(dependencies.ensureSource).not.toHaveBeenCalled();
  });

  it("returns a safe permission error for a missing or unauthorized membership", async () => {
    const dependencies = baseDependencies();
    dependencies.getMembership = async () => ({ role: "REVIEWER" });

    const result = await executeGenerateContentAction(request, dependencies);

    expect(result).toEqual({ ok: false, error: "You do not have permission to generate content for this organization." });
    expect(dependencies.resolveGrounding).not.toHaveBeenCalled();
    expect(dependencies.ensureSource).not.toHaveBeenCalled();
  });

  it("resolves approved knowledge before generation and passes only server-composed grounding", async () => {
    const dependencies = baseDependencies();

    await executeGenerateContentAction(request, dependencies);

    expect(dependencies.resolveGrounding).toHaveBeenCalledWith({
      organizationId,
      knowledgeRecordIds: [knowledgeRecordId],
      additionalContext: request.knowledgeContext,
    });
    expect(dependencies.generate).toHaveBeenCalledWith(
      {
        organizationId,
        topic: request.topic,
        knowledgeContext: groundingContext,
        language: request.language,
      },
      generatedItem.createdBy,
    );
    expect(dependencies.resolveGrounding.mock.invocationCallOrder[0]!).toBeLessThan(
      dependencies.generate.mock.invocationCallOrder[0]!,
    );
  });

  it("persists exact resolved snapshots before creating the canonical source artifact", async () => {
    const dependencies = baseDependencies();
    const result = await executeGenerateContentAction(request, dependencies);

    expect(dependencies.persistSnapshots).toHaveBeenCalledWith(
      generatedItem.id,
      organizationId,
      resolvedGrounding,
    );
    expect(dependencies.persistSnapshots.mock.invocationCallOrder[0]!).toBeLessThan(
      dependencies.ensureSource.mock.invocationCallOrder[0]!,
    );
    expect(dependencies.ensureSource).toHaveBeenCalledWith(generatedItem, generatedItem.createdBy);
    expect(result).toEqual({ ok: true, item: generatedItem, artifact: sourceArtifact });
  });

  it("rejects invalid or stale knowledge without invoking generation", async () => {
    const dependencies = baseDependencies();
    dependencies.resolveGrounding = vi.fn().mockRejectedValue(new Error("selected record is stale"));

    const result = await executeGenerateContentAction(request, dependencies);

    expect(result).toEqual({ ok: false, error: "Content generation is temporarily unavailable." });
    expect(dependencies.generate).not.toHaveBeenCalled();
    expect(dependencies.persistSnapshots).not.toHaveBeenCalled();
    expect(dependencies.ensureSource).not.toHaveBeenCalled();
  });

  it("preserves free-form behavior when no knowledge records are selected", async () => {
    const dependencies = baseDependencies();
    const freeFormRequest = {
      organizationId,
      topic: request.topic,
      knowledgeContext: "Use workshop context supplied by the editor.",
      language: request.language,
    };
    dependencies.resolveGrounding = vi.fn().mockResolvedValue({
      knowledgeContext: freeFormRequest.knowledgeContext,
      sources: [],
    });

    await executeGenerateContentAction(freeFormRequest, dependencies);

    expect(dependencies.generate).toHaveBeenCalledWith(freeFormRequest, generatedItem.createdBy);
    expect(dependencies.persistSnapshots).toHaveBeenCalledWith(
      generatedItem.id,
      organizationId,
      { knowledgeContext: freeFormRequest.knowledgeContext, sources: [] },
    );
  });

  it("returns safe failure when snapshot persistence fails and does not create the source artifact", async () => {
    const dependencies = baseDependencies();
    dependencies.persistSnapshots = vi.fn().mockRejectedValue(new Error("sk-secret-snapshot-leak"));

    const result = await executeGenerateContentAction(request, dependencies);

    expect(result).toEqual({ ok: false, error: "Content generation is temporarily unavailable." });
    expect(dependencies.ensureSource).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("sk-secret-snapshot-leak");
  });

  it("normalizes provider or canonical-artifact failure without exposing raw details", async () => {
    const providerFailure = baseDependencies();
    providerFailure.generate = vi.fn().mockRejectedValue(new Error("sk-secret-provider-leak"));

    const first = await executeGenerateContentAction(request, providerFailure);
    expect(first).toEqual({ ok: false, error: "Content generation is temporarily unavailable." });
    expect(JSON.stringify(first)).not.toContain("sk-secret-provider-leak");

    const artifactFailure = baseDependencies();
    artifactFailure.ensureSource = vi.fn().mockRejectedValue(new Error("sk-secret-artifact-leak"));

    const second = await executeGenerateContentAction(request, artifactFailure);
    expect(second).toEqual({ ok: false, error: "Content generation is temporarily unavailable." });
    expect(JSON.stringify(second)).not.toContain("sk-secret-artifact-leak");
  });
});
