"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AppRole } from "@/modules/auth/roles";
import type { ScenePlanStatus } from "@/modules/scene-planning/schema";
import {
  reorderScenePlanScenesAction,
  reorderScenePlanShotsAction,
  updateScenePlanSceneDraftAction,
  updateScenePlanShotDraftAction,
} from "./draft-edit-actions";
import { granularReplanScenePlanAction } from "./granular-replan-actions";
import { ShotVideoGenerationControls } from "./shot-video-generation-controls";

const EDIT_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR"];
const EDITABLE_STATUSES: readonly ScenePlanStatus[] = ["DRAFT", "QC_REQUIRED", "REVIEW_REQUIRED"];

export type ShotVideoGenerationView = {
  jobId: string;
  attemptId: string;
  state: "QUEUED" | "GENERATING" | "IMPORTING" | "COMPLETED" | "FAILED";
  mediaAssetId?: string;
  retryable?: boolean;
  errorCode?: string;
};

export type ScenePlanEditorShot = {
  id: string;
  ordinal: number;
  durationSeconds: number;
  narrationText: string;
  narrationStartChar: number | null;
  narrationEndChar: number | null;
  creativeDirection: string;
  masterVisualPrompt: string;
  cameraMotion: string;
  humanModified: boolean;
  videoGeneration?: ShotVideoGenerationView;
};

export type ScenePlanEditorScene = {
  id: string;
  ordinal: number;
  title: string;
  narrativeRole: string;
  durationSeconds: number;
  creativeDirection: string;
  shots: ScenePlanEditorShot[];
};

export type ScenePlanEditorProps = {
  organizationId: string;
  actorRole: AppRole;
  planVersionId: string;
  status: ScenePlanStatus;
  sourceFresh?: boolean;
  scenes: ScenePlanEditorScene[];
};

function reordered<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const copy = [...items];
  const current = copy[index];
  const target = copy[nextIndex];
  if (current === undefined || target === undefined) return items;
  copy[index] = target;
  copy[nextIndex] = current;
  return copy;
}

function numberField(form: FormData, name: string): number {
  return Number(form.get(name));
}

function textField(form: FormData, name: string): string {
  return String(form.get(name) ?? "");
}

