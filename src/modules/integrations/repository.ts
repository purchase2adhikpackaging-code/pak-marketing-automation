import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  IntegrationAuditEventType,
  IntegrationConnection,
  IntegrationConnectionConfig,
  IntegrationConnectionStatus,
  IntegrationProvider,
} from "./types";

type ConnectionRow = {
  id: string;
  organization_id: string;
  provider: IntegrationProvider;
  display_name: string | null;
  status: IntegrationConnectionStatus;
  config: IntegrationConnectionConfig;
  secret_version: number;
  masked_hint: string | null;
  last_verified_at: string | null;
  last_error_code: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type SecretRow = {
  ciphertext: string;
  encryption_version: number;
};

const CONNECTION_COLUMNS = [
  "id",
  "organization_id",
  "provider",
  "display_name",
  "status",
  "config",
  "secret_version",
  "masked_hint",
  "last_verified_at",
  "last_error_code",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
].join(",");

function mapConnection(row: ConnectionRow): IntegrationConnection {
  return {
    id: row.id,
    organizationId: row.organization_id,
    provider: row.provider,
    ...(row.display_name ? { displayName: row.display_name } : {}),
    status: row.status,
    config: row.config ?? {},
    secretVersion: row.secret_version,
    ...(row.masked_hint ? { maskedHint: row.masked_hint } : {}),
    ...(row.last_verified_at ? { lastVerifiedAt: row.last_verified_at } : {}),
    ...(row.last_error_code ? { lastErrorCode: row.last_error_code } : {}),
    ...(row.created_by ? { createdBy: row.created_by } : {}),
    ...(row.updated_by ? { updatedBy: row.updated_by } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface IntegrationMetadataStore {
  listConnections(organizationId: string): Promise<IntegrationConnection[]>;
  getConnection(organizationId: string, provider: IntegrationProvider): Promise<IntegrationConnection | null>;
  updateConnection(
    organizationId: string,
    provider: IntegrationProvider,
    actorUserId: string,
    patch: {
      config?: IntegrationConnectionConfig;
      status?: IntegrationConnectionStatus;
      lastVerifiedAt?: string | null;
      lastErrorCode?: string | null;
    },
  ): Promise<IntegrationConnection>;
}

/**
 * Injectable legacy contract used only by domain-level tests. Production secret
 * persistence and reads live in Supabase Vault behind authenticated Edge Functions.
 */
export interface IntegrationSecretStore {
  saveEncryptedSecret(input: {
    organizationId: string;
    provider: IntegrationProvider;
    actorUserId: string;
    secretName: string;
    ciphertext: string;
    encryptionVersion: number;
    maskedHint?: string;
  }): Promise<string>;
  removeEncryptedSecret(input: {
    organizationId: string;
    provider: IntegrationProvider;
    actorUserId: string;
    secretName: string;
  }): Promise<boolean>;
  getEncryptedSecret(
    organizationId: string,
    provider: IntegrationProvider,
    secretName: string,
  ): Promise<SecretRow | null>;
  appendAudit(input: {
    organizationId: string;
    connectionId: string | null;
    actorUserId: string;
    eventType: IntegrationAuditEventType;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export class SupabaseIntegrationMetadataStore implements IntegrationMetadataStore {
  async listConnections(organizationId: string): Promise<IntegrationConnection[]> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("integration_connections")
      .select(CONNECTION_COLUMNS)
      .eq("organization_id", organizationId)
      .order("provider", { ascending: true });

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to load integration settings.");
    return (data ?? []).map((row) => mapConnection(row as unknown as ConnectionRow));
  }

  async getConnection(
    organizationId: string,
    provider: IntegrationProvider,
  ): Promise<IntegrationConnection | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("integration_connections")
      .select(CONNECTION_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("provider", provider)
      .maybeSingle();

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to load integration settings.");
    return data ? mapConnection(data as unknown as ConnectionRow) : null;
  }

  async updateConnection(
    organizationId: string,
    provider: IntegrationProvider,
    actorUserId: string,
    patch: {
      config?: IntegrationConnectionConfig;
      status?: IntegrationConnectionStatus;
      lastVerifiedAt?: string | null;
      lastErrorCode?: string | null;
    },
  ): Promise<IntegrationConnection> {
    const supabase = await createServerSupabaseClient();
    const databasePatch: Record<string, unknown> = { updated_by: actorUserId };
    if (patch.config !== undefined) databasePatch.config = patch.config;
    if (patch.status !== undefined) databasePatch.status = patch.status;
    if (patch.lastVerifiedAt !== undefined) databasePatch.last_verified_at = patch.lastVerifiedAt;
    if (patch.lastErrorCode !== undefined) databasePatch.last_error_code = patch.lastErrorCode;

    const { data, error } = await supabase
      .from("integration_connections")
      .update(databasePatch)
      .eq("organization_id", organizationId)
      .eq("provider", provider)
      .select(CONNECTION_COLUMNS)
      .maybeSingle();

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to update integration settings.");
    if (!data) throw new AppError("NOT_FOUND", "Integration connection is not configured.");
    return mapConnection(data as unknown as ConnectionRow);
  }
}
