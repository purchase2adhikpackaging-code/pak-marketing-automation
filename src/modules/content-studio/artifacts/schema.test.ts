import { describe, expect, it } from "vitest";

import { generateTranslationRequestSchema, regenerateSourceRequestSchema } from "./schema";

const organizationId = "11111111-1111-4111-8111-111111111111";
const contentItemId = "22222222-2222-4222-8222-222222222222";

describe("multilingual script artifact request schemas", () => {
  it.each(["EN", "PL", "HI"] as const)("accepts %s as a translation target", (targetLanguage) => {
    const parsed = generateTranslationRequestSchema.parse({
      organizationId,
      contentItemId,
      targetLanguage,
    });

    expect(parsed.targetLanguage).toBe(targetLanguage);
  });

  it("rejects unsupported translation languages", () => {
    expect(() =>
      generateTranslationRequestSchema.parse({
        organizationId,
        contentItemId,
        targetLanguage: "DE",
      }),
    ).toThrow();
  });

  it("rejects invalid organization and content item identifiers", () => {
    expect(() =>
      generateTranslationRequestSchema.parse({
        organizationId: "not-a-uuid",
        contentItemId,
        targetLanguage: "EN",
      }),
    ).toThrow();

    expect(() =>
      regenerateSourceRequestSchema.parse({
        organizationId,
        contentItemId: "not-a-uuid",
      }),
    ).toThrow();
  });

  it("accepts valid source regeneration identifiers", () => {
    expect(
      regenerateSourceRequestSchema.parse({
        organizationId,
        contentItemId,
      }),
    ).toEqual({ organizationId, contentItemId });
  });
});
