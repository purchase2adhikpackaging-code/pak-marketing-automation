import Link from "next/link";

import { signUpFirstOwnerAction } from "@/app/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: existingOrgs } = await supabase.from("organizations").select("id").limit(1);
  const setupComplete = (existingOrgs ?? []).length > 0;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Polish Railway Academy</p>
        <h1 className="mt-3 text-3xl font-semibold">Initial PAK setup</h1>
        {setupComplete ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm leading-6 text-slate-300">Initial setup is already complete. New organization creation is disabled from this page.</p>
            <Link href="/login" className="inline-flex rounded-xl bg-white px-4 py-2.5 font-semibold text-slate-950">Go to sign in</Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-slate-400">Create the first PAK account. This account becomes the OWNER of the single initial PAK organization.</p>
            {params.error ? <p role="alert" className="mt-5 rounded-xl border border-rose-900 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{params.error}</p> : null}
            <form action={signUpFirstOwnerAction} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-200">
                Owner email
                <input name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              </label>
              <label className="block text-sm font-medium text-slate-200">
                Password
                <input name="password" type="password" autoComplete="new-password" minLength={8} required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              </label>
              <button type="submit" className="w-full rounded-xl bg-white px-4 py-2.5 font-semibold text-slate-950">Create PAK owner</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
