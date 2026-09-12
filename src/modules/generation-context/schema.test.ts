import { describe, expect, it } from "vitest";

import { organizationGenerationContextRequestSchema } from "./types";

const organizationId = "11111111-1111-4111-8111-111111111111";
const first = "22222222-2222-4222-8222-222222222222";
const second = "33333333-3333-4333-8333-333333333333";

describe("organizationGenerationContextRequestSchema", () => {
  it("accepts organization identity plus bounded selected Knowledge IDs and task context", () => {
    expect(organizationGenerationContextRequestSchema.parse({
      organizationId,
      selectedKnowledgeRecordIds: [first, second],
      additionalContext: "Focus on official railway training programmes.",
    })).toEqual({
      organizationId,
      selectedKnowledgeRecordIds: [first, second],
      additionalContext: "Focus on official railway training programmes.",
    });
  });

  it("rejects duplicate Knowledge IDs and oversized task context", () => {
    expect(() => organizationGenerationContextRequestSchema.parse({
      organizationId,
      selectedKnowledgeRecordIds: [first, first],
    })).toThrow();
    expect(() => organizationGenerationContextRequestSchema.parse({
      organizationId,
      additionalContext: "x".repeat(12001),
    })).toThrow();
  });

  it("rejects browser-supplied trusted profile/brand/knowledge bodies", () => {
    expect(() => organizationGenerationContextRequestSchema.parse({
      organizationId,
      profile: { officialName: "Fake" },
    })).toThrow();
    expect(() => organizationGenerationContextRequestSchema.parse({
      organizationId,
      brandKit: { primaryColor: "#000000" },
    })).toThrow();
    expect(() => organizationGenerationContextRequestSchema.parse({
      organizationId,
      coreKnowledge: [{ content: "browser supplied" }],
    })).toThrow();
  });
});
