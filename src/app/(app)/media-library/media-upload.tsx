"use client";

import { useState } from "react";

import { finalizeMediaUploadAction, issueMediaUploadAction } from "./actions";

function assetTypeForMime(mimeType: string): "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return "DOCUMENT";
}

export function MediaUpload({
  organizationId,
  onUploaded,
}: {
  organizationId: string;
  onUploaded(mediaAssetId: string): void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload() {
    if (!file || pending) return;
    setPending(true);
    setMessage(null);

    try {
      const issued = await issueMediaUploadAction({
        organizationId,
        assetType: assetTypeForMime(file.type || "application/octet-stream"),
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
      });
      if (!issued.ok) {
        setMessage(issued.error);
        return;
      }

      const response = await fetch(issued.signedUploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) {
        setMessage("The file could not be uploaded to private storage.");
        return;
      }

      const finalized = await finalizeMediaUploadAction({
        organizationId,
        sessionId: issued.sessionId,
      });
      if (!finalized.ok) {
        setMessage(finalized.error);
        return;
      }

      await onUploaded(finalized.mediaAssetId);
      setFile(null);
      setDisplayName("");
      setOpen(false);
      setMessage("Upload complete.");
    } catch {
      setMessage("The media upload could not be completed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        aria-label="Upload media"
        onClick={() => { setOpen((value) => !value); setMessage(null); }}
        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950"
      >
        Upload media
      </button>

      {open ? (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <label className="block text-sm text-slate-300">
            File
            <input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              disabled={pending}
              className="mt-2 block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200"
            />
          </label>
          <label className="mt-3 block text-sm text-slate-300">
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={200}
              disabled={pending}
              placeholder={file?.name ?? "Optional"}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-600"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={upload}
              disabled={!file || pending}
              className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-50"
            >
              {pending ? "Uploading…" : "Start upload"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setFile(null); setMessage(null); }}
              disabled={pending}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p role="status" className="mt-2 text-sm text-slate-300">{message}</p> : null}
    </div>
  );
}
