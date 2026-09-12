import "server-only";

import { createClient } from "@supabase/supabase-js";

let cachedSecret: string | null = null;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Publishing worker environment variable ${name} is required.`);
  return value;
}

export async function resolvePublishingWorkerSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;

  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("read_publishing_worker_dispatch_secret");
  if (error) throw new Error(`Publishing worker dispatch secret is unavailable: ${error.message}`);
  if (typeof data !== "string" || !data.trim()) {
    throw new Error("Publishing worker dispatch secret is unavailable.");
  }

  cachedSecret = data.trim();
  return cachedSecret;
}
