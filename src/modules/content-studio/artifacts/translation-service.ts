import "server-only";

import { AppError } from "@/lib/errors/app-error";
import type { TextGenerationProvider } from "@/modules/ai/text/provider";
import type { ScriptArtifactRepository } from "./repository";
import type { GenerateTranslationRequest, ScriptArtifact } from "./types";

export type TranslationDependencies = {
  repository: ScriptArtifactRepository;
  provider: TextGenerationProvider;
  actorUserId: string;
};

function buildTranslationInstructions(sourceLanguage: string, targetLanguage: string): string {
  return [
    `Translate the supplied PAK script from ${sourceLanguage} to ${targetLanguage}.`,
    "Preserve meaning, factual claims, names, figures, railway terminology, and PAK-specific terms.",
    "Do not add unsupported facts, certifications, guarantees, or marketing claims.",
    "Return only the complete translated script.",
  ].join(" ");
}

function assertCurrentSource(source: ScriptArtifact | null): asserts source is ScriptArtifact & { scriptText: string } {
  if (!source) {
    throw new AppError("NOT_FOUND", "Canonical source script is unavailable.");
  }

  if (!source.isSource || source.status !== "GENERATED" || !source.scriptText?.trim()) {
    throw new AppError("CONFLICT", "Canonical source script is not current and ready for translation.");
  }
}

export async function generateTranslationArtifact(
  request: GenerateTranslationRequest,
  dependencies: TranslationDependencies,
): Promise<ScriptArtifact> {
  const source = await dependencies.repository.getSource(request.organizationId, request.contentItemId);
  assertCurrentSource(source);

  if (source.language === request.targetLanguage) {
    throw new AppError("VALIDATION_ERROR", "Target language must differ from the canonical source language.");
  }

  const target = await dependencies.repository.ensureTarget(
    request.organizationId,
    request.contentItemId,
    request.targetLanguage,
    dependencies.actorUserId,
  );

  const started = await dependencies.repository.startGeneration({
    id: target.id,
    organizationId: request.organizationId,
    expectedRevision: target.revision,
  });

  let generated;
  try {
    generated = await dependencies.provider.generate({
      topic: `Translate PAK script to ${request.targetLanguage}`,
      knowledgeContext: source.scriptText,
      language: request.targetLanguage,
      systemInstructions: buildTranslationInstructions(source.language, request.targetLanguage),
      idempotencyKey: `content:${request.contentItemId}:translation:${request.targetLanguage}:source:${source.revision}:target:${target.revision}`,
    });
  } catch {
    await dependencies.repository.failGeneration(
      started.id,
      request.organizationId,
      started.revision,
      {
        code: "TRANSLATION_PROVIDER_FAILED",
        message: "Translation generation failed.",
      },
    );

    throw new AppError("PROVIDER_ERROR", "Translation generation is temporarily unavailable.");
  }

  return dependencies.repository.completeGeneration({
    id: started.id,
    organizationId: request.organizationId,
    expectedRevision: started.revision,
    scriptText: generated.text,
    provider: generated.provider,
    providerModel: generated.model,
    ...(generated.metadata ? { providerMetadata: generated.metadata } : {}),
    sourceRevision: source.revision,
  });
}
