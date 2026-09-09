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
