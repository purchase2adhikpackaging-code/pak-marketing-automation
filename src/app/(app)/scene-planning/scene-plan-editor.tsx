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

  function updateScene(scene: ScenePlanEditorScene, form: FormData) {
    startTransition(async () => {
      const result = await updateScenePlanSceneDraftAction({
        organizationId,
        planVersionId,
        sceneId: scene.id,
        title: textField(form, "title"),
        narrativeRole: textField(form, "narrativeRole") as ScenePlanEditorScene["narrativeRole"],
        durationSeconds: numberField(form, "durationSeconds"),
        creativeDirection: textField(form, "creativeDirection"),
      });
      finish(result, `Scene ${scene.ordinal} updated.`);
    });
  }

  function updateShot(sceneId: string, shot: ScenePlanEditorShot, form: FormData) {
    startTransition(async () => {
      const result = await updateScenePlanShotDraftAction({
        organizationId,
        planVersionId,
        sceneId,
        shotId: shot.id,
        durationSeconds: numberField(form, "durationSeconds"),
        creativeDirection: textField(form, "creativeDirection"),
        masterVisualPrompt: textField(form, "masterVisualPrompt"),
        cameraMotion: textField(form, "cameraMotion"),
      });
      finish(result, `Shot ${shot.ordinal} updated.`);
    });
  }

  function moveScene(index: number, direction: -1 | 1) {
    const order = reordered(scenes, index, direction).map((scene) => scene.id);
    startTransition(async () => {
      const result = await reorderScenePlanScenesAction({ organizationId, planVersionId, sceneIds: order });
      finish(result, "Scene order updated.");
    });
  }

  function moveShot(scene: ScenePlanEditorScene, index: number, direction: -1 | 1) {
    const order = reordered(scene.shots, index, direction).map((shot) => shot.id);
    startTransition(async () => {
      const result = await reorderScenePlanShotsAction({ organizationId, planVersionId, sceneId: scene.id, shotIds: order });
      finish(result, "Shot order updated.");
    });
  }

  function replanScene(scene: ScenePlanEditorScene) {
    startTransition(async () => {
      const result = await granularReplanScenePlanAction({
        organizationId,
        planVersionId,
        scope: "SCENE",
        sceneOrdinal: scene.ordinal,
        replaceHumanModified: replaceHumanByScene[scene.ordinal] ?? false,
      });
      finish(result, `Scene ${scene.ordinal} replanned into a new draft version.`);
    });
  }

  function replanShot(scene: ScenePlanEditorScene, shot: ScenePlanEditorShot, replaceHumanModified: boolean) {
    startTransition(async () => {
      const result = await granularReplanScenePlanAction({
        organizationId,
        planVersionId,
        scope: "SHOT",
        sceneOrdinal: scene.ordinal,
        shotOrdinal: shot.ordinal,
        replaceHumanModified,
      });
      finish(result, `Shot ${shot.ordinal} replanned into a new draft version.`);
    });
  }

  return (
    <section className="space-y-4" aria-label="Scene plan editor">
      {error ? <p role="alert" className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">{notice}</p> : null}

      {scenes.map((scene, sceneIndex) => (
        <article key={scene.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Scene {scene.ordinal} · {scene.narrativeRole}</h3>
              <p className="text-sm text-slate-400">{scene.title} · {scene.durationSeconds}s</p>
            </div>
            {editable ? (
              <div className="flex gap-2">
                <button type="button" disabled={isPending || sceneIndex === 0} onClick={() => moveScene(sceneIndex, -1)}>Move up</button>
                <button type="button" disabled={isPending || sceneIndex === scenes.length - 1} onClick={() => moveScene(sceneIndex, 1)}>Move down</button>
              </div>
            ) : null}
          </div>

          <p className="mb-4 text-sm text-slate-300"><span className="font-medium text-slate-100">Creative Direction:</span> {scene.creativeDirection}</p>

          {editable ? (
            <details className="mb-4 rounded-lg border border-slate-800 p-3">
              <summary className="cursor-pointer font-medium">Edit scene</summary>
              <form action={(form) => updateScene(scene, form)} className="mt-3 grid gap-3">
                <label>Title<input name="title" defaultValue={scene.title} /></label>
                <label>Narrative role<input name="narrativeRole" defaultValue={scene.narrativeRole} /></label>
                <label>Duration seconds<input name="durationSeconds" type="number" step="0.1" min="0.1" defaultValue={scene.durationSeconds} /></label>
                <label>Creative Direction<textarea name="creativeDirection" defaultValue={scene.creativeDirection} /></label>
                <button type="submit" disabled={isPending}>Save scene</button>
              </form>
              <div className="mt-4 border-t border-slate-800 pt-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={replaceHumanByScene[scene.ordinal] ?? false}
                    onChange={(event) => setReplaceHumanByScene((current) => ({ ...current, [scene.ordinal]: event.target.checked }))}
                  />
                  Allow AI to replace human-modified shots in this scene
                </label>
                <button type="button" disabled={isPending} onClick={() => replanScene(scene)}>Replan scene</button>
              </div>
            </details>
          ) : null}

          <div className="space-y-3">
            {scene.shots.map((shot, shotIndex) => (
              <div key={shot.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium">Shot {shot.ordinal} · {shot.durationSeconds}s</p>
                  {editable ? (
                    <div className="flex gap-2">
                      <button type="button" disabled={isPending || shotIndex === 0} onClick={() => moveShot(scene, shotIndex, -1)}>Move shot up</button>
                      <button type="button" disabled={isPending || shotIndex === scene.shots.length - 1} onClick={() => moveShot(scene, shotIndex, 1)}>Move shot down</button>
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 text-sm"><span className="font-medium">Narration:</span> {shot.narrationText || "—"}</p>
                <p className="mt-1 text-xs text-slate-500">Characters {shot.narrationStartChar ?? "—"}–{shot.narrationEndChar ?? "—"}</p>
                <p className="mt-3 text-sm"><span className="font-medium">Creative Direction:</span> {shot.creativeDirection}</p>
                <p className="mt-2 text-sm"><span className="font-medium">Generation Specification:</span> {shot.masterVisualPrompt}</p>
                <p className="mt-2 text-xs text-slate-500">Camera: {shot.cameraMotion || "not specified"}{shot.humanModified ? " · Human modified" : ""}</p>

                {editable ? (
                  <details className="mt-3 rounded-lg border border-slate-800 p-3">
                    <summary className="cursor-pointer font-medium">Edit shot</summary>
                    <form action={(form) => updateShot(scene.id, shot, form)} className="mt-3 grid gap-3">
                      <label>Duration seconds<input name="durationSeconds" type="number" step="0.1" min="0.1" defaultValue={shot.durationSeconds} /></label>
                      <label>Creative Direction<textarea name="creativeDirection" defaultValue={shot.creativeDirection} /></label>
                      <label>Generation Specification<textarea name="masterVisualPrompt" defaultValue={shot.masterVisualPrompt} /></label>
                      <label>Camera motion<input name="cameraMotion" defaultValue={shot.cameraMotion} /></label>
                      <button type="submit" disabled={isPending}>Save shot</button>
                    </form>
                    <div className="mt-4 border-t border-slate-800 pt-3">
                      {shot.humanModified ? (
                        <label className="mb-2 flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            aria-label={`Allow AI to replace human edit for shot ${shot.ordinal}`}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              const button = event.currentTarget.closest("details")?.querySelector<HTMLButtonElement>("button[data-shot-replan]");
                              if (button) button.dataset.replaceHuman = checked ? "true" : "false";
                            }}
                          />
                          Allow AI to replace this human edit
                        </label>
                      ) : null}
                      <button
                        type="button"
                        data-shot-replan
                        data-replace-human="false"
                        disabled={isPending || shot.humanModified}
                        onClick={(event) => replanShot(scene, shot, event.currentTarget.dataset.replaceHuman === "true")}
                      >
                        Replan shot
                      </button>
                    </div>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
