import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors/app-error";
import { OpenAITextGenerationProvider, type OpenAIResponsesTransport } from "./openai-provider";

const request = {
  topic: "Railway safety training",
  knowledgeContext: "Use PAK workshop context.",
  language: "EN" as const,
  systemInstructions: "Write a concise training script.",
  idempotencyKey: "content:123:script:v1",
};

const organizationId = "11111111-1111-4111-8111-111111111111";

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

  it("uses an organization-scoped Edge transport without resolving a provider key in Next.js", async () => {
    const transport: OpenAIResponsesTransport = {
      create: vi.fn().mockResolvedValue({ output_text: "Vault-backed output.", model: "gpt-vault-model" }),
    };
    const edgeTransportFactory = vi.fn().mockReturnValue(transport);
    const provider = new OpenAITextGenerationProvider({
      organizationId,
      edgeTransportFactory,
    });

    await expect(provider.generate(request)).resolves.toEqual({
      text: "Vault-backed output.",
      provider: "openai",
      model: "gpt-vault-model",
    });
    expect(edgeTransportFactory).toHaveBeenCalledWith(organizationId);
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
