"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { can } from "@/modules/auth/authorization";
import type { AppRole } from "@/modules/auth/roles";
import {
  organizationProfileRepository,
  type UpdateOrganizationProfileInput,
} from "@/modules/organization-profile/repository";
import { organizationProfileUpdateSchema } from "@/modules/organization-profile/schema";
import type { OrganizationProfile } from "@/modules/organization-profile/types";

const saveProfileSchema = z.object({
  organizationId: z.string().uuid(),
  profile: organizationProfileUpdateSchema,
}).strict();

type Actor = { id: string };
type Membership = { role: AppRole } | null;

export type OrganizationProfileActionDependencies = {
  getActor(): Promise<Actor | null>;
  getMembership(actorId: string, organizationId: string): Promise<Membership>;
  saveProfile(input: UpdateOrganizationProfileInput): Promise<OrganizationProfile>;
};

export type SaveOrganizationProfileResult =
  | { ok: true; profile: OrganizationProfile }
  | { ok: false; error: string };

export async function executeSaveOrganizationProfileAction(
  input: unknown,
  dependencies: OrganizationProfileActionDependencies,
): Promise<SaveOrganizationProfileResult> {
  const parsed = saveProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the Organization Profile fields and try again." };
  }

  const actor = await dependencies.getActor();
  if (!actor) return { ok: false, error: "You must be signed in to manage Organization Profile." };

  const membership = await dependencies.getMembership(actor.id, parsed.data.organizationId);
  if (!membership || !can(membership.role, "settings:manage")) {
    return { ok: false, error: "You do not have permission to manage Organization Profile for this organization." };
  }

  try {
    const profile = await dependencies.saveProfile({
      organizationId: parsed.data.organizationId,
      ...parsed.data.profile,
    });
    return { ok: true, profile };
  } catch {
    return { ok: false, error: "Organization Profile could not be saved." };
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

const productionDependencies: OrganizationProfileActionDependencies = {
  getActor,
  getMembership,
  saveProfile(input) {
    return organizationProfileRepository.update(input);
  },
};

export async function saveOrganizationProfileAction(input: unknown): Promise<SaveOrganizationProfileResult> {
  return executeSaveOrganizationProfileAction(input, productionDependencies);
}
