import { describe, expect, it } from "vitest";
import { contentGenerationRequestSchema } from "./schema";

describe("contentGenerationRequestSchema", () => {
  const base = {
    organizationId: "11111111-1111-4111-8111-111111111111",
    topic: "Railway safety training",
    knowledgeContext: "Use PAK workshop and competence-centre positioning.",
  };

  it.each(["EN", "PL", "HI"] as const)("accepts %s", (language) => {
    expect(contentGenerationRequestSchema.parse({ ...base, language }).language).toBe(language);
  });

  it("accepts unique Knowledge Base record IDs", () => {
    const parsed = contentGenerationRequestSchema.parse({
      ...base,
      language: "EN",
      knowledgeRecordIds: [
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      ],
    });

    expect(parsed.knowledgeRecordIds).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ]);
  });

  it("rejects duplicate Knowledge Base record IDs", () => {
    expect(() =>
      contentGenerationRequestSchema.parse({
        ...base,
        language: "EN",
        knowledgeRecordIds: [
          "22222222-2222-4222-8222-222222222222",
          "22222222-2222-4222-8222-222222222222",
        ],
      }),
    ).toThrow();
  });

  it("rejects more than 20 Knowledge Base record IDs", () => {
    const ids = Array.from(
      { length: 21 },
      (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    );

    expect(() =>
      contentGenerationRequestSchema.parse({ ...base, language: "EN", knowledgeRecordIds: ids }),
    ).toThrow();
  });

  it("rejects invalid Knowledge Base record IDs", () => {
    expect(() =>
      contentGenerationRequestSchema.parse({ ...base, language: "EN", knowledgeRecordIds: ["not-a-uuid"] }),
    ).toThrow();
  });

  it("rejects short topics", () => {
    expect(() =>
      contentGenerationRequestSchema.parse({ ...base, topic: "ab", language: "EN" }),
    ).toThrow();
  });

  it("rejects oversized context", () => {
    expect(() =>
      contentGenerationRequestSchema.parse({
        ...base,
        knowledgeContext: "x".repeat(12001),
        language: "EN",
      }),
    ).toThrow();
  });

  it("rejects unsupported language", () => {
    expect(() => contentGenerationRequestSchema.parse({ ...base, language: "DE" })).toThrow();
  });
});
