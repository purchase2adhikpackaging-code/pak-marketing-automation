import "server-only";

import { ensureAutomaticPortfolioProduction, runAutomaticWorkerCycle } from "./auto-portfolio";
import { planProductionRun } from "./run-planner";
import {
  curriculumTextForJob,
  loadAcademicRegistryFromDisk,
  loadProgrammeCurriculumFromDisk,
} from "./server-curriculum";
import { createPublishingWorkerBrokerClient } from "./worker-broker-client";
import { runConfiguredPublishingWorker } from "./node-worker-runtime";

export async function runConfiguredAutomaticPublishingWorker(input: {
  workerId: string;
  credential: string;
  concurrency?: number;
}) {
  const concurrency = input.concurrency ?? 4;
  const runWorker = () => runConfiguredPublishingWorker({
    workerId: input.workerId,
    credential: input.credential,
    concurrency,
  });

  return runAutomaticWorkerCycle({
    runWorker,
    ensurePortfolio: async () => {
      const broker = createPublishingWorkerBrokerClient({ credential: input.credential });
      return ensureAutomaticPortfolioProduction({
        listAutomationTargets: () => broker.listAutomationTargets(),
        bootstrapPortfolio: (bootstrapInput) => broker.bootstrapPortfolio(bootstrapInput),
        async planJobs(organizationId) {
          const registry = await loadAcademicRegistryFromDisk();
          const curriculumCache = new Map<string, Awaited<ReturnType<typeof loadProgrammeCurriculumFromDisk>>>();
          const curriculumLoader = async (programme: (typeof registry)[number]) => {
            const cached = curriculumCache.get(programme.code);
            if (cached) return cached;
            const loaded = await loadProgrammeCurriculumFromDisk(programme);
            curriculumCache.set(programme.code, loaded);
            return loaded;
          };
          const plan = await planProductionRun({
            scope: { type: "PORTFOLIO" },
            registry,
            curriculumLoader,
            releasedIdentities: new Set<string>(),
          });
          return Promise.all(plan.jobs.map(async (job) => {
            const programme = registry.find((candidate) => candidate.code === job.programmeCode);
            if (!programme) throw new Error(`Programme ${job.programmeCode} disappeared from the governed registry.`);
            const sources = await curriculumLoader(programme);
            return { job, curriculumText: curriculumTextForJob(job, sources) };
          }));
        },
      });
    },
  });
}
