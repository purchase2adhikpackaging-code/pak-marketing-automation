"use client";

import Link from "next/link";
import React from "react";

import type { SafeMediaAsset } from "@/modules/media/read-model";

export function MediaDetail({
  asset,
  signedUrl,
  previewPending,
  canSubmitForReview,
  reviewPending,
  reviewRequestHref,
  onPreview,
  onSubmitForReview,
  onClose,
}: {
  asset: SafeMediaAsset;
  signedUrl: string | undefined;
  previewPending: boolean;
  canSubmitForReview: boolean;
  reviewPending: boolean;
  reviewRequestHref: string | undefined;
  onPreview(): void;
  onSubmitForReview(): void;
  onClose(): void;
}) {
  return (
    <aside className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5" aria-label="Media details">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Asset detail</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{asset.displayName}</h3>
          <p className="mt-1 text-xs text-slate-500">{asset.assetType} · {asset.source} · {asset.status}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
          Close
        </button>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-slate-500">MIME</dt><dd className="mt-1 text-slate-200">{asset.mimeType}</dd></div>
        <div><dt className="text-slate-500">Created</dt><dd className="mt-1 text-slate-200">{new Date(asset.createdAt).toLocaleString()}</dd></div>
        {asset.width && asset.height ? <div><dt className="text-slate-500">Dimensions</dt><dd className="mt-1 text-slate-200">{asset.width} × {asset.height}</dd></div> : null}
        {asset.durationSeconds ? <div><dt className="text-slate-500">Duration</dt><dd className="mt-1 text-slate-200">{asset.durationSeconds.toFixed(1)}s</dd></div> : null}
        {asset.sizeBytes ? <div><dt className="text-slate-500">Size</dt><dd className="mt-1 text-slate-200">{(asset.sizeBytes / 1024 / 1024).toFixed(2)} MB</dd></div> : null}
        {asset.generatingJobId ? <div className="col-span-2"><dt className="text-slate-500">Generating job</dt><dd className="mt-1 break-all font-mono text-xs text-slate-300">{asset.generatingJobId}</dd></div> : null}
      </dl>

      {canSubmitForReview ? (
        <div className="mt-5 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Approval Center</p>
          <button
            type="button"
            aria-label={`Submit ${asset.displayName} for review`}
            onClick={onSubmitForReview}
            disabled={reviewPending}
            className="mt-3 w-full rounded-lg border border-emerald-800 px-3 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50"
          >
            {reviewPending ? "Submitting for review…" : "Submit for review"}
          </button>
          {reviewRequestHref ? (
            <Link href={reviewRequestHref} className="mt-3 inline-block text-sm font-semibold text-emerald-300 underline underline-offset-4">
              Open review request
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5">
        {!signedUrl ? (
          <button
            type="button"
            onClick={onPreview}
            disabled={previewPending}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {previewPending ? "Creating secure preview…" : "Create secure preview"}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-emerald-300">Secure preview ready</p>
            {asset.assetType === "VIDEO" ? <video controls src={signedUrl} className="max-h-80 w-full rounded-xl bg-black" /> : null}
            {asset.assetType === "IMAGE" ? <img src={signedUrl} alt={asset.displayName} className="max-h-80 w-full rounded-xl object-contain" /> : null}
            {asset.assetType === "AUDIO" ? <audio controls src={signedUrl} className="w-full" /> : null}
            {asset.assetType === "DOCUMENT" ? (
              <a href={signedUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-300 underline underline-offset-4">
                Open secure document preview
              </a>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
