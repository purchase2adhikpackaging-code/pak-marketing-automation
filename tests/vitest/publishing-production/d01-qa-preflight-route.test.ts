import { describe, expect, it } from "vitest";
import { handleD01QaPreflightRequest } from "@/modules/publishing-production/d01-qa-preflight-route";

const job = {
  bookId: "PAK-D01-S1-D01-101-TEXTBOOK",
  programmeCode: "PAK-D01",
  programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
  level: "diploma",
  academicPeriod: "S1",
  subjectCode: "D01-101",
  subjectTitle: "Railway Systems & Rolling Stock Fundamentals",
  publicationType: "textbook",
  edition: "2026",
  revision: "0.1.0",
  curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
  status: "ARCHITECTURE_REQUIRED",
  repairAttempts: {},
} as const;

const manuscript = {
  bookId: job.bookId,
  programmeCode: job.programmeCode,
  subjectCode: job.subjectCode,
  subjectTitle: job.subjectTitle,
  level: job.level,
  edition: job.edition,
  revision: job.revision,
  blueprintSha256: "a".repeat(64),
  knowledgePacks: [{ packId: "railway-foundations", sha256: "b".repeat(64) }],
  provider: { name: "openai", model: "provider-managed" },
  chapters: [{
    chapterId: "D01-101-CH01",
    number: 1,
    title: "Railway Fundamentals",
    purpose: "Introduce the governed railway-system foundation for the diploma.",
    learningOutcomes: ["Explain the core railway system."],
    keyTerms: [{ term: "Rolling stock", explanation: "Railway vehicles operating on the network." }],
    sections: [{ heading: "System overview", paragraphs: ["Railway systems combine infrastructure, rolling stock, operations and control functions."] }],
    workedExamples: [],
    practicalActivities: [],
    safetyNotes: ["Follow site safety instructions."],
    knowledgeChecks: ["What is rolling stock?"],
    summary: ["Railway systems integrate multiple engineering subsystems."],
    reviewQuestions: ["Describe the principal railway subsystems."],
    sourceIds: ["source-1"],
  }],
} as const;

function request(body: unknown, credential = "worker-capability") {
  return new Request("https://example.test/api/internal/publishing-d01-qa-preflight", {
    method: "POST",
    headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("D01 QA preflight route", () => {
  it("rejects missing bearer authorization", async () => {
    const response = await handleD01QaPreflightRequest(
      new Request("https://example.test/api/internal/publishing-d01-qa-preflight", { method: "POST", body: "{}" }),
      { authorize: async () => true, run: async () => ({ passed: true, gateResults: {}, findings: [] }) },
    );
    expect(response.status).toBe(401);
  });

  it("runs the bounded D01-101 manuscript through the authorized dry-run dependency", async () => {
    let calls = 0;
    const response = await handleD01QaPreflightRequest(request({ job, manuscript }), {
      authorize: async (credential) => credential === "worker-capability",
      run: async (input) => {
        calls += 1;
        expect(input.job.subjectCode).toBe("D01-101");
        expect(input.manuscript.bookId).toBe(job.bookId);
        return {
          passed: false,
          gateResults: { layout: "FAIL" },
          findings: [{
            id: "layout-qa-1",
            gate: "layout",
            defectClass: "internal-box-overflow",
            severity: "error",
            message: "Text escapes the bounds of a governed callout.",
            detector: "dom-layout-qa",
            repairable: true,
          }],
        };
      },
    });
    expect(response.status).toBe(200);
    expect(calls).toBe(1);
    expect(await response.json()).toMatchObject({ ok: true, passed: false });
  });

  it("rejects any subject outside D01-101 before running QA", async () => {
    let calls = 0;
    const response = await handleD01QaPreflightRequest(
      request({ job: { ...job, subjectCode: "D01-102" }, manuscript: { ...manuscript, subjectCode: "D01-102" } }),
      {
        authorize: async () => true,
        run: async () => { calls += 1; return { passed: true, gateResults: {}, findings: [] }; },
      },
    );
    expect(response.status).toBe(400);
    expect(calls).toBe(0);
  });
});
