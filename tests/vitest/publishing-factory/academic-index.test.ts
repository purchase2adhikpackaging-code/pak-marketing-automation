import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAcademicIndex } from "@/modules/publishing-factory/academic-index";

describe("academic index parser", () => {
  it("parses programme rows and level semantics", () => {
    const md = readFileSync("publishing/fixtures/academic-index.fixture.md", "utf8");
    const rows = parseAcademicIndex(md);

    expect(rows.map((row) => row.code)).toEqual([
      "PAK-C01",
      "PAK-D01",
      "PAK-B01",
      "PAK-PGD01",
      "PAK-M01",
    ]);
    expect(rows.find((row) => row.code === "PAK-D01")?.academicStructure).toBe("4 semesters");
    expect(rows.find((row) => row.code === "PAK-B01")?.level).toBe("bachelors");
  });

  it("parses the real portfolio as 34 programmes in the expected families", () => {
    const md = readFileSync("docs/academic/ACADEMIC_INDEX.md", "utf8");
    const entries = parseAcademicIndex(md);

    expect(entries).toHaveLength(34);
    expect(entries.filter((p) => p.level === "certificate")).toHaveLength(12);
    expect(entries.filter((p) => p.level === "diploma")).toHaveLength(5);
    expect(entries.filter((p) => p.level === "bachelors")).toHaveLength(5);
    expect(entries.filter((p) => p.level === "postgraduate-diploma")).toHaveLength(6);
    expect(entries.filter((p) => p.level === "masters")).toHaveLength(6);
  });

  it("rejects malformed programme rows rather than silently truncating", () => {
    const malformed = "| PAK-D01 | Diploma | Diploma | 2 Years | 4 semesters |";
    expect(() => parseAcademicIndex(malformed)).toThrow(/malformed academic index row/i);
  });
});
