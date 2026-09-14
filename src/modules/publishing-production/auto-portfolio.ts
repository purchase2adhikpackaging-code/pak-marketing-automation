import { createHash } from "node:crypto";
import type { BookJob } from "@/modules/publishing-factory/domain";
import type { NodePublishingWorkerResult } from "./node-worker";
import type { PublishingAutomationTarget } from "./worker-broker-client";

type PlannedAutomaticJob = { job: BookJob; curriculumText: string };
type BrokerJob = Record<string, unknown>;

export interface AutomaticPortfolioDependencies {
  listAutomationTargets(): Promise<PublishingAutomationTarget[]>;
  planJobs(organizationId: string): Promise<PlannedAutomaticJob[]>;
  bootstrapPortfolio(input: {
    organizationId: string;
    idempotencyKey: string;
    jobs: BrokerJob[];
  }): Promise<{ runId: string | null }>;
  chunkSize?: number;
}

export function autoPortfolioIdempotencyKey(jobs: readonly BookJob[]): string {
  const identities = jobs
    .map((job) => `${job.bookId}:${job.edition}:${job.revision}`)
    .sort((left, right) => left.localeCompare(right));
  return createHash("sha256").update(JSON.stringify(identities)).digest("hex");
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export async function ensureAutomaticPortfolioProduction(
  dependencies: AutomaticPortfolioDependencies,
): Promise<{ targets: number; plannedBooks: number; runIds: string[] }> {
  const targets = await dependencies.listAutomationTargets();
  const chunkSize = dependencies.chunkSize ?? 25;
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 100) {
    throw new Error("Automatic portfolio chunk size must be between 1 and 100.");
  }

  let plannedBooks = 0;
  const runIds = new Set<string>();

  for (const target of targets) {
    if (target.concurrency !== 4) {
      throw new Error("Automatic publishing rollout requires exactly four workers.");
    }
    const planned = await dependencies.planJobs(target.organizationId);
    if (planned.length === 0) continue;
    plannedBooks += planned.length;
    const idempotencyKey = autoPortfolioIdempotencyKey(planned.map((entry) => entry.job));
    const payload = planned.map((entry) => ({
      job: entry.job,
      curriculumText: entry.curriculumText,
    }));

    for (const batch of chunks(payload, chunkSize)) {
      const result = await dependencies.bootstrapPortfolio({
        organizationId: target.organizationId,
        idempotencyKey,
        jobs: batch,
      });
      if (result.runId) runIds.add(result.runId);
    }
  }

  return { targets: targets.length, plannedBooks, runIds: [...runIds] };
}

export async function runAutomaticWorkerCycle(input: {
  runWorker(): Promise<NodePublishingWorkerResult>;
  ensurePortfolio(): Promise<{ targets: number; plannedBooks: number; runIds: string[] }>;
}): Promise<NodePublishingWorkerResult> {
  const first = await input.runWorker();
  if (first.claimed > 0) return first;

  const automation = await input.ensurePortfolio();
  if (automation.runIds.length === 0) return first;

  return input.runWorker();
}
