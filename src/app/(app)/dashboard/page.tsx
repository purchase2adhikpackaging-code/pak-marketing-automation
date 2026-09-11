export const dynamic = "force-dynamic";

import { loadDashboardWorkspace } from "@/modules/dashboard/service";
import { DashboardSummary } from "./dashboard-summary";

export default async function DashboardPage() {
  let workspace = null;
  let error: string | undefined;

  try {
    workspace = await loadDashboardWorkspace();
  } catch {
    error = "Workspace summary is temporarily unavailable.";
  }

  return (
    <section className="max-w-7xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Dashboard</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
        Operational status for the workflows that are implemented today: content generation, approved knowledge, and OpenAI integration readiness.
      </p>
      <DashboardSummary workspace={workspace} {...(error ? { error } : {})} />
    </section>
  );
}
