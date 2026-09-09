import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors/app-error";
import { resolveKnowledgeGrounding } from "./grounding-service";
import type { KnowledgeRecord } from "./types";

const orgId = "11111111-1111-4111-8111-111111111111";
const firstId = "22222222-2222-4222-8222-222222222222";
const secondId = "33333333-3333-4333-8333-333333333333";
const now = "2026-09-09T00:00:00.000Z";

function record(id: string, overrides: Partial<KnowledgeRecord> = {}): KnowledgeRecord {
  return {
    id,
    organizationId: orgId,
    title: id === firstId ? "Safety standard" : "Workshop capabilities",
    content: id === firstId ? "Use approved railway safety procedures." : "PAK operates practical workshop training.",
    status: "ACTIVE",
    sourceType: "MANUAL",
    revision: id === firstId ? 4 : 2,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("resolveKnowledgeGrounding", () => {
  it("returns no grounding context when no sources or additional context are supplied", async () => {
    const result = await resolveKnowledgeGrounding(
      { organizationId: orgId },
      { getByIds: async () => [] },
    );

    expect(result).toEqual({ sources: [] });
  });

  it("preserves submitted source order even when repository order differs", async () => {
    const first = record(firstId);
    const second = record(secondId);

    const result = await resolveKnowledgeGrounding(
      { organizationId: orgId, knowledgeRecordIds: [firstId, secondId] },
      { getByIds: async () => [second, first] },
    );

    expect(result.sources.map((source) => source.record.id)).toEqual([firstId, secondId]);
    expect(result.knowledgeContext).toBe(
      "[Knowledge Source 1: Safety standard]\nUse approved railway safety procedures.\n\n" +
        "[Knowledge Source 2: Workshop capabilities]\nPAK operates practical workshop training.",
    );
  });

  it.each(["DRAFT", "ARCHIVED"] as const)("rejects %s records", async (status) => {
    await expect(
      resolveKnowledgeGrounding(
        { organizationId: orgId, knowledgeRecordIds: [firstId] },
        { getByIds: async () => [record(firstId, { status })] },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects missing or cross-organization selections represented by incomplete resolution", async () => {
    await expect(
      resolveKnowledgeGrounding(
        { organizationId: orgId, knowledgeRecordIds: [firstId, secondId] },
        { getByIds: async () => [record(firstId)] },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("labels additional user-provided context after approved sources", async () => {
    const result = await resolveKnowledgeGrounding(
      {
        organizationId: orgId,
        knowledgeRecordIds: [firstId],
        additionalContext: "Use a concise tone for recruitment managers.",
      },
      { getByIds: async () => [record(firstId)] },
    );

    expect(result.knowledgeContext).toContain("[Knowledge Source 1: Safety standard]");
    expect(result.knowledgeContext).toContain(
      "[Additional user-provided context]\nUse a concise tone for recruitment managers.",
    );
  });

  it("captures exact generation-time snapshot values", async () => {
    const source = record(firstId, {
      sourceType: "DOCUMENT",
      sourceLabel: "PAK Safety Manual",
      sourceReference: "Section 4.2",
      revision: 7,
    });

    const result = await resolveKnowledgeGrounding(
      { organizationId: orgId, knowledgeRecordIds: [firstId] },
      { getByIds: async () => [source] },
    );

    expect(result.sources[0]?.snapshot).toEqual({
      knowledgeRecordId: firstId,
      knowledgeRevision: 7,
      titleSnapshot: source.title,
      contentSnapshot: source.content,
      sourceTypeSnapshot: "DOCUMENT",
      sourceLabelSnapshot: "PAK Safety Manual",
      sourceReferenceSnapshot: "Section 4.2",
    });
  });

  it("normalizes repository failures without leaking raw details", async () => {
    let caught: unknown;
    try {
      await resolveKnowledgeGrounding(
        { organizationId: orgId, knowledgeRecordIds: [firstId] },
        {
          getByIds: async () => {
            throw new Error("database password sk-secret-do-not-leak");
          },
        },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).message).not.toContain("sk-secret-do-not-leak");
  });
});
