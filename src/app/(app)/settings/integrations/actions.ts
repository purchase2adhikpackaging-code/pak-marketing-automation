"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { can } from "@/modules/auth/authorization";
import type { AppRole } from "@/modules/auth/roles";
import { invokeIntegrationVault } from "@/modules/integrations/edge-client";
import {
  removeIntegrationSecretSchema,
  saveIntegrationSecretSchema,
  setIntegrationDisabledSchema,
  testIntegrationConnectionSchema,
  updateIntegrationConfigSchema,
} from "@/modules/integrations/schema";
import type { IntegrationProvider, SafeIntegrationConnection } from "@/modules/integrations/types";

type Actor = { id: string };
type Membership = { role: AppRole } | null;
type EdgeConnectionResponse = { connection: SafeIntegrationConnection };

export type IntegrationActionResult =
  | { ok: true; connection: SafeIntegrationConnection }
  | { ok: false; error: string };

export type IntegrationActionDependencies = {
  getActor(): Promise<Actor | null>;
  getMembership(actorId: string, organizationId: string): Promise<Membership>;
  saveSecret(input: {
    organizationId: string;
    provider: IntegrationProvider;
    secretName: string;
    secretValue: string;
    actorUserId: string;
  }): Promise<SafeIntegrationConnection>;
  removeSecret(input: {
    organizationId: string;
    provider: IntegrationProvider;
    secretName: string;
    actorUserId: string;
  }): Promise<SafeIntegrationConnection>;
  updateConfig(input: {
    organizationId: string;
    provider: IntegrationProvider;
    config: Record<string, unknown>;
    actorUserId: string;
  }): Promise<SafeIntegrationConnection>;
  setDisabled(input: {
    organizationId: string;
    provider: IntegrationProvider;
    disabled: boolean;
    actorUserId: string;
  }): Promise<SafeIntegrationConnection>;
  testConnection(input: {
    organizationId: string;
    provider: IntegrationProvider;
    actorUserId: string;
  }): Promise<SafeIntegrationConnection>;
};

async function authorize(
  organizationId: string,
  dependencies: Pick<IntegrationActionDependencies, "getActor" | "getMembership">,
): Promise<{ actorId: string } | { error: string }> {
  const actor = await dependencies.getActor();
  if (!actor) return { error: "You must be signed in to manage integrations." };

  const membership = await dependencies.getMembership(actor.id, organizationId);
  if (!membership || !can(membership.role, "settings:manage")) {
    return { error: "You do not have permission to manage integrations for this organization." };
  }

  return { actorId: actor.id };
}

function safeFailure(): IntegrationActionResult {
  return { ok: false, error: "Integration settings are temporarily unavailable." };
}

export async function executeSaveIntegrationSecretAction(
  input: unknown,
  dependencies: IntegrationActionDependencies,
): Promise<IntegrationActionResult> {
  const parsed = saveIntegrationSecretSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the integration credential and try again." };

  const authorization = await authorize(parsed.data.organizationId, dependencies);
  if ("error" in authorization) return { ok: false, error: authorization.error };

  try {
    const connection = await dependencies.saveSecret({ ...parsed.data, actorUserId: authorization.actorId });
    return { ok: true, connection };
  } catch {
    return safeFailure();
  }
}

export async function executeRemoveIntegrationSecretAction(
  input: unknown,
  dependencies: IntegrationActionDependencies,
): Promise<IntegrationActionResult> {
  const parsed = removeIntegrationSecretSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the integration credential and try again." };

  const authorization = await authorize(parsed.data.organizationId, dependencies);
  if ("error" in authorization) return { ok: false, error: authorization.error };

  try {
    const connection = await dependencies.removeSecret({ ...parsed.data, actorUserId: authorization.actorId });
    return { ok: true, connection };
  } catch {
    return safeFailure();
  }
}

