import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Temporary compatibility alias for the remaining provenance call site.
 * This no longer creates a privileged/admin client and never reads a service-role key.
 * Privileged provenance insertion is enforced inside Supabase by the guarded RPC.
 */
export function createSupabaseAdminClient() {
  return createServerSupabaseClient();
}
