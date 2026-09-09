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

const GENERATION_ROLES: AppRole[] = ["OWNER", "ADMIN", "EDITOR"];

type Actor = { id: string };
type Membership = { role: AppRole } | null;

export type GenerateContentActionResult =
  | { ok: true; item: ContentItem }
  | { ok: false; error: string };

export type GenerateContentActionDependencies = {
  getActor(): Promise<Actor | null>;
  getMembership(actorId: string, organizationId: string): Promise<Membership>;
  generate(request: ContentGenerationRequest, actorUserId: string): Promise<ContentItem>;
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
    const item = await dependencies.generate(parsed.data, actor.id);
    return { ok: true, item };
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
  if (error || !data.user) {
    return null;
  }

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

  if (error || !data) {
    return null;
  }

  return { role: data.role as AppRole };
}

export async function generateContentAction(input: unknown): Promise<GenerateContentActionResult> {
  return executeGenerateContentAction(input, {
    getActor,
    getMembership,
    async generate(request, actorUserId) {
      return generateContentScript(request, {
        repository: new SupabaseContentItemRepository(),
        provider: createTextGenerationProvider(),
        actorUserId,
      });
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
        provider: createTextGenerationProvider(),
        actorUserId,
      });
    },
    async regenerateSource(request, actorUserId) {
      return regenerateSourceArtifact(request, {
        artifactRepository: new SupabaseScriptArtifactRepository(),
        contentRepository: new SupabaseContentItemRepository(),
        provider: createTextGenerationProvider(),
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
        provider: createTextGenerationProvider(),
        actorUserId,
      });
    },
    async regenerateSource(request, actorUserId) {
      return regenerateSourceArtifact(request, {
        artifactRepository: new SupabaseScriptArtifactRepository(),
        contentRepository: new SupabaseContentItemRepository(),
        provider: createTextGenerationProvider(),
        actorUserId,
      });
    },
  });
}
