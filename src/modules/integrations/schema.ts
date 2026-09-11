import { z } from "zod";

import { INTEGRATION_PROVIDERS } from "./types";

export const OPENAI_ALLOWED_MODELS = ["gpt-5.6-luna", "gpt-5.6-terra"] as const;

const organizationId = z.string().uuid();
const provider = z.enum(INTEGRATION_PROVIDERS);
const secretName = z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/);
const SENSITIVE_CONFIG_KEY_RE = /(api.?key|secret|token|password|credential|private.?key)/i;

function containsSensitiveConfigKey(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== "object") return false;
  if (depth > 8) return true;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_CONFIG_KEY_RE.test(key)) return true;
    if (containsSensitiveConfigKey(nested, depth + 1)) return true;
  }

  return false;
}

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

export const updateIntegrationConfigSchema = z
  .object({
    organizationId,
    provider,
    config: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((value, context) => {
    if (containsSensitiveConfigKey(value.config)) {
      context.addIssue({
        code: "custom",
        path: ["config"],
        message: "Sensitive integration values must be stored as Vault secrets.",
      });
    }

    if (value.provider !== "OPENAI" || value.config.defaultModel === undefined) return;

    if (
      typeof value.config.defaultModel !== "string" ||
      !OPENAI_ALLOWED_MODELS.includes(value.config.defaultModel as (typeof OPENAI_ALLOWED_MODELS)[number])
    ) {
      context.addIssue({
        code: "custom",
        path: ["config", "defaultModel"],
        message: "Unsupported OpenAI model.",
      });
    }
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