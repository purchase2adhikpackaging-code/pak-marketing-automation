"use client";

import React, { useMemo, useState, useTransition } from "react";

import { can } from "@/modules/auth/authorization";
import type { AppRole } from "@/modules/auth/roles";
import type { KnowledgeRecord, KnowledgeSourceType } from "@/modules/knowledge-base/types";
import {
  archiveKnowledgeAction,
  createKnowledgeAction,
  deleteKnowledgeAction,
  updateKnowledgeAction,
} from "./actions";

export type KnowledgeOrganizationWorkspace = {
  id: string;
  label: string;
  role: AppRole;
  records: KnowledgeRecord[];
};

type DraftForm = {
  title: string;
  content: string;
  sourceType: KnowledgeSourceType;
  sourceLabel: string;
  sourceReference: string;
};

const EMPTY_FORM: DraftForm = {
  title: "",
  content: "",
  sourceType: "MANUAL",
  sourceLabel: "",
  sourceReference: "",
};

function formatUpdated(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("en-GB");
}

export function KnowledgeBaseManager({ organizations }: { organizations: KnowledgeOrganizationWorkspace[] }) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizations[0]?.id ?? "");
  const [recordsByOrganization, setRecordsByOrganization] = useState<Record<string, KnowledgeRecord[]>>(
    Object.fromEntries(organizations.map((organization) => [organization.id, organization.records])),
  );
  const [createForm, setCreateForm] = useState<DraftForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DraftForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedOrganization = useMemo(
    () => organizations.find((option) => option.id === selectedOrganizationId) ?? organizations[0],
    [organizations, selectedOrganizationId],
  );

  if (!selectedOrganization) {
    return (
      <div className="mt-8 rounded-2xl border border-amber-900/50 bg-amber-950/20 p-5 text-sm text-amber-100">
        No Knowledge Base organization is available for this account.
      </div>
    );
  }

  const organization: KnowledgeOrganizationWorkspace = selectedOrganization;
  const canManage = can(organization.role, "knowledge:manage");
  const canDelete = can(organization.role, "knowledge:delete");
  const sourceRecords = recordsByOrganization[organization.id] ?? [];
  const visibleRecords = canManage ? sourceRecords : sourceRecords.filter((record) => record.status === "ACTIVE");

  function replaceRecord(next: KnowledgeRecord) {
    setRecordsByOrganization((current) => ({
      ...current,
      [next.organizationId]: (current[next.organizationId] ?? []).map((record) =>
        record.id === next.id ? next : record,
      ),
    }));
  }

  function createRecord() {
    setError(null);
    startTransition(async () => {
      const result = await createKnowledgeAction({
        organizationId: organization.id,
        title: createForm.title,
        content: createForm.content,
        sourceType: createForm.sourceType,
        ...(createForm.sourceLabel.trim() ? { sourceLabel: createForm.sourceLabel.trim() } : {}),
        ...(createForm.sourceReference.trim() ? { sourceReference: createForm.sourceReference.trim() } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRecordsByOrganization((current) => ({
        ...current,
        [organization.id]: [result.record, ...(current[organization.id] ?? [])],
      }));
      setCreateForm(EMPTY_FORM);
    });
  }

  function beginEdit(record: KnowledgeRecord) {
    setError(null);
    setEditingId(record.id);
    setEditForm({
      title: record.title,
      content: record.content,
      sourceType: record.sourceType,
      sourceLabel: record.sourceLabel ?? "",
      sourceReference: record.sourceReference ?? "",
    });
  }

  function updateRecord(record: KnowledgeRecord, status = record.status) {
    return updateKnowledgeAction({
      id: record.id,
      organizationId: record.organizationId,
      expectedRevision: record.revision,
      title: editForm.title || record.title,
      content: editForm.content || record.content,
      status,
      sourceType: editingId === record.id ? editForm.sourceType : record.sourceType,
      ...((editingId === record.id ? editForm.sourceLabel : record.sourceLabel)?.trim()
        ? { sourceLabel: (editingId === record.id ? editForm.sourceLabel : record.sourceLabel)?.trim() }
        : {}),
      ...((editingId === record.id ? editForm.sourceReference : record.sourceReference)?.trim()
        ? { sourceReference: (editingId === record.id ? editForm.sourceReference : record.sourceReference)?.trim() }
        : {}),
    });
  }

  function saveEdit(record: KnowledgeRecord) {
    setError(null);
    startTransition(async () => {
      const result = await updateRecord(record);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      replaceRecord(result.record);
      setEditingId(null);
    });
  }

  function activateRecord(record: KnowledgeRecord) {
    setError(null);
    startTransition(async () => {
      const result = await updateKnowledgeAction({
        id: record.id,
        organizationId: record.organizationId,
        expectedRevision: record.revision,
        title: record.title,
        content: record.content,
        status: "ACTIVE",
        sourceType: record.sourceType,
        ...(record.sourceLabel ? { sourceLabel: record.sourceLabel } : {}),
        ...(record.sourceReference ? { sourceReference: record.sourceReference } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      replaceRecord(result.record);
    });
  }

  function archiveRecord(record: KnowledgeRecord) {
    setError(null);
    startTransition(async () => {
      const result = await archiveKnowledgeAction({
        id: record.id,
        organizationId: record.organizationId,
        expectedRevision: record.revision,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      replaceRecord(result.record);
    });
  }

  function removeRecord(record: KnowledgeRecord) {
    setError(null);
    startTransition(async () => {
      const result = await deleteKnowledgeAction({ id: record.id, organizationId: record.organizationId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRecordsByOrganization((current) => ({
        ...current,
        [record.organizationId]: (current[record.organizationId] ?? []).filter(
          (candidate) => candidate.id !== record.id,
        ),
      }));
    });
  }

  return (
    <div className="mt-8 space-y-6">
      {organizations.length > 1 ? (
        <label className="block max-w-md space-y-2">
          <span className="text-sm font-medium text-slate-200">Organization</span>
          <select
            value={organization.id}
            onChange={(event) => {
              setSelectedOrganizationId(event.target.value);
              setEditingId(null);
              setError(null);
            }}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"
            disabled={isPending}
          >
            {organizations.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      ) : null}

      {!canManage ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-sm font-semibold text-white">Read-only approved knowledge</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Your role can view ACTIVE approved knowledge but cannot create, edit, archive, or delete records.
          </p>
        </div>
      ) : null}

      {error ? <div role="alert" className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}

      {canManage ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <h3 className="text-lg font-semibold text-white">Add knowledge record</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2"><span className="text-sm font-medium text-slate-200">Title</span><input aria-label="Title" value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" disabled={isPending} /></label>
            <label className="space-y-2 md:col-span-2"><span className="text-sm font-medium text-slate-200">Content</span><textarea aria-label="Content" value={createForm.content} onChange={(event) => setCreateForm((current) => ({ ...current, content: event.target.value }))} rows={7} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" disabled={isPending} /></label>
            <label className="space-y-2"><span className="text-sm font-medium text-slate-200">Source type</span><select aria-label="Source type" value={createForm.sourceType} onChange={(event) => setCreateForm((current) => ({ ...current, sourceType: event.target.value as KnowledgeSourceType }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" disabled={isPending}><option value="MANUAL">Manual</option><option value="DOCUMENT">Document</option><option value="URL">URL</option></select></label>
            <label className="space-y-2"><span className="text-sm font-medium text-slate-200">Source label</span><input aria-label="Source label" value={createForm.sourceLabel} onChange={(event) => setCreateForm((current) => ({ ...current, sourceLabel: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" disabled={isPending} /></label>
            <label className="space-y-2 md:col-span-2"><span className="text-sm font-medium text-slate-200">Source reference</span><input aria-label="Source reference" value={createForm.sourceReference} onChange={(event) => setCreateForm((current) => ({ ...current, sourceReference: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" disabled={isPending} /></label>
          </div>
          <button type="button" onClick={createRecord} disabled={isPending || createForm.title.trim().length < 3 || createForm.content.trim().length === 0} className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">Create draft</button>
        </section>
      ) : null}

      <section className="space-y-4">
        <div><h3 className="text-lg font-semibold text-white">Knowledge records</h3><p className="mt-1 text-sm text-slate-500">{visibleRecords.length} record{visibleRecords.length === 1 ? "" : "s"}</p></div>
        {visibleRecords.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">No Knowledge Base records are available for this organization.</div> : null}
        {visibleRecords.map((record) => {
          const editing = editingId === record.id;
          return (
            <article key={record.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><h4 className="text-base font-semibold text-white">{record.title}</h4><div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400"><span>{record.status}</span><span>Revision {record.revision}</span><span>Updated {formatUpdated(record.updatedAt)}</span></div></div>
                {canManage ? <div className="flex flex-wrap gap-2">
                  <button type="button" aria-label={`Edit ${record.title}`} onClick={() => beginEdit(record)} disabled={isPending} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200">Edit</button>
                  {record.status !== "ACTIVE" ? <button type="button" aria-label={`Activate ${record.title}`} onClick={() => activateRecord(record)} disabled={isPending} className="rounded-lg border border-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-200">Activate</button> : null}
                  {record.status !== "ARCHIVED" ? <button type="button" aria-label={`Archive ${record.title}`} onClick={() => archiveRecord(record)} disabled={isPending} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200">Archive</button> : null}
                  {canDelete ? <button type="button" aria-label={`Delete ${record.title}`} onClick={() => removeRecord(record)} disabled={isPending} className="rounded-lg border border-red-900/70 px-3 py-2 text-xs font-semibold text-red-200">Delete</button> : null}
                </div> : null}
              </div>
              {editing ? <div className="mt-5 space-y-4 border-t border-slate-800 pt-5">
                <label className="block space-y-2"><span className="text-sm text-slate-300">Edit title</span><input aria-label="Edit title" value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" /></label>
                <label className="block space-y-2"><span className="text-sm text-slate-300">Edit content</span><textarea aria-label="Edit content" value={editForm.content} onChange={(event) => setEditForm((current) => ({ ...current, content: event.target.value }))} rows={6} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" /></label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2"><span className="text-sm text-slate-300">Edit source type</span><select aria-label="Edit source type" value={editForm.sourceType} onChange={(event) => setEditForm((current) => ({ ...current, sourceType: event.target.value as KnowledgeSourceType }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white"><option value="MANUAL">Manual</option><option value="DOCUMENT">Document</option><option value="URL">URL</option></select></label>
                  <label className="space-y-2"><span className="text-sm text-slate-300">Edit source label</span><input aria-label="Edit source label" value={editForm.sourceLabel} onChange={(event) => setEditForm((current) => ({ ...current, sourceLabel: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" /></label>
                  <label className="space-y-2 md:col-span-2"><span className="text-sm text-slate-300">Edit source reference</span><input aria-label="Edit source reference" value={editForm.sourceReference} onChange={(event) => setEditForm((current) => ({ ...current, sourceReference: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white" /></label>
                </div>
                <div className="flex gap-2"><button type="button" aria-label={`Save ${record.title}`} onClick={() => saveEdit(record)} disabled={isPending} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-950">Save</button><button type="button" onClick={() => setEditingId(null)} disabled={isPending} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300">Cancel</button></div>
              </div> : <div className="mt-5 space-y-3 text-sm leading-6 text-slate-300"><p className="whitespace-pre-wrap">{record.content}</p><div className="text-xs text-slate-500"><span>{record.sourceType}</span>{record.sourceLabel ? <span className="ml-3">{record.sourceLabel}</span> : null}{record.sourceReference ? <span className="ml-3">{record.sourceReference}</span> : null}</div></div>}
            </article>
          );
        })}
      </section>
    </div>
  );
}
