import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { getServerEnv } from "@/lib/env/server";
import {
  decryptSecret,
  encryptSecret,
  INTEGRATION_SECRET_ENCRYPTION_VERSION,
  parseVaultEncryptionKey,
} from "./crypto";
import {
  SupabaseIntegrationMetadataStore,
  SupabaseIntegrationSecretStore,
  type IntegrationMetadataStore,
  type IntegrationSecretStore,
} from "./repository";
import type {
  IntegrationConnection,
  IntegrationConnectionConfig,
  IntegrationCredentialResolver,
  IntegrationProvider,
  SafeIntegrationConnection,
} from "./types";

function safeConnection(connection: IntegrationConnection): SafeIntegrationConnection {
  const { createdBy: _createdBy, updatedBy: _updatedBy, ...safe } = connection;
  return safe;
}

function maskedHint(value: string): string {
  const suffix = value.slice(-4);
  return `••••${suffix}`;
}

export class IntegrationVaultService implements IntegrationCredentialResolver {
  constructor(
    private readonly metadata: IntegrationMetadataStore,
    private readonly secrets: IntegrationSecretStore,
    private readonly rootKey: string,
  ) {
    parseVaultEncryptionKey(rootKey);
  }

  async listConnections(organizationId: string): Promise<SafeIntegrationConnection[]> {
    const rows = await this.metadata.listConnections(organizationId);
    return rows.map(safeConnection);
  }

  async saveSecret(input: {
    organizationId: string;
    provider: IntegrationProvider;
    secretName: string;
    secretValue: string;
    actorUserId: string;
  }): Promise<SafeIntegrationConnection> {
    const ciphertext = encryptSecret(input.secretValue, this.rootKey);

    await this.secrets.saveEncryptedSecret({
      organizationId: input.organizationId,
      provider: input.provider,
      actorUserId: input.actorUserId,
      secretName: input.secretName,
      ciphertext,
      encryptionVersion: INTEGRATION_SECRET_ENCRYPTION_VERSION,
      maskedHint: maskedHint(input.secretValue),
    });

    const connection = await this.metadata.getConnection(input.organizationId, input.provider);
    if (!connection) {
      throw new AppError("INTERNAL_ERROR", "Integration credential was saved but its connection metadata is unavailable.");
    }
    return safeConnection(connection);
  }

  async removeSecret(input: {
    organizationId: string;
    provider: IntegrationProvider;
    secretName: string;
    actorUserId: string;
  }): Promise<SafeIntegrationConnection> {
    const removed = await this.secrets.removeEncryptedSecret(input);
    if (!removed) throw new AppError("NOT_FOUND", "Integration credential is not configured.");

    const connection = await this.metadata.getConnection(input.organizationId, input.provider);
    if (!connection) throw new AppError("NOT_FOUND", "Integration connection is not configured.");
    return safeConnection(connection);
  }

  async updateConfig(input: {
    organizationId: string;
    provider: IntegrationProvider;
    config: IntegrationConnectionConfig;
    actorUserId: string;
  }): Promise<SafeIntegrationConnection> {
    const connection = await this.metadata.updateConnection(
      input.organizationId,
      input.provider,
      input.actorUserId,
      { config: input.config },
    );
    await this.secrets.appendAudit({
      organizationId: input.organizationId,
      connectionId: connection.id,
      actorUserId: input.actorUserId,
      eventType: "UPDATED",
      metadata: { fields: ["config"] },
    });
    return safeConnection(connection);
  }

  async setDisabled(input: {
    organizationId: string;
    provider: IntegrationProvider;
    disabled: boolean;
    actorUserId: string;
  }): Promise<SafeIntegrationConnection> {
    const current = await this.metadata.getConnection(input.organizationId, input.provider);
    if (!current) throw new AppError("NOT_FOUND", "Integration connection is not configured.");

    const nextStatus = input.disabled ? "DISABLED" : current.secretVersion > 0 ? "CONFIGURED" : "NOT_CONFIGURED";
    const connection = await this.metadata.updateConnection(
      input.organizationId,
      input.provider,
      input.actorUserId,
      { status: nextStatus },
    );
    await this.secrets.appendAudit({
      organizationId: input.organizationId,
      connectionId: connection.id,
      actorUserId: input.actorUserId,
      eventType: input.disabled ? "DISABLED" : "ENABLED",
    });
    return safeConnection(connection);
  }

  async recordTestResult(input: {
    organizationId: string;
    provider: IntegrationProvider;
    actorUserId: string;
    ok: boolean;
    errorCode?: string;
  }): Promise<SafeIntegrationConnection> {
    const connection = await this.metadata.updateConnection(
      input.organizationId,
      input.provider,
      input.actorUserId,
      {
        status: input.ok ? "CONFIGURED" : "INVALID",
        lastVerifiedAt: new Date().toISOString(),
        lastErrorCode: input.ok ? null : input.errorCode ?? "UNKNOWN_PROVIDER_ERROR",
      },
    );
    await this.secrets.appendAudit({
      organizationId: input.organizationId,
      connectionId: connection.id,
      actorUserId: input.actorUserId,
      eventType: input.ok ? "TEST_SUCCEEDED" : "TEST_FAILED",
      metadata: input.ok ? {} : { error_code: input.errorCode ?? "UNKNOWN_PROVIDER_ERROR" },
    });
    return safeConnection(connection);
  }

  async getProviderConfig<TConfig>(
    organizationId: string,
    provider: IntegrationProvider,
  ): Promise<TConfig> {
    const connection = await this.metadata.getConnection(organizationId, provider);
    if (!connection) throw new AppError("NOT_FOUND", "Integration connection is not configured.");
    if (connection.status === "DISABLED") throw new AppError("CONFLICT", "Integration connection is disabled.");
    return connection.config as TConfig;
  }

  async getSecret(
    organizationId: string,
    provider: IntegrationProvider,
    secretName: string,
  ): Promise<string> {
    const connection = await this.metadata.getConnection(organizationId, provider);
    if (!connection || connection.status === "NOT_CONFIGURED") {
      throw new AppError("NOT_FOUND", "Integration credential is not configured.");
    }
    if (connection.status === "DISABLED") {
      throw new AppError("CONFLICT", "Integration connection is disabled.");
    }

    const encrypted = await this.secrets.getEncryptedSecret(organizationId, provider, secretName);
    if (!encrypted) throw new AppError("NOT_FOUND", "Integration credential is not configured.");

    try {
      return decryptSecret(encrypted.ciphertext, this.rootKey);
    } catch {
      throw new AppError("INTERNAL_ERROR", "Integration credential could not be decrypted.");
    }
  }
}

export function createIntegrationVaultService(): IntegrationVaultService {
  const env = getServerEnv();
  if (!env.INTEGRATION_VAULT_ENCRYPTION_KEY) {
    throw new AppError("INTERNAL_ERROR", "Integration Vault is not configured on this deployment.");
  }

  return new IntegrationVaultService(
    new SupabaseIntegrationMetadataStore(),
    new SupabaseIntegrationSecretStore(),
    env.INTEGRATION_VAULT_ENCRYPTION_KEY,
  );
}
