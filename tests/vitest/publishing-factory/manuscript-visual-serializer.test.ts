import { describe, expect, it } from "vitest";
import type { BookJob } from "@/modules/publishing-factory/domain";
import type { BookManuscript } from "@/modules/publishing-factory/manuscript-domain";
import { renderBookHtml } from "@/modules/publishing-factory/manuscript-serializer";
import type { ResolvedBookVisualBundle } from "@/modules/publishing-factory/visual-production";

const job: BookJob = {
  bookId: "PAK-D01-S1-D01-101-TEXTBOOK",
  programmeCode: "PAK-D01",
  programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
  level: "diploma",
  academicPeriod: "S1",
  subjectCode: "D01-101",
  subjectTitle: "Railway Systems & Rolling Stock Fundamentals",
  publicationType: "textbook",
  edition: "2026",
  revision: "0.2.0",
  curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
  status: "VISUALS_READY",
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
  knowledgePacks: [{ packId: "kp-1", sha256: "b".repeat(64) }],
  provider: { name: "fixture", model: "fixture" },
  chapters: [{
    chapterId: "ch-1",
    number: 1,
    title: "Rolling stock fundamentals",
    purpose: "Understand rolling stock.",
    learningOutcomes: ["Identify core components."],
    keyTerms: [{ term: "bogie", explanation: "Running gear assembly." }],
    sections: [{ heading: "Bogie", paragraphs: ["The bogie supports the vehicle body and guides the wheelsets through the railway track geometry."] }],
    workedExamples: [],
    practicalActivities: [],
    safetyNotes: [],
    knowledgeChecks: ["What is a bogie?"],
    summary: ["Bogie components interact as a system."],
    reviewQuestions: ["Name the primary bogie functions."],
    sourceIds: ["src-1"],
  }],
};

const dataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD";
const visuals: ResolvedBookVisualBundle = {
  bookId: job.bookId,
  visuals: [
    {
      id: "front",
      placement: "front-cover",
      subjectPrompt: "front",
      caption: "Front cover",
      altText: "Realistic passenger train front cover",
      realistic: true,
      labelsRequired: false,
      assetId: "front-asset",
      mimeType: "image/jpeg",
      width: 1800,
      height: 2700,
      byteLength: 250000,
      sourceKind: "approved-library",
      provenance: "PAK approved library",
      dataUri,
      realismVerified: true,
      labelsPresent: false,
    },
    {
      id: "bogie",
      placement: "technical-diagram",
      chapterId: "ch-1",
      subjectPrompt: "bogie",
      caption: "Bogie components",
      altText: "Labeled realistic railway bogie",
      realistic: true,
      labelsRequired: true,
      assetId: "bogie-asset",
      mimeType: "image/jpeg",
      width: 1600,
      height: 1200,
      byteLength: 250000,
      sourceKind: "approved-library",
      provenance: "PAK approved library",
      dataUri,
      realismVerified: true,
      labelsPresent: true,
    },
    {
      id: "back",
      placement: "back-cover",
      subjectPrompt: "back",
      caption: "Back cover",
      altText: "Realistic railway back cover",
      realistic: true,
      labelsRequired: false,
      assetId: "back-asset",
      mimeType: "image/jpeg",
      width: 1800,
      height: 2700,
      byteLength: 250000,
      sourceKind: "approved-library",
      provenance: "PAK approved library",
      dataUri,
      realismVerified: true,
      labelsPresent: false,
    },
  ],
};

describe("visual manuscript HTML", () => {
  it("renders full-page front/back photographic covers and chapter figures", () => {
    const html = renderBookHtml({ job, manuscript, visuals });
    expect(html).toContain('class="book-cover book-cover-front"');
    expect(html).toContain('class="book-cover book-cover-back"');
    expect(html).toContain('data-visual-id="front"');
    expect(html).toContain('data-visual-id="back"');
    expect(html).toContain('data-visual-id="bogie"');
    expect(html).toContain("<figcaption>Bogie components</figcaption>");
    expect(html).toContain('alt="Labeled realistic railway bogie"');
    expect(html).toContain(dataUri);
  });

  it("marks covers so ordinary running page furniture can be suppressed", () => {
    const html = renderBookHtml({ job, manuscript, visuals });
    expect(html).toMatch(/\.book-cover\s*\{[^}]*break-after:\s*page/);
    expect(html).toMatch(/\.book-cover\s*\{[^}]*height:\s*297mm/);
    expect(html).toContain('data-pak-cover="front"');
    expect(html).toContain('data-pak-cover="back"');
  });
});
