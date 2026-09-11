import { describe, expect, it } from "vitest";
import type { CompileBookResult } from "@/modules/publishing-factory/book-compiler";
import type { ProductionJob } from "@/modules/publishing-production/domain";
import { publishQaPassedBook } from "@/modules/publishing-production/artifact-publisher";

function productionJob(): ProductionJob {
  const bookJobPayload = {
    bookId: "PAK-D01-S1-D01-102-TEXTBOOK",
    programmeCode: "PAK-D01",
    programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
    level: "diploma" as const,
    academicPeriod: "S1",
    subjectCode: "D01-102",
    subjectTitle: "Applied Engineering Mathematics & Physics for Railways",
    publicationType: "textbook" as const,
    edition: "2026",
    revision: "0.1.0",
    curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
    status: "PLANNED" as const,
    repairAttempts: {},
  };
  return {
    id: "22222222-2222-4222-8222-222222222222",
    organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    productionRunId: "11111111-1111-4111-8111-111111111111",
    bookId: bookJobPayload.bookId,
    programmeCode: "PAK-D01",
    subjectCode: "D01-102",
    academicPeriod: "S1",
    edition: "2026",
    revision: "0.1.0",
    bookJobPayload,
    curriculumText: "governed curriculum",
    status: "RUNNING",
    claimCount: 1,
    failureAttempts: 0,
    maxFailureAttempts: 3,
    leaseOwner: "worker-1",
    leaseExpiresAt: "2026-09-12T01:00:00Z",
    lastError: null,
    currentStage: "QA_RUNNING",
    checkpointRoot: null,
    qaStatus: null,
    pdfArtifactPath: null,
    manifestArtifactPath: null,
    providerName: null,
    providerModel: null,
    knowledgeHashes: [],
    createdAt: "2026-09-12T00:00:00Z",
    updatedAt: "2026-09-12T00:00:00Z",
    startedAt: "2026-09-12T00:00:00Z",
    completedAt: null,
  };
}

function compilerResult(status: "QA_PASSED" | "QA_FAILED"): CompileBookResult {
  const job = { ...productionJob().bookJobPayload, status };
  return {
    job,
    blueprint: {
      bookId: job.bookId,
      programmeCode: job.programmeCode,
      subjectCode: job.subjectCode,
      subjectTitle: job.subjectTitle,
      level: job.level,
      edition: job.edition,
      revision: job.revision,
      knowledgePackIds: ["railway-systems"],
      chapters: [{
        id: "D01-102-CH01",
        number: 1,
        title: "Units",
        learningOutcomes: ["Apply units"],
        requiredKnowledgePackIds: ["railway-systems"],
        practicalRequirements: [],
        visualRequirements: [],
      }],
    },
    manuscript: {
      bookId: job.bookId,
      programmeCode: job.programmeCode,
      subjectCode: job.subjectCode,
      subjectTitle: job.subjectTitle,
      level: job.level,
      edition: job.edition,
      revision: job.revision,
      blueprintSha256: "a".repeat(64),
      knowledgePacks: [{ packId: "railway-systems", sha256: "b".repeat(64) }],
      provider: { name: "fake", model: "fake-v1" },
      chapters: [],
    },
    html: "<html><body>book</body></html>",
    report: {
      bookId: job.bookId,
      revision: job.revision,
      startedAt: "2026-09-12T00:00:00.000Z",
      completedAt: "2026-09-12T00:01:00.000Z",
      gateResults: { content: status === "QA_PASSED" ? "PASS" : "FAIL" },
      findings: [],
      passed: status === "QA_PASSED",
    },
    render: {
      pdfPath: "/tmp/textbook.pdf",
      htmlPath: "/tmp/textbook.html",
      pageImages: ["/tmp/page-001.png"],
    },
    resumedChapterIds: [],
    generatedChapterIds: [],
    incomplete: false,
  };
}

describe("durable Book Library publisher", () => {
  it("refuses to publish a book that did not pass QA", async () => {
    await expect(publishQaPassedBook({
      organizationId: productionJob().organizationId,
      job: productionJob(),
      compilerResult: compilerResult("QA_FAILED"),
      readFile: async () => Buffer.from("pdf"),
      storage: { put: async () => undefined },
      publications: { upsert: async (record) => record },
    })).rejects.toThrow(/QA/i);
  });

  it("writes deterministic organization-isolated artifacts and metadata", async () => {
    const paths: string[] = [];
    const records: Record<string, unknown>[] = [];
    const result = await publishQaPassedBook({
      organizationId: productionJob().organizationId,
      job: productionJob(),
      compilerResult: compilerResult("QA_PASSED"),
      readFile: async () => Buffer.from("pdf"),
      storage: { put: async (path) => { paths.push(path); } },
      publications: { upsert: async (record) => { records.push(record); return record; } },
    });

    expect(paths).toHaveLength(6);
    expect(paths.every((path) => path.startsWith(`${productionJob().organizationId}/PAK-D01/S1/D01-102/2026/0.1.0/`))).toBe(true);
    expect(paths).toContain(`${result.prefix}textbook.pdf`);
    expect(paths).toContain(`${result.prefix}release-manifest.json`);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ status: "RELEASED", book_id: productionJob().bookId });
  });

  it("rejects cross-organization publication requests", async () => {
    await expect(publishQaPassedBook({
      organizationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      job: productionJob(),
      compilerResult: compilerResult("QA_PASSED"),
      readFile: async () => Buffer.from("pdf"),
      storage: { put: async () => undefined },
      publications: { upsert: async (record) => record },
    })).rejects.toThrow(/organization/i);
  });
});
