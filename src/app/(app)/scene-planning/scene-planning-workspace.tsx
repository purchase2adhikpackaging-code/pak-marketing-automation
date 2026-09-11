"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AppRole } from "@/modules/auth/roles";
import type { ScenePlanStatus } from "@/modules/scene-planning/schema";
import { ScenePlanEditor, type ScenePlanEditorScene } from "./scene-plan-editor";
import {
  approveScenePlanAction,
  cloneScenePlanForEditAction,
  generateScenePlanAction,
  runScenePlanQcAction,
  saveScenePlanningBriefAction,
  saveVisualBibleAction,
} from "./workflow-actions";

const EDIT_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR"];
const APPROVE_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "REVIEWER"];
const PROJECT_EDITABLE_STATUSES: readonly ScenePlanStatus[] = ["DRAFT", "PLANNING", "QC_REQUIRED", "REVIEW_REQUIRED", "FAILED", "STALE", "SUPERSEDED"];

type ProjectView = {
  id: string;
  title: string;
  purpose: string;
  targetDurationSeconds: number;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
  qualityProfile: "STANDARD" | "PREMIUM" | "CINEMATIC";
  targetPlatforms: string[];
  language: "EN" | "PL" | "HI";
  sourceIntegrityHash: string;
};

type VisualBibleView = {
  characters: string[];
  locations: string[];
  globalNegativeConstraints: string[];
  realismLevel: string;
  cinematographyLanguage: string;
  lightingLanguage: string;
};

type FindingView = {
  id: string;
  severity: "BLOCKER" | "WARNING" | "INFO";
  code: string;
  message: string;
  acknowledged: boolean;
};

type PlanView = {
  id: string;
  versionNumber: number;
  status: ScenePlanStatus;
  sourceFresh: boolean;
  qcSummary: {
    blockerCount: number;
    warningCount: number;
    infoCount: number;
  };
  findings: FindingView[];
  scenes: ScenePlanEditorScene[];
};

export type ScenePlanningWorkspaceProps = {
  organizationId: string;
  actorRole: AppRole;
  project: ProjectView;
  visualBible: VisualBibleView;
  plan?: PlanView;
};

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function statusTone(status: ScenePlanStatus): string {
  if (status === "APPROVED") return "border-emerald-800 bg-emerald-950/40 text-emerald-200";
  if (status === "STALE" || status === "FAILED") return "border-red-900 bg-red-950/40 text-red-200";
  if (status === "REVIEW_REQUIRED" || status === "QC_REQUIRED") return "border-amber-900 bg-amber-950/40 text-amber-200";
  return "border-slate-700 bg-slate-900/70 text-slate-300";
}

