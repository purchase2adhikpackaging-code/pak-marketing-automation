"use client";

import React, { FormEvent, useEffect, useState, useTransition } from "react";

import { can } from "@/modules/auth/authorization";
import type { AppRole } from "@/modules/auth/roles";
import { OPENAI_ALLOWED_MODELS } from "@/modules/integrations/schema";
import type { SafeIntegrationConnection } from "@/modules/integrations/types";
import {
  removeIntegrationSecretAction,
  saveIntegrationSecretAction,
  setIntegrationDisabledAction,
  testIntegrationConnectionAction,
  updateIntegrationConfigAction,
} from "./actions";

export type IntegrationOrganizationWorkspace = {
  id: string;
  label: string;
  role: AppRole;
  connections: SafeIntegrationConnection[];
};

type Message = { type: "success" | "error"; text: string } | null;
type OpenAIModel = (typeof OPENAI_ALLOWED_MODELS)[number];
type PendingOperation = "save-key" | "remove-key" | "save-model" | "test" | "toggle" | null;

function statusLabel(status: SafeIntegrationConnection["status"] | undefined): string {
  switch (status) {
    case "CONFIGURED":
      return "Configured";
    case "INVALID":
      return "Invalid";
    case "DISABLED":
      return "Disabled";
    default:
      return "Not configured";
  }
}

function safeConfiguredModel(connection: SafeIntegrationConnection | undefined): OpenAIModel {
  const candidate = connection?.config.defaultModel;
  return typeof candidate === "string" && OPENAI_ALLOWED_MODELS.includes(candidate as OpenAIModel)
    ? (candidate as OpenAIModel)
    : "gpt-5.6-luna";
}

function pendingLabel(operation: PendingOperation, enabling: boolean): string | null {
  switch (operation) {
    case "save-key":
      return "Saving API key…";
    case "remove-key":
      return "Removing API key…";
    case "save-model":
      return "Saving model configuration…";
    case "test":
      return "Testing connection…";
    case "toggle":
      return enabling ? "Enabling OpenAI…" : "Disabling OpenAI…";
    default:
      return null;
  }
}

