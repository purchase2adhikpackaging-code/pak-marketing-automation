"use client";

import React, { useState } from "react";

import type { KnowledgeRecord } from "@/modules/knowledge-base/types";
import { MediaUpload, type UploadedMediaFile } from "../media-library/media-upload";
import { ingestKnowledgeFileAction, ingestKnowledgeUrlAction } from "./actions";

const DOCUMENT_ACCEPT = [
  ".pdf",
  ".docx",
  ".pptx",
  ".txt",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
].join(",");

type FileFormat = "PDF" | "DOCX" | "PPTX" | "TXT";

const FORMAT_BY_EXTENSION: Readonly<Record<string, FileFormat>> = {
  pdf: "PDF",
  docx: "DOCX",
  pptx: "PPTX",
  txt: "TXT",
};

const FORMAT_BY_MIME: Readonly<Record<string, FileFormat>> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "text/plain": "TXT",
};

function formatForUpload(file: UploadedMediaFile): FileFormat | null {
  const extension = file.filename.split(".").pop()?.trim().toLowerCase() ?? "";
  const extensionFormat = FORMAT_BY_EXTENSION[extension];
  const mimeFormat = FORMAT_BY_MIME[file.mimeType.split(";", 1)[0]!.trim().toLowerCase()];

  if (extensionFormat && mimeFormat && extensionFormat !== mimeFormat) return null;
  return extensionFormat ?? mimeFormat ?? null;
}

const REVIEW_MESSAGE = "Draft created for review. Activate it only after verifying the extracted content.";

export function KnowledgeIngestionPanel({
  organizationId,
  onIngested,
}: {
  organizationId: string;
  onIngested(record: KnowledgeRecord): void;
}) {
  const [documentLabel, setDocumentLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [urlLabel, setUrlLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function beginOperation() {
    setMessage(null);
    setError(null);
  }

  async function ingestUploadedFile(mediaAssetId: string, file: UploadedMediaFile) {
    beginOperation();
    const format = formatForUpload(file);
    if (!format) {
      setError("Use a PDF, DOCX, PPTX, or TXT file whose extension matches its document type.");
      return;
    }

    setPending(true);
    try {
      const result = await ingestKnowledgeFileAction({
        organizationId,
        mediaAssetId,
        format,
        ...(documentLabel.trim() ? { sourceLabel: documentLabel.trim() } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.record.status !== "DRAFT") {
        setError("The source could not be prepared safely for review.");
        return;
      }
      onIngested(result.record);
      setDocumentLabel("");
      setMessage(REVIEW_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  async function ingestUrl() {
    if (!sourceUrl.trim() || pending) return;
    beginOperation();
    setPending(true);
    try {
      const result = await ingestKnowledgeUrlAction({
        organizationId,
        sourceUrl: sourceUrl.trim(),
        ...(urlLabel.trim() ? { sourceLabel: urlLabel.trim() } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.record.status !== "DRAFT") {
        setError("The source could not be prepared safely for review.");
        return;
      }
      onIngested(result.record);
      setSourceUrl("");
      setUrlLabel("");
      setMessage(REVIEW_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
      <h3 className="text-lg font-semibold text-white">Ingest approved sources</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Upload a supported document through the private Media Library or ingest a public URL. Extracted content always enters Knowledge Base as a draft for human review.
      </p>

      {pending ? <p role="status" className="mt-4 text-sm text-slate-300">Preparing Knowledge Base draft…</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</p> : null}
      {message ? <p role="status" className="mt-4 rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-200">{message}</p> : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 p-4">
          <h4 className="text-sm font-semibold text-white">Document</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">PDF, DOCX, PPTX, or TXT. The server validates the finalized private asset before extraction.</p>
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-slate-200">Source label</span>
            <input
              aria-label="Document source label"
              value={documentLabel}
              onChange={(event) => setDocumentLabel(event.target.value)}
              maxLength={240}
              disabled={pending}
              placeholder="Optional source title"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
            />
          </label>
          <div className="mt-4">
            <MediaUpload
              organizationId={organizationId}
              accept={DOCUMENT_ACCEPT}
              onUploaded={ingestUploadedFile}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 p-4">
          <h4 className="text-sm font-semibold text-white">Public URL</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">Only server-validated public HTTP(S) sources are fetched; private and unsafe destinations remain blocked.</p>
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-slate-200">URL</span>
            <input
              aria-label="Knowledge URL"
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              disabled={pending}
              placeholder="https://example.org/source"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
            />
          </label>
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-slate-200">Source label</span>
            <input
              aria-label="URL source label"
              value={urlLabel}
              onChange={(event) => setUrlLabel(event.target.value)}
              maxLength={240}
              disabled={pending}
              placeholder="Optional source title"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
            />
          </label>
          <button
            type="button"
            onClick={ingestUrl}
            disabled={pending || sourceUrl.trim().length === 0}
            className="mt-4 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Ingest URL
          </button>
        </div>
      </div>
    </section>
  );
}
