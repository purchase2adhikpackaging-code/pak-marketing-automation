import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertUniqueBookJobs,
  enumerateBookJobs,
  stableBookId,
} from "@/modules/publishing-factory/book-jobs";
import { parseAcademicIndex } from "@/modules/publishing-factory/academic-index";
import type { BookJob } from "@/modules/publishing-factory/domain";

function getRegistryEntry(code: string) {
  const index = readFileSync("docs/academic/ACADEMIC_INDEX.md", "utf8");
  const entry = parseAcademicIndex(index).find((item) => item.code === code);
  if (!entry) throw new Error(`Missing registry entry ${code}`);
  return entry;
}

describe("book job enumeration", () => {
  it("creates stable textbook IDs", () => {
    expect(
      stableBookId({
        programmeCode: "PAK-D01",
        academicPeriod: "S1",
        subjectCode: "D01-101",
        publicationType: "textbook",
      }),
    ).toBe("PAK-D01-S1-D01-101-TEXTBOOK");
  });

  it("rejects duplicate jobs", () => {
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
      revision: "0.1.0",
      curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
      status: "PLANNED",
      repairAttempts: {},
    };

    expect(() => assertUniqueBookJobs([job, job])).toThrow(/duplicate book id/i);
  });

  it("enumerates all 24 D01 semester textbooks", () => {
    const sourceFiles = [1, 2, 3, 4].map((semester) => ({
      path: `docs/academic/diplomas/D01/S${semester}.md`,
      content: readFileSync(`docs/academic/diplomas/D01/S${semester}.md`, "utf8"),
    }));

    const jobs = enumerateBookJobs({
      programme: getRegistryEntry("PAK-D01"),
      sourceFiles,
      edition: "2026",
      revision: "0.1.0",
    });

    expect(jobs).toHaveLength(24);
    expect(new Set(jobs.map((job) => job.bookId)).size).toBe(24);
    expect(jobs[0]?.bookId).toBe("PAK-D01-S1-D01-101-TEXTBOOK");
    expect(jobs.at(-1)?.bookId).toBe("PAK-D01-S4-D01-406-TEXTBOOK");
  });

  it("enumerates certificate weekly modules as module books", () => {
    const path = "docs/academic/certificates/C01/PAK-C01.md";
    const jobs = enumerateBookJobs({
      programme: getRegistryEntry("PAK-C01"),
      sourceFiles: [{ path, content: readFileSync(path, "utf8") }],
      edition: "2026",
      revision: "0.1.0",
    });

    expect(jobs).toHaveLength(12);
    expect(jobs[0]?.bookId).toBe("PAK-C01-W1-C01-101-MODULE-BOOK");
    expect(jobs.at(-1)?.bookId).toBe("PAK-C01-W12-C01-112-MODULE-BOOK");
  });
});