export function IntegrationsManager({ organizations }: { organizations: IntegrationOrganizationWorkspace[] }) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizations[0]?.id ?? "");
  const [connectionsByOrg, setConnectionsByOrg] = useState<Record<string, SafeIntegrationConnection[]>>(
    Object.fromEntries(organizations.map((organization) => [organization.id, organization.connections])),
  );
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<OpenAIModel>("gpt-5.6-luna");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation>(null);
  const [isPending, startTransition] = useTransition();

  const organization = organizations.find((item) => item.id === selectedOrganizationId) ?? organizations[0];
  const connections = organization ? connectionsByOrg[organization.id] ?? [] : [];
  const openAiConnection = connections.find((connection) => connection.provider === "OPENAI");
  const canManage = organization ? can(organization.role, "settings:manage") : false;
  const configuredModel = safeConfiguredModel(openAiConnection);
  const enabling = openAiConnection?.status === "DISABLED";

  useEffect(() => {
    setModel(configuredModel);
    setConfirmRemove(false);
    setConfirmDisable(false);
  }, [configuredModel, selectedOrganizationId]);

  function replaceConnection(next: SafeIntegrationConnection) {
    setConnectionsByOrg((current) => {
      const rows = current[next.organizationId] ?? [];
      const withoutProvider = rows.filter((connection) => connection.provider !== next.provider);
      return { ...current, [next.organizationId]: [...withoutProvider, next] };
    });
  }

  function run(
    operation: Exclude<PendingOperation, null>,
    action: () => Promise<{ ok: true; connection: SafeIntegrationConnection } | { ok: false; error: string }>,
    success: string,
  ) {
    setMessage(null);
    setPendingOperation(operation);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          replaceConnection(result.connection);
          setMessage({ type: "success", text: success });
        } else {
          setMessage({ type: "error", text: result.error });
        }
      } finally {
        setPendingOperation(null);
      }
    });
  }

  function saveKey(event: FormEvent) {
    event.preventDefault();
    if (!organization || !apiKey.trim()) return;
    run(
      "save-key",
      () => saveIntegrationSecretAction({
        organizationId: organization.id,
        provider: "OPENAI",
        secretName: "API_KEY",
        secretValue: apiKey,
      }),
      "OpenAI API key saved securely.",
    );
    setApiKey("");
  }

  function removeKey() {
    if (!organization) return;
    run(
      "remove-key",
      () => removeIntegrationSecretAction({
        organizationId: organization.id,
        provider: "OPENAI",
        secretName: "API_KEY",
      }),
      "OpenAI API key removed.",
    );
    setConfirmRemove(false);
  }

  function setOpenAiDisabled(disabled: boolean) {
    if (!organization) return;
    run(
      "toggle",
      () => setIntegrationDisabledAction({ organizationId: organization.id, provider: "OPENAI", disabled }),
      disabled ? "OpenAI disabled." : "OpenAI enabled.",
    );
    setConfirmDisable(false);
  }

  if (!organization) {
    return (
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
        <p>No organization membership is available for Integration Settings.</p>
        <p className="mt-2">Ask an organization Owner or Admin to add this account before configuring providers.</p>
      </div>
    );
  }

  const currentPendingLabel = pendingLabel(pendingOperation, enabling);

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Organization context</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="font-semibold text-white">{organization.label}</span>
          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{organization.role}</span>
        </div>
      </section>

      {organizations.length > 1 ? (
        <label className="block max-w-md text-sm text-slate-300">
          Organization
          <select
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={organization.id}
            disabled={isPending}
            onChange={(event) => {
              setSelectedOrganizationId(event.target.value);
              setApiKey("");
              setMessage(null);
              setConfirmRemove(false);
              setConfirmDisable(false);
            }}
          >
            {organizations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      ) : null}

      {currentPendingLabel ? (
        <div role="status" aria-live="polite" className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          {currentPendingLabel}
        </div>
      ) : null}
      {message ? (
        <div
          role={message.type === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-900 bg-emerald-950/40 text-emerald-200" : "border-rose-900 bg-rose-950/40 text-rose-200"}`}
        >
          {message.text}
        </div>
      ) : null}

      <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-semibold text-white">OpenAI</h3>
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300">{statusLabel(openAiConnection?.status)}</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Used by Content Studio for canonical scripts and multilingual AI workflows. Stored keys are encrypted and never displayed again.
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>{openAiConnection?.maskedHint ?? "No saved key"}</div>
            {openAiConnection?.lastVerifiedAt ? <div className="mt-1">Verified {new Date(openAiConnection.lastVerifiedAt).toLocaleString()}</div> : null}
          </div>
        </div>

        {canManage ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <form onSubmit={saveKey} className="space-y-3 rounded-xl border border-slate-800 p-4">
              <label className="block text-sm font-medium text-slate-200" htmlFor="openai-api-key">OpenAI API key</label>
              <input
                id="openai-api-key"
                aria-label="OpenAI API key"
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={openAiConnection ? "Paste a replacement key" : "Paste API key"}
                disabled={isPending}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600"
              />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={isPending || !apiKey.trim()} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Save API key</button>
                {openAiConnection && !confirmRemove ? (
                  <button type="button" disabled={isPending} onClick={() => { setMessage(null); setConfirmRemove(true); setConfirmDisable(false); }} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 disabled:opacity-50">Remove key</button>
                ) : null}
              </div>
              {confirmRemove ? (
                <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-3">
                  <p className="text-sm text-red-100">Remove the saved OpenAI API key? Content generation will stop until a new key is saved.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" aria-label="Confirm remove OpenAI API key" onClick={removeKey} disabled={isPending} className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-950">Confirm remove</button>
                    <button type="button" onClick={() => setConfirmRemove(false)} disabled={isPending} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200">Cancel</button>
                  </div>
                </div>
              ) : null}
              <p className="text-xs leading-5 text-slate-500">The saved value is write-only. PAK displays only a masked suffix and connection status.</p>
            </form>

            <div className="space-y-3 rounded-xl border border-slate-800 p-4">
              <label className="block text-sm font-medium text-slate-200" htmlFor="openai-model">Default model</label>
              <select
                id="openai-model"
                aria-label="Default model"
                value={model}
                onChange={(event) => setModel(event.target.value as OpenAIModel)}
                disabled={isPending}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {OPENAI_ALLOWED_MODELS.map((allowedModel) => <option key={allowedModel} value={allowedModel}>{allowedModel}</option>)}
              </select>
              <p className="text-xs leading-5 text-slate-500">Only production-approved models are selectable. Unsupported model IDs are also rejected server-side.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending || !openAiConnection}
                  onClick={() => run(
                    "save-model",
                    () => updateIntegrationConfigAction({ organizationId: organization.id, provider: "OPENAI", config: { ...openAiConnection?.config, defaultModel: model } }),
                    "OpenAI model configuration saved.",
                  )}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
                >Save model</button>
                <button
                  type="button"
                  disabled={isPending || !openAiConnection || openAiConnection.status === "NOT_CONFIGURED"}
                  onClick={() => run(
                    "test",
                    () => testIntegrationConnectionAction({ organizationId: organization.id, provider: "OPENAI" }),
                    "OpenAI connection verified.",
                  )}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
                >Test connection</button>
                {openAiConnection && openAiConnection.status === "DISABLED" ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setOpenAiDisabled(false)}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 disabled:opacity-50"
                  >Enable</button>
                ) : openAiConnection && !confirmDisable ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => { setMessage(null); setConfirmDisable(true); setConfirmRemove(false); }}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 disabled:opacity-50"
                  >Disable</button>
                ) : null}
              </div>
              {confirmDisable ? (
                <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-3">
                  <p className="text-sm text-amber-100">Disable OpenAI for this organization? Content generation will be unavailable until OpenAI is enabled again.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-label="Confirm disable OpenAI"
                      onClick={() => setOpenAiDisabled(true)}
                      disabled={isPending}
                      className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-950"
                    >Confirm disable</button>
                    <button type="button" onClick={() => setConfirmDisable(false)} disabled={isPending} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200">Cancel</button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : <p className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">Owner or Admin access is required to manage integration credentials.</p>}
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["Meta", "Facebook, Instagram and WhatsApp credentials will use this same vault in the publishing integration phase."],
          ["LTX / Video", "Video provider credentials will use this same vault when Scene Planning and generation are enabled."],
        ].map(([title, description]) => (
          <article key={title} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-white">{title}</h3><span className="rounded-full border border-slate-800 px-2 py-1 text-xs text-slate-500">Planned</span></div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
