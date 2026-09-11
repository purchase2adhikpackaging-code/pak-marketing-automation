import type { QaFinding } from "./domain";

export interface ExpectedBookIdentity {
  programmeCode: string;
  subjectCode: string;
  subjectTitle: string;
}

export interface ContentQaInput {
  manuscript: string;
  expectedIdentity: ExpectedBookIdentity;
  approvedBoilerplate?: string[];
}

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^\s*TODO\s*$/im,
  /^\s*TBD\s*$/im,
  /\bLOREM\s+IPSUM\b/i,
  /\bFILL\s+IN\s+DETAILS\b/i,
  /\bINSERT\s+IMAGE\b/i,
  /^\s*PLACEHOLDER\s*$/im,
];

const INSTRUCTOR_ONLY_PATTERNS: RegExp[] = [
  /^#{1,6}\s+Instructor Answer Key\s*$/im,
  /^#{1,6}\s+Marking Rubric\s*$/im,
  /^#{1,6}\s+Instructor-Only Notes\s*$/im,
  /^#{1,6}\s+Instructor Notes\s*$/im,
];

export function normalizeParagraph(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[—–-]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalizeParagraph(value).split(" ").filter(Boolean));
}

export function paragraphSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 && right.size === 0) return 1;
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function paragraphs(markdown: string): string[] {
  return markdown
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .filter((block) => !/^#{1,6}\s/.test(block))
    .filter((block) => !/^\|/.test(block));
}

function finding(
  index: number,
  defectClass: string,
  message: string,
  repairable = true,
): QaFinding {
  return {
    id: `content-qa-${index}`,
    gate: "content",
    defectClass,
    severity: "error",
    message,
    detector: "deterministic-content-qa",
    repairable,
  };
}

export function runContentQa(input: ContentQaInput): QaFinding[] {
  const findings: QaFinding[] = [];
  let findingIndex = 1;

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(input.manuscript)) {
      findings.push(
        finding(
          findingIndex++,
          "production-placeholder",
          `Unresolved production placeholder matched ${pattern.source}`,
        ),
      );
    }
  }

  const frontMatter = input.manuscript.split(/\r?\n/).slice(0, 30).join("\n");
  const programmeCodes = [...frontMatter.matchAll(/\bPAK-(?:C|D|B|PGD|M)\d{2}\b/g)].map(
    (match) => match[0],
  );
  const wrongProgramme = programmeCodes.find((code) => code !== input.expectedIdentity.programmeCode);

  if (
    wrongProgramme ||
    !frontMatter.includes(input.expectedIdentity.programmeCode) ||
    !frontMatter.includes(input.expectedIdentity.subjectCode) ||
    !frontMatter.toLowerCase().includes(input.expectedIdentity.subjectTitle.toLowerCase())
  ) {
    findings.push(
      finding(
        findingIndex++,
        "identity-mismatch",
        `Manuscript front matter does not match ${input.expectedIdentity.programmeCode} / ${input.expectedIdentity.subjectCode} / ${input.expectedIdentity.subjectTitle}`,
      ),
    );
  }

  for (const pattern of INSTRUCTOR_ONLY_PATTERNS) {
    if (pattern.test(input.manuscript)) {
      findings.push(
        finding(
          findingIndex++,
          "instructor-content-leakage",
          "Instructor-only content is present in a student textbook/module-book manuscript.",
        ),
      );
      break;
    }
  }

  const approved = new Set((input.approvedBoilerplate ?? []).map(normalizeParagraph));
  const substantive = paragraphs(input.manuscript)
    .map((text) => ({ raw: text, normalized: normalizeParagraph(text) }))
    .filter(({ normalized }) => normalized.length >= 40)
    .filter(({ normalized }) => !approved.has(normalized));

  for (let i = 0; i < substantive.length; i += 1) {
    const current = substantive[i];
    if (!current) continue;
    for (let j = i + 1; j < substantive.length; j += 1) {
      const other = substantive[j];
      if (!other) continue;
      const similarity = paragraphSimilarity(current.raw, other.raw);
      if (similarity >= 0.92) {
        findings.push(
          finding(
            findingIndex++,
            "duplicate-paragraph",
            `Near-duplicate substantive paragraphs detected (similarity ${similarity.toFixed(3)}).`,
          ),
        );
      }
    }
  }

  return findings;
}
