import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors/app-error";
import type { TextGenerationProvider } from "@/modules/ai/text/provider";
import type { TextGenerationRequest } from "@/modules/ai/text/types";
import type { ContentItemRepository } from "../repository";
import type { ContentItem } from "../types";
import type { CompleteArtifactGenerationInput, ScriptArtifactRepository, StartArtifactGenerationInput } from "./repository";
import { regenerateSourceArtifact } from "./source-service";
import type { ScriptArtifact } from "./types";

const now = "2026-09-09T00:00:00.000Z";

function sourceArtifact(overrides: Partial<ScriptArtifact> = {}): ScriptArtifact {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    organizationId: "22222222-2222-4222-8222-222222222222",
    contentItemId: "33333333-3333-4333-8333-333333333333",
    language: "EN",
    isSource: true,
    status: "GENERATED",
    scriptText: "Existing canonical PAK script.",
    revision: 3,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function contentItem(): ContentItem {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    organizationId: "22222222-2222-4222-8222-222222222222",
    topic: "Railway safety training",
    knowledgeContext: "Use approved PAK workshop context only.",
    language: "EN",
    status: "GENERATED",
    generatedScript: "Existing canonical PAK script.",
    createdAt: now,
    updatedAt: now,
  };
}

class FakeArtifactRepository implements ScriptArtifactRepository {
  source: ScriptArtifact | null = sourceArtifact();
  started: StartArtifactGenerationInput[] = [];
  completed: CompleteArtifactGenerationInput[] = [];
  failed: Array<{ id: string; organizationId: string; expectedRevision: number; metadata: Record<string, unknown> }> = [];
  staleCalls: Array<{ organizationId: string; contentItemId: string; revision: number }> = [];
  conflictOnComplete = false;

  async listForContent() { return this.source ? [this.source] : []; }
  async getSource() { return this.source; }
  async getByLanguage() { return this.source; }
  async ensureSourceFromLegacy() {
    if (!this.source) throw new AppError("NOT_FOUND", "Canonical source script is unavailable.");
    return this.source;
  }
  async ensureTarget() { throw new Error("not used"); }
  async startGeneration(input: StartArtifactGenerationInput) {
    this.started.push(input);
    if (!this.source) throw new AppError("NOT_FOUND", "Canonical source script is unavailable.");
    this.source = { ...this.source, status: "GENERATING" };
    return this.source;
  }
  async completeGeneration(input: CompleteArtifactGenerationInput) {
    this.completed.push(input);
    if (this.conflictOnComplete) throw new AppError("CONFLICT", "stale source completion");
    if (!this.source) throw new AppError("NOT_FOUND", "Canonical source script is unavailable.");
    this.source = {
      ...this.source,
      status: "GENERATED",
      scriptText: input.scriptText,
      revision: input.expectedRevision + 1,
      provider: input.provider,
      providerModel: input.providerModel,
    };
    return this.source;
  }
  async failGeneration(id: string, organizationId: string, expectedRevision: number, metadata: Record<string, unknown>) {
    this.failed.push({ id, organizationId, expectedRevision, metadata });
    if (!this.source) throw new AppError("NOT_FOUND", "Canonical source script is unavailable.");
    this.source = { ...this.source, status: "FAILED", failureMetadata: metadata };
    return this.source;
  }
  async markTranslationsStale(organizationId: string, contentItemId: string, revision: number) {
    this.staleCalls.push({ organizationId, contentItemId, revision });
  }
}

class FakeContentRepository implements ContentItemRepository {
  item: ContentItem | null = contentItem();

  async getById(id: string, organizationId: string) {
    return this.item?.id === id && this.item.organizationId === organizationId ? this.item : null;
  }
  async createDraft() { throw new Error("not used"); }
  async markGenerating() {}
  async markGenerated() { throw new Error("not used"); }
  async markFailed() { throw new Error("not used"); }
}

class FakeProvider implements TextGenerationProvider {
  readonly name = "fake";
  requests: TextGenerationRequest[] = [];
  failWith?: Error;

  async validateConfiguration() {}
  async generate(request: TextGenerationRequest) {
    this.requests.push(request);
    if (this.failWith) throw this.failWith;
    return { text: "Regenerated canonical PAK script.", provider: "fake", model: "deterministic-v1" };
  }
}

function request() {
  return {
    organizationId: "22222222-2222-4222-8222-222222222222",
    contentItemId: "33333333-3333-4333-8333-333333333333",
  };
}

describe("regenerateSourceArtifact", () => {
  it("resolves source and parent server-side and preserves previous text while generation starts", async () => {
    const artifacts = new FakeArtifactRepository();
    const content = new FakeContentRepository();
    const provider = new FakeProvider();

    const pending = regenerateSourceArtifact(request(), {
      artifactRepository: artifacts,
      contentRepository: content,
      provider,
      actorUserId: "actor",
    });

    const result = await pending;

    expect(artifacts.started).toEqual([{
      id: "11111111-1111-4111-8111-111111111111",
      organizationId: request().organizationId,
      expectedRevision: 3,
    }]);
    expect(provider.requests[0]).toMatchObject({
      topic: "Railway safety training",
      knowledgeContext: "Use approved PAK workshop context only.",
      language: "EN",
      idempotencyKey: "content:33333333-3333-4333-8333-333333333333:source:EN:revision:3",
    });
    expect(result.scriptText).toBe("Regenerated canonical PAK script.");
  });

  it("increments the source revision and stales translations only after successful completion", async () => {
    const artifacts = new FakeArtifactRepository();

    const result = await regenerateSourceArtifact(request(), {
      artifactRepository: artifacts,
      contentRepository: new FakeContentRepository(),
      provider: new FakeProvider(),
      actorUserId: "actor",
    });

    expect(result.revision).toBe(4);
    expect(result.sourceRevision).toBeUndefined();
    expect(artifacts.staleCalls).toEqual([{
      organizationId: request().organizationId,
      contentItemId: request().contentItemId,
      revision: 4,
    }]);
  });

  it("records sanitized failure, preserves previous source text, and does not stale translations", async () => {
    const artifacts = new FakeArtifactRepository();
    const provider = new FakeProvider();
    provider.failWith = new Error("provider failure sk-secret-do-not-leak");

    await expect(regenerateSourceArtifact(request(), {
      artifactRepository: artifacts,
      contentRepository: new FakeContentRepository(),
      provider,
      actorUserId: "actor",
    })).rejects.toMatchObject({ code: "PROVIDER_ERROR" });

    expect(artifacts.source?.scriptText).toBe("Existing canonical PAK script.");
    expect(artifacts.source?.status).toBe("FAILED");
    expect(JSON.stringify(artifacts.failed)).not.toContain("sk-secret-do-not-leak");
    expect(artifacts.staleCalls).toEqual([]);
  });

  it("does not stale translations when source completion loses a concurrency race", async () => {
    const artifacts = new FakeArtifactRepository();
    artifacts.conflictOnComplete = true;

    await expect(regenerateSourceArtifact(request(), {
      artifactRepository: artifacts,
      contentRepository: new FakeContentRepository(),
      provider: new FakeProvider(),
      actorUserId: "actor",
    })).rejects.toMatchObject({ code: "CONFLICT" });

    expect(artifacts.staleCalls).toEqual([]);
  });
});
