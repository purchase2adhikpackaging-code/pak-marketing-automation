import { z } from "zod";

import { INTEGRATION_PROVIDERS } from "./types";

const organizationId = z.string().uuid();
const provider = z.enum(INTEGRATION_PROVIDERS);
const secretName = z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/);

export const saveIntegrationSecretSchema = z.object({
  organizationId,
  provider,
  secretName,
  secretValue: z.string().min(1).max(16384),
});

export const removeIntegrationSecretSchema = z.object({
  organizationId,
  provider,
  secretName,
});

export const updateIntegrationConfigSchema = z.object({
  organizationId,
  provider,
  config: z.record(z.string(), z.unknown()).default({}),
});

export const setIntegrationDisabledSchema = z.object({
  organizationId,
  provider,
  disabled: z.boolean(),
});

export const testIntegrationConnectionSchema = z.object({
  organizationId,
  provider,
});

export type SaveIntegrationSecretInput = z.infer<typeof saveIntegrationSecretSchema>;
export type RemoveIntegrationSecretInput = z.infer<typeof removeIntegrationSecretSchema>;
export type UpdateIntegrationConfigInput = z.infer<typeof updateIntegrationConfigSchema>;
export type SetIntegrationDisabledInput = z.infer<typeof setIntegrationDisabledSchema>;
export type TestIntegrationConnectionInput = z.infer<typeof testIntegrationConnectionSchema>;
