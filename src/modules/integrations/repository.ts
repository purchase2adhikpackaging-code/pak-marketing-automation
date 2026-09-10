import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

export class SupabaseIntegrationSecretStore implements IntegrationSecretStore {
  async saveEncryptedSecret(input: {
    organizationId: string;
    provider: IntegrationProvider;
    actorUserId: string;
    secretName: string;
    ciphertext: string;
    encryptionVersion: number;
    maskedHint?: string;
  }): Promise<string> {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("save_integration_secret_server", {
      _organization_id: input.organizationId,
      _provider: input.provider,
      _actor_user_id: input.actorUserId,
      _secret_name: input.secretName,
      _ciphertext: input.ciphertext,
      _encryption_version: input.encryptionVersion,
      _masked_hint: input.maskedHint ?? null,
    });

    if (error || typeof data !== "string") {
      throw new AppError("INTERNAL_ERROR", "Unable to save integration credential.");
    }
    return data;
  }

  async removeEncryptedSecret(input: {
    organizationId: string;
    provider: IntegrationProvider;
    actorUserId: string;
    secretName: string;
  }): Promise<boolean> {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("remove_integration_secret_server", {
      _organization_id: input.organizationId,
      _provider: input.provider,
      _actor_user_id: input.actorUserId,
      _secret_name: input.secretName,
    });

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to remove integration credential.");
    return data === true;
  }

  async getEncryptedSecret(
    organizationId: string,
    provider: IntegrationProvider,
    secretName: string,
  ): Promise<SecretRow | null> {
    const supabase = createSupabaseAdminClient();
    const { data: connection, error: connectionError } = await supabase
      .from("integration_connections")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("provider", provider)
      .maybeSingle();

    if (connectionError) throw new AppError("INTERNAL_ERROR", "Unable to resolve integration credential.");
    if (!connection) return null;

    const { data, error } = await supabase
      .from("integration_secrets")
      .select("ciphertext,encryption_version")
      .eq("organization_id", organizationId)
      .eq("connection_id", connection.id)
      .eq("secret_name", secretName)
      .maybeSingle();

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to resolve integration credential.");
    return data ? (data as SecretRow) : null;
  }

  async appendAudit(input: {
    organizationId: string;
    connectionId: string | null;
    actorUserId: string;
    eventType: IntegrationAuditEventType;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("integration_audit_events").insert({
      organization_id: input.organizationId,
      connection_id: input.connectionId,
      actor_user_id: input.actorUserId,
      event_type: input.eventType,
      metadata: input.metadata ?? {},
    });

    if (error) throw new AppError("INTERNAL_ERROR", "Unable to record integration audit event.");
  }
}
