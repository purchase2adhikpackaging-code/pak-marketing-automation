import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors/app-error";
import { OpenAITextGenerationProvider, type OpenAIResponsesTransport } from "./openai-provider";

const request = {
  topic: "Railway safety training",
  knowledgeContext: "Use PAK workshop context.",
  language: "EN" as const,
  systemInstructions: "Write a concise training script.",
  idempotencyKey: "content:123:script:v1",
};

describe("OpenAITextGenerationProvider", () => {
  it("maps non-empty output text into the provider-neutral result", async () => {
    const transport: OpenAIResponsesTransport = {
      create: async () => ({ output_text: "Generated railway safety script." }),
    };
    const provider = new OpenAITextGenerationProvider({ transport, model: "gpt-test" });

    await expect(provider.generate(request)).resolves.toEqual({
      text: "Generated railway safety script.",
      provider: "openai",
      model: "gpt-test",
    });
  });

  it("rejects empty provider output", async () => {
    const transport: OpenAIResponsesTransport = {
      create: async () => ({ output_text: "   " }),
    };
    const provider = new OpenAITextGenerationProvider({ transport, model: "gpt-test" });

    await expect(provider.generate(request)).rejects.toMatchObject({
      name: "AppError",
      code: "PROVIDER_ERROR",
    });
  });

  it("normalizes transport errors without leaking provider details", async () => {
    const transport: OpenAIResponsesTransport = {
      create: async () => {
        throw new Error("rate limit api-key-sk-secret");
      },
    };
    const provider = new OpenAITextGenerationProvider({ transport, model: "gpt-test" });

    try {
      await provider.generate(request);
      throw new Error("expected generate to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: "PROVIDER_ERROR",
        message: "Text generation is temporarily unavailable.",
      });
      expect(String(error)).not.toContain("api-key-sk-secret");
    }
  });
});
