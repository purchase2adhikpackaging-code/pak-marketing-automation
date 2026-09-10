import Link from "next/link";

import type { AppRole } from "@/modules/auth/roles";
import type { IntegrationConnectionStatus } from "@/modules/integrations/types";

export type DashboardWorkspace = {
  organizationLabel: string;
  role: AppRole;
  content: { total: number; generated: number; failed: number };
  knowledge: { total: number; active: number };
  openAI: { status: IntegrationConnectionStatus; lastVerifiedAt?: string };
};

function MetricCard({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </article>
  );
}

export function DashboardSummary({
  workspace,
  error,
}: {
  workspace: DashboardWorkspace | null;
  error?: string;
}) {
  if (!workspace) {
    return (
      <div role="alert" className="mt-8 rounded-2xl border border-amber-900/50 bg-amber-950/20 p-5 text-sm leading-6 text-amber-100">
        {error ?? "No organization workspace is available for this account."}
      </div>
    );
  }

  const openAiLabel =
    workspace.openAI.status === "CONFIGURED"
      ? "Configured"
      : workspace.openAI.status === "INVALID"
        ? "Invalid"
        : workspace.openAI.status === "DISABLED"
          ? "Disabled"
          : "Not configured";

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Active workspace</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-white">{workspace.organizationLabel}</h3>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300">{workspace.role}</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Implemented workflow health">
        <MetricCard
          label="Content items"
          value={workspace.content.total}
          detail={
            workspace.content.total === 0
              ? "No content has been generated yet. Start in Content Studio when your source material is ready."
              : `${workspace.content.generated} generated · ${workspace.content.failed} failed`
          }
        />
        <MetricCard
          label="Knowledge records"
          value={workspace.knowledge.total}
          detail={
            workspace.knowledge.total === 0
              ? "No Knowledge Base records are available yet. Add approved source material before grounded generation."
              : `${workspace.knowledge.active} ACTIVE and selectable for grounded generation`
          }
        />
        <MetricCard
          label="OpenAI integration"
          value={openAiLabel}
          detail={
            workspace.openAI.status === "CONFIGURED"
              ? workspace.openAI.lastVerifiedAt
                ? `Last verified ${new Date(workspace.openAI.lastVerifiedAt).toLocaleString("en-GB")}`
                : "Configured. Run a connection test in Settings when verification is required."
              : "OpenAI is not configured for active generation. Review Integration Settings."
          }
        />
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
        <h3 className="text-lg font-semibold text-white">Continue active workflows</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          These destinations are implemented today. Future roadmap modules are intentionally excluded from Dashboard metrics until their workflows are enabled.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/content-studio" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950">Content Studio</Link>
          <Link href="/knowledge-base" className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-100">Knowledge Base</Link>
          <Link href="/settings" className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-100">Settings</Link>
        </div>
      </section>
    </div>
  );
}
