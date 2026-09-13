"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTextGenerationProvider } from "@/modules/ai/text/provider-factory";
import type { AppRole } from "@/modules/auth/roles";
import { SupabaseScriptArtifactRepository } from "@/modules/content-studio/artifacts/repository";
import {
  generateTranslationRequestSchema,
  regenerateSourceRequestSchema,
  type GenerateTranslationRequest,
  type RegenerateSourceRequest,
} from "@/modules/content-studio/artifacts/schema";
import { regenerateSourceArtifact } from "@/modules/content-studio/artifacts/source-service";
import { generateTranslationArtifact } from "@/modules/content-studio/artifacts/translation-service";
import type { ScriptArtifact } from "@/modules/content-studio/artifacts/types";
import { SupabaseContentItemRepository } from "@/modules/content-studio/repository";
import { contentGenerationRequestSchema, type ContentGenerationRequest } from "@/modules/content-studio/schema";
import { generateContentScript } from "@/modules/content-studio/service";
import type { ContentItem } from "@/modules/content-studio/types";
import { generationContextRepository } from "@/modules/generation-context/repository";
import { resolveOrganizationGenerationContext } from "@/modules/generation-context/resolver";
import type { OrganizationGenerationContext } from "@/modules/generation-context/types";

const GENERATION_ROLES: AppRole[] = ["OWNER", "ADMIN", "EDITOR"];

type Actor = { id: string };
type Membership = { role: AppRole } | null;

export type GenerateContentActionResult =
  | { ok: true; item: ContentItem; artifact: ScriptArtifact }
  | { ok: false; error: string };

export type GenerateContentActionDependencies = {
  getActor(): Promise<Actor | null>;
  getMembership(actorId: string, organizationId: string): Promise<Membership>;
  resolveContext(input: {
    organizationId: string;
    selectedKnowledgeRecordIds?: string[];
    additionalContext?: string;
  }): Promise<OrganizationGenerationContext>;
  generate(request: ContentGenerationRequest, actorUserId: string): Promise<ContentItem>;
  persistProvenance(
    contentItemId: string,
    organizationId: string,
    context: OrganizationGenerationContext,
  ): Promise<void>;
  markFailed?(item: ContentItem, failureMetadata: Record<string, unknown>): Promise<void>;
  ensureSource(item: ContentItem, actorUserId: string): Promise<ScriptArtifact>;
};

export type ScriptArtifactActionResult =
  | { ok: true; artifact: ScriptArtifact }
  | { ok: false; error: string };

export type ScriptArtifactActionDependencies = {
  getActor(): Promise<Actor | null>;
  getMembership(actorId: string, organizationId: string): Promise<Membership>;
  generateTranslation(request: GenerateTranslationRequest, actorUserId: string): Promise<ScriptArtifact>;
  regenerateSource(request: RegenerateSourceRequest, actorUserId: string): Promise<ScriptArtifact>;
};

