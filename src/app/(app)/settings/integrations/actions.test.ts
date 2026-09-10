import { describe, expect, it, vi } from "vitest";

import type { SafeIntegrationConnection } from "@/modules/integrations/types";
import {
  executeSaveIntegrationSecretAction,
  executeSetIntegrationDisabledAction,
  type IntegrationActionDependencies,
} from "./actions";

const organizationId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";

const connection: SafeIntegrationConnection = {
  id: "33333333-3333-4333-8333-333333333333",
  organizationId,
  provider: "OPENAI",
  displayName: "OpenAI",
  status: "CONFIGURED",
  config: { defaultModel: "gpt-5.6-luna" },
  secretVersion: 1,
  maskedHint: "••••1234",
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

function dependencies(role: "OWNER" | "ADMIN" | "EDITOR" = "OWNER"): IntegrationActionDependencies {
  return {
    getActor: vi.fn().mockResolvedValue({ id: actorId }),
    getMembership: vi.fn().mockResolvedValue({ role }),
    saveSecret: vi.fn().mockResolvedValue(connection),
    removeSecret: vi.fn().mockResolvedValue(connection),
    updateConfig: vi.fn().mockResolvedValue(connection),
    setDisabled: vi.fn().mockResolvedValue(connection),
    testConnection: vi.fn().mockResolvedValue(connection),
  };
}

describe("Integration Settings actions", () => {
  it("allows an OWNER to save a write-only OpenAI key", async () => {
    const deps = dependencies("OWNER");
    const result = await executeSaveIntegrationSecretAction(
      {
        organizationId,
        provider: "OPENAI",
        secretName: "API_KEY",
        secretValue: "sk-test-value-1234",
      },
      deps,
    );

    expect(result).toEqual({ ok: true, connection });
    expect(deps.saveSecret).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: actorId, secretValue: "sk-test-value-1234" }),
    );
    expect(JSON.stringify(result)).not.toContain("sk-test-value-1234");
  });

  it("rejects an EDITOR before any privileged secret mutation", async () => {
    const deps = dependencies("EDITOR");
    const result = await executeSaveIntegrationSecretAction(
      {
        organizationId,
        provider: "OPENAI",
        secretName: "API_KEY",
        secretValue: "sk-test-value-1234",
      },
      deps,
    );

    expect(result).toEqual({ ok: false, error: "You do not have permission to manage integrations for this organization." });
    expect(deps.saveSecret).not.toHaveBeenCalled();
  });

  it("rejects invalid input without calling dependencies", async () => {
    const deps = dependencies();
    const result = await executeSaveIntegrationSecretAction(
      { organizationId: "bad", provider: "OPENAI", secretName: "API_KEY", secretValue: "x" },
      deps,
    );

    expect(result.ok).toBe(false);
    expect(deps.getActor).not.toHaveBeenCalled();
  });

  it("can disable an existing provider connection", async () => {
    const deps = dependencies("ADMIN");
    const result = await executeSetIntegrationDisabledAction(
      { organizationId, provider: "OPENAI", disabled: true },
      deps,
    );

    expect(result.ok).toBe(true);
    expect(deps.setDisabled).toHaveBeenCalledWith({
      organizationId,
      provider: "OPENAI",
      disabled: true,
      actorUserId: actorId,
    });
  });
});
