import { createHash } from "node:crypto";
import type { AppRole } from "@/modules/auth/roles";
import {
  ProductionJobSchema,
  ProductionRunSchema,
  PublicationSchema,
  ProductionScopeSchema,
  type ProductionJob,
  type ProductionRun,
  type ProductionScope,
  type Publication,
} from "./domain";

type RunRow = Record<string, unknown>;
type JobRow = Record<string, unknown>;
type PublicationRow = Record<string, unknown>;

export interface PublishingProductionTransport {
  insertRun(payload: Record<string, unknown>): Promise<RunRow>;
  listRuns(organizationId: string): Promise<RunRow[]>;
  getRun(organizationId: string, runId: string): Promise<RunRow | null>;
  rpc(name: string, args: Record<string, unknown>): Promise<unknown>;
  listPublications(organizationId: string): Promise<PublicationRow[]>;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function idempotencyKey(input: {
  organizationId: string;
  scope: ProductionScope;
  requestedConcurrency: number;
}): string {
  return createHash("sha256")
    .update(stableJson(input), "utf8")
    .digest("hex");
}

function camelRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase()),
      value,
    ]),
  );
}

function parseRun(row: RunRow): ProductionRun {
  return ProductionRunSchema.parse(camelRow(row));
}

function parseJob(row: JobRow): ProductionJob {
  return ProductionJobSchema.parse(camelRow(row));
}

function parsePublication(row: PublicationRow): Publication {
  return PublicationSchema.parse(camelRow(row));
}

export class PublishingProductionRepository {
  constructor(private readonly transport: PublishingProductionTransport) {}

  async createRun(input: {
    organizationId: string;
    createdBy: string;
    role: AppRole;
    scope: ProductionScope;
    requestedConcurrency: number;
    plannedCount: number;
  }): Promise<ProductionRun> {
    const scope = ProductionScopeSchema.parse(input.scope);
    if (!Number.isInteger(input.requestedConcurrency) || input.requestedConcurrency < 1 || input.requestedConcurrency > 32) {
      throw new Error("Publishing production concurrency must be an integer from 1 to 32.");
    }
    if (!Number.isInteger(input.plannedCount) || input.plannedCount < 0) {
      throw new Error("Publishing production planned count must be a non-negative integer.");
    }
    if (!["OWNER", "ADMIN", "EDITOR"].includes(input.role)) {
      throw new Error("You do not have permission to create publishing production runs.");
    }
    if (scope.type === "PORTFOLIO" && input.role === "EDITOR") {
      throw new Error("Editors do not have permission to launch portfolio production.");
    }

    const row = await this.transport.insertRun({
      organization_id: input.organizationId,
      created_by: input.createdBy,
      scope_type: scope.type,
      scope_value: scope,
      requested_concurrency: input.requestedConcurrency,
      planned_count: input.plannedCount,
      idempotency_key: idempotencyKey({
        organizationId: input.organizationId,
        scope,
        requestedConcurrency: input.requestedConcurrency,
      }),
    });
    return parseRun(row);
  }

  async listRuns(organizationId: string): Promise<ProductionRun[]> {
    return (await this.transport.listRuns(organizationId)).map(parseRun);
  }

  async getRun(organizationId: string, runId: string): Promise<ProductionRun | null> {
    const row = await this.transport.getRun(organizationId, runId);
    return row ? parseRun(row) : null;
  }

  async claimJobs(input: { workerId: string; limit: number; leaseSeconds: number }): Promise<ProductionJob[]> {
    if (!input.workerId.trim()) throw new Error("Publishing worker id is required.");
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 32) {
      throw new Error("Publishing claim limit must be an integer from 1 to 32.");
    }
    const rows = await this.transport.rpc("claim_publishing_jobs", {
      p_worker_id: input.workerId,
      p_limit: input.limit,
      p_lease_seconds: input.leaseSeconds,
    });
    if (!Array.isArray(rows)) throw new Error("Publishing claim RPC returned an invalid result.");
    return rows.map((row) => parseJob(row as JobRow));
  }

  async heartbeatJob(jobId: string, workerId: string, leaseSeconds = 300): Promise<ProductionJob> {
    return parseJob((await this.transport.rpc("heartbeat_publishing_job", {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_lease_seconds: leaseSeconds,
    })) as JobRow);
  }

  async yieldJob(input: {
    jobId: string;
    workerId: string;
    checkpointRoot: string;
    currentStage: string;
  }): Promise<ProductionJob> {
    return parseJob((await this.transport.rpc("yield_publishing_job", {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_checkpoint_root: input.checkpointRoot,
      p_current_stage: input.currentStage,
    })) as JobRow);
  }

  async completeJob(input: {
    jobId: string;
    workerId: string;
    qaStatus: "QA_PASSED";
    pdfArtifactPath: string;
    manifestArtifactPath: string;
    providerName?: string;
    providerModel?: string;
    knowledgeHashes?: unknown[];
  }): Promise<ProductionJob> {
    return parseJob((await this.transport.rpc("complete_publishing_job", {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_qa_status: input.qaStatus,
      p_pdf_artifact_path: input.pdfArtifactPath,
      p_manifest_artifact_path: input.manifestArtifactPath,
      p_provider_name: input.providerName ?? null,
      p_provider_model: input.providerModel ?? null,
      p_knowledge_hashes: input.knowledgeHashes ?? [],
    })) as JobRow);
  }

  async failJob(jobId: string, workerId: string, error: string): Promise<ProductionJob> {
    return parseJob((await this.transport.rpc("fail_publishing_job", {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_error: error,
    })) as JobRow);
  }

  async pauseRun(runId: string): Promise<ProductionRun> {
    return parseRun((await this.transport.rpc("set_publishing_run_state", { p_run_id: runId, p_state: "PAUSED" })) as RunRow);
  }

  async resumeRun(runId: string): Promise<ProductionRun> {
    return parseRun((await this.transport.rpc("set_publishing_run_state", { p_run_id: runId, p_state: "RUNNING" })) as RunRow);
  }

  async cancelRun(runId: string): Promise<ProductionRun> {
    return parseRun((await this.transport.rpc("set_publishing_run_state", { p_run_id: runId, p_state: "CANCELLED" })) as RunRow);
  }

  async listPublications(organizationId: string): Promise<Publication[]> {
    return (await this.transport.listPublications(organizationId)).map(parsePublication);
  }
}