export function ScenePlanningWorkspace({ organizationId, actorRole, project, visualBible, plan }: ScenePlanningWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);

  const [title, setTitle] = useState(project.title);
  const [purpose, setPurpose] = useState(project.purpose);
  const [targetDurationSeconds, setTargetDurationSeconds] = useState(String(project.targetDurationSeconds));
  const [aspectRatio, setAspectRatio] = useState<ProjectView["aspectRatio"]>(project.aspectRatio);
  const [qualityProfile, setQualityProfile] = useState<ProjectView["qualityProfile"]>(project.qualityProfile);
  const [targetPlatforms, setTargetPlatforms] = useState(project.targetPlatforms.join("\n"));

  const [characters, setCharacters] = useState(visualBible.characters.join("\n"));
  const [locations, setLocations] = useState(visualBible.locations.join("\n"));
  const [negativeConstraints, setNegativeConstraints] = useState(visualBible.globalNegativeConstraints.join("\n"));
  const [realismLevel, setRealismLevel] = useState(visualBible.realismLevel);
  const [cinematographyLanguage, setCinematographyLanguage] = useState(visualBible.cinematographyLanguage);
  const [lightingLanguage, setLightingLanguage] = useState(visualBible.lightingLanguage);

  const canEditProject = EDIT_ROLES.includes(actorRole) && (!plan || PROJECT_EDITABLE_STATUSES.includes(plan.status));
  const canApprove = APPROVE_ROLES.includes(actorRole) && plan?.status === "REVIEW_REQUIRED";
  const warningCount = plan?.qcSummary.warningCount ?? 0;
  const blockerCount = plan?.qcSummary.blockerCount ?? 0;
  const approvalDisabled = isPending || !canApprove || !plan?.sourceFresh || blockerCount > 0 || (warningCount > 0 && !acknowledgeWarnings);

  const findingSummary = useMemo(() => {
    if (!plan) return "No QC result yet";
    return `${plan.qcSummary.blockerCount} blocker${plan.qcSummary.blockerCount === 1 ? "" : "s"} · ${plan.qcSummary.warningCount} warning${plan.qcSummary.warningCount === 1 ? "" : "s"} · ${plan.qcSummary.infoCount} info`;
  }, [plan]);

  function completeAction(result: { ok: true } | { ok: false; error: string }, successMessage: string) {
    if (!result.ok) {
      setNotice(null);
      setError(result.error);
      return;
    }
    setError(null);
    setNotice(successMessage);
    router.refresh();
  }

  function saveBrief() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await saveScenePlanningBriefAction({
        organizationId,
        projectId: project.id,
        title,
        purpose,
        targetDurationSeconds: Number(targetDurationSeconds),
        aspectRatio,
        qualityProfile,
        targetPlatforms: lines(targetPlatforms),
      });
      completeAction(result, "Production brief saved.");
    });
  }

  function saveVisualBible() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await saveVisualBibleAction({
        organizationId,
        projectId: project.id,
        characters: lines(characters),
        locations: lines(locations),
        globalNegativeConstraints: lines(negativeConstraints),
        realismLevel,
        cinematographyLanguage,
        lightingLanguage,
      });
      completeAction(result, "Visual Bible saved.");
    });
  }

  function generatePlan() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await generateScenePlanAction({ organizationId, projectId: project.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(`Scene Plan generated with ${result.blockerCount} blockers and ${result.warningCount} warnings.`);
      router.refresh();
    });
  }

  function runQc() {
    if (!plan) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await runScenePlanQcAction({ organizationId, planVersionId: plan.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(`QC complete: ${result.blockerCount} blockers, ${result.warningCount} warnings.`);
      router.refresh();
    });
  }

  function approvePlan() {
    if (!plan) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await approveScenePlanAction({ organizationId, planVersionId: plan.id, acknowledgeWarnings });
      completeAction(result, "Scene Plan approved.");
    });
  }

  function cloneForEdit() {
    if (!plan) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await cloneScenePlanForEditAction({ organizationId, planVersionId: plan.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(`Editable Scene Plan version created (${result.planVersionId}).`);
      router.refresh();
    });
  }

  return (
    <div className="mt-8 space-y-6">
      {error ? <div role="alert" className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}
      {notice ? <div role="status" className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-4 text-sm text-emerald-200">{notice}</div> : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-6" aria-labelledby="production-brief-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Project controls</p><h3 id="production-brief-heading" className="mt-2 text-xl font-semibold text-white">Production Brief</h3></div>
          <div className="text-right text-xs text-slate-500"><div>Source language {project.language}</div><div className="mt-1 font-mono">{project.sourceIntegrityHash}</div></div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-300">Project title<input aria-label="Project title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!canEditProject || isPending} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60" /></label>
          <label className="text-sm text-slate-300">Target duration (seconds)<input aria-label="Target duration" type="number" min="1" value={targetDurationSeconds} onChange={(event) => setTargetDurationSeconds(event.target.value)} disabled={!canEditProject || isPending} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60" /></label>
          <label className="text-sm text-slate-300 md:col-span-2">Purpose<textarea aria-label="Purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} disabled={!canEditProject || isPending} rows={3} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60" /></label>
          <label className="text-sm text-slate-300">Aspect ratio<select aria-label="Aspect ratio" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as ProjectView["aspectRatio"])} disabled={!canEditProject || isPending} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60"><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option><option value="4:5">4:5</option></select></label>
          <label className="text-sm text-slate-300">Quality profile<select aria-label="Quality profile" value={qualityProfile} onChange={(event) => setQualityProfile(event.target.value as ProjectView["qualityProfile"])} disabled={!canEditProject || isPending} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60"><option value="STANDARD">Standard</option><option value="PREMIUM">Premium</option><option value="CINEMATIC">Cinematic</option></select></label>
          <label className="text-sm text-slate-300 md:col-span-2">Target platforms<textarea aria-label="Target platforms" value={targetPlatforms} onChange={(event) => setTargetPlatforms(event.target.value)} disabled={!canEditProject || isPending} rows={2} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60" /></label>
        </div>
        {canEditProject ? <button type="button" onClick={saveBrief} disabled={isPending} className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Save production brief</button> : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-6" aria-labelledby="visual-bible-heading">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Continuity controls</p><h3 id="visual-bible-heading" className="mt-2 text-xl font-semibold text-white">Visual Bible</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-300">Characters<textarea aria-label="Characters" value={characters} onChange={(event) => setCharacters(event.target.value)} disabled={!canEditProject || isPending} rows={5} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60" /></label>
          <label className="text-sm text-slate-300">Locations<textarea aria-label="Locations" value={locations} onChange={(event) => setLocations(event.target.value)} disabled={!canEditProject || isPending} rows={5} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60" /></label>
          <label className="text-sm text-slate-300 md:col-span-2">Global negative constraints<textarea aria-label="Global negative constraints" value={negativeConstraints} onChange={(event) => setNegativeConstraints(event.target.value)} disabled={!canEditProject || isPending} rows={3} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60" /></label>
          <label className="text-sm text-slate-300">Realism level<textarea aria-label="Realism level" value={realismLevel} onChange={(event) => setRealismLevel(event.target.value)} disabled={!canEditProject || isPending} rows={3} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60" /></label>
          <label className="text-sm text-slate-300">Cinematography language<textarea aria-label="Cinematography language" value={cinematographyLanguage} onChange={(event) => setCinematographyLanguage(event.target.value)} disabled={!canEditProject || isPending} rows={3} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60" /></label>
          <label className="text-sm text-slate-300 md:col-span-2">Lighting language<textarea aria-label="Lighting language" value={lightingLanguage} onChange={(event) => setLightingLanguage(event.target.value)} disabled={!canEditProject || isPending} rows={3} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-60" /></label>
        </div>
        {canEditProject ? <button type="button" onClick={saveVisualBible} disabled={isPending} className="mt-5 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Visual Bible</button> : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-6" aria-labelledby="timeline-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Versioned planning</p><h3 id="timeline-heading" className="mt-2 text-xl font-semibold text-white">Scene & Shot Timeline</h3></div>
          <div className="flex flex-wrap gap-2">
            {EDIT_ROLES.includes(actorRole) ? <button type="button" onClick={generatePlan} disabled={isPending} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Generate Scene Plan</button> : null}
            {plan && EDIT_ROLES.includes(actorRole) && ["DRAFT", "QC_REQUIRED", "REVIEW_REQUIRED"].includes(plan.status) ? <button type="button" onClick={runQc} disabled={isPending} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Run QC</button> : null}
          </div>
        </div>
        {!plan ? <p className="mt-5 text-sm text-slate-400">No Scene Plan version exists yet. Generate one from the current brief and Visual Bible.</p> : (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap items-center gap-3"><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(plan.status)}`}>Version {plan.versionNumber} · {plan.status}</span><span className={plan.sourceFresh ? "text-xs text-emerald-300" : "text-xs text-red-300"}>{plan.sourceFresh ? "Source current" : "Source stale"}</span></div>
            {plan.status === "APPROVED" ? <p className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3 text-sm text-emerald-200">Approved versions are immutable.</p> : null}
            {plan.status === "APPROVED" && plan.sourceFresh ? <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-4"><p className="text-sm font-semibold text-emerald-100">Approved Scene Plan is ready for Phase 7 video-generation handoff.</p><p className="mt-1 text-sm leading-6 text-emerald-200/80">Phase 6 exports an immutable provider-neutral package only. No video provider is executed from this workspace.</p></div> : null}
            <ScenePlanEditor organizationId={organizationId} actorRole={actorRole} planVersionId={plan.id} status={plan.status} scenes={plan.scenes} />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-6" aria-labelledby="qc-heading">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Deterministic quality gate</p><h3 id="qc-heading" className="mt-2 text-xl font-semibold text-white">QC & Approval</h3></div><span className="text-sm text-slate-400">{findingSummary}</span></div>
        {plan?.findings.length ? <div className="mt-5 space-y-3">{plan.findings.map((finding) => <div key={finding.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-slate-300">{finding.severity}</span><span className="font-mono text-xs text-slate-500">{finding.code}</span>{finding.acknowledged ? <span className="text-xs text-emerald-300">Acknowledged</span> : null}</div><p className="mt-2 text-sm leading-6 text-slate-300">{finding.message}</p></div>)}</div> : <p className="mt-5 text-sm text-slate-400">No QC findings are recorded for the current plan.</p>}
        {plan && warningCount > 0 && canApprove ? <label className="mt-5 flex items-start gap-3 text-sm text-slate-300"><input type="checkbox" aria-label="Acknowledge outstanding QC warnings" checked={acknowledgeWarnings} onChange={(event) => setAcknowledgeWarnings(event.target.checked)} className="mt-1" /><span>Acknowledge outstanding QC warnings</span></label> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {plan && canApprove ? <button type="button" onClick={approvePlan} disabled={approvalDisabled} className="rounded-xl bg-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-40">Approve Scene Plan</button> : null}
          {plan?.status === "APPROVED" && EDIT_ROLES.includes(actorRole) ? <button type="button" onClick={cloneForEdit} disabled={isPending} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Create editable version</button> : null}
        </div>
      </section>
    </div>
  );
}
