"use client";

import React, { useMemo, useState, useTransition } from "react";

import type { ScriptArtifact } from "@/modules/content-studio/artifacts/types";
import { generateContentAction } from "./actions";
import { KnowledgeSelector, type SelectableKnowledgeRecord } from "./knowledge-selector";
import { MultilingualContentPanel } from "./multilingual-content-panel";

type OrganizationOption = {
  id: string;
  label: string;
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

const LANGUAGE_OPTIONS = [
  { value: "EN", label: "English" },
  { value: "PL", label: "Polish" },
  { value: "HI", label: "Hindi" },
] as const;

export function ContentStudioForm({ organizations }: { organizations: OrganizationOption[] }) {
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>({
    topic: "",
    knowledgeContext: "",
    language: "EN",
  });
  const [result, setResult] = useState<{ script?: string; error?: string }>({});
  const [workspace, setWorkspace] = useState<GeneratedWorkspace | null>(null);
  const [isPending, startTransition] = useTransition();

  const knowledgeRecords = useMemo(
    () => organizations.find((organization) => organization.id === organizationId)?.knowledgeRecords ?? [],
    [organizations, organizationId],
  );

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

      setResult({ script: response.item.generatedScript ?? "" });
      setWorkspace({
        organizationId: response.item.organizationId,
        contentItemId: response.item.id,
        artifact: response.artifact,
      });
    });
  }

  const canSubmit = organizationId.length > 0 && form.topic.trim().length >= 3 && !isPending;

  return (
    <div className="mt-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-sm">
          <div className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Organization</span>
              <select
                value={organizationId}
                onChange={(event) => {
                  setSelectedKnowledgeIds([]);
                  setOrganizationId(event.target.value);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500"
                disabled={organizations.length === 0 || isPending}
              >
                {organizations.length === 0 ? <option value="">No eligible organization</option> : null}
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
          </div>
        </section>

        <section className="min-h-[28rem] rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-sm" aria-live="polite">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Canonical output</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Source script</h3>
            </div>
            {result.script ? <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-400">Generated</span> : null}
          </div>

          {result.error ? (
            <div className="mt-6 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm leading-6 text-red-200">
              {result.error}
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
        />
      ) : null}
    </div>
  );
}
