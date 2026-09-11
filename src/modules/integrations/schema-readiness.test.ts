import { describe, expect, it } from "vitest";

import { updateIntegrationConfigSchema } from "./schema";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("OpenAI integration model configuration", () => {
  it("accepts only models supported by the production generation allowlist", () => {
    expect(
      updateIntegrationConfigSchema.safeParse({
        organizationId,
        provider: "OPENAI",
        config: { defaultModel: "gpt-5.6-terra" },
      }).success,
    ).toBe(true);

    expect(
      updateIntegrationConfigSchema.safeParse({
        organizationId,
        provider: "OPENAI",
        config: { defaultModel: "gpt-5.6-sol" },
      }).success,
    ).toBe(false);
  });

  it("rejects secret-bearing configuration keys before the Edge Vault boundary", () => {
    expect(
      updateIntegrationConfigSchema.safeParse({
        organizationId,
        provider: "OPENAI",
        config: { apiKey: "sk-must-not-be-config" },
      }).success,
    ).toBe(false);

    expect(
      updateIntegrationConfigSchema.safeParse({
        organizationId,
        provider: "OPENAI",
        config: { runtime: { private_key: "must-not-be-config" } },
      }).success,
    ).toBe(false);
  });
});
