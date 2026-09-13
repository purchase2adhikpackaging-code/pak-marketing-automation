"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import type { AppRole } from "@/modules/auth/roles";
import type { OrganizationBrandKit } from "@/modules/brand-kit/types";
import { saveBrandKitAction } from "./actions";

export type BrandKitImageAssetOption = {
  id: string;
  displayName: string;
  mimeType: string;
};

export type BrandKitWorkspace = {
  id: string;
  label: string;
  role: AppRole;
  brandKit: OrganizationBrandKit;
  imageAssets: BrandKitImageAssetOption[];
};

type BrandForm = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  typographyRules: string;
  brandVoice: string;
  logoUsageRules: string;
  visualConstraints: string;
  primaryLogoAssetId: string;
  lightLogoAssetId: string;
  darkLogoAssetId: string;
  brandMarkAssetId: string;
  faviconAssetId: string;
  approvedImageryAssetIds: string[];
};

function formFromKit(brandKit: OrganizationBrandKit): BrandForm {
  return {
    primaryColor: brandKit.primaryColor ?? "",
    secondaryColor: brandKit.secondaryColor ?? "",
    accentColor: brandKit.accentColor ?? "",
    typographyRules: brandKit.typographyRules ?? "",
    brandVoice: brandKit.brandVoice ?? "",
    logoUsageRules: brandKit.logoUsageRules ?? "",
    visualConstraints: brandKit.visualConstraints ?? "",
    primaryLogoAssetId: brandKit.primaryLogoAssetId ?? "",
    lightLogoAssetId: brandKit.lightLogoAssetId ?? "",
    darkLogoAssetId: brandKit.darkLogoAssetId ?? "",
    brandMarkAssetId: brandKit.brandMarkAssetId ?? "",
    faviconAssetId: brandKit.faviconAssetId ?? "",
    approvedImageryAssetIds: [...brandKit.approvedImageryAssetIds],
  };
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function BrandKitClient({ organizations }: { organizations: BrandKitWorkspace[] }) {
  const [workspaces, setWorkspaces] = useState(organizations);
  const [selectedId, setSelectedId] = useState(organizations[0]?.id ?? "");
  const selected = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedId) ?? workspaces[0],
    [selectedId, workspaces],
  );
  const [form, setForm] = useState<BrandForm>(() =>
    selected ? formFromKit(selected.brandKit) : {
      primaryColor: "",
      secondaryColor: "",
      accentColor: "",
      typographyRules: "",
      brandVoice: "",
      logoUsageRules: "",
      visualConstraints: "",
      primaryLogoAssetId: "",
      lightLogoAssetId: "",
      darkLogoAssetId: "",
      brandMarkAssetId: "",
      faviconAssetId: "",
      approvedImageryAssetIds: [],
    },
  );
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selected) return;
    setForm(formFromKit(selected.brandKit));
    setMessage(undefined);
  }, [selected]);

  if (!selected) {
    return <p className="mt-6 text-sm text-slate-400">No organization workspace is available.</p>;
  }

  const canEdit = selected.role === "OWNER" || selected.role === "ADMIN";
  const setField = (field: keyof Omit<BrandForm, "approvedImageryAssetIds">, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };
  const toggleApprovedImagery = (assetId: string) => {
    setForm((current) => ({
      ...current,
      approvedImageryAssetIds: current.approvedImageryAssetIds.includes(assetId)
        ? current.approvedImageryAssetIds.filter((id) => id !== assetId)
        : [...current.approvedImageryAssetIds, assetId],
    }));
  };

  const save = () => {
    const primaryColor = optional(form.primaryColor);
    const secondaryColor = optional(form.secondaryColor);
    const accentColor = optional(form.accentColor);
    const typographyRules = optional(form.typographyRules);
    const brandVoice = optional(form.brandVoice);
    const logoUsageRules = optional(form.logoUsageRules);
    const visualConstraints = optional(form.visualConstraints);
    const primaryLogoAssetId = optional(form.primaryLogoAssetId);
    const lightLogoAssetId = optional(form.lightLogoAssetId);
    const darkLogoAssetId = optional(form.darkLogoAssetId);
    const brandMarkAssetId = optional(form.brandMarkAssetId);
    const faviconAssetId = optional(form.faviconAssetId);

    setMessage(undefined);
    startTransition(async () => {
      const result = await saveBrandKitAction({
        organizationId: selected.id,
        brandKit: {
          ...(primaryColor ? { primaryColor } : {}),
          ...(secondaryColor ? { secondaryColor } : {}),
          ...(accentColor ? { accentColor } : {}),
          ...(typographyRules ? { typographyRules } : {}),
          ...(brandVoice ? { brandVoice } : {}),
          ...(logoUsageRules ? { logoUsageRules } : {}),
          ...(visualConstraints ? { visualConstraints } : {}),
          ...(primaryLogoAssetId ? { primaryLogoAssetId } : {}),
          ...(lightLogoAssetId ? { lightLogoAssetId } : {}),
          ...(darkLogoAssetId ? { darkLogoAssetId } : {}),
          ...(brandMarkAssetId ? { brandMarkAssetId } : {}),
          ...(faviconAssetId ? { faviconAssetId } : {}),
          approvedImageryAssetIds: form.approvedImageryAssetIds,
          expectedRevision: selected.brandKit.revision,
        },
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setWorkspaces((current) =>
        current.map((workspace) =>
          workspace.id === selected.id ? { ...workspace, brandKit: result.brandKit } : workspace,
        ),
      );
      setMessage("Brand Kit saved.");
    });
  };

  const inputClass = "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60";
  const labelClass = "text-sm font-medium text-slate-200";
  const renderAssetSelect = (label: string, field: keyof Pick<BrandForm, "primaryLogoAssetId" | "lightLogoAssetId" | "darkLogoAssetId" | "brandMarkAssetId" | "faviconAssetId">) => (
    <label className={labelClass}>
      {label}
      <select aria-label={label} className={inputClass} disabled={!canEdit} value={form[field]} onChange={(event) => setField(field, event.target.value)}>
        <option value="">Not assigned</option>
        {selected.imageAssets.map((asset) => (
          <option key={asset.id} value={asset.id}>{asset.displayName}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="mt-7 space-y-6">
      {workspaces.length > 1 ? (
        <label className={labelClass}>
          Organization
          <select className={inputClass} value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.label}</option>)}
          </select>
        </label>
      ) : null}

      {!canEdit ? (
        <p className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
          Owner or Admin access is required to edit Brand Kit. You can review the current authoritative brand settings.
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        <label className={labelClass}>Primary color<input aria-label="Primary color" className={inputClass} disabled={!canEdit} placeholder="#0F2B46" value={form.primaryColor} onChange={(event) => setField("primaryColor", event.target.value)} /></label>
        <label className={labelClass}>Secondary color<input aria-label="Secondary color" className={inputClass} disabled={!canEdit} placeholder="#FFFFFF" value={form.secondaryColor} onChange={(event) => setField("secondaryColor", event.target.value)} /></label>
        <label className={labelClass}>Accent color<input aria-label="Accent color" className={inputClass} disabled={!canEdit} placeholder="#D51F2B" value={form.accentColor} onChange={(event) => setField("accentColor", event.target.value)} /></label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {renderAssetSelect("Primary logo", "primaryLogoAssetId")}
        {renderAssetSelect("Light logo", "lightLogoAssetId")}
        {renderAssetSelect("Dark logo", "darkLogoAssetId")}
        {renderAssetSelect("Brand mark", "brandMarkAssetId")}
        {renderAssetSelect("Favicon", "faviconAssetId")}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className={labelClass}>Typography rules<textarea aria-label="Typography rules" className={`${inputClass} min-h-28`} disabled={!canEdit} value={form.typographyRules} onChange={(event) => setField("typographyRules", event.target.value)} /></label>
        <label className={labelClass}>Brand voice<textarea aria-label="Brand voice" className={`${inputClass} min-h-28`} disabled={!canEdit} value={form.brandVoice} onChange={(event) => setField("brandVoice", event.target.value)} /></label>
        <label className={labelClass}>Logo usage rules<textarea aria-label="Logo usage rules" className={`${inputClass} min-h-28`} disabled={!canEdit} value={form.logoUsageRules} onChange={(event) => setField("logoUsageRules", event.target.value)} /></label>
        <label className={labelClass}>Visual constraints<textarea aria-label="Visual constraints" className={`${inputClass} min-h-28`} disabled={!canEdit} value={form.visualConstraints} onChange={(event) => setField("visualConstraints", event.target.value)} /></label>
      </div>

      <fieldset className="rounded-xl border border-slate-800 p-4" disabled={!canEdit}>
        <legend className="px-2 text-sm font-semibold text-white">Approved institutional imagery</legend>
        {selected.imageAssets.length === 0 ? (
          <p className="text-sm text-slate-400">Upload approved images to Media Library first.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {selected.imageAssets.map((asset) => (
              <label key={asset.id} className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.approvedImageryAssetIds.includes(asset.id)} onChange={() => toggleApprovedImagery(asset.id)} />
                {asset.displayName}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-4">
        {canEdit ? (
          <button type="button" disabled={isPending} onClick={save} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {isPending ? "Saving…" : "Save Brand Kit"}
          </button>
        ) : null}
        <span className="text-xs text-slate-500">Revision {selected.brandKit.revision}</span>
        {message ? <span role="status" className="text-sm text-slate-300">{message}</span> : null}
      </div>
    </div>
  );
}