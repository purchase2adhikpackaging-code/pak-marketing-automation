import "server-only";

import OpenAI from "openai";

import { AppError } from "@/lib/errors/app-error";
import { getServerEnv } from "@/lib/env/server";
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
};

export class OpenAITextGenerationProvider implements TextGenerationProvider {
  readonly name = "openai";
  private readonly transport: OpenAIResponsesTransport;
  private readonly model: string;

  constructor(options: OpenAITextGenerationProviderOptions = {}) {
    if (options.transport) {
      this.model = options.model ?? "gpt-5.6-luna";
      this.transport = options.transport;
      return;
    }

    const env = getServerEnv();
    this.model = options.model ?? env.OPENAI_TEXT_MODEL ?? "gpt-5.6-luna";
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.transport = {
      create: async (input) => {
        const response = await client.responses.create(input);
        return { output_text: response.output_text };
      },
    };
  }

  async validateConfiguration(): Promise<void> {
    if (this.transport) {
      return;
    }
  }

  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    try {
      const response = await this.transport.create({
        model: this.model,
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
        model: this.model,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("PROVIDER_ERROR", "Text generation is temporarily unavailable.");
    }
  }
}
