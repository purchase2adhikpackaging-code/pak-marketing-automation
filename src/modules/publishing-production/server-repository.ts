import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  PublishingProductionRepository,
  type PublishingProductionTransport,
} from "./repository";

function authenticatedTransport(client: SupabaseClient): PublishingProductionTransport {
  return {
    async insertRun(payload) {
      const organizationId = String(payload.organization_id);
      const idempotencyKey = String(payload.idempotency_key);
      const existing = await client
        .from("publishing_production_runs")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing.error) throw new Error(`Publishing run lookup failed: ${existing.error.message}`);
      if (existing.data) return existing.data as Record<string, unknown>;

      const inserted = await client
        .from("publishing_production_runs")
        .insert(payload)
        .select("*")
        .single();
      if (!inserted.error) return inserted.data as Record<string, unknown>;
      if (inserted.error.code === "23505") {
        const raced = await client
          .from("publishing_production_runs")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("idempotency_key", idempotencyKey)
          .single();
        if (!raced.error && raced.data) return raced.data as Record<string, unknown>;
      }
      throw new Error(`Publishing run creation failed: ${inserted.error.message}`);
    },

    async insertJobs(payloads) {
      if (payloads.length === 0) return [];
      const first = payloads[0]!;
      const productionRunId = String(first.production_run_id);
      const { error } = await client
        .from("publishing_production_jobs")
        .upsert(payloads, {
          onConflict: "production_run_id,book_id,edition,revision",
          ignoreDuplicates: true,
        });
      if (error) throw new Error(`Publishing job enqueue failed: ${error.message}`);

      const { data, error: selectError } = await client
        .from("publishing_production_jobs")
        .select("*")
        .eq("production_run_id", productionRunId)
        .order("created_at", { ascending: true });
      if (selectError) throw new Error(`Publishing job readback failed: ${selectError.message}`);
      return (data ?? []) as Record<string, unknown>[];
    },

    async listRuns(organizationId) {
      const { data, error } = await client
        .from("publishing_production_runs")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Publishing run list failed: ${error.message}`);
      return (data ?? []) as Record<string, unknown>[];
    },

    async getRun(organizationId, runId) {
      const { data, error } = await client
        .from("publishing_production_runs")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("id", runId)
        .maybeSingle();
      if (error) throw new Error(`Publishing run lookup failed: ${error.message}`);
      return data as Record<string, unknown> | null;
    },

    async rpc(name, args) {
      const { data, error } = await client.rpc(name, args);
      if (error) throw new Error(`Publishing RPC ${name} failed: ${error.message}`);
      return data;
    },

    async listPublications(organizationId) {
      const { data, error } = await client
        .from("publishing_publications")
        .select("*")
        .eq("organization_id", organizationId)
        .order("released_at", { ascending: false });
      if (error) throw new Error(`Publishing library list failed: ${error.message}`);
      return (data ?? []) as Record<string, unknown>[];
    },
  };
}

export async function createAuthenticatedPublishingRepository(): Promise<PublishingProductionRepository> {
  return new PublishingProductionRepository(
    authenticatedTransport(await createServerSupabaseClient()),
  );
}