export async function executeUpdateIntegrationConfigAction(
  input: unknown,
  dependencies: IntegrationActionDependencies,
): Promise<IntegrationActionResult> {
  const parsed = updateIntegrationConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the integration settings and try again." };

  const authorization = await authorize(parsed.data.organizationId, dependencies);
  if ("error" in authorization) return { ok: false, error: authorization.error };

  try {
    const connection = await dependencies.updateConfig({ ...parsed.data, actorUserId: authorization.actorId });
    return { ok: true, connection };
  } catch {
    return safeFailure();
  }
}

export async function executeSetIntegrationDisabledAction(
  input: unknown,
  dependencies: IntegrationActionDependencies,
): Promise<IntegrationActionResult> {
  const parsed = setIntegrationDisabledSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the integration settings and try again." };

  const authorization = await authorize(parsed.data.organizationId, dependencies);
  if ("error" in authorization) return { ok: false, error: authorization.error };

  try {
    const connection = await dependencies.setDisabled({ ...parsed.data, actorUserId: authorization.actorId });
    return { ok: true, connection };
  } catch {
    return safeFailure();
  }
}

export async function executeTestIntegrationConnectionAction(
  input: unknown,
  dependencies: IntegrationActionDependencies,
): Promise<IntegrationActionResult> {
  const parsed = testIntegrationConnectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the integration settings and try again." };

  const authorization = await authorize(parsed.data.organizationId, dependencies);
  if ("error" in authorization) return { ok: false, error: authorization.error };

  try {
    const connection = await dependencies.testConnection({ ...parsed.data, actorUserId: authorization.actorId });
    return { ok: true, connection };
  } catch {
    return { ok: false, error: "Connection test failed. Check the saved credential and provider access." };
  }
}

async function getActor(): Promise<Actor | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

async function getMembership(actorId: string, organizationId: string): Promise<Membership> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", actorId)
    .maybeSingle();
  if (error || !data) return null;
  return { role: data.role as AppRole };
}

async function edgeConnection(body: Record<string, unknown>): Promise<SafeIntegrationConnection> {
  const result = await invokeIntegrationVault<EdgeConnectionResponse>(body);
  return result.connection;
}

function productionDependencies(): IntegrationActionDependencies {
  return {
    getActor,
    getMembership,
    saveSecret: (input) => edgeConnection({
      action: "save",
      organizationId: input.organizationId,
      provider: input.provider,
      secretName: input.secretName,
      secretValue: input.secretValue,
    }),
    removeSecret: (input) => edgeConnection({
      action: "remove",
      organizationId: input.organizationId,
      provider: input.provider,
      secretName: input.secretName,
    }),
    updateConfig: (input) => edgeConnection({
      action: "update_config",
      organizationId: input.organizationId,
      provider: input.provider,
      config: input.config,
    }),
    setDisabled: (input) => edgeConnection({
      action: "set_disabled",
      organizationId: input.organizationId,
      provider: input.provider,
      disabled: input.disabled,
    }),
    testConnection: (input) => edgeConnection({
      action: "test",
      organizationId: input.organizationId,
      provider: input.provider,
    }),
  };
}

export async function saveIntegrationSecretAction(input: unknown): Promise<IntegrationActionResult> {
  return executeSaveIntegrationSecretAction(input, productionDependencies());
}

export async function removeIntegrationSecretAction(input: unknown): Promise<IntegrationActionResult> {
  return executeRemoveIntegrationSecretAction(input, productionDependencies());
}

export async function updateIntegrationConfigAction(input: unknown): Promise<IntegrationActionResult> {
  return executeUpdateIntegrationConfigAction(input, productionDependencies());
}

export async function setIntegrationDisabledAction(input: unknown): Promise<IntegrationActionResult> {
  return executeSetIntegrationDisabledAction(input, productionDependencies());
}

export async function testIntegrationConnectionAction(input: unknown): Promise<IntegrationActionResult> {
  return executeTestIntegrationConnectionAction(input, productionDependencies());
}
