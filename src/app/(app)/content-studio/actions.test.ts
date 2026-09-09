import { describe, expect, it, vi } from "vitest";

import type { ScriptArtifact } from "@/modules/content-studio/artifacts/types";
import type { ContentItem } from "@/modules/content-studio/types";
import { executeGenerateContentAction } from "./actions";

const request = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  topic: "Railway safety training",
  knowledgeContext: "Use PAK workshop context.",
  language: "EN" as const,
};

const generatedItem: ContentItem = {
  id: "22222222-2222-4222-8222-222222222222",
  organizationId: request.organizationId,
  topic: request.topic,
  knowledgeContext: request.knowledgeContext,
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
  scriptText: generatedItem.generatedScript,
  revision: 1,
  provider: generatedItem.provider,
  providerModel: generatedItem.providerModel,
  createdBy: generatedItem.createdBy,
  createdAt: generatedItem.createdAt,
  updatedAt: generatedItem.updatedAt,
};

function baseDependencies() {
  return {
    getActor: async () => ({ id: generatedItem.createdBy! }),
    getMembership: async () => ({ role: "EDITOR" as const }),
    generate: vi.fn().mockResolvedValue(generatedItem),
    ensureSource: vi.fn().mockResolvedValue(sourceArtifact),
  };
}

describe("executeGenerateContentAction", () => {
  it("returns a safe authentication error when unauthenticated", async () => {
    const dependencies = baseDependencies();
    dependencies.getActor = async () => null as never;

    const result = await executeGenerateContentAction(request, dependencies);

    expect(result).toEqual({ ok: false, error: "You must be signed in to generate content." });
    expect(dependencies.ensureSource).not.toHaveBeenCalled();
  });

  it("returns a safe permission error for a missing or unauthorized membership", async () => {
    const dependencies = baseDependencies();
    dependencies.getMembership = async () => ({ role: "REVIEWER" as const });

    const result = await executeGenerateContentAction(request, dependencies);

    expect(result).toEqual({ ok: false, error: "You do not have permission to generate content for this organization." });
    expect(dependencies.ensureSource).not.toHaveBeenCalled();
  });

  it("creates the canonical source artifact after authorized initial generation", async () => {
    const dependencies = baseDependencies();
    const result = await executeGenerateContentAction(request, dependencies);

    expect(dependencies.generate).toHaveBeenCalledWith(request, generatedItem.createdBy);
    expect(dependencies.ensureSource).toHaveBeenCalledWith(generatedItem, generatedItem.createdBy);
    expect(result).toEqual({ ok: true, item: generatedItem, artifact: sourceArtifact });
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
