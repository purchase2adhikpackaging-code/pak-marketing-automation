import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  saveIntegrationSecretAction: vi.fn(),
  removeIntegrationSecretAction: vi.fn(),
  updateIntegrationConfigAction: vi.fn(),
  setIntegrationDisabledAction: vi.fn(),
  testIntegrationConnectionAction: vi.fn(),
}));

import { IntegrationsManager } from "./integrations-manager";

describe("IntegrationsManager", () => {
  it("renders only safe OpenAI metadata and a blank write-only secret input", () => {
    render(
      <IntegrationsManager
        organizations={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            label: "PAK",
            role: "OWNER",
            connections: [
              {
                id: "22222222-2222-4222-8222-222222222222",
                organizationId: "11111111-1111-4111-8111-111111111111",
                provider: "OPENAI",
                displayName: "OpenAI",
                status: "CONFIGURED",
                config: { defaultModel: "gpt-5.6-luna" },
                secretVersion: 2,
                maskedHint: "••••abcd",
                createdAt: "2026-09-10T00:00:00.000Z",
                updatedAt: "2026-09-10T00:00:00.000Z",
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Configured")).not.toBeNull();
    expect(screen.getByText("••••abcd")).not.toBeNull();
    expect((screen.getByLabelText("OpenAI API key") as HTMLInputElement).value).toBe("");
    expect(document.body.textContent).not.toContain("sk-");
  });

  it("does not show credential mutation controls to non-managers", () => {
    render(
      <IntegrationsManager
        organizations={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            label: "PAK",
            role: "EDITOR",
            connections: [],
          },
        ]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Save API key" })).toBeNull();
    expect(screen.getByText(/Owner or Admin access is required/i)).not.toBeNull();
  });
});
