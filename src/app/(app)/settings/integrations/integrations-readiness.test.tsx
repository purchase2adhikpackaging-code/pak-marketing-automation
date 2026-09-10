import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { removeIntegrationSecretAction } from "./actions";
import { IntegrationsManager } from "./integrations-manager";

vi.mock("./actions", () => ({
  saveIntegrationSecretAction: vi.fn(),
  removeIntegrationSecretAction: vi.fn(),
  updateIntegrationConfigAction: vi.fn(),
  setIntegrationDisabledAction: vi.fn(),
  testIntegrationConnectionAction: vi.fn(),
}));

const organizationId = "11111111-1111-4111-8111-111111111111";

const organizations = [
  {
    id: organizationId,
    label: "Polish Railway Academy",
    role: "OWNER" as const,
    connections: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        organizationId,
        provider: "OPENAI" as const,
        displayName: "OpenAI",
        status: "CONFIGURED" as const,
        config: { defaultModel: "gpt-5.6-luna" },
        secretVersion: 1,
        maskedHint: "••••2XQA",
        createdAt: "2026-09-10T00:00:00.000Z",
        updatedAt: "2026-09-10T00:00:00.000Z",
      },
    ],
  },
];

describe("Integration Settings production readiness", () => {
  beforeEach(() => vi.mocked(removeIntegrationSecretAction).mockReset());

  it("constrains OpenAI model selection to the supported production allowlist", () => {
    render(<IntegrationsManager organizations={organizations} />);

    const model = screen.getByLabelText("Default model") as HTMLSelectElement;
    expect(model.tagName).toBe("SELECT");
    expect(Array.from(model.options).map((option) => option.value)).toEqual([
      "gpt-5.6-luna",
      "gpt-5.6-terra",
    ]);
  });

  it("requires confirmation before removing the write-only credential", async () => {
    const current = organizations[0]!.connections[0]!;
    vi.mocked(removeIntegrationSecretAction).mockResolvedValue({
      ok: true,
      connection: {
        id: current.id,
        organizationId: current.organizationId,
        provider: current.provider,
        displayName: current.displayName,
        status: "NOT_CONFIGURED",
        config: current.config,
        secretVersion: current.secretVersion,
        createdAt: current.createdAt,
        updatedAt: current.updatedAt,
      },
    });

    render(<IntegrationsManager organizations={organizations} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove key" }));
    expect(removeIntegrationSecretAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm remove OpenAI API key" }));
    await waitFor(() => expect(removeIntegrationSecretAction).toHaveBeenCalledTimes(1));
  });
});
