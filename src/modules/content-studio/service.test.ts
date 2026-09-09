import { describe, expect, it } from "vitest";

import type { TextGenerationProvider } from "@/modules/ai/text/provider";
import type { TextGenerationRequest, TextGenerationResult } from "@/modules/ai/text/types";
import type { ContentItemRepository } from "./repository";
import { generateContentScript } from "./service";
import type {
  ContentItem,
  CreateDraftInput,
  MarkFailedInput,
  MarkGeneratedInput,
} from "./types";

const now = "2026-09-09T00:00:00.000Z";

function buildDraft(input: CreateDraftInput): ContentItem {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    organizationId: input.organizationId,
    topic: input.topic,
    ...(input.knowledgeContext ? { knowledgeContext: input.knowledgeContext } : {}),
    language: input.language,
    status: "DRAFT",
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

class InMemoryRepository implements ContentItemRepository {
  events: string[] = [];
  current?: ContentItem;

  async createDraft(input: CreateDraftInput): Promise<ContentItem> {
    this.events.push("createDraft");
    this.current = buildDraft(input);
    return this.current;
  }

  async markGenerating(id: string, organizationId: string): Promise<void> {
    this.events.push("markGenerating");
    if (!this.current || this.current.id !== id || this.current.organizationId !== organizationId) {
      throw new Error("content item not found");
    }
    this.current = { ...this.current, status: "GENERATING", updatedAt: now };
  }

  async markGenerated(input: MarkGeneratedInput): Promise<ContentItem> {
    this.events.push("markGenerated");
    if (!this.current) throw new Error("content item not found");
    this.current = {
      ...this.current,
      status: "GENERATED",
      generatedScript: input.generatedScript,
      provider: input.provider,
      providerModel: input.providerModel,
      ...(input.providerMetadata ? { providerMetadata: input.providerMetadata } : {}),
      updatedAt: now,
    };
    return this.current;
  }

  async markFailed(input: MarkFailedInput): Promise<ContentItem> {
    this.events.push("markFailed");
    if (!this.current) throw new Error("content item not found");
    this.current = {
      ...this.current,
      status: "FAILED",
      failureMetadata: input.failureMetadata,
      updatedAt: now,
    };
    return this.current;
  }
}

class SuccessfulProvider implements TextGenerationProvider {
  readonly name = "test-provider";
  requests: TextGenerationRequest[] = [];

  async validateConfiguration(): Promise<void> {}

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    this.requests.push(request);
    return {
      text: "A factual railway safety training script.",
      provider: "test-provider",
      model: "test-model-v1",
      metadata: { generatedAt: now },
    };
  }
}

class FailingProvider implements TextGenerationProvider {
  readonly name = "failing-provider";

  async validateConfiguration(): Promise<void> {}

  async generate(): Promise<TextGenerationResult> {
    throw new Error("secret-provider-detail: sk-example");
  }
}

const request = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  topic: "Railway safety training",
  knowledgeContext: "Use PAK workshop and competence-centre positioning.",
  language: "EN" as const,
};

describe("generateContentScript", () => {
  it("persists DRAFT -> GENERATING -> GENERATED with normalized provider metadata", async () => {
    const repository = new InMemoryRepository();
    const provider = new SuccessfulProvider();

    const result = await generateContentScript(request, {
      repository,
      provider,
      actorUserId: "33333333-3333-4333-8333-333333333333",
    });

    expect(repository.events).toEqual(["createDraft", "markGenerating", "markGenerated"]);
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]?.idempotencyKey).toBe(
      "content:22222222-2222-4222-8222-222222222222:script:v1",
    );
    expect(provider.requests[0]?.systemInstructions).toContain("clear, factual, professional");
    expect(result.status).toBe("GENERATED");
    expect(result.generatedScript).toBe("A factual railway safety training script.");
    expect(result.provider).toBe("test-provider");
    expect(result.providerModel).toBe("test-model-v1");
    expect(result.providerMetadata).toEqual({ generatedAt: now });
  });

  it("persists FAILED with sanitized metadata when provider generation throws", async () => {
    const repository = new InMemoryRepository();

    await expect(
      generateContentScript(request, {
        repository,
        provider: new FailingProvider(),
        actorUserId: "33333333-3333-4333-8333-333333333333",
      }),
    ).rejects.toThrow("Content generation failed.");

    expect(repository.events).toEqual(["createDraft", "markGenerating", "markFailed"]);
    expect(repository.current?.status).toBe("FAILED");
    expect(repository.current?.failureMetadata).toEqual({
      code: "GENERATION_FAILED",
      message: "Content generation failed.",
    });
    expect(JSON.stringify(repository.current?.failureMetadata)).not.toContain("sk-example");
  });
});
