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
});
