"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useTransition } from "react";

import type { AppRole } from "@/modules/auth/roles";
import type { AssemblyBlockReason } from "@/modules/video/assembly/readiness";
import type { FinalAssemblyReadModel } from "@/modules/video/assembly/read-repository";
import { enqueueFinalAssemblyAction } from "./final-assembly-actions";

const EDIT_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR"];

const REASON_COPY: Record<AssemblyBlockReason, string> = {
  PLAN_NOT_APPROVED: "The Scene Plan must be approved before final rendering.",
  SOURCE_STALE: "The canonical source changed after this Scene Plan was created.",
  QC_BLOCKER_PRESENT: "Resolve all blocker-level QC findings before final rendering.",
  NO_SHOTS: "The approved Scene Plan does not contain any shots.",
  SHOT_MEDIA_MISSING: "Required shot media is not ready for final assembly.",
  MEDIA_NOT_ACTIVE: "One or more required shot media assets are inactive or invalid.",
  UNSUPPORTED_ASPECT_RATIO: "This aspect ratio is not supported by the Phase 8 render profile.",
  ASSEMBLY_ALREADY_RUNNING: "A final video assembly is already running for this Scene Plan.",
};

export function FinalRenderControls({
  organizationId,
  planVersionId,
  actorRole,
  view,
}: {
  organizationId: string;
  planVersionId: string;
  actorRole: AppRole;
  view: FinalAssemblyReadModel;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const canRender = EDIT_ROLES.includes(actorRole);
  const assembly = view.assembly;

  function enqueue() {
    setMessage(null);
    startTransition(async () => {
      const result = await enqueueFinalAssemblyAction({
        organizationId,
        planVersionId,
        profile: "PAK_MASTER_1080P_V1",
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(result.mediaAssetId ? "Final visual master is already available in PAK Media." : "Final render queued.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" aria-labelledby="final-render-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Phase 8 assembly</p>
          <h4 id="final-render-heading" className="mt-1 text-base font-semibold text-white">Final visual master</h4>
        </div>
        <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-400">PAK_MASTER_1080P_V1</span>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-400">
        PAK assembles the approved generated shots into a deterministic visual master. Phase 8 does not add narration, music, or provider audio.
      </p>

      {assembly?.state === "COMPLETED" && assembly.finalMediaAssetId ? (
        <div className="mt-4 rounded-xl border border-emerald-900/60 bg-emerald-950/25 p-4">
          <p className="text-sm font-semibold text-emerald-200">Final visual master completed.</p>
          <Link
            href={`/media-library?asset=${assembly.finalMediaAssetId}`}
            className="mt-2 inline-block text-sm font-medium text-emerald-300 underline underline-offset-4"
          >
            Open final video in Media Library
          </Link>
        </div>
      ) : assembly?.state === "QUEUED" || assembly?.state === "PROCESSING" ? (
        <div className="mt-4 rounded-xl border border-sky-900/60 bg-sky-950/25 p-4 text-sm text-sky-200">
          {assembly.state === "QUEUED" ? "Final visual master is queued for the render worker." : "Final visual master is rendering."}
        </div>
      ) : assembly?.state === "FAILED" ? (
        <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/25 p-4 text-sm text-red-200">
          Final visual master failed. A new render can start only when the authoritative render state becomes ready again.
        </div>
      ) : null}

      {view.reasons.length > 0 && assembly?.state !== "COMPLETED" ? (
        <ul className="mt-4 space-y-2" aria-label="Final render blockers">
          {view.reasons.map((reason) => (
            <li key={reason} className="rounded-lg border border-amber-900/50 bg-amber-950/15 px-3 py-2 text-sm text-amber-100">
              {REASON_COPY[reason]}
            </li>
          ))}
        </ul>
      ) : null}

      {view.ready && canRender && assembly?.state !== "COMPLETED" ? (
        <button
          type="button"
          aria-label="Generate final video"
          onClick={enqueue}
          disabled={isPending}
          className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {isPending ? "Queueing final render…" : "Generate final video"}
        </button>
      ) : null}

      {view.ready && !canRender && !assembly ? (
        <p className="mt-4 text-sm text-slate-500">The final render is ready, but your role is read-only for render creation.</p>
      ) : null}

      {message ? <p role="status" className="mt-3 text-sm text-slate-300">{message}</p> : null}
    </section>
  );
}
