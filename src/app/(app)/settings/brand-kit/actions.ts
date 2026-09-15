"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { can } from "@/modules/auth/authorization";
import type { AppRole } from "@/modules/auth/roles";
import {
  brandKitRepository,
  type UpdateBrandKitInput,
} from "@/modules/brand-kit/repository";
import { brandKitUpdateSchema } from "@/modules/brand-kit/schema";
import type { OrganizationBrandKit } from "@/modules/brand-kit/types";

const saveBrandKitSchema = z.object({
  organizationId: z.string().uuid(),
  brandKit: brandKitUpdateSchema,
}).strict();

type Actor = { id: string };
type Membership = { role: AppRole } | null;

export type BrandKitActionDependencies = {
  getActor(): Promise<Actor | null>;
  getMembership(actorId: string, organizationId: string): Promise<Membership>;
  saveBrandKit(input: UpdateBrandKitInput): Promise<OrganizationBrandKit>;
};

export type SaveBrandKitResult =
  | { ok: true; brandKit: OrganizationBrandKit }
  | { ok: false; error: string };

export async function executeSaveBrandKitAction(
  input: unknown,
  dependencies: BrandKitActionDependencies,
): Promise<SaveBrandKitResult> {
  const parsed = saveBrandKitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the Brand Kit fields and try again." };

  const actor = await dependencies.getActor();
  if (!actor) return { ok: false, error: "You must be signed in to manage Brand Kit." };

  const membership = await dependencies.getMembership(actor.id, parsed.data.organizationId);
  if (!membership || !can(membership.role, "settings:manage")) {
    return { ok: false, error: "You do not have permission to manage Brand Kit for this organization." };
  }

  try {
    const brandKit = await dependencies.saveBrandKit({
      organizationId: parsed.data.organizationId,
      ...parsed.data.brandKit,
    });
    return { ok: true, brandKit };
  } catch {
    return { ok: false, error: "Brand Kit could not be saved." };
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

const productionDependencies: BrandKitActionDependencies = {
  getActor,
  getMembership,
  saveBrandKit(input) {
    return brandKitRepository.update(input);
  },
};

export async function saveBrandKitAction(input: unknown): Promise<SaveBrandKitResult> {
  return executeSaveBrandKitAction(input, productionDependencies);
}
