import type { QualificationLevel } from "./domain";

export interface ProgrammeRegistryEntry {
  code: string;
  programmeTitle: string;
  level: QualificationLevel;
  duration: string;
  academicStructure: string;
  modularPath: string;
  curriculumStatus: string;
  chapterStatus: string;
  studyMaterialStatus: string;
  printStatus: string;
  masterPrdRef: string;
}

function normalizeCell(value: string): string {
  return value.trim();
}

function mapLevel(raw: string): QualificationLevel {
  switch (raw.trim()) {
    case "Certificate":
      return "certificate";
    case "Diploma":
      return "diploma";
    case "Bachelor's-level":
      return "bachelors";
    case "Postgraduate Diploma":
      return "postgraduate-diploma";
    case "Master's-level":
      return "masters";
    default:
      throw new Error(`Unsupported qualification level in academic index: ${raw}`);
  }
}

export function parseAcademicIndex(markdown: string): ProgrammeRegistryEntry[] {
  const programmeRows = markdown
    .split(/\r?\n/)
    .filter((line) => /^\|\s*PAK-(?:C|D|B|PGD|M)\d{2}\s*\|/.test(line));

  return programmeRows.map((line) => {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map(normalizeCell);

    if (cells.length !== 11) {
      throw new Error(`Malformed academic index row: expected 11 columns, received ${cells.length}: ${line}`);
    }

    const [
      code,
      programmeTitle,
      level,
      duration,
      academicStructure,
      modularPath,
      curriculumStatus,
      chapterStatus,
      studyMaterialStatus,
      printStatus,
      masterPrdRef,
    ] = cells;

    if (
      !code ||
      !programmeTitle ||
      !level ||
      !duration ||
      !academicStructure ||
      !modularPath ||
      !curriculumStatus ||
      !chapterStatus ||
      !studyMaterialStatus ||
      !printStatus ||
      !masterPrdRef
    ) {
      throw new Error(`Malformed academic index row: empty required cell: ${line}`);
    }

    return {
      code,
      programmeTitle,
      level: mapLevel(level),
      duration,
      academicStructure,
      modularPath,
      curriculumStatus,
      chapterStatus,
      studyMaterialStatus,
      printStatus,
      masterPrdRef,
    };
  });
}
