export const INTEGRATION_PROVIDERS = ["OPENAI", "META", "LTX"] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const INTEGRATION_CONNECTION_STATUSES = [
  "NOT_CONFIGURED",
  "CONFIGURED",
  "INVALID",
  "DISABLED",
] as const;
export type IntegrationConnectionStatus = (typeof INTEGRATION_CONNECTION_STATUSES)[number];

export type IntegrationConnectionConfig = Record<string, unknown>;

export type IntegrationConnection = {
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  displayName?: string;
  status: IntegrationConnectionStatus;
  config: IntegrationConnectionConfig;
  secretVersion: number;
  maskedHint?: string;
  lastVerifiedAt?: string;
  lastErrorCode?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type SafeIntegrationConnection = Omit<
  IntegrationConnection,
  "createdBy" | "updatedBy"
>;

export type IntegrationAuditEventType =
  | "CREATED"
  | "UPDATED"
  | "SECRET_REPLACED"
  | "SECRET_REMOVED"
  | "TEST_SUCCEEDED"
  | "TEST_FAILED"
  | "DISABLED"
  | "ENABLED";

export interface IntegrationCredentialResolver {
  getProviderConfig<TConfig>(organizationId: string, provider: IntegrationProvider): Promise<TConfig>;
  getSecret(organizationId: string, provider: IntegrationProvider, secretName: string): Promise<string>;
}
