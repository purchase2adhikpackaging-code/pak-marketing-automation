import "server-only";

import { AppError } from "@/lib/errors/app-error";
import type { TextGenerationProvider } from "@/modules/ai/text/provider";
import type { ContentGenerationRequest } from "./schema";
import type { ContentItemRepository } from "./repository";
import type { ContentItem } from "./types";

export type ContentStudioDependencies = {
  repository: ContentItemRepository;
  provider: TextGenerationProvider;
  actorUserId: string;
};

function buildSystemInstructions(language: ContentGenerationRequest["language"]): string {
  return [
    "Write a clear, factual, professional script for PAK Marketing Automation.",
    "Use only the supplied topic and knowledge context as grounding information.",
    "Do not invent unsupported facts, statistics, claims, certifications, or guarantees.",
    `Write the complete script in the requested language code: ${language}.`,
    "Structure the script so it is easy to review and later adapt into scene-based video content.",
  ].join(" ");
}

export async function generateContentScript(
  request: ContentGenerationRequest,
  dependencies: ContentStudioDependencies,
): Promise<ContentItem> {
  const draft = await dependencies.repository.createDraft({
    organizationId: request.organizationId,
    topic: request.topic,
    ...(request.knowledgeContext ? { knowledgeContext: request.knowledgeContext } : {}),
    language: request.language,
    createdBy: dependencies.actorUserId,
  });

  await dependencies.repository.markGenerating(draft.id, request.organizationId);

  try {
    const generated = await dependencies.provider.generate({
      topic: request.topic,
      ...(request.knowledgeContext ? { knowledgeContext: request.knowledgeContext } : {}),
      language: request.language,
      systemInstructions: buildSystemInstructions(request.language),
      idempotencyKey: `content:${draft.id}:script:v1`,
    });

    return dependencies.repository.markGenerated({
      id: draft.id,
      organizationId: request.organizationId,
      generatedScript: generated.text,
      provider: generated.provider,
      providerModel: generated.model,
      ...(generated.metadata ? { providerMetadata: generated.metadata } : {}),
    });
  } catch {
    await dependencies.repository.markFailed({
      id: draft.id,
      organizationId: request.organizationId,
      failureMetadata: {
        code: "GENERATION_FAILED",
        message: "Content generation failed.",
      },
    });

    throw new AppError("PROVIDER_ERROR", "Content generation failed.");
  }
}
