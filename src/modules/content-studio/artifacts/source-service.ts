import "server-only";

import { AppError } from "@/lib/errors/app-error";
import type { TextGenerationProvider } from "@/modules/ai/text/provider";
import type { ContentItemRepository } from "../repository";
import type { ScriptArtifactRepository } from "./repository";
import type { RegenerateSourceRequest, ScriptArtifact } from "./types";

export type SourceRegenerationDependencies = {
  artifactRepository: ScriptArtifactRepository;
  contentRepository: ContentItemRepository;
  provider: TextGenerationProvider;
  actorUserId: string;
};

function buildSourceInstructions(language: string): string {
  return [
    "Rewrite the canonical PAK Marketing Automation script using only the supplied topic and knowledge context.",
    "Preserve factual accuracy, names, figures, railway terminology, and PAK-specific terms.",
    "Do not add unsupported facts, certifications, guarantees, or marketing claims.",
    `Return only the complete script in ${language}.`,
  ].join(" ");
}

export async function regenerateSourceArtifact(
  request: RegenerateSourceRequest,
  dependencies: SourceRegenerationDependencies,
): Promise<ScriptArtifact> {
  const parent = await dependencies.contentRepository.getById(request.contentItemId, request.organizationId);
  if (!parent) {
    throw new AppError("NOT_FOUND", "Content item is unavailable.");
  }

  const existingSource = await dependencies.artifactRepository.getSource(request.organizationId, request.contentItemId);
  const source = existingSource ?? await dependencies.artifactRepository.ensureSourceFromLegacy(
    request.organizationId,
    request.contentItemId,
    dependencies.actorUserId,
  );

  if (!source.isSource || !source.scriptText?.trim()) {
    throw new AppError("CONFLICT", "Canonical source script is unavailable for regeneration.");
  }

  const started = await dependencies.artifactRepository.startGeneration({
    id: source.id,
    organizationId: request.organizationId,
    expectedRevision: source.revision,
  });

  let generated;
  try {
    generated = await dependencies.provider.generate({
      topic: parent.topic,
      ...(parent.knowledgeContext ? { knowledgeContext: parent.knowledgeContext } : {}),
      language: source.language,
      systemInstructions: buildSourceInstructions(source.language),
      idempotencyKey: `content:${request.contentItemId}:source:${source.language}:revision:${source.revision}`,
    });
  } catch {
    await dependencies.artifactRepository.failGeneration(
      started.id,
      request.organizationId,
      started.revision,
      {
        code: "SOURCE_PROVIDER_FAILED",
        message: "Canonical source regeneration failed.",
      },
    );

    throw new AppError("PROVIDER_ERROR", "Canonical source generation is temporarily unavailable.");
  }

  const completed = await dependencies.artifactRepository.completeGeneration({
    id: started.id,
    organizationId: request.organizationId,
    expectedRevision: started.revision,
    scriptText: generated.text,
    provider: generated.provider,
    providerModel: generated.model,
    ...(generated.metadata ? { providerMetadata: generated.metadata } : {}),
  });

  await dependencies.artifactRepository.markTranslationsStale(
    request.organizationId,
    request.contentItemId,
    completed.revision,
  );

  await dependencies.contentRepository.markGenerated({
    id: parent.id,
    organizationId: request.organizationId,
    generatedScript: completed.scriptText ?? generated.text,
    provider: completed.provider ?? generated.provider,
    providerModel: completed.providerModel ?? generated.model,
    ...(completed.providerMetadata ? { providerMetadata: completed.providerMetadata } : generated.metadata ? { providerMetadata: generated.metadata } : {}),
  });

  return completed;
}
