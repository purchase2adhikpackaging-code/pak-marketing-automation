"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import type { AppRole } from "@/modules/auth/roles";
import type { OrganizationProfile } from "@/modules/organization-profile/types";
import { saveOrganizationProfileAction } from "./actions";

export type OrganizationProfileWorkspace = {
  id: string;
  label: string;
  role: AppRole;
  profile: OrganizationProfile;
};

type ProfileForm = {
  officialName: string;
  shortName: string;
  about: string;
  address: string;
  primaryEmail: string;
  primaryPhone: string;
  website: string;
  defaultLanguage: string;
  timezone: string;
  socialLinksJson: string;
  legalIdentifiersJson: string;
};

function formFromProfile(profile: OrganizationProfile): ProfileForm {
  return {
    officialName: profile.officialName,
    shortName: profile.shortName ?? "",
    about: profile.about ?? "",
    address: profile.address ?? "",
    primaryEmail: profile.primaryEmail ?? "",
    primaryPhone: profile.primaryPhone ?? "",
    website: profile.website ?? "",
    defaultLanguage: profile.defaultLanguage,
    timezone: profile.timezone,
    socialLinksJson: JSON.stringify(profile.socialLinks, null, 2),
    legalIdentifiersJson: JSON.stringify(profile.legalIdentifiers, null, 2),
  };
}

function parseStringMap(value: string): Record<string, string> {
  const parsed: unknown = JSON.parse(value || "{}");
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Expected an object.");
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (typeof entry !== "string") throw new Error("Values must be strings.");
    result[key] = entry;
  }
  return result;
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function OrganizationProfileClient({ organizations }: { organizations: OrganizationProfileWorkspace[] }) {
  const [workspaces, setWorkspaces] = useState(organizations);
  const [selectedId, setSelectedId] = useState(organizations[0]?.id ?? "");
  const selected = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedId) ?? workspaces[0],
    [selectedId, workspaces],
  );
  const [form, setForm] = useState<ProfileForm>(() =>
    selected ? formFromProfile(selected.profile) : {
      officialName: "", shortName: "", about: "", address: "", primaryEmail: "", primaryPhone: "", website: "",
      defaultLanguage: "en", timezone: "Europe/Warsaw", socialLinksJson: "{}", legalIdentifiersJson: "{}",
    },
  );
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selected) return;
    setForm(formFromProfile(selected.profile));
    setMessage(undefined);
  }, [selected]);

  if (!selected) return <p className="mt-6 text-sm text-slate-400">No organization workspace is available.</p>;

  const canEdit = selected.role === "OWNER" || selected.role === "ADMIN";
  const setField = (field: keyof ProfileForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const save = () => {
    let socialLinks: Record<string, string>;
    let legalIdentifiers: Record<string, string>;
    try {
      socialLinks = parseStringMap(form.socialLinksJson);
      legalIdentifiers = parseStringMap(form.legalIdentifiersJson);
    } catch {
      setMessage("Social links and legal identifiers must be valid JSON objects with text values.");
      return;
    }

    const shortName = optional(form.shortName);
    const about = optional(form.about);
    const address = optional(form.address);
    const primaryEmail = optional(form.primaryEmail);
    const primaryPhone = optional(form.primaryPhone);
    const website = optional(form.website);

    setMessage(undefined);
    startTransition(async () => {
      const result = await saveOrganizationProfileAction({
        organizationId: selected.id,
        profile: {
          officialName: form.officialName,
          ...(shortName ? { shortName } : {}),
          ...(about ? { about } : {}),
          ...(address ? { address } : {}),
          ...(primaryEmail ? { primaryEmail } : {}),
          ...(primaryPhone ? { primaryPhone } : {}),
          ...(website ? { website } : {}),
          socialLinks,
          defaultLanguage: form.defaultLanguage,
          timezone: form.timezone,
          legalIdentifiers,
          expectedRevision: selected.profile.revision,
        },
      });
      if (!result.ok) { setMessage(result.error); return; }
      setWorkspaces((current) => current.map((workspace) => workspace.id === selected.id ? { ...workspace, profile: result.profile } : workspace));
      setMessage("Organization Profile saved.");
    });
  };

  const inputClass = "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60";
  const labelClass = "text-sm font-medium text-slate-200";

  return (
    <div className="mt-7 space-y-6">
      {workspaces.length > 1 ? <label className={labelClass}>Organization<select className={inputClass} value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.label}</option>)}</select></label> : null}
      {!canEdit ? <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">Owner or Admin access is required to edit Organization Profile. You can review the current authoritative values.</p> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <label className={labelClass}>Official name<input aria-label="Official name" className={inputClass} disabled={!canEdit} value={form.officialName} onChange={(event) => setField("officialName", event.target.value)} /></label>
        <label className={labelClass}>Short name<input aria-label="Short name" className={inputClass} disabled={!canEdit} value={form.shortName} onChange={(event) => setField("shortName", event.target.value)} /></label>
        <label className={`${labelClass} md:col-span-2`}>About<textarea aria-label="About" className={`${inputClass} min-h-28`} disabled={!canEdit} value={form.about} onChange={(event) => setField("about", event.target.value)} /></label>
        <label className={`${labelClass} md:col-span-2`}>Address<textarea aria-label="Address" className={`${inputClass} min-h-20`} disabled={!canEdit} value={form.address} onChange={(event) => setField("address", event.target.value)} /></label>
        <label className={labelClass}>Primary email<input aria-label="Primary email" type="email" className={inputClass} disabled={!canEdit} value={form.primaryEmail} onChange={(event) => setField("primaryEmail", event.target.value)} /></label>
        <label className={labelClass}>Primary phone<input aria-label="Primary phone" className={inputClass} disabled={!canEdit} value={form.primaryPhone} onChange={(event) => setField("primaryPhone", event.target.value)} /></label>
        <label className={labelClass}>Website<input aria-label="Website" type="url" className={inputClass} disabled={!canEdit} value={form.website} onChange={(event) => setField("website", event.target.value)} /></label>
        <label className={labelClass}>Default language<input aria-label="Default language" className={inputClass} disabled={!canEdit} value={form.defaultLanguage} onChange={(event) => setField("defaultLanguage", event.target.value)} /></label>
        <label className={labelClass}>Timezone<input aria-label="Timezone" className={inputClass} disabled={!canEdit} value={form.timezone} onChange={(event) => setField("timezone", event.target.value)} /></label>
        <label className={`${labelClass} md:col-span-2`}>Social links (JSON)<textarea aria-label="Social links (JSON)" className={`${inputClass} min-h-28 font-mono`} disabled={!canEdit} value={form.socialLinksJson} onChange={(event) => setField("socialLinksJson", event.target.value)} /></label>
        <label className={`${labelClass} md:col-span-2`}>Legal identifiers (JSON)<textarea aria-label="Legal identifiers (JSON)" className={`${inputClass} min-h-28 font-mono`} disabled={!canEdit} value={form.legalIdentifiersJson} onChange={(event) => setField("legalIdentifiersJson", event.target.value)} /></label>
      </div>
      <div className="flex items-center gap-4">
        {canEdit ? <button type="button" disabled={isPending} onClick={save} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">{isPending ? "Saving…" : "Save Organization Profile"}</button> : null}
        <span className="text-xs text-slate-500">Revision {selected.profile.revision}</span>
        {message ? <span role="status" className="text-sm text-slate-300">{message}</span> : null}
      </div>
    </div>
  );
}