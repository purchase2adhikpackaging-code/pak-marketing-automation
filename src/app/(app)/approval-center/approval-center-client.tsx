"use client";

import Link from "next/link";
import React, { useMemo, useState, useTransition } from "react";

import type { AppRole } from "@/modules/auth/roles";
import type { ApprovalListPage, ApprovalQueueItem } from "@/modules/approval/read-model";
import type { ApprovalStatus } from "@/modules/approval/types";
import { listApprovalRequestsAction } from "./actions";

export type ApprovalCenterOrganization = {
  id: string;
  label: string;
  role: AppRole;
  initialPage: ApprovalListPage;
  sceneReviewRequired: number;
};

const STATUS_TABS: readonly { status: ApprovalStatus; label: string; empty: string }[] = [
  { status: "PENDING", label: "Awaiting review", empty: "No requests are awaiting review." },
  { status: "CHANGES_REQUESTED", label: "Changes requested", empty: "No changes-requested requests." },
  { status: "APPROVED", label: "Approved", empty: "No approved requests." },
  { status: "REJECTED", label: "Rejected", empty: "No rejected requests." },
  { status: "SUPERSEDED", label: "Superseded", empty: "No superseded requests." },
] as const;

function targetTitle(item: ApprovalQueueItem): string {
  return item.target.type === "CONTENT_ARTIFACT" ? item.target.topic : item.target.displayName;
}

function targetMeta(item: ApprovalQueueItem): string {
  if (item.target.type === "CONTENT_ARTIFACT") {
    return `${item.target.language} · Revision ${item.target.revision}`;
  }
  const checksum = item.target.checksum ? ` · ${item.target.checksum.slice(0, 18)}…` : "";
  return `${item.target.assetType}${checksum}`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function ApprovalCenterClient({ organizations }: { organizations: ApprovalCenterOrganization[] }) {
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [activeStatus, setActiveStatus] = useState<ApprovalStatus>("PENDING");
  const [page, setPage] = useState<ApprovalListPage>(organizations[0]?.initialPage ?? { items: [] });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const organization = useMemo(
    () => organizations.find((candidate) => candidate.id === organizationId) ?? organizations[0],
    [organizationId, organizations],
  );
  const activeTab = STATUS_TABS.find((tab) => tab.status === activeStatus) ?? STATUS_TABS[0]!;

  if (!organization) {
    return (
      <div className="mt-8 rounded-2xl border border-amber-900/50 bg-amber-950/20 p-5 text-sm leading-6 text-amber-100">
        No organization with Approval Center review access is available for this account.
      </div>
    );
  }

  const currentOrganization = organization;

  function selectOrganization(nextId: string) {
    const next = organizations.find((candidate) => candidate.id === nextId);
    setOrganizationId(nextId);
    setActiveStatus("PENDING");
    setPage(next?.initialPage ?? { items: [] });
    setError(null);
  }

  function loadStatus(status: ApprovalStatus) {
    setActiveStatus(status);
    setError(null);
    startTransition(async () => {
      const response = await listApprovalRequestsAction({
        organizationId: currentOrganization.id,
        status,
        limit: 50,
      });
      if (!response.ok) {
        setPage({ items: [] });
        setError(response.error);
        return;
      }
      setPage(response.page);
    });
  }

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="block max-w-xl flex-1 space-y-2">
            <span className="text-sm font-medium text-slate-200">Organization</span>
            <select
              value={currentOrganization.id}
              onChange={(event) => selectOrganization(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500"
              disabled={isPending}
            >
              {organizations.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
              ))}
            </select>
          </label>
          <p className="text-sm text-slate-400">Current role: <span className="font-semibold text-slate-200">{currentOrganization.role}</span></p>
        </div>
      </section>

      <section className="rounded-2xl border border-indigo-900/50 bg-indigo-950/20 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Domain approval</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Scene Planning review stays authoritative</h3>
            <p className="mt-1 text-sm text-slate-300">
              {currentOrganization.sceneReviewRequired} scene plans require domain review in Scene Planning.
            </p>
          </div>
          <Link href="/scene-planning" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-indigo-700 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-950/60">
            Open Scene Planning
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <div className="flex flex-wrap gap-2" aria-label="Approval workflow status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.status}
              type="button"
              onClick={() => loadStatus(tab.status)}
              disabled={isPending}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                activeStatus === tab.status
                  ? "border-slate-500 bg-slate-800 text-white"
                  : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error ? <p role="alert" className="mt-4 text-sm text-red-300">{error}</p> : null}
        {isPending ? <p className="mt-6 text-sm text-slate-400">Loading approval requests…</p> : null}

        {!isPending && page.items.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">
            {activeTab.empty}
          </div>
        ) : null}

        {!isPending && page.items.length > 0 ? (
          <div className="mt-6 divide-y divide-slate-800 rounded-xl border border-slate-800">
            {page.items.map((item) => (
              <article key={item.id} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {item.targetType === "CONTENT_ARTIFACT" ? "Content" : "Media"}
                    </span>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <h3 className="mt-2 truncate text-base font-semibold text-white">{targetTitle(item)}</h3>
                  <p className="mt-1 text-sm text-slate-400">{targetMeta(item)}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Requested {formatTime(item.requestedAt)}{item.requestedBy ? ` · ${item.requestedBy.slice(0, 8)}…` : ""}
                  </p>
                </div>
                <Link
                  href={`/approval-center/${item.id}?organization=${currentOrganization.id}`}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
                >
                  Review request
                </Link>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
