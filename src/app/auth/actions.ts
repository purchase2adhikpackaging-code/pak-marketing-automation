"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const INTERNAL_LOGIN_DOMAIN = "pak.local";

function value(formData: FormData, name: string): string {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

function loginIdentifierToEmail(identifier: string): string {
  const normalized = identifier.trim().toLowerCase();
  return normalized.includes("@") ? normalized : `${normalized}@${INTERNAL_LOGIN_DOMAIN}`;
}

async function ensureFirstOwnerIfNeeded(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("id")
    .limit(1);

  if (error) return;
  if ((memberships ?? []).length > 0) return;

  const { data: bootstrapAvailable } = await supabase.rpc("is_pak_bootstrap_available");
  if (bootstrapAvailable === true) {
    await supabase.rpc("bootstrap_first_owner");
  }
}

export async function signInAction(formData: FormData): Promise<void> {
  const identifier = value(formData, "identifier");
  const password = value(formData, "password");
  const email = loginIdentifierToEmail(identifier);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("Invalid login ID or password.")}`);
  }

  await ensureFirstOwnerIfNeeded();
  redirect("/dashboard");
}

export async function signUpFirstOwnerAction(formData: FormData): Promise<void> {
  const email = value(formData, "email");
  const password = value(formData, "password");

  if (!email || password.length < 8) {
    redirect(`/setup?error=${encodeURIComponent("Use a valid email and a password with at least 8 characters.")}`);
  }

  const supabase = await createServerSupabaseClient();
  const { data: bootstrapAvailable, error: availabilityError } = await supabase.rpc("is_pak_bootstrap_available");
  if (availabilityError || bootstrapAvailable !== true) {
    redirect("/login");
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    redirect(`/setup?error=${encodeURIComponent("Account setup failed. Check the details and try again.")}`);
  }

  if (!data.session) {
    redirect(`/login?message=${encodeURIComponent("Account created. Confirm your email if required, then sign in.")}`);
  }

  const { error: bootstrapError } = await supabase.rpc("bootstrap_first_owner");
  if (bootstrapError) {
    redirect(`/setup?error=${encodeURIComponent("PAK owner setup could not be completed.")}`);
  }

  redirect("/settings");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
