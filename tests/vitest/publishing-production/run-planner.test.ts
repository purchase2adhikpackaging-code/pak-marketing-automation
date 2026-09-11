import { describe, expect, it } from "vitest";
import type { ProgrammeRegistryEntry } from "@/modules/publishing-factory/academic-index";
import { planProductionRun } from "@/modules/publishing-production/run-planner";

const d01: ProgrammeRegistryEntry = {
  code: "PAK-D01",
  programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
  level: "diploma",
  duration: "2 years",
  academicStructure: "4 semesters",
  modularPath: "`diplomas/D01/S1.md`",
  curriculumStatus: "Subject Architecture Complete",
  chapterStatus: "Pending",
  studyMaterialStatus: "Pending",
  printStatus: "Pending",
  masterPrdRef: "26",
};

const b03: ProgrammeRegistryEntry = {
  code: "PAK-B03",
  programmeTitle: "Bachelor's-level Railway Programme",
  level: "bachelors",
  duration: "3 years",
  academicStructure: "6 semesters",
  modularPath: "`bachelors/B03/S1.md`",
  curriculumStatus: "Catalogue Only",
  chapterStatus: "Pending",
  studyMaterialStatus: "Pending",
  printStatus: "Pending",
  masterPrdRef: "26",
};

const sources: Record<string, string> = {
  "docs/academic/diplomas/D01/S1.md": [
    "| Code | Subject | Hours |",
    "| D01-101 | Railway Systems & Rolling Stock Fundamentals | 50 |",
    "| D01-102 | Applied Engineering Mathematics & Physics for Railways | 50 |",
  ].join("\n"),
  "docs/academic/diplomas/D01/S2.md": [
    "| Code | Subject | Hours |",
    "| D01-201 | Rolling Stock Structures | 50 |",
  ].join("\n"),
  "docs/academic/diplomas/D01/S3.md": "| D01-301 | Maintenance Engineering | 50 |",
  "docs/academic/diplomas/D01/S4.md": "| D01-401 | Reliability Engineering | 50 |",
};

const loader = async (programme: ProgrammeRegistryEntry) => {
  if (programme.code === "PAK-D01") {
    return Object.entries(sources).map(([path, content]) => ({ path, content }));
  }
  return [];
};

describe("planProductionRun", () => {
  it("plans one governed subject even though chapter writing is still pending", async () => {
    const result = await planProductionRun({
      scope: { type: "SUBJECT", programmeCode: "PAK-D01", subjectCode: "D01-102" },
      registry: [d01, b03],
      curriculumLoader: loader,
      releasedIdentities: new Set(),
    });
    expect(result.jobs.map((job) => job.subjectCode)).toEqual(["D01-102"]);
    expect(result.exclusions).toEqual([]);
  });

  it("plans a programme in deterministic curriculum order", async () => {
    const result = await planProductionRun({
      scope: { type: "PROGRAMME", programmeCode: "PAK-D01" },
      registry: [d01],
      curriculumLoader: loader,
      releasedIdentities: new Set(),
    });
    expect(result.jobs.map((job) => job.subjectCode)).toEqual([
      "D01-101",
      "D01-102",
      "D01-201",
      "D01-301",
      "D01-401",
    ]);
  });

  it("limits pilots without changing stable order", async () => {
    const result = await planProductionRun({
      scope: { type: "PILOT", programmeCode: "PAK-D01", limit: 2 },
      registry: [d01],
      curriculumLoader: loader,
      releasedIdentities: new Set(),
    });
    expect(result.jobs.map((job) => job.subjectCode)).toEqual(["D01-101", "D01-102"]);
  });

  it("excludes already released identities", async () => {
    const result = await planProductionRun({
      scope: { type: "PROGRAMME", programmeCode: "PAK-D01" },
      registry: [d01],
      curriculumLoader: loader,
      releasedIdentities: new Set(["PAK-D01-S1-D01-101-TEXTBOOK:2026:0.1.0"]),
    });
    expect(result.jobs.some((job) => job.subjectCode === "D01-101")).toBe(false);
    expect(result.exclusions).toContainEqual(expect.objectContaining({
      subjectCode: "D01-101",
      reason: "ALREADY_RELEASED",
    }));
  });

  it("excludes catalogue-only architecture rather than inventing jobs", async () => {
    const result = await planProductionRun({
      scope: { type: "PORTFOLIO" },
      registry: [d01, b03],
      curriculumLoader: loader,
      releasedIdentities: new Set(),
    });
    expect(result.jobs.every((job) => job.programmeCode !== "PAK-B03")).toBe(true);
    expect(result.exclusions).toContainEqual(expect.objectContaining({
      programmeCode: "PAK-B03",
      reason: "ARCHITECTURE_REQUIRED",
    }));
  });
});
