import React from "react";
import Link from "next/link";

import type { DashboardWorkspace } from "@/modules/dashboard/service";
import type { IntegrationConnectionStatus } from "@/modules/integrations/types";

function statusLabel(status: IntegrationConnectionStatus): string {
  if (status === "CONFIGURED") return "Configured";
  if (status === "INVALID") return "Invalid";
  if (status === "DISABLED") return "Disabled";
  return "Not configured";
}

function MetricCard({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function IntegrationCard({
  provider,
  connection,
}: {
  provider: string;
  connection: { status: IntegrationConnectionStatus; lastVerifiedAt?: string };
}) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-white">{provider}</p>
        <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300">
          {statusLabel(connection.status)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {connection.lastVerifiedAt
          ? `Last verified ${new Date(connection.lastVerifiedAt).toLocaleString("en-GB")}`
          : connection.status === "CONFIGURED"
            ? "Configured. Run a connection test when fresh verification is required."
            : "No verified active connection is available."}
      </p>
    </article>
  );
}

export function DashboardSummary({ workspace, error }: { workspace: DashboardWorkspace | null; error?: string }) {
  if (!workspace) {
    return (
      <div role="alert" className="mt-8 rounded-2xl border border-amber-900/50 bg-amber-950/20 p-5 text-sm leading-6 text-amber-100">
        {error ?? "No organization workspace is available for this account."}
      </div>
    );
  }

  const profileState = workspace.identity.profileRevision === null
    ? "Not configured"
    : `Profile revision ${workspace.identity.profileRevision}`;
  const brandState = workspace.identity.brandKitRevision === null
    ? "Not configured"
    : `Brand Kit revision ${workspace.identity.brandKitRevision}`;

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Active workspace</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">{workspace.organizationLabel}</h3>
            {workspace.lastActivityAt ? (
              <p className="mt-1 text-xs text-slate-500">Latest activity {new Date(workspace.lastActivityAt).toLocaleString("en-GB")}</p>
            ) : null}
          </div>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300">{workspace.role}</span>
        </div>
      </section>

      <Section title="Continue production">
        <p className="max-w-3xl text-sm leading-6 text-slate-400">{workspace.nextAction.reason}</p>
        <div className="mt-4">
          <Link
            href={workspace.nextAction.href}
            className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            {workspace.nextAction.label}
          </Link>
        </div>
      </Section>

      <Section title="Institutional readiness">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Organization Profile"
            value={profileState}
            detail="Authoritative organization identity used by generation context."
          />
          <MetricCard
            label="Brand Kit"
            value={brandState}
            detail="Official institutional brand identity and approved media defaults."
          />
          <MetricCard
            label="Core Knowledge"
            value={workspace.identity.activeCoreKnowledge}
            detail={`${workspace.identity.activeCoreKnowledge} ACTIVE Core Knowledge records are automatically grounded in generation.`}
          />
        </div>
      </Section>

      <Section title="Content production">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Content items" value={workspace.content.total} detail="Canonical content items in this organization." />
          <MetricCard label="Generated" value={workspace.content.generated} detail="Content items that completed generation." />
          <MetricCard label="Failed" value={workspace.content.failed} detail="Generation failures that may require operator attention." />
        </div>
      </Section>

      <Section title="Trusted Knowledge">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total records" value={workspace.knowledge.total} detail="All current Knowledge records in organization scope." />
          <MetricCard label="ACTIVE" value={workspace.knowledge.active} detail="Approved sources eligible for trusted grounding." />
          <MetricCard label="DRAFT" value={workspace.knowledge.draft} detail="Sources still awaiting human review and activation." />
          <MetricCard label="Core ACTIVE" value={workspace.knowledge.coreActive} detail="Institutional sources automatically included in generation." />
        </div>
      </Section>

      <Section title="Scene & video production">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Video projects" value={workspace.production.projects} detail="Non-archived Scene Planning projects." />
          <MetricCard
            label="Current plans"
            value={workspace.production.plansNeedingWork + workspace.production.approvedPlans}
            detail={`${workspace.production.plansNeedingWork} need work · ${workspace.production.approvedPlans} approved`}
          />
          <MetricCard
            label="Shot generation"
            value={workspace.production.generation.active}
            detail={`${workspace.production.generation.active} active · ${workspace.production.generation.failed} failed · ${workspace.production.generation.completed} completed`}
          />
          <MetricCard
            label="Final assembly"
            value={workspace.production.assembly.active}
            detail={`${workspace.production.assembly.active} active · ${workspace.production.assembly.failed} failed · ${workspace.production.assembly.completed} completed`}
          />
        </div>
      </Section>

      <Section title="Media Library">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="ACTIVE assets" value={workspace.media.active} detail="PAK-owned assets currently available for approved reuse." />
          <MetricCard label="Video assets" value={workspace.media.video} detail="ACTIVE video assets, including generated and assembled media." />
          <MetricCard label="Final renders" value={workspace.media.finalRenders} detail="Completed assemblies linked to final Media Library assets." />
        </div>
        <div className="mt-4">
          <Link href="/media-library" className="text-sm font-semibold text-slate-200 underline decoration-slate-600 underline-offset-4 hover:text-white">Open Media Library</Link>
        </div>
      </Section>

      <Section title="Integrations">
        <div className="grid gap-4 md:grid-cols-2">
          <IntegrationCard provider="OpenAI" connection={workspace.integrations.openAI} />
          <IntegrationCard provider="LTX" connection={workspace.integrations.ltx} />
        </div>
        <div className="mt-4">
          <Link href="/settings" className="text-sm font-semibold text-slate-200 underline decoration-slate-600 underline-offset-4 hover:text-white">Open Settings</Link>
        </div>
      </Section>
    </div>
  );
}
