import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors/app-error";
import type { TextGenerationProvider } from "@/modules/ai/text/provider";
import type { TextGenerationRequest } from "@/modules/ai/text/types";
import type { CompleteArtifactGenerationInput, ScriptArtifactRepository, StartArtifactGenerationInput } from "./repository";
import { generateTranslationArtifact } from "./translation-service";
import type { ScriptArtifact } from "./types";

const now = "2026-09-09T00:00:00.000Z";

function artifact(overrides: Partial<ScriptArtifact> = {}): ScriptArtifact {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    organizationId: "22222222-2222-4222-8222-222222222222",
    contentItemId: "33333333-3333-4333-8333-333333333333",
    language: "EN",
    isSource: true,
    status: "GENERATED",
    scriptText: "PAK railway safety training script.",
    revision: 3,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

class FakeRepository implements ScriptArtifactRepository {
  source: ScriptArtifact | null = artifact();
  target: ScriptArtifact = artifact({
    id: "44444444-4444-4444-8444-444444444444",
    language: "PL",
    isSource: false,
    status: "STALE",
    scriptText: "Old Polish script",
    revision: 5,
    sourceRevision: 2,
  });
  started: StartArtifactGenerationInput[] = [];
  completed: CompleteArtifactGenerationInput[] = [];
  failures: Array<{ id: string; organizationId: string; expectedRevision: number; metadata: Record<string, unknown> }> = [];
  conflictOnComplete = false;

  async listForContent() { return [this.source, this.target].filter(Boolean) as ScriptArtifact[]; }
  async getSource() { return this.source; }
  async getByLanguage(_organizationId: string, _contentItemId: string, language: "EN" | "PL" | "HI") {
    if (this.source?.language === language) return this.source;
    return this.target.language === language ? this.target : null;
  }
  async ensureSourceFromLegacy() {
    if (!this.source) throw new AppError("NOT_FOUND", "Canonical source script is unavailable.");
    return this.source;
  }
  async ensureTarget(_organizationId: string, _contentItemId: string, language: "EN" | "PL" | "HI") {
    if (language !== this.target.language) {
      const next = artifact({
        id: "55555555-5555-4555-8555-555555555555",
        language,
        isSource: false,
        status: "PENDING",
        revision: 1,
      });
      const { scriptText: _scriptText, sourceRevision: _sourceRevision, ...target } = next;
      this.target = target;
    }
    return this.target;
  }
  async startGeneration(input: StartArtifactGenerationInput) {
    this.started.push(input);
    this.target = { ...this.target, status: "GENERATING" };
    return this.target;
  }
  async completeGeneration(input: CompleteArtifactGenerationInput) {
    this.completed.push(input);
    if (this.conflictOnComplete) throw new AppError("CONFLICT", "stale completion");
    this.target = {
      ...this.target,
      status: "GENERATED",
      scriptText: input.scriptText,
      revision: input.expectedRevision + 1,
      ...(input.sourceRevision !== undefined ? { sourceRevision: input.sourceRevision } : {}),
      provider: input.provider,
      providerModel: input.providerModel,
    };
    return this.target;
  }
  async failGeneration(id: string, organizationId: string, expectedRevision: number, metadata: Record<string, unknown>) {
    this.failures.push({ id, organizationId, expectedRevision, metadata });
    this.target = { ...this.target, status: "FAILED", failureMetadata: metadata };
    return this.target;
  }
  async markTranslationsStale() {}
}

class FakeProvider implements TextGenerationProvider {
  readonly name = "fake";
  requests: TextGenerationRequest[] = [];
  failWith?: Error;

  async validateConfiguration() {}
  async generate(request: TextGenerationRequest) {
    this.requests.push(request);
    if (this.failWith) throw this.failWith;
    return { text: "Przetłumaczony skrypt PAK.", provider: "fake", model: "deterministic-v1" };
  }
}

function request() {
  return {
    organizationId: "22222222-2222-4222-8222-222222222222",
    contentItemId: "33333333-3333-4333-8333-333333333333",
    targetLanguage: "PL" as const,
  };
}

describe("generateTranslationArtifact", () => {
  it("rejects when the canonical source is unavailable", async () => {
    const repository = new FakeRepository();
    repository.source = null;

    await expect(
      generateTranslationArtifact(request(), { repository, provider: new FakeProvider(), actorUserId: "actor" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("requires a generated source with non-empty script text", async () => {
    const repository = new FakeRepository();
    repository.source = artifact({ status: "FAILED" });

    await expect(
      generateTranslationArtifact(request(), { repository, provider: new FakeProvider(), actorUserId: "actor" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects translating into the canonical source language", async () => {
    const repository = new FakeRepository();

    await expect(
      generateTranslationArtifact({ ...request(), targetLanguage: "EN" }, { repository, provider: new FakeProvider(), actorUserId: "actor" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("generates only the requested target and persists the source revision", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();

    const result = await generateTranslationArtifact(request(), { repository, provider, actorUserId: "actor" });

    expect(repository.started).toEqual([{ id: repository.target.id, organizationId: request().organizationId, expectedRevision: 5 }]);
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]?.language).toBe("PL");
    expect(provider.requests[0]?.idempotencyKey).toBe("content:33333333-3333-4333-8333-333333333333:translation:PL:source:3:target:5");
    expect(repository.completed[0]?.sourceRevision).toBe(3);
    expect(result.status).toBe("GENERATED");
    expect(result.revision).toBe(6);
  });

  it("persists a sanitized failure without leaking provider secrets", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();
    provider.failWith = new Error("rate limited sk-secret-do-not-leak");

    await expect(
      generateTranslationArtifact(request(), { repository, provider, actorUserId: "actor" }),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });

    expect(repository.failures).toHaveLength(1);
    expect(JSON.stringify(repository.failures[0])).not.toContain("sk-secret-do-not-leak");
  });

  it("surfaces compare-and-set conflicts instead of overwriting a newer translation", async () => {
    const repository = new FakeRepository();
    repository.conflictOnComplete = true;

    await expect(
      generateTranslationArtifact(request(), { repository, provider: new FakeProvider(), actorUserId: "actor" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
