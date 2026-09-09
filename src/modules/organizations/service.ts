import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { OrganizationMembership } from "./types";

export async function getCurrentUserMemberships(): Promise<OrganizationMembership[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("id, organization_id, user_id, role, created_at, updated_at");

  if (error) {
    throw new Error(`Failed to load organization memberships: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