export function ScenePlanEditor({
  organizationId,
  actorRole,
  planVersionId,
  status,
  sourceFresh = false,
  scenes,
}: ScenePlanEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [replaceHumanByScene, setReplaceHumanByScene] = useState<Record<number, boolean>>({});
  const editable = EDIT_ROLES.includes(actorRole) && EDITABLE_STATUSES.includes(status);

  function finish(result: { ok: true } | { ok: false; error: string }, message: string) {
    if (!result.ok) {
      setNotice(null);
      setError(result.error);
      return;
    }
    setError(null);
    setNotice(message);
    router.refresh();
  }

  function saveScene(event: React.FormEvent<HTMLFormElement>, scene: ScenePlanEditorScene) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateScenePlanSceneDraftAction({
        organizationId,
        planVersionId,
        sceneId: scene.id,
        title: textField(form, "title"),
        durationSeconds: numberField(form, "durationSeconds"),
        creativeDirection: textField(form, "creativeDirection"),
      });
      finish(result, `Scene ${scene.ordinal} changes saved. QC must be rerun.`);
    });
  }

  function saveShot(event: React.FormEvent<HTMLFormElement>, scene: ScenePlanEditorScene, shot: ScenePlanEditorShot) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateScenePlanShotDraftAction({
        organizationId,
        planVersionId,
        shotId: shot.id,
        durationSeconds: numberField(form, "durationSeconds"),
        creativeDirection: textField(form, "creativeDirection"),
        masterVisualPrompt: textField(form, "masterVisualPrompt"),
        cameraMotion: textField(form, "cameraMotion"),
      });
      finish(result, `Shot ${scene.ordinal}.${shot.ordinal} changes saved. QC must be rerun.`);
    });
  }

  function moveScene(index: number, direction: -1 | 1) {
    const next = reordered(scenes, index, direction);
    if (next === scenes) return;
    startTransition(async () => {
      const result = await reorderScenePlanScenesAction({
        organizationId,
        planVersionId,
        orderedSceneIds: next.map((scene) => scene.id),
      });
      finish(result, "Scene order updated. QC must be rerun.");
    });
  }

  function moveShot(scene: ScenePlanEditorScene, index: number, direction: -1 | 1) {
    const next = reordered(scene.shots, index, direction);
    if (next === scene.shots) return;
    startTransition(async () => {
      const result = await reorderScenePlanShotsAction({
        organizationId,
        planVersionId,
        sceneId: scene.id,
        orderedShotIds: next.map((shot) => shot.id),
      });
      finish(result, `Shot order updated in Scene ${scene.ordinal}. QC must be rerun.`);
    });
  }

  function replanScene(scene: ScenePlanEditorScene) {
    const replaceHumanModifiedShots = replaceHumanByScene[scene.ordinal] === true;
    startTransition(async () => {
      const result = await granularReplanScenePlanAction({
        organizationId,
        planVersionId,
        scope: "SCENE",
        targetSceneOrdinal: scene.ordinal,
        replaceHumanModifiedShots,
      });
      if (!result.ok) {
        setNotice(null);
        setError(result.error);
        return;
      }
      setError(null);
      setNotice(`Scene ${scene.ordinal} replanned as a new version. QC has been rerun.`);
      router.refresh();
    });
  }

  function replanShot(scene: ScenePlanEditorScene, shot: ScenePlanEditorShot) {
    const replaceHumanModifiedShots = replaceHumanByScene[scene.ordinal] === true;
    startTransition(async () => {
      const result = await granularReplanScenePlanAction({
        organizationId,
        planVersionId,
        scope: "SHOT",
        targetSceneOrdinal: scene.ordinal,
        targetShotOrdinal: shot.ordinal,
        replaceHumanModifiedShots,
      });
      if (!result.ok) {
        setNotice(null);
        setError(result.error);
        return;
      }
      setError(null);
      setNotice(`Shot ${scene.ordinal}.${shot.ordinal} replanned as a new version. QC has been rerun.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {error ? <div role="alert" className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</div> : null}
      {notice ? <div role="status" className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</div> : null}

      {scenes.map((scene, sceneIndex) => {
        const containsHumanEdits = scene.shots.some((shot) => shot.humanModified);
        const replaceHumanModifiedShots = replaceHumanByScene[scene.ordinal] === true;
        return (
          <details key={scene.id} open={sceneIndex === 0} className="rounded-2xl border border-slate-800 bg-slate-950">
            <summary className="cursor-pointer list-none p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Scene {scene.ordinal} · {scene.narrativeRole}</p>
                  <h4 className="mt-1 text-lg font-semibold text-white">{scene.title}</h4>
                  <p className="mt-2 text-sm text-slate-400">{scene.creativeDirection}</p>
                </div>
                <span className="text-xs text-slate-400">{scene.durationSeconds}s · {scene.shots.length} shot{scene.shots.length === 1 ? "" : "s"}</span>
              </div>
            </summary>

            <div className="border-t border-slate-800 p-5">
              {editable ? (
                <form onSubmit={(event) => saveScene(event, scene)} className="grid gap-4 lg:grid-cols-2">
                  <label className="text-sm text-slate-300">
                    Scene title
                    <input name="title" aria-label={`Scene ${scene.ordinal} title`} defaultValue={scene.title} disabled={isPending} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-50" />
                  </label>
                  <label className="text-sm text-slate-300">
                    Duration seconds
                    <input name="durationSeconds" aria-label={`Scene ${scene.ordinal} duration`} type="number" min="0.1" step="0.1" defaultValue={scene.durationSeconds} disabled={isPending} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-50" />
                  </label>
                  <label className="text-sm text-slate-300 lg:col-span-2">
                    Creative direction
                    <textarea name="creativeDirection" aria-label={`Scene ${scene.ordinal} creative direction`} defaultValue={scene.creativeDirection} rows={3} disabled={isPending} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-50" />
                  </label>
                  <div className="flex flex-wrap gap-2 lg:col-span-2">
                    <button type="submit" disabled={isPending} className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" aria-label={`Save Scene ${scene.ordinal} changes`}>Save Scene {scene.ordinal} changes</button>
                    {sceneIndex > 0 ? <button type="button" onClick={() => moveScene(sceneIndex, -1)} disabled={isPending} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-50" aria-label={`Move Scene ${scene.ordinal} up`}>Move up</button> : null}
                    {sceneIndex < scenes.length - 1 ? <button type="button" onClick={() => moveScene(sceneIndex, 1)} disabled={isPending} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-50" aria-label={`Move Scene ${scene.ordinal} down`}>Move down</button> : null}
                    <button type="button" onClick={() => replanScene(scene)} disabled={isPending} className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" aria-label={`Replan Scene ${scene.ordinal}`}>Replan Scene {scene.ordinal}</button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-slate-400">This version is read-only. Create an editable version before changing or replanning scenes.</p>
              )}

              {editable && containsHumanEdits ? (
                <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-900/40 bg-amber-950/20 p-3 text-sm text-amber-100">
                  <input
                    type="checkbox"
                    aria-label={`Allow AI to replace human edits in Scene ${scene.ordinal}`}
                    checked={replaceHumanModifiedShots}
                    onChange={(event) => setReplaceHumanByScene((current) => ({ ...current, [scene.ordinal]: event.target.checked }))}
                    className="mt-1"
                  />
                  <span>Allow AI to replace human edits in Scene {scene.ordinal}. Leave unchecked to preserve all human-modified shots.</span>
                </label>
              ) : null}

              <div className="mt-5 space-y-4">
                {scene.shots.map((shot, shotIndex) => {
                  const humanTargetProtected = shot.humanModified && !replaceHumanModifiedShots;
                  return (
                    <article key={shot.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">Shot {scene.ordinal}.{shot.ordinal} · {shot.durationSeconds}s</p>
                        {shot.humanModified ? <span className="rounded-full border border-amber-800 px-2.5 py-1 text-xs text-amber-200">Human modified</span> : null}
                      </div>

                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Locked narration · Characters {shot.narrationStartChar ?? "—"}–{shot.narrationEndChar ?? "—"}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{shot.narrationText}</p>
                      </div>

                      {editable ? (
                        <form onSubmit={(event) => saveShot(event, scene, shot)} className="mt-4 grid gap-4 lg:grid-cols-2">
                          <label className="text-sm text-slate-300">
                            Duration seconds
                            <input name="durationSeconds" aria-label={`Shot ${scene.ordinal}.${shot.ordinal} duration`} type="number" min="0.1" step="0.1" defaultValue={shot.durationSeconds} disabled={isPending} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-50" />
                          </label>
                          <label className="text-sm text-slate-300">
                            Camera motion
                            <input name="cameraMotion" aria-label={`Shot ${scene.ordinal}.${shot.ordinal} camera motion`} defaultValue={shot.cameraMotion} disabled={isPending} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-50" />
                          </label>
                          <label className="text-sm text-slate-300 lg:col-span-2">
                            Creative direction
                            <textarea name="creativeDirection" aria-label={`Shot ${scene.ordinal}.${shot.ordinal} creative direction`} defaultValue={shot.creativeDirection} rows={3} disabled={isPending} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-50" />
                          </label>
                          <label className="text-sm text-slate-300 lg:col-span-2">
                            Generation specification
                            <textarea name="masterVisualPrompt" aria-label={`Shot ${scene.ordinal}.${shot.ordinal} generation specification`} defaultValue={shot.masterVisualPrompt} rows={4} disabled={isPending} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 disabled:opacity-50" />
                          </label>
                          <div className="flex flex-wrap gap-2 lg:col-span-2">
                            <button type="submit" disabled={isPending} className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" aria-label={`Save Shot ${scene.ordinal}.${shot.ordinal} changes`}>Save Shot {scene.ordinal}.{shot.ordinal} changes</button>
                            {shotIndex > 0 ? <button type="button" onClick={() => moveShot(scene, shotIndex, -1)} disabled={isPending} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-50" aria-label={`Move Shot ${scene.ordinal}.${shot.ordinal} up`}>Move up</button> : null}
                            {shotIndex < scene.shots.length - 1 ? <button type="button" onClick={() => moveShot(scene, shotIndex, 1)} disabled={isPending} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-50" aria-label={`Move Shot ${scene.ordinal}.${shot.ordinal} down`}>Move down</button> : null}
                            <button type="button" onClick={() => replanShot(scene, shot)} disabled={isPending || humanTargetProtected} title={humanTargetProtected ? "Enable explicit human-edit replacement for this scene before replanning this shot." : undefined} className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" aria-label={`Replan Shot ${scene.ordinal}.${shot.ordinal}`}>Replan Shot {scene.ordinal}.{shot.ordinal}</button>
                          </div>
                        </form>
                      ) : (
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Creative Direction</p><p className="mt-2 text-sm leading-6 text-slate-200">{shot.creativeDirection}</p></div>
                          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Generation Specification</p><p className="mt-2 text-sm leading-6 text-slate-200">{shot.masterVisualPrompt}</p></div>
                        </div>
                      )}

                      <ShotVideoGenerationControls
                        organizationId={organizationId}
                        actorRole={actorRole}
                        planVersionId={planVersionId}
                        planStatus={status}
                        sourceFresh={sourceFresh}
                        sceneOrdinal={scene.ordinal}
                        shot={shot}
                      />
                    </article>
                  );
                })}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
