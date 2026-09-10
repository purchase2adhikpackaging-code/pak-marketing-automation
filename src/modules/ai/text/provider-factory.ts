import "server-only";

import { getServerEnv } from "@/lib/env/server";
import { FakeTextGenerationProvider } from "./fake-provider";
import { OpenAITextGenerationProvider, type OpenAIResponsesTransport } from "./openai-provider";
import type { TextGenerationProvider } from "./provider";

export type TextProviderFactoryOptions = {
  provider?: "fake" | "openai";
  model?: string;
  organizationId?: string;
  openAITransport?: OpenAIResponsesTransport;
  openAIEdgeTransportFactory?: (organizationId: string) => OpenAIResponsesTransport;
};

export function createTextGenerationProvider(
  options: TextProviderFactoryOptions = {},
): TextGenerationProvider {
  const providerName = options.provider ?? getServerEnv().AI_TEXT_PROVIDER;

  if (providerName === "fake") {
    return new FakeTextGenerationProvider();
  }

  return new OpenAITextGenerationProvider({
    ...(options.model ? { model: options.model } : {}),
    ...(options.organizationId ? { organizationId: options.organizationId } : {}),
    ...(options.openAITransport ? { transport: options.openAITransport } : {}),
    ...(options.openAIEdgeTransportFactory ? { edgeTransportFactory: options.openAIEdgeTransportFactory } : {}),
  });
}
