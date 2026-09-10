import Link from "next/link";

import { signInAction } from "@/app/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Polish Railway Academy</p>
        <h1 className="mt-3 text-3xl font-semibold">Sign in to PAK</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Use your PAK login ID to access the marketing automation workspace.</p>

        {params.error ? <p role="alert" className="mt-5 rounded-xl border border-rose-900 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">{params.error}</p> : null}
        {params.message ? <p className="mt-5 rounded-xl border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">{params.message}</p> : null}

        <form action={signInAction} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-200">
            Login ID
            <input name="identifier" type="text" autoComplete="username" required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Password
            <input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          </label>
          <button type="submit" className="w-full rounded-xl bg-white px-4 py-2.5 font-semibold text-slate-950">Sign in</button>
        </form>

        <p className="mt-6 text-sm text-slate-500">First PAK account? <Link href="/setup" className="font-medium text-slate-200 underline">Initial setup</Link></p>
      </div>
    </main>
  );
}
