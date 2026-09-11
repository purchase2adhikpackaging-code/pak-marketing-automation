"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ScriptArtifact, ScriptArtifactStatus } from "@/modules/content-studio/artifacts/types";
import { createScenePlanningProjectAction } from "../scene-planning/actions";
import { generateTranslationAction, regenerateSourceAction } from "./actions";

const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "PL", label: "Polish" },
  { code: "HI", label: "Hindi" },
] as const;

type LanguageCode = (typeof LANGUAGES)[number]["code"];
type MultilingualContentPanelProps = {
  organizationId: string;
  contentItemId: string;
  artifacts: ScriptArtifact[];
};

function actionForTarget(artifact: ScriptArtifact | undefined): { label: string; ariaLabel: string; disabled: boolean } {
  if (!artifact || artifact.status === "PENDING") return { label: "Generate translation", ariaLabel: "Generate", disabled: false };
  if (artifact.status === "GENERATING") return { label: "Generating…", ariaLabel: "generating", disabled: true };
  if (artifact.status === "FAILED") return { label: "Retry translation", ariaLabel: "Retry", disabled: false };
  return { label: "Refresh translation", ariaLabel: "Refresh", disabled: false };
}

function stateMessage(status: ScriptArtifactStatus | undefined): string | null {
  if (status === "STALE") return "Source changed — refresh translation";
  if (status === "FAILED") return "Translation generation failed. You can retry safely.";
  if (status === "GENERATING") return "Translation generation is in progress.";
  return null;
}

export function MultilingualContentPanel({ organizationId, contentItemId, artifacts: initialArtifacts }: MultilingualContentPanelProps) {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [error, setError] = useState<string | null>(null);
  const [pendingLanguage, setPendingLanguage] = useState<LanguageCode | null>(null);
  const [scenePlanningArtifactId, setScenePlanningArtifactId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setArtifacts(initialArtifacts), [initialArtifacts]);

  const byLanguage = useMemo(() => {
    const map = new Map<LanguageCode, ScriptArtifact>();
    for (const artifact of artifacts) map.set(artifact.language, artifact);
    return map;
  }, [artifacts]);

  function replaceArtifact(next: ScriptArtifact) {
    setArtifacts((current) => [...current.filter((artifact) => artifact.language !== next.language), next]);
  }

  function translate(language: LanguageCode) {
    setError(null);
    setPendingLanguage(language);
    startTransition(async () => {
      const response = await generateTranslationAction({ organizationId, contentItemId, targetLanguage: language });
      if (!response.ok) {
        setError(response.error);
        setPendingLanguage(null);
        return;
      }
      replaceArtifact(response.artifact);
      setPendingLanguage(null);
    });
  }

  function regenerateSource(source: ScriptArtifact) {
    setError(null);
    setPendingLanguage(source.language);
    startTransition(async () => {
      const response = await regenerateSourceAction({ organizationId, contentItemId });
      if (!response.ok) {
        setError(response.error);
        setPendingLanguage(null);
        return;
      }
      setArtifacts((current) => current.map((artifact) => {
        if (artifact.language === response.artifact.language) return response.artifact;
        if (!artifact.isSource && artifact.status === "GENERATED" && (artifact.sourceRevision ?? 0) < response.artifact.revision) {
          return { ...artifact, status: "STALE" };
        }
        return artifact;
      }));
      setPendingLanguage(null);
    });
  }

  function createScenePlan(artifact: ScriptArtifact) {
    setError(null);
    setScenePlanningArtifactId(artifact.id);
    startTransition(async () => {
      const response = await createScenePlanningProjectAction({
        organizationId,
        sourceArtifactId: artifact.id,
      });
      if (!response.ok) {
        setError(response.error);
        setScenePlanningArtifactId(null);
        return;
      }
      router.push(`/scene-planning?project=${response.projectId}`);
    });
  }

  return (
    <section className="mt-8" aria-label="Multilingual scripts">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Multilingual artifacts</p>
          <h3 className="mt-2 text-xl font-semibold text-white">English, Polish & Hindi</h3>
        </div>
        <p className="max-w-xl text-sm leading-6 text-slate-400">
          The canonical source controls translation freshness. Regenerating it marks older translations stale until refreshed.
        </p>
      </div>

      {error ? <div className="mt-5 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm leading-6 text-red-200" role="alert">{error}</div> : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {LANGUAGES.map(({ code, label }) => {
          const artifact = byLanguage.get(code);
          const source = artifact?.isSource === true;
          const action = actionForTarget(artifact);
          const busy = isPending && pendingLanguage === code;
          const sceneBusy = isPending && scenePlanningArtifactId === artifact?.id;
          const message = stateMessage(artifact?.status);
          const scenePlanningEligible = artifact?.status === "GENERATED" && Boolean(artifact.scriptText?.trim());

          return (
            <article key={code} data-testid="language-card" className="flex min-h-[24rem] flex-col rounded-2xl border border-slate-800 bg-slate-950/60 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{code}</p><h4 className="mt-1 text-lg font-semibold text-white">{label}</h4></div>
                <div className="flex flex-col items-end gap-2">
                  {source ? <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-200">Canonical source</span> : null}
                  <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{artifact?.status ?? "PENDING"}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>{artifact ? `Revision ${artifact.revision}` : "Not generated"}</span>
                {!source && artifact?.sourceRevision ? <span>Source revision {artifact.sourceRevision}</span> : null}
              </div>

              {message ? <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm leading-6 text-slate-300">{message}</div> : null}
              <div className="mt-4 flex-1 whitespace-pre-wrap text-sm leading-7 text-slate-200">{artifact?.scriptText?.trim() || "No script exists for this language yet."}</div>

              <div className="mt-5 space-y-2 border-t border-slate-800 pt-4">
                {source ? (
                  <button type="button" onClick={() => regenerateSource(artifact)} disabled={busy || artifact.status === "GENERATING"} aria-label={`Regenerate ${label} source`} className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50">
                    {busy ? "Regenerating…" : "Regenerate source"}
                  </button>
                ) : (
                  <button type="button" onClick={() => translate(code)} disabled={busy || action.disabled} aria-label={action.ariaLabel === "generating" ? `${label} translation generating` : `${action.ariaLabel} ${label} translation`} className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50">
                    {busy && !action.disabled ? "Generating…" : action.label}
                  </button>
                )}

                {scenePlanningEligible && artifact ? (
                  <button type="button" onClick={() => createScenePlan(artifact)} disabled={sceneBusy} aria-label={`Create Scene Plan from ${label}`} className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50">
                    {sceneBusy ? "Creating Scene Plan…" : "Create Scene Plan"}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
