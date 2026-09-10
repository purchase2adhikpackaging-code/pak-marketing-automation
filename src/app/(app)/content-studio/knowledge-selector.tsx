"use client";

import Link from "next/link";
import React from "react";

import type { KnowledgeSourceType } from "@/modules/knowledge-base/types";

export type SelectableKnowledgeRecord = {
  id: string;
  title: string;
  sourceType: KnowledgeSourceType;
  sourceLabel?: string;
  revision: number;
};

export function KnowledgeSelector({
  records,
  selectedIds,
  onChange,
  disabled = false,
}: {
  records: SelectableKnowledgeRecord[];
  selectedIds: string[];
  onChange(ids: string[]): void;
  disabled?: boolean;
}) {
  const selected = new Set(selectedIds);
  const selectionFull = selectedIds.length >= 20;

  function toggle(id: string) {
    if (selected.has(id)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== id));
      return;
    }

    if (selectionFull) return;
    onChange([...selectedIds, id]);
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-200">Approved Knowledge Base sources</p>
          <p className="mt-1 text-xs text-slate-500">Select trusted ACTIVE records to ground this generation.</p>
        </div>
        <span className="text-xs font-medium text-slate-400">{selectedIds.length} of 20 selected</span>
      </div>

      {records.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-500">
          <p>No ACTIVE Knowledge Base records are available for this organization.</p>
          <Link href="/knowledge-base" className="mt-3 inline-flex min-h-10 items-center font-semibold text-slate-200 underline underline-offset-4">
            Open Knowledge Base
          </Link>
        </div>
      ) : (
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
          {records.map((record) => {
            const isSelected = selected.has(record.id);
            const checkboxDisabled = disabled || (!isSelected && selectionFull);

            return (
              <label key={record.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <input
                  type="checkbox"
                  aria-label={record.title}
                  checked={isSelected}
                  disabled={checkboxDisabled}
                  onChange={() => toggle(record.id)}
                  className="mt-1 h-4 w-4"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-200">{record.title}</span>
                  <span className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{record.sourceType}</span>
                    {record.sourceLabel ? <span>{record.sourceLabel}</span> : null}
                    <span>Revision {record.revision}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}
