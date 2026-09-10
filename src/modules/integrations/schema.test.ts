import { describe, expect, it } from "vitest";

import {
  saveIntegrationSecretSchema,
  updateIntegrationConfigSchema,
} from "./schema";

describe("integration schemas", () => {
  it("accepts an organization-scoped OpenAI API key mutation", () => {
    expect(
      saveIntegrationSecretSchema.parse({
        organizationId: "11111111-1111-4111-8111-111111111111",
        provider: "OPENAI",
        secretName: "API_KEY",
        secretValue: "sk-test-example-value",
      }),
    ).toMatchObject({ provider: "OPENAI", secretName: "API_KEY" });
  });

  it("rejects unknown providers and unsafe secret names", () => {
    expect(() =>
      saveIntegrationSecretSchema.parse({
        organizationId: "11111111-1111-4111-8111-111111111111",
        provider: "UNKNOWN",
        secretName: "api key",
        secretValue: "secret",
      }),
    ).toThrow();
  });

  it("accepts OpenAI non-secret model configuration", () => {
    expect(
      updateIntegrationConfigSchema.parse({
        organizationId: "11111111-1111-4111-8111-111111111111",
        provider: "OPENAI",
        config: { defaultModel: "gpt-5.6-luna" },
      }),
    ).toMatchObject({ config: { defaultModel: "gpt-5.6-luna" } });
  });
});
