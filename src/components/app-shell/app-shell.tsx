import type { ReactNode } from "react";
import { AppNavigation } from "./app-navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto min-h-screen max-w-[1600px] lg:grid lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-800 bg-slate-900/60 px-4 py-4 lg:border-b-0 lg:border-r lg:p-6">
          <div className="flex items-center justify-between gap-4 lg:mb-8 lg:block">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Polish Railway Academy</p>
              <h1 className="mt-1 text-lg font-semibold lg:mt-2 lg:text-xl">PAK Marketing Automation</h1>
            </div>
            <div className="lg:mt-8">
              <AppNavigation />
            </div>
          </div>
        </aside>
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
