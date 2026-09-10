"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";

import { can } from "@/modules/auth/authorization";
import type { AppRole } from "@/modules/auth/roles";
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

export function IntegrationsManager({ organizations }: { organizations: IntegrationOrganizationWorkspace[] }) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizations[0]?.id ?? "");
  const [connectionsByOrg, setConnectionsByOrg] = useState<Record<string, SafeIntegrationConnection[]>>(
    Object.fromEntries(organizations.map((organization) => [organization.id, organization.connections])),
  );
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-5.6-luna");
  const [message, setMessage] = useState<Message>(null);
  const [isPending, startTransition] = useTransition();

  const organization = organizations.find((item) => item.id === selectedOrganizationId) ?? organizations[0];
  const connections = organization ? connectionsByOrg[organization.id] ?? [] : [];
  const openAiConnection = connections.find((connection) => connection.provider === "OPENAI");
  const canManage = organization ? can(organization.role, "settings:manage") : false;
  const configuredModel =
    typeof openAiConnection?.config.defaultModel === "string"
      ? openAiConnection.config.defaultModel
      : "gpt-5.6-luna";

  useEffect(() => {
    setModel(configuredModel);
  }, [configuredModel, selectedOrganizationId]);

  function replaceConnection(next: SafeIntegrationConnection) {
    setConnectionsByOrg((current) => {
      const rows = current[next.organizationId] ?? [];
      const withoutProvider = rows.filter((connection) => connection.provider !== next.provider);
      return { ...current, [next.organizationId]: [...withoutProvider, next] };
    });
  }

  function run(action: () => Promise<{ ok: true; connection: SafeIntegrationConnection } | { ok: false; error: string }>, success: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        replaceConnection(result.connection);
        setMessage({ type: "success", text: success });
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  }

  function saveKey(event: FormEvent) {
    event.preventDefault();
    if (!organization || !apiKey.trim()) return;
    run(
      () =>
        saveIntegrationSecretAction({
          organizationId: organization.id,
          provider: "OPENAI",
          secretName: "API_KEY",
          secretValue: apiKey,
        }),
      "OpenAI API key saved securely.",
    );
    setApiKey("");
  }

  if (!organization) {
    return (
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
        No organization membership is available for Integration Settings.
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {organizations.length > 1 ? (
        <label className="block max-w-md text-sm text-slate-300">
          Organization
          <select
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            value={organization.id}
            onChange={(event) => {
              setSelectedOrganizationId(event.target.value);
              setApiKey("");
              setMessage(null);
            }}
          >
            {organizations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {message ? (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-900 bg-emerald-950/40 text-emerald-200"
              : "border-rose-900 bg-rose-950/40 text-rose-200"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-semibold text-white">OpenAI</h3>
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300">
                {statusLabel(openAiConnection?.status)}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Used by Content Studio for canonical scripts and multilingual AI workflows. Stored keys are encrypted and never displayed again.
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>{openAiConnection?.maskedHint ?? "No saved key"}</div>
            {openAiConnection?.lastVerifiedAt ? (
              <div className="mt-1">Verified {new Date(openAiConnection.lastVerifiedAt).toLocaleString()}</div>
            ) : null}
          </div>
        </div>

        {canManage ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <form onSubmit={saveKey} className="space-y-3 rounded-xl border border-slate-800 p-4">
              <label className="block text-sm font-medium text-slate-200" htmlFor="openai-api-key">
                OpenAI API key
              </label>
              <input
                id="openai-api-key"
                aria-label="OpenAI API key"
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={openAiConnection ? "Paste a replacement key" : "Paste API key"}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isPending || !apiKey.trim()}
                  className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  Save API key
                </button>
                {openAiConnection ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      run(
                        () =>
                          removeIntegrationSecretAction({
                            organizationId: organization.id,
                            provider: "OPENAI",
                            secretName: "API_KEY",
                          }),
                        "OpenAI API key removed.",
                      )
                    }
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 disabled:opacity-50"
                  >
                    Remove key
                  </button>
                ) : null}
              </div>
              <p className="text-xs leading-5 text-slate-500">The saved value is write-only. PAK displays only a masked suffix and connection status.</p>
            </form>

            <div className="space-y-3 rounded-xl border border-slate-800 p-4">
              <label className="block text-sm font-medium text-slate-200" htmlFor="openai-model">
                Default model
              </label>
              <input
                id="openai-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending || !openAiConnection || !model.trim()}
                  onClick={() =>
                    run(
                      () =>
                        updateIntegrationConfigAction({
                          organizationId: organization.id,
                          provider: "OPENAI",
                          config: { ...openAiConnection?.config, defaultModel: model.trim() },
                        }),
                      "OpenAI model configuration saved.",
                    )
                  }
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
                >
                  Save model
                </button>
                <button
                  type="button"
                  disabled={isPending || !openAiConnection || openAiConnection.status === "NOT_CONFIGURED"}
                  onClick={() =>
                    run(
                      () =>
                        testIntegrationConnectionAction({
                          organizationId: organization.id,
                          provider: "OPENAI",
                        }),
                      "OpenAI connection verified.",
                    )
                  }
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
                >
                  Test connection
                </button>
                {openAiConnection ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      run(
                        () =>
                          setIntegrationDisabledAction({
                            organizationId: organization.id,
                            provider: "OPENAI",
                            disabled: openAiConnection.status !== "DISABLED",
                          }),
                        openAiConnection.status === "DISABLED" ? "OpenAI enabled." : "OpenAI disabled.",
                      )
                    }
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 disabled:opacity-50"
                  >
                    {openAiConnection.status === "DISABLED" ? "Enable" : "Disable"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
            Owner or Admin access is required to manage integration credentials.
          </p>
        )}
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["Meta", "Facebook, Instagram and WhatsApp credentials will use this same vault in the publishing integration phase."],
          ["LTX / Video", "Video provider credentials will use this same vault when Scene Planning and generation are enabled."],
        ].map(([title, description]) => (
          <article key={title} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-white">{title}</h3>
              <span className="rounded-full border border-slate-800 px-2 py-1 text-xs text-slate-500">Planned</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}