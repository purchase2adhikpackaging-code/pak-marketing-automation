import { describe, expect, it } from "vitest";

import { FakeTextGenerationProvider } from "./fake-provider";
import { OpenAITextGenerationProvider } from "./openai-provider";
import { createTextGenerationProvider } from "./provider-factory";

const noopTransport = {
  async create() {
    return { output_text: "ok" };
  },
};

describe("createTextGenerationProvider", () => {
  it("returns the deterministic fake provider", () => {
    const provider = createTextGenerationProvider({ provider: "fake" });
    expect(provider).toBeInstanceOf(FakeTextGenerationProvider);
  });

  it("returns an OpenAI provider without network access when transport is injected", () => {
    const provider = createTextGenerationProvider({
      provider: "openai",
      model: "test-model",
      openAITransport: noopTransport,
    });

    expect(provider).toBeInstanceOf(OpenAITextGenerationProvider);
    expect(provider.name).toBe("openai");
  });
});