function keyValueLines(values: Record<string, string>): string[] {
  return Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}: ${value}`);
}

function composeOrganizationGenerationContext(context: OrganizationGenerationContext): string {
  if (!context.profile || !context.brandKit) {
    throw new Error("Authoritative organization identity is unavailable.");
  }

  const profile = context.profile;
  const brand = context.brandKit;
  const profileLines = [
    "[Organization Profile]",
    `Official name: ${profile.officialName}`,
    ...(profile.shortName ? [`Short name: ${profile.shortName}`] : []),
    ...(profile.about ? [`About: ${profile.about}`] : []),
    ...(profile.address ? [`Address: ${profile.address}`] : []),
    ...(profile.primaryEmail ? [`Primary email: ${profile.primaryEmail}`] : []),
    ...(profile.primaryPhone ? [`Primary phone: ${profile.primaryPhone}`] : []),
    ...(profile.website ? [`Website: ${profile.website}`] : []),
    `Default language: ${profile.defaultLanguage}`,
    `Timezone: ${profile.timezone}`,
    ...keyValueLines(profile.socialLinks).map((line) => `Social ${line}`),
    ...keyValueLines(profile.legalIdentifiers).map((line) => `Legal ${line}`),
  ];

  const brandLines = [
    "[Brand Kit]",
    ...(brand.primaryColor ? [`Primary color: ${brand.primaryColor}`] : []),
    ...(brand.secondaryColor ? [`Secondary color: ${brand.secondaryColor}`] : []),
    ...(brand.accentColor ? [`Accent color: ${brand.accentColor}`] : []),
    ...(brand.typographyRules ? [`Typography rules: ${brand.typographyRules}`] : []),
    ...(brand.brandVoice ? [`Brand voice: ${brand.brandVoice}`] : []),
    ...(brand.logoUsageRules ? [`Logo usage rules: ${brand.logoUsageRules}`] : []),
    ...(brand.visualConstraints ? [`Visual constraints: ${brand.visualConstraints}`] : []),
    ...(brand.primaryLogoAssetId ? [`Official primary logo asset ID: ${brand.primaryLogoAssetId}`] : []),
  ];

  return [
    profileLines.join("\n"),
    brandLines.join("\n"),
    ...(context.knowledgeContext ? [context.knowledgeContext] : []),
  ].join("\n\n");
}

export async function executeGenerateContentAction(
  input: unknown,
  dependencies: GenerateContentActionDependencies,
): Promise<GenerateContentActionResult> {
  const parsed = contentGenerationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the content generation details and try again." };
  }

  const actor = await dependencies.getActor();
  if (!actor) {
    return { ok: false, error: "You must be signed in to generate content." };
  }

  const membership = await dependencies.getMembership(actor.id, parsed.data.organizationId);
  if (!membership || !GENERATION_ROLES.includes(membership.role)) {
    return { ok: false, error: "You do not have permission to generate content for this organization." };
  }

  try {
    const context = await dependencies.resolveContext({
      organizationId: parsed.data.organizationId,
      ...(parsed.data.knowledgeRecordIds !== undefined
        ? { selectedKnowledgeRecordIds: parsed.data.knowledgeRecordIds }
        : {}),
      ...(parsed.data.knowledgeContext !== undefined
        ? { additionalContext: parsed.data.knowledgeContext }
        : {}),
    });

    const generationRequest: ContentGenerationRequest = {
      organizationId: parsed.data.organizationId,
      topic: parsed.data.topic,
      knowledgeContext: composeOrganizationGenerationContext(context),
      language: parsed.data.language,
    };

    const item = await dependencies.generate(generationRequest, actor.id);

    try {
      await dependencies.persistProvenance(item.id, parsed.data.organizationId, context);
    } catch {
      if (dependencies.markFailed) {
        try {
          await dependencies.markFailed(item, {
            code: "PROVENANCE_PERSISTENCE_FAILED",
            message: "Generated content could not be bound to immutable organization provenance.",
          });
        } catch {
          // Preserve the original safe action failure even if recovery persistence also fails.
        }
      }
      return { ok: false, error: "Content generation is temporarily unavailable." };
    }

    const artifact = await dependencies.ensureSource(item, actor.id);
    return { ok: true, item, artifact };
  } catch {
    return { ok: false, error: "Content generation is temporarily unavailable." };
  }
}

async function authorizeArtifactAction(
  organizationId: string,
  dependencies: Pick<ScriptArtifactActionDependencies, "getActor" | "getMembership">,
): Promise<{ actorId: string } | { error: string }> {
  const actor = await dependencies.getActor();
  if (!actor) {
    return { error: "You must be signed in to manage content artifacts." };
  }

  const membership = await dependencies.getMembership(actor.id, organizationId);
  if (!membership || !GENERATION_ROLES.includes(membership.role)) {
    return { error: "You do not have permission to manage content artifacts for this organization." };
  }

  return { actorId: actor.id };
}

export async function executeGenerateTranslationAction(
  input: unknown,
  dependencies: ScriptArtifactActionDependencies,
): Promise<ScriptArtifactActionResult> {
  const parsed = generateTranslationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the translation details and try again." };
  }

  const authorization = await authorizeArtifactAction(parsed.data.organizationId, dependencies);
  if ("error" in authorization) {
    return { ok: false, error: authorization.error };
  }

  try {
    const artifact = await dependencies.generateTranslation(parsed.data, authorization.actorId);
    return { ok: true, artifact };
  } catch {
    return { ok: false, error: "Content artifact generation is temporarily unavailable." };
  }
}

export async function executeRegenerateSourceAction(
  input: unknown,
  dependencies: ScriptArtifactActionDependencies,
): Promise<ScriptArtifactActionResult> {
  const parsed = regenerateSourceRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the source regeneration details and try again." };
  }

  const authorization = await authorizeArtifactAction(parsed.data.organizationId, dependencies);
  if ("error" in authorization) {
    return { ok: false, error: authorization.error };
  }

  try {
    const artifact = await dependencies.regenerateSource(parsed.data, authorization.actorId);
    return { ok: true, artifact };
  } catch {
    return { ok: false, error: "Content artifact generation is temporarily unavailable." };
  }
}

async function getActor(): Promise<Actor | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

async function getMembership(actorId: string, organizationId: string): Promise<Membership> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", actorId)
    .maybeSingle();
  if (error || !data) return null;
  return { role: data.role as AppRole };
}

async function persistGenerationProvenance(
  contentItemId: string,
  organizationId: string,
  context: OrganizationGenerationContext,
): Promise<void> {
  if (!context.profile || !context.brandKit) {
    throw new Error("Authoritative identity is unavailable.");
  }
  const snapshots = [...context.coreKnowledge, ...context.selectedKnowledge].map((record) => ({
    knowledge_record_id: record.id,
    knowledge_revision: record.revision,
    title_snapshot: record.title,
    content_snapshot: record.content,
    source_type_snapshot: record.sourceType,
    source_label_snapshot: record.sourceLabel ?? null,
    source_reference_snapshot: record.sourceReference ?? null,
  }));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("persist_content_generation_provenance", {
    _organization_id: organizationId,
    _content_item_id: contentItemId,
    _profile_revision: context.profile.revision,
    _brand_kit_revision: context.brandKit.revision,
    _knowledge_snapshots: snapshots,
  });
  if (error) throw new Error("Generation provenance persistence failed.");
}

export async function generateContentAction(input: unknown): Promise<GenerateContentActionResult> {
  const contentRepository = new SupabaseContentItemRepository();
  return executeGenerateContentAction(input, {
    getActor,
    getMembership,
    async resolveContext(contextInput) {
      return resolveOrganizationGenerationContext(contextInput, generationContextRepository);
    },
    async generate(request, actorUserId) {
      return generateContentScript(request, {
        repository: contentRepository,
        provider: createTextGenerationProvider({ organizationId: request.organizationId }),
        actorUserId,
      });
    },
    persistProvenance: persistGenerationProvenance,
    async markFailed(item, failureMetadata) {
      await contentRepository.markFailed({
        id: item.id,
        organizationId: item.organizationId,
        failureMetadata,
      });
    },
    async ensureSource(item, actorUserId) {
      return new SupabaseScriptArtifactRepository().ensureSourceFromLegacy(
        item.organizationId,
        item.id,
        actorUserId,
      );
    },
  });
}

export async function generateTranslationAction(input: unknown): Promise<ScriptArtifactActionResult> {
  return executeGenerateTranslationAction(input, {
    getActor,
    getMembership,
    async generateTranslation(request, actorUserId) {
      return generateTranslationArtifact(request, {
        repository: new SupabaseScriptArtifactRepository(),
        provider: createTextGenerationProvider({ organizationId: request.organizationId }),
        actorUserId,
      });
    },
    async regenerateSource(request, actorUserId) {
      return regenerateSourceArtifact(request, {
        artifactRepository: new SupabaseScriptArtifactRepository(),
        contentRepository: new SupabaseContentItemRepository(),
        provider: createTextGenerationProvider({ organizationId: request.organizationId }),
        actorUserId,
      });
    },
  });
}

export async function regenerateSourceAction(input: unknown): Promise<ScriptArtifactActionResult> {
  return executeRegenerateSourceAction(input, {
    getActor,
    getMembership,
    async generateTranslation(request, actorUserId) {
      return generateTranslationArtifact(request, {
        repository: new SupabaseScriptArtifactRepository(),
        provider: createTextGenerationProvider({ organizationId: request.organizationId }),
        actorUserId,
      });
    },
    async regenerateSource(request, actorUserId) {
      return regenerateSourceArtifact(request, {
        artifactRepository: new SupabaseScriptArtifactRepository(),
        contentRepository: new SupabaseContentItemRepository(),
        provider: createTextGenerationProvider({ organizationId: request.organizationId }),
        actorUserId,
      });
    },
  });
}
