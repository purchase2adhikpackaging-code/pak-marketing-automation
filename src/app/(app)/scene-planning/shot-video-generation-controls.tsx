"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AppRole } from "@/modules/auth/roles";
import type { ScenePlanStatus } from "@/modules/scene-planning/schema";
import type { ScenePlanEditorShot } from "./scene-plan-editor";
import {
  enqueueShotVideoGenerationAction,
  reconcileShotVideoGenerationAction,
  retryShotVideoGenerationAction,
} from "./video-generation-actions";

const EDIT_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR"];

type Props = {
  organizationId: string;
  actorRole: AppRole;
  planVersionId: string;
  planStatus: ScenePlanStatus;
  sourceFresh: boolean;
  sceneOrdinal: number;
  shot: ScenePlanEditorShot;
};

export function ShotVideoGenerationControls({
  organizationId,
  actorRole,
  planVersionId,
  planStatus,
  sourceFresh,
  sceneOrdinal,
  shot,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const generation = shot.videoGeneration;
  if (planStatus !== "APPROVED") return null;

  const canOperate = sourceFresh && EDIT_ROLES.includes(actorRole);
  const label = `Shot ${sceneOrdinal}.${shot.ordinal}`;

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-sky-900/60 bg-sky-950/20 p-3" aria-label={`${label} video generation`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">Video generation</p>
          {!generation ? <p className="mt-1 text-sm text-slate-300">No generated video yet.</p> : null}
          {generation?.state === "QUEUED" ? <p className="mt-1 text-sm text-slate-300">Queued for generation.</p> : null}
          {generation?.state === "GENERATING" ? <p className="mt-1 text-sm text-slate-300">Provider generation in progress.</p> : null}
          {generation?.state === "IMPORTING" ? <p className="mt-1 text-sm text-slate-300">Importing completed video into PAK Media.</p> : null}
          {generation?.state === "COMPLETED" ? (
            <p className="mt-1 text-sm text-emerald-200">
              Video ready in PAK Media{generation.mediaAssetId ? ` · ${generation.mediaAssetId}` : ""}
            </p>
          ) : null}
          {generation?.state === "FAILED" ? (
            <p className="mt-1 text-sm text-red-200">
              Generation failed{generation.errorCode ? ` · ${generation.errorCode}` : ""}
            </p>
          ) : null}
          {!sourceFresh ? <p className="mt-1 text-xs text-red-300">Source is stale. Generation is locked.</p> : null}
          {sourceFresh && !EDIT_ROLES.includes(actorRole) ? <p className="mt-1 text-xs text-slate-500">Editor access is required to operate generation.</p> : null}
        </div>

        {canOperate && !generation ? (
          <button
            type="button"
            disabled={isPending}
            aria-label={`Generate ${label} video`}
            onClick={() => run(() => enqueueShotVideoGenerationAction({ organizationId, planVersionId, shotId: shot.id }))}
            className="rounded-xl bg-sky-200 px-3 py-2 text-sm font-semibold text-sky-950 disabled:opacity-50"
          >
            Generate video
          </button>
        ) : null}

        {canOperate && generation && ["QUEUED", "GENERATING", "IMPORTING"].includes(generation.state) ? (
          <button
            type="button"
            disabled={isPending}
            aria-label={`Refresh ${label} video status`}
            onClick={() => run(() => reconcileShotVideoGenerationAction({
              organizationId,
              jobId: generation.jobId,
              attemptId: generation.attemptId,
            }))}
            className="rounded-xl border border-sky-800 px-3 py-2 text-sm font-semibold text-sky-100 disabled:opacity-50"
          >
            Refresh status
          </button>
        ) : null}

        {canOperate && generation?.state === "FAILED" && generation.retryable === true ? (
          <button
            type="button"
            disabled={isPending}
            aria-label={`Retry ${label} video`}
            onClick={() => run(() => retryShotVideoGenerationAction({
              organizationId,
              jobId: generation.jobId,
              attemptId: generation.attemptId,
            }))}
            className="rounded-xl border border-amber-800 px-3 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
          >
            Retry video
          </button>
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-red-200">{error}</p> : null}
    </div>
  );
}
