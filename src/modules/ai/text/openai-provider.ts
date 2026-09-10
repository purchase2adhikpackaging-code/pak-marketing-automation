import "server-only";

import OpenAI from "openai";

import { AppError } from "@/lib/errors/app-error";
import { createIntegrationVaultService } from "@/modules/integrations/service";
import type { IntegrationCredentialResolver } from "@/modules/integrations/types";
import type { TextGenerationProvider } from "./provider";
import type { TextGenerationRequest, TextGenerationResult } from "./types";

export interface OpenAIResponsesTransport {
  create(input: {
    model: string;
    instructions: string;
    input: string;
  }): Promise<{ output_text?: string | null }>;
}

type OpenAITextGenerationProviderOptions = {
  transport?: OpenAIResponsesTransport;
  model?: string;
  organizationId?: string;
  credentialResolver?: IntegrationCredentialResolver;
  transportFactory?: (apiKey: string) => OpenAIResponsesTransport;
};

type OpenAIProviderConfig = {
  defaultModel?: string;
};

function createOpenAITransport(apiKey: string): OpenAIResponsesTransport {
  const client = new OpenAI({ apiKey });
  return {
    create: async (input) => {
      const response = await client.responses.create(input);
      return { output_text: response.output_text };
    },
  };
}

export class OpenAITextGenerationProvider implements TextGenerationProvider {
  readonly name = "openai";
  private readonly directTransport: OpenAIResponsesTransport | undefined;
  private readonly modelOverride: string | undefined;
  private readonly organizationId: string | undefined;
  private readonly credentialResolver: IntegrationCredentialResolver | undefined;
  private readonly transportFactory: (apiKey: string) => OpenAIResponsesTransport;

  constructor(options: OpenAITextGenerationProviderOptions = {}) {
    this.directTransport = options.transport;
    this.modelOverride = options.model;
    this.organizationId = options.organizationId;
    this.credentialResolver = options.credentialResolver;
    this.transportFactory = options.transportFactory ?? createOpenAITransport;
  }

  private async resolveRuntime(): Promise<{ transport: OpenAIResponsesTransport; model: string }> {
    if (this.directTransport) {
      return {
        transport: this.directTransport,
        model: this.modelOverride ?? "gpt-5.6-luna",
      };
    }

    if (!this.organizationId) {
      throw new AppError("INTERNAL_ERROR", "OpenAI organization context is unavailable.");
    }

    const resolver = this.credentialResolver ?? createIntegrationVaultService();
    const [apiKey, config] = await Promise.all([
      resolver.getSecret(this.organizationId, "OPENAI", "API_KEY"),
      resolver.getProviderConfig<OpenAIProviderConfig>(this.organizationId, "OPENAI"),
    ]);
    const configuredModel = config.defaultModel?.trim();

    return {
      transport: this.transportFactory(apiKey),
      model: this.modelOverride ?? configuredModel ?? "gpt-5.6-luna",
    };
  }

  async validateConfiguration(): Promise<void> {
    await this.resolveRuntime();
  }

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    try {
      const runtime = await this.resolveRuntime();
      const response = await runtime.transport.create({
        model: runtime.model,
        instructions: request.systemInstructions,
        input: [
          `Target language: ${request.language}`,
          `Topic: ${request.topic}`,
          request.knowledgeContext ? `Knowledge context:\n${request.knowledgeContext}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      });

      const text = response.output_text?.trim();
      if (!text) {
        throw new AppError("PROVIDER_ERROR", "Text generation returned no usable content.");
      }

      return {
        text,
        provider: this.name,
        model: runtime.model,
      };
    } catch (error) {
      if (error instanceof AppError && error.code === "PROVIDER_ERROR") {
        throw error;
      }

      throw new AppError("PROVIDER_ERROR", "Text generation is temporarily unavailable.");
    }
  }
}
