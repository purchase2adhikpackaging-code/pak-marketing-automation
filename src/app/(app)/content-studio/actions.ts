"use server";

import type { AppRole } from "@/modules/auth/roles";
import { createTextGenerationProvider } from "@/modules/ai/text/provider-factory";
import { contentGenerationRequestSchema, type ContentGenerationRequest } from "@/modules/content-studio/schema";
import { SupabaseContentItemRepository } from "@/modules/content-studio/repository";
import { generateContentScript } from "@/modules/content-studio/service";
import type { ContentItem } from "@/modules/content-studio/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

export async function generateContentAction(input: unknown): Promise<GenerateContentActionResult> {
  return executeGenerateContentAction(input, {
    async getActor() {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        return null;
      }

      return { id: data.user.id };
    },

    async getMembership(actorId, organizationId) {
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
    },

    async generate(request, actorUserId) {
      return generateContentScript(request, {
        repository: new SupabaseContentItemRepository(),
        provider: createTextGenerationProvider(),
        actorUserId,
      });
    },
  });
}
