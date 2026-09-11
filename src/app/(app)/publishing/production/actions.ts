"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import type { AppRole } from "@/modules/auth/roles";
import type { BookJob } from "@/modules/publishing-factory/domain";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProductionScopeSchema, type ProductionScope } from "@/modules/publishing-production/domain";
import { planProductionRun, type ProductionPlanExclusion } from "@/modules/publishing-production/run-planner";
import {
  curriculumTextForJob,
  loadAcademicRegistryFromDisk,
  loadProgrammeCurriculumFromDisk,
} from "@/modules/publishing-production/server-curriculum";
import { createAuthenticatedPublishingRepository } from "@/modules/publishing-production/server-repository";

export interface ProductionActionDependencies {
  getActorMembership(organizationId: string): Promise<{ actorId: string; role: AppRole } | null>;
  plan(input: { organizationId: string; scope: ProductionScope }): Promise<{
    jobs: Array<{ job: BookJob; curriculumText: string }>;
    exclusions: ProductionPlanExclusion[];
  }>;
  createRun(input: {
    organizationId: string;
    actorId: string;
    role: AppRole;
    scope: ProductionScope;
    concurrency: number;
    plannedCount: number;
  }): Promise<{ id: string }>;
  enqueueJobs(input: {
    organizationId: string;
    productionRunId: string;
    jobs: Array<{ job: BookJob; curriculumText: string }>;
  }): Promise<unknown>;
  kick(runId: string): Promise<void>;
  controlRun(runId: string, state: "PAUSED" | "RUNNING" | "CANCELLED"): Promise<void>;
}

export type ProductionActionResult =
  | { ok: true; runId: string; plannedCount: number; exclusions: ProductionPlanExclusion[] }
  | { ok: false; error: string; exclusions?: ProductionPlanExclusion[] };

function validateOrganizationId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function executeStartProductionRunAction(
  input: { organizationId: string; scope: ProductionScope; concurrency?: number },
  dependencies: ProductionActionDependencies,
): Promise<ProductionActionResult> {
  if (!validateOrganizationId(input.organizationId)) return { ok: false, error: "Invalid organization." };
  const parsedScope = ProductionScopeSchema.safeParse(input.scope);
  if (!parsedScope.success) return { ok: false, error: "Invalid production scope." };
  const concurrency = input.concurrency ?? 4;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    return { ok: false, error: "Concurrency must be an integer from 1 to 32." };
  }

  const membership = await dependencies.getActorMembership(input.organizationId);
  if (!membership || !["OWNER", "ADMIN", "EDITOR"].includes(membership.role)) {
    return { ok: false, error: "You do not have permission to start publishing production." };
  }
  if (membership.role === "EDITOR" && parsedScope.data.type === "PORTFOLIO") {
    return { ok: false, error: "Editors cannot start full portfolio production." };
  }

  try {
    const plan = await dependencies.plan({ organizationId: input.organizationId, scope: parsedScope.data });
    if (plan.jobs.length === 0) {
      return { ok: false, error: "No governed books are eligible for this production scope.", exclusions: plan.exclusions };
    }

    const run = await dependencies.createRun({
      organizationId: input.organizationId,
      actorId: membership.actorId,
      role: membership.role,
      scope: parsedScope.data,
      concurrency,
      plannedCount: plan.jobs.length,
    });
    await dependencies.enqueueJobs({
      organizationId: input.organizationId,
      productionRunId: run.id,
      jobs: plan.jobs,
    });
    await dependencies.kick(run.id);
    return { ok: true, runId: run.id, plannedCount: plan.jobs.length, exclusions: plan.exclusions };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Publishing production could not be started." };
  }
}

export async function executeProductionRunControlAction(
  input: { organizationId: string; runId: string; state: "PAUSED" | "RUNNING" | "CANCELLED" },
  dependencies: ProductionActionDependencies,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!validateOrganizationId(input.organizationId) || !validateOrganizationId(input.runId)) {
    return { ok: false, error: "Invalid production run." };
  }
  const membership = await dependencies.getActorMembership(input.organizationId);
  if (!membership || !["OWNER", "ADMIN", "EDITOR"].includes(membership.role)) {
    return { ok: false, error: "You do not have permission to control this production run." };
  }
  try {
    await dependencies.controlRun(input.runId, input.state);
    if (input.state === "RUNNING") await dependencies.kick(input.runId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Publishing run control failed." };
  }
}

async function productionDependencies(): Promise<ProductionActionDependencies> {
  const repository = await createAuthenticatedPublishingRepository();
  return {
    async getActorMembership(organizationId) {
      const supabase = await createServerSupabaseClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) return null;
      const { data, error } = await supabase
        .from("organization_memberships")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (error || !data) return null;
      return { actorId: authData.user.id, role: data.role as AppRole };
    },

    async plan({ organizationId, scope }) {
      const registry = await loadAcademicRegistryFromDisk();
      const curriculumCache = new Map<string, Awaited<ReturnType<typeof loadProgrammeCurriculumFromDisk>>>();
      const curriculumLoader = async (programme: (typeof registry)[number]) => {
        const cached = curriculumCache.get(programme.code);
        if (cached) return cached;
        const loaded = await loadProgrammeCurriculumFromDisk(programme);
        curriculumCache.set(programme.code, loaded);
        return loaded;
      };
      const released = await repository.listPublications(organizationId);
      const releasedIdentities = new Set(released.map((publication) => `${publication.bookId}:${publication.edition}:${publication.revision}`));
      const planned = await planProductionRun({ scope, registry, curriculumLoader, releasedIdentities });
      const jobs = await Promise.all(planned.jobs.map(async (job) => {
        const programme = registry.find((candidate) => candidate.code === job.programmeCode);
        if (!programme) throw new Error(`Programme ${job.programmeCode} disappeared from the governed registry.`);
        const sources = await curriculumLoader(programme);
        return { job, curriculumText: curriculumTextForJob(job, sources) };
      }));
      return { jobs, exclusions: planned.exclusions };
    },

    async createRun(input) {
      return repository.createRun({
        organizationId: input.organizationId,
        createdBy: input.actorId,
        role: input.role,
        scope: input.scope,
        requestedConcurrency: input.concurrency,
        plannedCount: input.plannedCount,
      });
    },

    enqueueJobs: (input) => repository.enqueueJobs(input),

    async kick() {
      const secret = process.env.CRON_SECRET ?? process.env.PUBLISHING_WORKER_SECRET;
      if (!secret) return;
      const requestHeaders = await headers();
      const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
      if (!host) return;
      const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
      const url = `${protocol}://${host}/api/internal/publishing-worker`;
      after(async () => {
        try {
          await fetch(url, {
            method: "POST",
            headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
            body: "{}",
            cache: "no-store",
          });
        } catch {
          // Cron remains the durable fallback; a failed immediate kick must not undo a persisted run.
        }
      });
    },

    async controlRun(runId, state) {
      if (state === "PAUSED") await repository.pauseRun(runId);
      else if (state === "RUNNING") await repository.resumeRun(runId);
      else await repository.cancelRun(runId);
    },
  };
}

export async function startProductionRun(input: {
  organizationId: string;
  scope: ProductionScope;
  concurrency?: number;
}): Promise<ProductionActionResult> {
  return executeStartProductionRunAction(input, await productionDependencies());
}

export async function controlProductionRun(input: {
  organizationId: string;
  runId: string;
  state: "PAUSED" | "RUNNING" | "CANCELLED";
}) {
  return executeProductionRunControlAction(input, await productionDependencies());
}
