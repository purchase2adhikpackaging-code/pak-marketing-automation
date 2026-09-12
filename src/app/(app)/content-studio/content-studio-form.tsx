"use client";

import Link from "next/link";
import React, { useMemo, useState, useTransition } from "react";

import type { AppRole } from "@/modules/auth/roles";
import type { ScriptArtifact } from "@/modules/content-studio/artifacts/types";
import { generateContentAction } from "./actions";
import { KnowledgeSelector, type SelectableKnowledgeRecord } from "./knowledge-selector";
import { MultilingualContentPanel } from "./multilingual-content-panel";

type OrganizationOption = {
  id: string;
  label: string;
  role: AppRole;
  knowledgeRecords: SelectableKnowledgeRecord[];
};

type FormState = {
  topic: string;
  knowledgeContext: string;
  language: "EN" | "PL" | "HI";
};

type GeneratedWorkspace = {
  organizationId: string;
  contentItemId: string;
  artifact: ScriptArtifact;
};

type GenerationResult = {
  script?: string;
  error?: string;
  provider?: string;
  providerModel?: string;
};

const LANGUAGE_OPTIONS = [
  { value: "EN", label: "English" },
  { value: "PL", label: "Polish" },
  { value: "HI", label: "Hindi" },
] as const;

function providerLabel(provider?: string, model?: string): string | null {
  if (!provider && !model) return null;
  const providerName = provider?.toLowerCase() === "openai" ? "OpenAI" : provider;
  return [providerName, model].filter(Boolean).join(" · ");
}

export function ContentStudioForm({ organizations }: { organizations: OrganizationOption[] }) {
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>({
    topic: "",
    knowledgeContext: "",
    language: "EN",
  });
  const [result, setResult] = useState<GenerationResult>({});
  const [workspace, setWorkspace] = useState<GeneratedWorkspace | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === organizationId) ?? organizations[0],
    [organizations, organizationId],
  );
  const knowledgeRecords = selectedOrganization?.knowledgeRecords ?? [];

  if (!selectedOrganization) {
    return (
      <div className="mt-8 rounded-2xl border border-amber-900/50 bg-amber-950/20 p-5 text-sm leading-6 text-amber-100">
        <p>No organization with Content Studio generation permission is available for this account.</p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link href="/knowledge-base" className="font-semibold underline underline-offset-4">
            Open Knowledge Base
          </Link>
          <Link href="/settings" className="font-semibold underline underline-offset-4">
            Open Settings
          </Link>
        </div>
      </div>
    );
  }

  function submit() {
    setResult({});
    setWorkspace(null);
    startTransition(async () => {
      const response = await generateContentAction({
        organizationId,
        topic: form.topic,
        ...(selectedKnowledgeIds.length > 0 ? { knowledgeRecordIds: selectedKnowledgeIds } : {}),
        ...(form.knowledgeContext.trim().length > 0
          ? { knowledgeContext: form.knowledgeContext.trim() }
          : {}),
        language: form.language,
      });

      if (!response.ok) {
        setResult({ error: response.error });
        return;
      }

      setResult({
        script: response.item.generatedScript ?? "",
        ...(response.item.provider ? { provider: response.item.provider } : {}),
        ...(response.item.providerModel ? { providerModel: response.item.providerModel } : {}),
      });
      setWorkspace({
        organizationId: response.item.organizationId,
        contentItemId: response.item.id,
        artifact: response.artifact,
      });
    });
  }

  const canSubmit = organizationId.length > 0 && form.topic.trim().length >= 3 && !isPending;
  const generatedBy = providerLabel(result.provider, result.providerModel);

  return (
    <div className="mt-8">
      <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current generation context</p>
        <p className="mt-1 text-sm font-medium text-slate-200">
          {selectedOrganization.label} · {selectedOrganization.role}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-sm">
          <div className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Organization</span>
              <select
                value={organizationId}
                onChange={(event) => {
                  setSelectedKnowledgeIds([]);
                  setResult({});
                  setWorkspace(null);
                  setOrganizationId(event.target.value);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500"
                disabled={isPending}
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Topic</span>
              <input
                value={form.topic}
                onChange={(event) => setForm((current) => ({ ...current, topic: event.target.value }))}
                placeholder="e.g. Railway safety training for workshop teams"
                maxLength={300}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-slate-500"
                disabled={isPending}
              />
            </label>

            <KnowledgeSelector
              records={knowledgeRecords}
              selectedIds={selectedKnowledgeIds}
              onChange={setSelectedKnowledgeIds}
              disabled={isPending}
            />

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Additional context</span>
              <textarea
                value={form.knowledgeContext}
                onChange={(event) => setForm((current) => ({ ...current, knowledgeContext: event.target.value }))}
                placeholder="Optional supplemental context that is not already captured in the approved Knowledge Base sources."
                maxLength={12000}
                rows={7}
                className="w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-slate-500"
                disabled={isPending}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Canonical source language</span>
              <select
                value={form.language}
                onChange={(event) => setForm((current) => ({ ...current, language: event.target.value as FormState["language"] }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500"
                disabled={isPending}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Generating…" : "Generate source script"}
            </button>

            <div aria-live="polite" className="min-h-6 text-sm text-slate-400">
              {isPending ? <p>Generating source script…</p> : null}
              {!isPending && result.script ? (
                <p>Canonical source generated. Translation actions are available below.</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="min-h-[28rem] rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-sm" aria-live="polite">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Canonical output</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Source script</h3>
              {generatedBy ? <p className="mt-2 text-xs text-slate-400">{generatedBy}</p> : null}
            </div>
            {result.script ? <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-400">Generated</span> : null}
          </div>

          {result.error ? (
            <div role="alert" className="mt-6 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm leading-6 text-red-200">
              <p>{result.error}</p>
              <div className="mt-3 flex flex-wrap gap-4">
                <Link href="/settings" className="font-semibold underline underline-offset-4">Open Settings</Link>
                <Link href="/knowledge-base" className="font-semibold underline underline-offset-4">Open Knowledge Base</Link>
              </div>
            </div>
          ) : result.script ? (
            <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-200">{result.script}</div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-800 p-6 text-sm leading-6 text-slate-500">
              Select approved Knowledge Base sources, optionally add supplemental context, and generate the canonical source. The server re-resolves selected record IDs and re-checks organization access before any AI request is made.
            </div>
          )}
        </section>
      </div>

      {workspace ? (
        <MultilingualContentPanel
          organizationId={workspace.organizationId}
          contentItemId={workspace.contentItemId}
          artifacts={[workspace.artifact]}
          role={selectedOrganization.role}
        />
      ) : null}
    </div>
  );
}
