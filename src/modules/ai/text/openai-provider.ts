import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { invokeContentGeneration } from "@/modules/integrations/edge-client";
import type { TextGenerationProvider } from "./provider";
import type { TextGenerationRequest, TextGenerationResult } from "./types";

export interface OpenAIResponsesTransport {
  create(input: {
    model?: string;
    instructions: string;
    input: string;
  }): Promise<{ output_text?: string | null; model?: string | null }>;
}

type OpenAITextGenerationProviderOptions = {
  transport?: OpenAIResponsesTransport;
  model?: string;
  organizationId?: string;
  edgeTransportFactory?: (organizationId: string) => OpenAIResponsesTransport;
};

type EdgeGenerationResponse = {
  output_text?: string | null;
  model?: string | null;
};

function createEdgeTransport(organizationId: string): OpenAIResponsesTransport {
  return {
    create: (input) => invokeContentGeneration<EdgeGenerationResponse>({
      organizationId,
      ...(input.model ? { model: input.model } : {}),
      instructions: input.instructions,
      input: input.input,
    }),
  };
}

export class OpenAITextGenerationProvider implements TextGenerationProvider {
  readonly name = "openai";
  private readonly directTransport: OpenAIResponsesTransport | undefined;
  private readonly modelOverride: string | undefined;
  private readonly organizationId: string | undefined;
  private readonly edgeTransportFactory: (organizationId: string) => OpenAIResponsesTransport;

  constructor(options: OpenAITextGenerationProviderOptions = {}) {
    this.directTransport = options.transport;
    this.modelOverride = options.model;
    this.organizationId = options.organizationId;
    this.edgeTransportFactory = options.edgeTransportFactory ?? createEdgeTransport;
  }

  private resolveRuntime(): { transport: OpenAIResponsesTransport; model?: string } {
    if (this.directTransport) {
      return {
        transport: this.directTransport,
        model: this.modelOverride ?? "gpt-5.6-luna",
      };
    }

    if (!this.organizationId) {
      throw new AppError("INTERNAL_ERROR", "OpenAI organization context is unavailable.");
    }

    return {
      transport: this.edgeTransportFactory(this.organizationId),
      ...(this.modelOverride ? { model: this.modelOverride } : {}),
    };
  }

  async validateConfiguration(): Promise<void> {
    this.resolveRuntime();
  }

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    try {
      const runtime = this.resolveRuntime();
      const response = await runtime.transport.create({
        ...(runtime.model ? { model: runtime.model } : {}),
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
        model: response.model?.trim() || runtime.model || "gpt-5.6-luna",
      };
    } catch (error) {
      if (error instanceof AppError && error.code === "PROVIDER_ERROR") {
        throw error;
      }

      throw new AppError("PROVIDER_ERROR", "Text generation is temporarily unavailable.");
    }
  }
}
