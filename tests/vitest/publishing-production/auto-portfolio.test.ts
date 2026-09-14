import { describe, expect, it, vi } from "vitest";
import type { BookJob } from "@/modules/publishing-factory/domain";
import {
  autoPortfolioIdempotencyKey,
  ensureAutomaticPortfolioProduction,
} from "@/modules/publishing-production/auto-portfolio";

function job(subjectCode: string): BookJob {
  return {
    bookId: `PAK-D01-S1-${subjectCode}-TEXTBOOK`,
    programmeCode: "PAK-D01",
    programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
    level: "diploma",
    academicPeriod: "S1",
    subjectCode,
    subjectTitle: `Subject ${subjectCode}`,
    publicationType: "textbook",
    edition: "2026",
    revision: "0.1.0",
    curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
    status: "PLANNED",
    repairAttempts: {},
  };
}

describe("autonomous portfolio production", () => {
  it("does nothing when the broker exposes no pilot-approved automation target", async () => {
    const planJobs = vi.fn();
    const bootstrapPortfolio = vi.fn();
    const result = await ensureAutomaticPortfolioProduction({
      listAutomationTargets: async () => [],
      planJobs,
      bootstrapPortfolio,
    });
    expect(result).toEqual({ targets: 0, plannedBooks: 0, runIds: [] });
    expect(planJobs).not.toHaveBeenCalled();
    expect(bootstrapPortfolio).not.toHaveBeenCalled();
  });

  it("uses a deterministic 64-character identity for the governed book set", () => {
    const left = autoPortfolioIdempotencyKey([job("D01-102"), job("D01-101")]);
    const right = autoPortfolioIdempotencyKey([job("D01-101"), job("D01-102")]);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
    expect(left).toBe(right);
  });

  it("bootstraps a pilot-approved portfolio in bounded chunks at concurrency four", async () => {
    const jobs = [job("D01-101"), job("D01-102"), job("D01-103")].map((book) => ({
      job: book,
      curriculumText: `CURRICULUM ${book.subjectCode}`,
    }));
    const bootstrapPortfolio = vi.fn(async () => ({ runId: "171d9d52-b497-456f-8dbb-bc947a20865e" }));

    const result = await ensureAutomaticPortfolioProduction({
      listAutomationTargets: async () => [{
        organizationId: "932a5898-a85f-4ba6-b571-66d6fe8cd9e8",
        concurrency: 4 as const,
      }],
      planJobs: async () => jobs,
      bootstrapPortfolio,
      chunkSize: 2,
    });

    expect(result.targets).toBe(1);
    expect(result.plannedBooks).toBe(3);
    expect(result.runIds).toEqual(["171d9d52-b497-456f-8dbb-bc947a20865e"]);
    expect(bootstrapPortfolio).toHaveBeenCalledTimes(2);
    const first = bootstrapPortfolio.mock.calls[0]![0];
    const second = bootstrapPortfolio.mock.calls[1]![0];
    expect(first.organizationId).toBe("932a5898-a85f-4ba6-b571-66d6fe8cd9e8");
    expect(first.idempotencyKey).toMatch(/^[a-f0-9]{64}$/);
    expect(first.jobs).toHaveLength(2);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.jobs).toHaveLength(1);
  });
});
