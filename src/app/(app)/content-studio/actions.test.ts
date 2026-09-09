import { describe, expect, it, vi } from "vitest";

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

describe("executeGenerateContentAction", () => {
  it("returns a safe authentication error when unauthenticated", async () => {
    const result = await executeGenerateContentAction(request, {
      getActor: async () => null,
      getMembership: vi.fn(),
      generate: vi.fn(),
    });

    expect(result).toEqual({ ok: false, error: "You must be signed in to generate content." });
  });

  it("returns a safe permission error for a missing or unauthorized membership", async () => {
    const result = await executeGenerateContentAction(request, {
      getActor: async () => ({ id: "33333333-3333-4333-8333-333333333333" }),
      getMembership: async () => ({ role: "REVIEWER" }),
      generate: vi.fn(),
    });

    expect(result).toEqual({ ok: false, error: "You do not have permission to generate content for this organization." });
  });

  it("calls the workflow for an authorized actor and returns the generated item", async () => {
    const generate = vi.fn().mockResolvedValue(generatedItem);
    const result = await executeGenerateContentAction(request, {
      getActor: async () => ({ id: generatedItem.createdBy! }),
      getMembership: async () => ({ role: "EDITOR" }),
      generate,
    });

    expect(generate).toHaveBeenCalledWith(request, generatedItem.createdBy);
    expect(result).toEqual({ ok: true, item: generatedItem });
  });

  it("normalizes provider failure without exposing raw details", async () => {
    const result = await executeGenerateContentAction(request, {
      getActor: async () => ({ id: generatedItem.createdBy! }),
      getMembership: async () => ({ role: "OWNER" }),
      generate: async () => {
        throw new Error("sk-secret-provider-leak");
      },
    });

    expect(result).toEqual({ ok: false, error: "Content generation is temporarily unavailable." });
    expect(JSON.stringify(result)).not.toContain("sk-secret-provider-leak");
  });
});
