import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAVIGATION } from "./navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-800 bg-slate-900/60 p-6 lg:border-b-0 lg:border-r">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Polish Railway Academy</p>
            <h1 className="mt-2 text-xl font-semibold">PAK Marketing Automation</h1>
          </div>
          <nav aria-label="Primary" className="grid gap-1">
            {APP_NAVIGATION.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
