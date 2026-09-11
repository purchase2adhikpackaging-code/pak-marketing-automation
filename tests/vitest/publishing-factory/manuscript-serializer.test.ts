import { describe, expect, it } from "vitest";
import type { BookJob } from "@/modules/publishing-factory/domain";
import type { BookManuscript } from "@/modules/publishing-factory/manuscript-domain";
import {
  renderBookHtml,
  serializeBookManuscript,
} from "@/modules/publishing-factory/manuscript-serializer";

const job: BookJob = {
  bookId: "PAK-D01-S1-D01-102-TEXTBOOK",
  programmeCode: "PAK-D01",
  programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
  level: "diploma",
  academicPeriod: "S1",
  subjectCode: "D01-102",
  subjectTitle: "Applied Engineering Mathematics & Physics for Railways",
  publicationType: "textbook",
  edition: "2026",
  revision: "0.1.0",
  curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
  status: "PLANNED",
  repairAttempts: {},
};

const manuscript: BookManuscript = {
  bookId: job.bookId,
  programmeCode: job.programmeCode,
  subjectCode: job.subjectCode,
  subjectTitle: job.subjectTitle,
  level: job.level,
  edition: job.edition,
  revision: job.revision,
  blueprintSha256: "a".repeat(64),
  knowledgePacks: [{ packId: "mechanical-fundamentals", sha256: "b".repeat(64) }],
  provider: { name: "fixture", model: "fixture-model" },
  chapters: [
    {
      chapterId: "D01-102-CH01",
      number: 1,
      title: "Engineering quantities and units",
      purpose: "Establish controlled calculation conventions.",
      learningOutcomes: ["Apply units consistently in railway calculations."],
      keyTerms: [
        { term: "SI unit", explanation: "A controlled engineering unit <script>alert('x')</script>." },
      ],
      sections: [
        {
          heading: "Engineering quantities",
          paragraphs: [
            "Railway engineering calculations require explicit quantities, units and conversion steps so the reasoning can be checked independently.",
          ],
        },
      ],
      workedExamples: [
        {
          title: "Unit conversion",
          problem: "Convert a speed quantity into the unit required by an equation.",
          solutionSteps: ["State the source unit.", "Apply the conversion factors."],
          conclusion: "The result is ready for the downstream calculation.",
        },
      ],
      practicalActivities: [],
      safetyNotes: ["Training values do not replace controlled limits for a real railway asset."],
      knowledgeChecks: ["Why must units remain explicit?"],
      summary: ["Use consistent units and show conversion steps."],
      reviewQuestions: ["Explain how to verify a conversion."],
      sourceIds: ["eu-2016-797"],
    },
  ],
};

describe("manuscript serialization", () => {
  it("is deterministic for identical structured input", () => {
    expect(serializeBookManuscript(manuscript)).toBe(serializeBookManuscript(manuscript));
    expect(renderBookHtml({ job, manuscript })).toBe(renderBookHtml({ job, manuscript }));
  });

  it("emits exact identity and only one learning-outcomes block per chapter", () => {
    const html = renderBookHtml({ job, manuscript });
    expect(html).toContain(job.bookId);
    expect(html).toContain(job.programmeCode);
    expect(html).toContain(job.subjectCode);
    expect(html.match(/class="learning-outcomes"/g)).toHaveLength(1);
  });

  it("escapes model-provided HTML and marks bounded callouts for layout QA", () => {
    const html = renderBookHtml({ job, manuscript });
    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(html).toContain("data-pak-box=");
  });

  it("produces source notes and stable chapter labels without instructor-only content", () => {
    const markdown = serializeBookManuscript(manuscript);
    const html = renderBookHtml({ job, manuscript });
    expect(markdown).toContain("Chapter 1 — Engineering quantities and units");
    expect(markdown).toContain("eu-2016-797");
    expect(html).toContain("chapter-1");
    expect(html).not.toMatch(/instructor answer key|marking rubric|instructor-only/i);
  });
});
