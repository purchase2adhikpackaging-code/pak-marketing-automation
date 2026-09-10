import { describe, expect, it, vi } from "vitest";

import { IntegrationVaultService } from "./service";
import type { IntegrationConnection } from "./types";
import type { IntegrationMetadataStore, IntegrationSecretStore } from "./repository";

const orgId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const rootKey = Buffer.alloc(32, 9).toString("base64");

function connection(overrides: Partial<IntegrationConnection> = {}): IntegrationConnection {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    organizationId: orgId,
    provider: "OPENAI",
    displayName: "OpenAI",
    status: "CONFIGURED",
    config: { defaultModel: "gpt-5.6-luna" },
    secretVersion: 1,
    maskedHint: "••••1234",
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    ...overrides,
  };
}

function stores() {
  const metadata: IntegrationMetadataStore = {
    listConnections: vi.fn().mockResolvedValue([connection()]),
    getConnection: vi.fn().mockResolvedValue(connection()),
    updateConnection: vi.fn().mockResolvedValue(connection()),
  };
  const secrets: IntegrationSecretStore = {
    saveEncryptedSecret: vi.fn().mockResolvedValue(connection().id),
    removeEncryptedSecret: vi.fn().mockResolvedValue(true),
    getEncryptedSecret: vi.fn(),
    appendAudit: vi.fn().mockResolvedValue(undefined),
  };
  return { metadata, secrets };
}

describe("IntegrationVaultService", () => {
  it("encrypts a saved key and returns only safe metadata", async () => {
    const { metadata, secrets } = stores();
    const service = new IntegrationVaultService(metadata, secrets, rootKey);

    const result = await service.saveSecret({
      organizationId: orgId,
      provider: "OPENAI",
      secretName: "API_KEY",
      secretValue: "sk-secret-1234",
      actorUserId: actorId,
    });

    expect(secrets.saveEncryptedSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: orgId,
        provider: "OPENAI",
        secretName: "API_KEY",
        maskedHint: "••••1234",
      }),
    );
    const saved = vi.mocked(secrets.saveEncryptedSecret).mock.calls[0]?.[0];
    expect(saved?.ciphertext).not.toContain("sk-secret-1234");
    expect(result).not.toHaveProperty("createdBy");
    expect(result).not.toHaveProperty("updatedBy");
  });

  it("decrypts secrets only through the server-side resolver", async () => {
    const { metadata, secrets } = stores();
    const service = new IntegrationVaultService(metadata, secrets, rootKey);
    await service.saveSecret({
      organizationId: orgId,
      provider: "OPENAI",
      secretName: "API_KEY",
      secretValue: "sk-secret-1234",
      actorUserId: actorId,
    });
    const encrypted = vi.mocked(secrets.saveEncryptedSecret).mock.calls[0]?.[0].ciphertext;
    vi.mocked(secrets.getEncryptedSecret).mockResolvedValue({ ciphertext: encrypted!, encryption_version: 1 });

    await expect(service.getSecret(orgId, "OPENAI", "API_KEY")).resolves.toBe("sk-secret-1234");
  });

  it("does not expose configured secrets in list results", async () => {
    const { metadata, secrets } = stores();
    const service = new IntegrationVaultService(metadata, secrets, rootKey);

    const result = await service.listConnections(orgId);

    expect(JSON.stringify(result)).not.toContain("ciphertext");
    expect(JSON.stringify(result)).not.toContain("sk-");
  });

  it("returns a safe not-found error for missing credentials", async () => {
    const { metadata, secrets } = stores();
    vi.mocked(secrets.getEncryptedSecret).mockResolvedValue(null);
    const service = new IntegrationVaultService(metadata, secrets, rootKey);

    await expect(service.getSecret(orgId, "OPENAI", "API_KEY")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Integration credential is not configured.",
    });
  });
});
