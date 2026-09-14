import { describe, expect, it } from "vitest";

import {
  researchCandidateInputSchema,
  researchSearchInputSchema,
} from "./schema";
import {
  MAX_RESEARCH_QUERY_CHARS,
  MAX_RESEARCH_RESULTS,
  MAX_RESEARCH_TITLE_CHARS,
  MAX_RESEARCH_URL_CHARS,
  MAX_RESEARCH_HOST_CHARS,
  MAX_RESEARCH_EXCERPT_CHARS,
  RESEARCH_PROVIDER_TIMEOUT_MS,
} from "./types";

const organizationId = "11111111-1111-4111-8111-111111111111";
const candidateId = "22222222-2222-4222-8222-222222222222";

describe("knowledge research contracts", () => {
  it("keeps the approved hard bounds stable", () => {
    expect(MAX_RESEARCH_QUERY_CHARS).toBe(300);
    expect(MAX_RESEARCH_RESULTS).toBe(8);
    expect(MAX_RESEARCH_TITLE_CHARS).toBe(500);
    expect(MAX_RESEARCH_URL_CHARS).toBe(2048);
    expect(MAX_RESEARCH_HOST_CHARS).toBe(255);
    expect(MAX_RESEARCH_EXCERPT_CHARS).toBe(4000);
    expect(RESEARCH_PROVIDER_TIMEOUT_MS).toBe(12_000);
  });

  it("accepts only organizationId plus a bounded research query", () => {
    const input = { organizationId, query: "Poland railway recruitment trends 2026" };

    expect(researchSearchInputSchema.parse(input)).toEqual(input);
    expect(researchSearchInputSchema.safeParse({ organizationId, query: "ab" }).success).toBe(false);
    expect(
      researchSearchInputSchema.safeParse({
        organizationId,
        query: "x".repeat(MAX_RESEARCH_QUERY_CHARS + 1),
      }).success,
    ).toBe(false);
  });

  it.each([
    ["provider", "EXA_MCP"],
    ["apiKey", "secret"],
    ["sourceUrl", "https://example.com"],
    ["excerpt", "provider supplied text"],
    ["status", "COMPLETED"],
    ["knowledgeStatus", "ACTIVE"],
  ])("rejects browser-authoritative search field %s", (field, value) => {
    expect(
      researchSearchInputSchema.safeParse({
        organizationId,
        query: "safe public research topic",
        [field]: value,
      }).success,
    ).toBe(false);
  });

  it("accepts only organizationId plus candidateId for candidate actions", () => {
    const input = { organizationId, candidateId };

    expect(researchCandidateInputSchema.parse(input)).toEqual(input);
  });

  it.each([
    ["provider", "EXA_MCP"],
    ["apiKey", "secret"],
    ["sourceUrl", "https://attacker.example"],
    ["excerpt", "forged source text"],
    ["status", "CONVERTED"],
    ["knowledgeStatus", "ACTIVE"],
  ])("rejects browser-authoritative candidate field %s", (field, value) => {
    expect(
      researchCandidateInputSchema.safeParse({
        organizationId,
        candidateId,
        [field]: value,
      }).success,
    ).toBe(false);
  });
});
