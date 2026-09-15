"use client";

import React, { useEffect, useState, useTransition } from "react";

import type { AppRole } from "@/modules/auth/roles";
import type { ApprovalDetail, ApprovalEvent } from "@/modules/approval/read-model";
import type { ApprovalDecision } from "@/modules/approval/types";
import {
  decideApprovalAction,
  loadApprovalDetailAction,
  previewApprovalMediaAction,
} from "../actions";

const DECISION_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "REVIEWER"];

function formatTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function statusLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function intentEntries(intent: Record<string, unknown>): [string, string][] {
  return Object.entries(intent).map(([key, value]) => [
    key,
    typeof value === "string" ? value : JSON.stringify(value),
  ]);
}

function eventActor(event: ApprovalEvent): string {
  if (event.actorKind === "SYSTEM") return "System";
  return event.actorUserId ? `User ${event.actorUserId.slice(0, 8)}…` : "User";
}

export function ApprovalReviewClient({
  organizationId,
  role,
  initialDetail,
}: {
  organizationId: string;
  role: AppRole;
  initialDetail: ApprovalDetail;
}) {
  const [detail, setDetail] = useState(initialDetail);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDetail(initialDetail);
    setComment("");
    setError(null);
    setPreviewUrl(null);
    setPreviewError(null);
  }, [initialDetail]);

  const canDecide = detail.status === "PENDING" && DECISION_ROLES.includes(role);

  function refreshAuthoritativeDetail() {
    return loadApprovalDetailAction({ organizationId, requestId: detail.id });
  }

  function decide(decision: ApprovalDecision) {
    const normalizedComment = comment.trim();
    if ((decision === "REQUEST_CHANGES" || decision === "REJECT") && !normalizedComment) {
      setError("A comment is required for request changes or rejection.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await decideApprovalAction({
        organizationId,
        requestId: detail.id,
        decision,
        ...(normalizedComment ? { comment: normalizedComment } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const refreshed = await refreshAuthoritativeDetail();
      if (!refreshed.ok) {
        setError(refreshed.error);
        return;
      }
      if (!refreshed.detail) {
        setError("The approval request is no longer available.");
        return;
      }
      setDetail(refreshed.detail);
      setComment("");
      if (result.staleTarget) {
        setError("The reviewed target changed and the request was superseded.");
      }
    });
  }

  function createPreview() {
    if (detail.target.type !== "MEDIA_ASSET") return;
    setPreviewError(null);
    setPreviewUrl(null);
    const mediaAssetId = detail.target.mediaAssetId;
    startTransition(async () => {
      const result = await previewApprovalMediaAction({ organizationId, mediaAssetId });
      if (!result.ok) {
        setPreviewError(result.error);
        return;
      }
      setPreviewUrl(result.signedUrl);
    });
  }

  const intent = intentEntries(detail.publicationIntent);

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Exact review target</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {detail.target.type === "CONTENT_ARTIFACT" ? detail.target.topic : detail.target.displayName}
            </h2>
          </div>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200">
            {statusLabel(detail.status)}
          </span>
        </div>

        {detail.target.type === "CONTENT_ARTIFACT" ? (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
              <span>{detail.target.language}</span>
              <span>Revision {detail.target.revision}</span>
              {detail.target.sourceRevision !== undefined ? <span>Source revision {detail.target.sourceRevision}</span> : null}
              <span>{detail.target.isSource ? "Canonical source" : "Translation"}</span>
              <span>{detail.target.status}</span>
            </div>
            <div className="whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-sm leading-7 text-slate-100">
              {detail.target.scriptText}
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <dl className="grid gap-3 text-sm">
              <div><dt className="text-slate-500">Asset type</dt><dd className="mt-1 text-slate-100">{detail.target.assetType}</dd></div>
              <div><dt className="text-slate-500">MIME</dt><dd className="mt-1 text-slate-100">{detail.target.mimeType}</dd></div>
              <div><dt className="text-slate-500">Checksum</dt><dd className="mt-1 break-all font-mono text-xs text-slate-200">{detail.target.checksum}</dd></div>
              {detail.target.source ? <div><dt className="text-slate-500">Lineage</dt><dd className="mt-1 text-slate-100">{detail.target.source}</dd></div> : null}
              {detail.target.width && detail.target.height ? <div><dt className="text-slate-500">Dimensions</dt><dd className="mt-1 text-slate-100">{detail.target.width} × {detail.target.height}</dd></div> : null}
              {detail.target.durationSeconds !== undefined ? <div><dt className="text-slate-500">Duration</dt><dd className="mt-1 text-slate-100">{detail.target.durationSeconds}s</dd></div> : null}
            </dl>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-sm font-semibold text-white">Secure preview</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">A short-lived preview is created only when requested and is never persisted in approval history.</p>
              <button
                type="button"
                onClick={createPreview}
                disabled={isPending}
                className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                Create secure preview
              </button>
              {previewError ? <p role="alert" className="mt-3 text-sm text-red-300">{previewError}</p> : null}
              {previewUrl ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-medium text-emerald-300">Secure preview ready</p>
                  {detail.target.mimeType.startsWith("video/") ? <video controls src={previewUrl} className="max-h-80 w-full rounded-xl bg-black" /> : null}
                  {detail.target.mimeType.startsWith("image/") ? <img src={previewUrl} alt={detail.target.displayName} className="max-h-80 w-full rounded-xl object-contain" /> : null}
                  {!detail.target.mimeType.startsWith("video/") && !detail.target.mimeType.startsWith("image/") ? (
                    <a href={previewUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-300 underline underline-offset-4">Open secure preview</a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Publication intent</p>
        <h3 className="mt-2 text-lg font-semibold text-white">Non-authoritative review context</h3>
        {intent.length > 0 ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {intent.map(([key, value]) => (
              <div key={key} className="rounded-xl border border-slate-800 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">{key}</dt>
                <dd className="mt-1 break-words text-sm text-slate-200">{value}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="mt-3 text-sm text-slate-500">No publication context was supplied.</p>}
      </section>

      {detail.target.type === "CONTENT_ARTIFACT" ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Knowledge provenance</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Immutable generation-time sources</h3>
          {detail.knowledgeSources.length === 0 ? <p className="mt-3 text-sm text-slate-500">No Knowledge Base snapshots were attached.</p> : (
            <div className="mt-4 space-y-3">
              {detail.knowledgeSources.map((source) => (
                <article key={source.id} className="rounded-xl border border-slate-800 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold text-white">{source.title}</h4>
                    <span className="text-xs text-slate-500">Revision {source.knowledgeRevision}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{source.content}</p>
                  <p className="mt-2 text-xs text-slate-500">{source.sourceLabel ?? source.sourceType}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Audit history</p>
        <h3 className="mt-2 text-lg font-semibold text-white">Immutable approval events</h3>
        {detail.events.length === 0 ? <p className="mt-3 text-sm text-slate-500">No approval events recorded.</p> : (
          <ol className="mt-4 space-y-3">
            {detail.events.map((event) => (
              <li key={event.id} className="rounded-xl border border-slate-800 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">{event.eventType}</span>
                  <time className="text-xs text-slate-500">{formatTime(event.createdAt)}</time>
                </div>
                <p className="mt-1 text-xs text-slate-500">{eventActor(event)}</p>
                {event.comment ? <p className="mt-2 text-sm text-slate-300">{event.comment}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {canDecide ? (
        <section className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Decision</p>
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-slate-200">Decision comment</span>
            <textarea
              aria-label="Decision comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
              rows={4}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              placeholder="Required for request changes or rejection; optional for approval."
              disabled={isPending}
            />
          </label>
          {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => decide("APPROVE")} disabled={isPending} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Approve</button>
            <button type="button" onClick={() => decide("REQUEST_CHANGES")} disabled={isPending} className="rounded-xl border border-amber-800 px-4 py-2 text-sm font-semibold text-amber-200 disabled:opacity-50">Request changes</button>
            <button type="button" onClick={() => decide("REJECT")} disabled={isPending} className="rounded-xl border border-red-900 px-4 py-2 text-sm font-semibold text-red-200 disabled:opacity-50">Reject</button>
          </div>
        </section>
      ) : error ? <p role="alert" className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
