"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";

import type { AppRole } from "@/modules/auth/roles";
import type {
  MediaAssetSource,
  MediaAssetStatus,
  MediaAssetType,
  MediaCursor,
  MediaListPage,
  SafeMediaAsset,
} from "@/modules/media/read-model";
import {
  archiveMediaAction,
  deleteMediaAction,
  listMediaAction,
  previewMediaAction,
} from "./actions";
import { MediaDetail } from "./media-detail";
import { MediaUpload } from "./media-upload";

export type MediaOrganizationWorkspace = {
  id: string;
  label: string;
  role: AppRole;
  initialPage: MediaListPage;
};

type FilterState = {
  assetType: "" | MediaAssetType;
  source: "" | MediaAssetSource;
  status: MediaAssetStatus;
  search: string;
};

const DEFAULT_FILTERS: FilterState = {
  assetType: "",
  source: "",
  status: "ACTIVE",
  search: "",
};

function lineageLabel(asset: SafeMediaAsset): string | null {
  if (asset.metadata.kind === "FINAL_VIDEO") return "Final video";
  if (asset.source === "GENERATED") return "Generated shot";
  if (asset.source === "UPLOAD") return "Operator upload";
  if (asset.source === "IMPORT") return "Imported media";
  return null;
}

function formatSize(sizeBytes?: number): string {
  if (!sizeBytes) return "—";
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaLibraryClient({ organizations }: { organizations: MediaOrganizationWorkspace[] }) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizations[0]?.id ?? "");
  const [items, setItems] = useState<SafeMediaAsset[]>(organizations[0]?.initialPage.items ?? []);
  const [nextCursor, setNextCursor] = useState<MediaCursor | undefined>(organizations[0]?.initialPage.nextCursor);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [previewPendingId, setPreviewPendingId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const organization = organizations.find((entry) => entry.id === selectedOrganizationId) ?? organizations[0];
  const role = organization?.role;
  const canEdit = role === "OWNER" || role === "ADMIN" || role === "EDITOR";
  const canDelete = role === "OWNER" || role === "ADMIN";
  const selectedAsset = useMemo(
    () => items.find((item) => item.id === selectedAssetId) ?? null,
    [items, selectedAssetId],
  );

  useEffect(() => {
    if (!organization) return;
    setItems(organization.initialPage.items);
    setNextCursor(organization.initialPage.nextCursor);
    setFilters(DEFAULT_FILTERS);
    setSelectedAssetId(null);
    setPreviewUrl(undefined);
    setMessage(null);
  }, [organization?.id]);

  function query(cursor?: MediaCursor) {
    if (!organization) return null;
    return {
      organizationId: organization.id,
      status: filters.status,
      ...(filters.assetType ? { assetType: filters.assetType } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
      ...(cursor ? { cursor } : {}),
      limit: 24,
    };
  }

  function replaceWithPage(page: MediaListPage) {
    setItems(page.items);
    setNextCursor(page.nextCursor);
    setSelectedAssetId(null);
    setPreviewUrl(undefined);
  }

  async function reload() {
    const input = query();
    if (!input) return;
    const result = await listMediaAction(input);
    if (result.ok) {
      replaceWithPage(result.page);
      setMessage(null);
    } else {
      setMessage(result.error);
    }
  }

  function applyFilters() {
    setMessage(null);
    startTransition(async () => reload());
  }

  function loadMore() {
    if (!nextCursor) return;
    const input = query(nextCursor);
    if (!input) return;
    setMessage(null);
    startTransition(async () => {
      const result = await listMediaAction(input);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setItems((current) => [...current, ...result.page.items]);
      setNextCursor(result.page.nextCursor);
    });
  }

  async function requestPreview(asset: SafeMediaAsset) {
    if (!organization) return;
    setSelectedAssetId(asset.id);
    setPreviewUrl(undefined);
    setPreviewPendingId(asset.id);
    setMessage(null);
    const result = await previewMediaAction({ organizationId: organization.id, mediaAssetId: asset.id });
    setPreviewPendingId(null);
    if (result.ok) {
      setPreviewUrl(result.signedUrl);
    } else {
      setMessage(result.error);
    }
  }

  function confirmArchive(asset: SafeMediaAsset) {
    if (!organization) return;
    setMessage(null);
    startTransition(async () => {
      const result = await archiveMediaAction({ organizationId: organization.id, mediaAssetId: asset.id });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setItems((current) => current.filter((entry) => entry.id !== asset.id));
      if (selectedAssetId === asset.id) setSelectedAssetId(null);
      setConfirmArchiveId(null);
      setMessage("Media archived.");
    });
  }

  function confirmDelete(asset: SafeMediaAsset) {
    if (!organization) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteMediaAction({ organizationId: organization.id, mediaAssetId: asset.id });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setItems((current) => current.filter((entry) => entry.id !== asset.id));
      if (selectedAssetId === asset.id) setSelectedAssetId(null);
      setConfirmDeleteId(null);
      setMessage("Media permanently deleted.");
    });
  }

  if (!organization) {
    return (
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
        No organization membership is available for Media Library access.
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <div className="min-w-64 flex-1">
          {organizations.length > 1 ? (
            <label className="text-sm text-slate-300">
              Organization
              <select
                value={organization.id}
                onChange={(event) => setSelectedOrganizationId(event.target.value)}
                disabled={isPending}
                className="mt-2 w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              >
                {organizations.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
              </select>
            </label>
          ) : (
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Organization</p>
              <p className="mt-1 font-semibold text-white">{organization.label}</p>
            </div>
          )}
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{organization.role}</span>
        {canEdit ? <MediaUpload organizationId={organization.id} onUploaded={reload} /> : null}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 md:grid-cols-5">
        <input
          aria-label="Search media"
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          placeholder="Search display name"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600 md:col-span-2"
        />
        <select
          aria-label="Asset type"
          value={filters.assetType}
          onChange={(event) => setFilters((current) => ({ ...current, assetType: event.target.value as FilterState["assetType"] }))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          <option value="">All types</option>
          <option value="IMAGE">Images</option>
          <option value="VIDEO">Videos</option>
          <option value="AUDIO">Audio</option>
          <option value="DOCUMENT">Documents</option>
        </select>
        <select
          aria-label="Source"
          value={filters.source}
          onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value as FilterState["source"] }))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          <option value="">All sources</option>
          <option value="GENERATED">Generated</option>
          <option value="UPLOAD">Uploads</option>
          <option value="IMPORT">Imports</option>
        </select>
        <div className="flex gap-2">
          <select
            aria-label="Status"
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as MediaAssetStatus }))}
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
            <option value="FAILED">Failed</option>
          </select>
          <button type="button" onClick={applyFilters} disabled={isPending} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-50">
            Apply
          </button>
        </div>
      </div>

      {message ? <p role="status" className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">{message}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50">
          {items.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-medium text-slate-200">No media matches this view.</p>
              <p className="mt-2 text-sm text-slate-500">Adjust the filters or upload an approved asset.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {items.map((asset) => {
                const lineage = lineageLabel(asset);
                return (
                  <article key={asset.id} className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-semibold text-white">{asset.displayName}</h3>
                          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">{asset.assetType}</span>
                          {lineage ? <span className="rounded-full border border-emerald-900/70 bg-emerald-950/30 px-2 py-0.5 text-[11px] text-emerald-300">{lineage}</span> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>{asset.mimeType}</span>
                          <span>{formatSize(asset.sizeBytes)}</span>
                          {asset.durationSeconds ? <span>{asset.durationSeconds.toFixed(1)}s</span> : null}
                          <span>{new Date(asset.createdAt).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          aria-label={`Preview ${asset.displayName}`}
                          onClick={() => requestPreview(asset)}
                          disabled={previewPendingId === asset.id}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50"
                        >Preview</button>
                        <button type="button" onClick={() => { setSelectedAssetId(asset.id); setPreviewUrl(undefined); }} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300">Details</button>
                        {canEdit && asset.status === "ACTIVE" ? (
                          <button type="button" aria-label={`Archive ${asset.displayName}`} onClick={() => { setConfirmArchiveId(asset.id); setConfirmDeleteId(null); }} className="rounded-lg border border-amber-900/70 px-3 py-1.5 text-xs text-amber-200">Archive</button>
                        ) : null}
                        {canDelete ? (
                          <button type="button" aria-label={`Delete ${asset.displayName}`} onClick={() => { setConfirmDeleteId(asset.id); setConfirmArchiveId(null); }} className="rounded-lg border border-red-900/70 px-3 py-1.5 text-xs text-red-200">Delete</button>
                        ) : null}
                      </div>
                    </div>

                    {confirmArchiveId === asset.id ? (
                      <div className="mt-3 rounded-xl border border-amber-900/60 bg-amber-950/20 p-3 text-sm text-amber-100">
                        Archive this asset? It will leave the default Active catalogue.
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => confirmArchive(asset)} disabled={isPending} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-950">Confirm archive</button>
                          <button type="button" onClick={() => setConfirmArchiveId(null)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300">Cancel</button>
                        </div>
                      </div>
                    ) : null}

                    {confirmDeleteId === asset.id ? (
                      <div className="mt-3 rounded-xl border border-red-900/60 bg-red-950/20 p-3 text-sm text-red-100">
                        Permanently delete this asset? PAK will block deletion when generation or assembly lineage still requires it.
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => confirmDelete(asset)} disabled={isPending} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-950">Confirm permanent delete</button>
                          <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300">Cancel</button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          {nextCursor ? (
            <div className="border-t border-slate-800 p-4 text-center">
              <button type="button" onClick={loadMore} disabled={isPending} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-50">Load more</button>
            </div>
          ) : null}
        </div>

        {selectedAsset ? (
          <MediaDetail
            asset={selectedAsset}
            signedUrl={previewUrl}
            previewPending={previewPendingId === selectedAsset.id}
            onPreview={() => requestPreview(selectedAsset)}
            onClose={() => { setSelectedAssetId(null); setPreviewUrl(undefined); }}
          />
        ) : (
          <aside className="rounded-2xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">
            Select Details or Preview on an asset to inspect its metadata and secure private preview.
          </aside>
        )}
      </div>
    </div>
  );
}
