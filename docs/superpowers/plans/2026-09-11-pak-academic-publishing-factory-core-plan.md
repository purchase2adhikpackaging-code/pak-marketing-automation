# PAK Academic Publishing Factory Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic core of the PAK Academic Publishing Factory: validated book-job enumeration, lifecycle/state enforcement, release-manifest arithmetic, manuscript/content QA, HTML/CSS print rendering, layout/PDF QA contracts, repair routing, and a CLI capable of taking a representative book from registry to gated release.

**Architecture:** Add a focused `src/modules/publishing-factory/` module containing pure domain contracts first, then deterministic registry/QA/rendering/orchestration layers. The core does not invent curriculum or prose; it consumes approved curriculum/manuscript artifacts and guarantees that no publication can reach `RELEASED` without passing every configured gate. AI authoring, canonical-knowledge generation, image generation, and portfolio-scale worker queues are separate follow-on plans that consume this core.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest 3, Playwright 1.55, Node.js 22, Next.js 15 repository conventions.

**Spec:** `docs/superpowers/specs/2026-09-11-pak-academic-publishing-factory-design.md`

## Global Constraints

- Work only on branch `feat/pak-academic-publishing-factory`.
- Do not modify or weaken `docs/academic/PAK_ACADEMIC_CURRICULUM_STUDY_MATERIAL_BLUEPRINT_PRD.md` governance.
- `docs/academic/ACADEMIC_INDEX.md` and modular academic files are curriculum inputs, not generated-output storage.
- `RELEASED` is unreachable unless all required QA gates are `PASS`.
- Automatic repair is limited to **3 attempts per unique defect signature**; an unresolved defect after attempt 3 becomes `BLOCKED`.
- Renderer baseline is **HTML/CSS -> Playwright-controlled Chromium PDF**.
- Default publication page size is **A4**.
- Critical technical labels are deterministic/typeset; generated images are not trusted for exact technical text.
- The core must not silently merge requested textbook/module-book placements.
- No API keys, service-role keys, or provider secrets may be committed.
- Existing repository scripts `typecheck`, `lint`, `test:run`, `build`, and `test:e2e` remain valid.
- TDD is mandatory for deterministic code.

---

## File Structure Locked by This Plan

Create:

```text
src/modules/publishing-factory/
  domain.ts
  state-machine.ts
  academic-index.ts
  book-jobs.ts
  content-qa.ts
  layout-qa.ts
  renderer.ts
  pdf-qa.ts
  repair.ts
  manifest.ts
  orchestrator.ts
  cli.ts
  index.ts

tests/vitest/publishing-factory/
  domain.test.ts
  state-machine.test.ts
  academic-index.test.ts
  book-jobs.test.ts
  content-qa.test.ts
  layout-qa.test.ts
  renderer.test.ts
  pdf-qa.test.ts
  repair.test.ts
  manifest.test.ts
  orchestrator.test.ts

publishing/fixtures/
  academic-index.fixture.md
  manuscript-good.fixture.html
  manuscript-overflow.fixture.html
  manuscript-duplicate.fixture.md
  manuscript-placeholder.fixture.md

publishing/templates/
  textbook-base.css
  textbook-shell.html

publishing/manifests/
  .gitkeep
```

Modify:

```text
package.json
.gitignore
```

Generated runtime artifacts must go under `artifacts/publishing/` and remain ignored by git.

---

### Task 1: Define Publishing Domain Contracts

**Files:**
- Create: `src/modules/publishing-factory/domain.ts`
- Create: `tests/vitest/publishing-factory/domain.test.ts`

**Interfaces:**
- Produces: `BookJobSchema`, `BookJob`, `BookJobStatusSchema`, `BookJobStatus`, `QaGateSchema`, `QaGate`, `QaFindingSchema`, `QaFinding`, `QaReportSchema`, `QaReport`, `ReleaseRecordSchema`, `ReleaseRecord`.
- Consumes: Zod only.

- [ ] **Step 1: Write failing schema tests**

```ts
import { describe, expect, it } from "vitest";
import {
  BookJobSchema,
  QaFindingSchema,
} from "@/modules/publishing-factory/domain";

describe("publishing domain", () => {
  it("accepts a valid book job", () => {
    const parsed = BookJobSchema.parse({
      bookId: "PAK-D01-S1-D01-101-TEXTBOOK",
      programmeCode: "PAK-D01",
      programmeTitle: "Diploma in Railway Rolling Stock Engineering & Maintenance",
      level: "diploma",
      academicPeriod: "S1",
      subjectCode: "D01-101",
      subjectTitle: "Railway Fundamentals",
      publicationType: "textbook",
      edition: "2026",
      revision: "0.1.0",
      curriculumSourcePaths: ["docs/academic/diplomas/D01/S1.md"],
      status: "PLANNED",
      repairAttempts: {},
    });
    expect(parsed.bookId).toBe("PAK-D01-S1-D01-101-TEXTBOOK");
  });

  it("rejects a QA finding without a defect class", () => {
    expect(() =>
      QaFindingSchema.parse({
        id: "q1",
        severity: "error",
        message: "overflow",
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails because the module does not exist**

```bash
npm run test:run -- tests/vitest/publishing-factory/domain.test.ts
```

- [ ] **Step 3: Implement the schemas and exported types**

Required enums:

```ts
export const BookJobStatusSchema = z.enum([
  "PLANNED",
  "ARCHITECTURE_REQUIRED",
  "BLUEPRINT_READY",
  "KNOWLEDGE_READY",
  "MANUSCRIPT_READY",
  "VISUALS_READY",
  "TYPESET_READY",
  "PDF_BUILT",
  "QA_RUNNING",
  "QA_FAILED",
  "REPAIRING",
  "QA_PASSED",
  "RELEASED",
  "BLOCKED",
]);

export const QualificationLevelSchema = z.enum([
  "certificate",
  "diploma",
  "bachelors",
  "postgraduate-diploma",
  "masters",
]);

export const PublicationTypeSchema = z.enum(["textbook", "module-book"]);
export const QaGateSchema = z.enum([
  "schema",
  "content",
  "references",
  "safety",
  "visual-assets",
  "layout",
  "pdf",
  "render-vision",
  "portfolio",
]);
```

`QaFinding` must include: `id`, `gate`, `defectClass`, `severity`, `message`, optional `page`, optional `componentId`, `detector`, optional `evidence`, and `repairable`.

`QaReport` must include: `bookId`, `revision`, `startedAt`, `completedAt`, `gateResults`, `findings`, `passed`.

`BookJob` must include required identity fields plus optional paths from the architecture spec and `repairAttempts: Record<string, number>`.

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- tests/vitest/publishing-factory/domain.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/publishing-factory/domain.ts tests/vitest/publishing-factory/domain.test.ts
git commit -m "feat: define publishing factory domain contracts"
```

---

### Task 2: Enforce the Book-Job State Machine

**Files:**
- Create: `src/modules/publishing-factory/state-machine.ts`
- Create: `tests/vitest/publishing-factory/state-machine.test.ts`

**Interfaces:**
- Consumes: `BookJobStatus` from `domain.ts`.
- Produces: `canTransition(from, to): boolean`, `assertTransition(from, to): void`, `transitionJob(job, to): BookJob`.

- [ ] **Step 1: Write failing tests for legal and illegal transitions**

```ts
import { describe, expect, it } from "vitest";
import { canTransition } from "@/modules/publishing-factory/state-machine";

describe("publishing job state machine", () => {
  it("permits normal production progression", () => {
    expect(canTransition("PLANNED", "BLUEPRINT_READY")).toBe(true);
    expect(canTransition("PDF_BUILT", "QA_RUNNING")).toBe(true);
    expect(canTransition("QA_PASSED", "RELEASED")).toBe(true);
  });

  it("forbids release directly from PDF build", () => {
    expect(canTransition("PDF_BUILT", "RELEASED")).toBe(false);
  });

  it("permits failed QA to repair or block only", () => {
    expect(canTransition("QA_FAILED", "REPAIRING")).toBe(true);
    expect(canTransition("QA_FAILED", "BLOCKED")).toBe(true);
    expect(canTransition("QA_FAILED", "RELEASED")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

```bash
npm run test:run -- tests/vitest/publishing-factory/state-machine.test.ts
```

- [ ] **Step 3: Implement an explicit transition map**

```ts
const transitions: Record<BookJobStatus, ReadonlySet<BookJobStatus>> = {
  PLANNED: new Set(["ARCHITECTURE_REQUIRED", "BLUEPRINT_READY"]),
  ARCHITECTURE_REQUIRED: new Set(["BLUEPRINT_READY", "BLOCKED"]),
  BLUEPRINT_READY: new Set(["KNOWLEDGE_READY", "MANUSCRIPT_READY", "BLOCKED"]),
  KNOWLEDGE_READY: new Set(["MANUSCRIPT_READY", "BLOCKED"]),
  MANUSCRIPT_READY: new Set(["VISUALS_READY", "TYPESET_READY", "BLOCKED"]),
  VISUALS_READY: new Set(["TYPESET_READY", "BLOCKED"]),
  TYPESET_READY: new Set(["PDF_BUILT", "BLOCKED"]),
  PDF_BUILT: new Set(["QA_RUNNING", "BLOCKED"]),
  QA_RUNNING: new Set(["QA_FAILED", "QA_PASSED", "BLOCKED"]),
  QA_FAILED: new Set(["REPAIRING", "BLOCKED"]),
  REPAIRING: new Set(["MANUSCRIPT_READY", "VISUALS_READY", "TYPESET_READY", "PDF_BUILT", "BLOCKED"]),
  QA_PASSED: new Set(["RELEASED"]),
  RELEASED: new Set(),
  BLOCKED: new Set(),
};
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- tests/vitest/publishing-factory/state-machine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/publishing-factory/state-machine.ts tests/vitest/publishing-factory/state-machine.test.ts
git commit -m "feat: enforce publishing job lifecycle"
```

---

### Task 3: Parse the Academic Index into a Programme Registry

**Files:**
- Create: `src/modules/publishing-factory/academic-index.ts`
- Create: `publishing/fixtures/academic-index.fixture.md`
- Create: `tests/vitest/publishing-factory/academic-index.test.ts`

**Interfaces:**
- Produces: `ProgrammeRegistryEntry`, `parseAcademicIndex(markdown: string): ProgrammeRegistryEntry[]`.
- Consumes: programme table format from `docs/academic/ACADEMIC_INDEX.md`.

- [ ] **Step 1: Add a fixture containing one programme from each qualification family**

The fixture must include C01, D01, B01, PGD01, M01 rows using the same pipe-table column order as the real index.

- [ ] **Step 2: Write failing parser tests**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAcademicIndex } from "@/modules/publishing-factory/academic-index";

describe("academic index parser", () => {
  it("parses programme rows and level semantics", () => {
    const md = readFileSync("publishing/fixtures/academic-index.fixture.md", "utf8");
    const rows = parseAcademicIndex(md);
    expect(rows.map((r) => r.code)).toEqual([
      "PAK-C01",
      "PAK-D01",
      "PAK-B01",
      "PAK-PGD01",
      "PAK-M01",
    ]);
    expect(rows.find((r) => r.code === "PAK-D01")?.academicStructure).toBe("4 semesters");
  });
});
```

- [ ] **Step 3: Run and verify failure**

```bash
npm run test:run -- tests/vitest/publishing-factory/academic-index.test.ts
```

- [ ] **Step 4: Implement the strict table parser**

Reject rows with fewer than 11 columns. Map level strings exactly to the qualification enum. Preserve `modularPath`, `curriculumStatus`, `chapterStatus`, `studyMaterialStatus`, `printStatus`, and `masterPrdRef`.

- [ ] **Step 5: Add a real-index invariant test**

```ts
expect(entries).toHaveLength(34);
expect(entries.filter((p) => p.level === "certificate")).toHaveLength(12);
expect(entries.filter((p) => p.level === "diploma")).toHaveLength(5);
expect(entries.filter((p) => p.level === "bachelors")).toHaveLength(5);
expect(entries.filter((p) => p.level === "postgraduate-diploma")).toHaveLength(6);
expect(entries.filter((p) => p.level === "masters")).toHaveLength(6);
```

- [ ] **Step 6: Run tests**

```bash
npm run test:run -- tests/vitest/publishing-factory/academic-index.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/publishing-factory/academic-index.ts publishing/fixtures/academic-index.fixture.md tests/vitest/publishing-factory/academic-index.test.ts
git commit -m "feat: parse PAK academic programme registry"
```

---

### Task 4: Enumerate Stable Book Jobs Without Silent Merging

**Files:**
- Create: `src/modules/publishing-factory/book-jobs.ts`
- Create: `tests/vitest/publishing-factory/book-jobs.test.ts`

**Interfaces:**
- Consumes: `ProgrammeRegistryEntry[]`, modular programme files supplied as `{ path, content }[]`.
- Produces: `stableBookId(input): string`, `enumerateBookJobs(input): BookJob[]`, `assertUniqueBookJobs(jobs): void`.

- [ ] **Step 1: Write failing tests for stable IDs and uniqueness**

```ts
it("creates stable textbook IDs", () => {
  expect(stableBookId({
    programmeCode: "PAK-D01",
    academicPeriod: "S1",
    subjectCode: "D01-101",
    publicationType: "textbook",
  })).toBe("PAK-D01-S1-D01-101-TEXTBOOK");
});
```

- [ ] **Step 2: Add a D01 enumeration test against its modular overview/semester sources**

Load the real D01 overview plus S1-S4 and assert **24** unique textbook jobs.

- [ ] **Step 3: Implement stable ID formatting and semester-subject extraction**

Subject codes must be extracted only from Markdown table rows matching the programme family, not from prose references. Certificate module enumeration must be a separate code path.

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- tests/vitest/publishing-factory/book-jobs.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/publishing-factory/book-jobs.ts tests/vitest/publishing-factory/book-jobs.test.ts
git commit -m "feat: enumerate stable PAK textbook jobs"
```

---

### Task 5: Add Deterministic Manuscript Content QA

**Files:**
- Create: `src/modules/publishing-factory/content-qa.ts`
- Create: `publishing/fixtures/manuscript-duplicate.fixture.md`
- Create: `publishing/fixtures/manuscript-placeholder.fixture.md`
- Create: `tests/vitest/publishing-factory/content-qa.test.ts`

**Interfaces:**
- Produces: `runContentQa(input: ContentQaInput): QaFinding[]`, `normalizeParagraph(text): string`, `paragraphSimilarity(a, b): number`.

- [ ] **Step 1: Write tests for exact duplicate paragraphs**

A repeated normalized paragraph of 40+ characters must emit `duplicate-paragraph` with severity `error` unless explicitly approved boilerplate.

- [ ] **Step 2: Write tests for placeholders**

Reject:

```text
TODO
TBD
LOREM IPSUM
FILL IN DETAILS
INSERT IMAGE
PLACEHOLDER
```

- [ ] **Step 3: Write tests for identity mismatch**

Given expected `PAK-D01`, `D01-101`, and `Railway Fundamentals`, a manuscript carrying `PAK-D02` must emit `identity-mismatch`.

- [ ] **Step 4: Write a student/instructor leakage test**

Reject `Instructor Answer Key`, `Marking Rubric`, or `Instructor-Only Notes` in textbook/module-book content.

- [ ] **Step 5: Implement deterministic QA rules**

No LLM is used in this stage.

- [ ] **Step 6: Run tests**

```bash
npm run test:run -- tests/vitest/publishing-factory/content-qa.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/publishing-factory/content-qa.ts publishing/fixtures/manuscript-duplicate.fixture.md publishing/fixtures/manuscript-placeholder.fixture.md tests/vitest/publishing-factory/content-qa.test.ts
git commit -m "feat: add deterministic textbook content QA"
```

---

### Task 6: Build the Print Shell and DOM Layout QA

**Files:**
- Create: `publishing/templates/textbook-base.css`
- Create: `publishing/templates/textbook-shell.html`
- Create: `publishing/fixtures/manuscript-good.fixture.html`
- Create: `publishing/fixtures/manuscript-overflow.fixture.html`
- Create: `src/modules/publishing-factory/layout-qa.ts`
- Create: `tests/vitest/publishing-factory/layout-qa.test.ts`

**Interfaces:**
- Produces: `runDomLayoutQa(page: Page): Promise<QaFinding[]>`.

- [ ] **Step 1: Define print CSS baseline**

```css
@page { size: A4; margin: 18mm 16mm 18mm 20mm; }
html, body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
[data-pak-box] { overflow: visible; box-sizing: border-box; }
.pak-avoid-break { break-inside: avoid; }
```

- [ ] **Step 2: Create good and intentional internal-box overflow fixtures**

The overflow fixture must reproduce text inside the page but outside a bordered rectangle.

- [ ] **Step 3: Write Playwright-backed QA tests**

For `[data-pak-box]`, compare descendant text/image bounding boxes to the container with a 0.5 px tolerance. Emit `internal-box-overflow` when crossed. Also detect page horizontal overflow, marked no-overlap collisions, empty instructional image alt text, and figure labels without captions.

- [ ] **Step 4: Implement DOM measurement using `page.evaluate()`**

Do not use OCR for this stage.

- [ ] **Step 5: Run tests**

```bash
npm run test:run -- tests/vitest/publishing-factory/layout-qa.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add publishing/templates publishing/fixtures/manuscript-good.fixture.html publishing/fixtures/manuscript-overflow.fixture.html src/modules/publishing-factory/layout-qa.ts tests/vitest/publishing-factory/layout-qa.test.ts
git commit -m "feat: add textbook print shell and DOM layout QA"
```

---

### Task 7: Render Deterministic A4 PDFs and Page Images

**Files:**
- Create: `src/modules/publishing-factory/renderer.ts`
- Create: `tests/vitest/publishing-factory/renderer.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `renderPublication(input: RenderPublicationInput): Promise<RenderPublicationResult>`.

- [ ] **Step 1: Write failing render test**

Assert non-empty PDF, at least one page screenshot, and all output paths inside the caller artifact root.

- [ ] **Step 2: Implement Playwright PDF export**

```ts
await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  tagged: true,
  outline: true,
});
```

If `outline` is unsupported, record navigation deficiency in PDF QA rather than claiming success.

- [ ] **Step 3: Ignore runtime artifacts**

Append:

```text
artifacts/publishing/
```

- [ ] **Step 4: Run tests and commit**

```bash
npm run test:run -- tests/vitest/publishing-factory/renderer.test.ts
git add src/modules/publishing-factory/renderer.ts tests/vitest/publishing-factory/renderer.test.ts .gitignore
git commit -m "feat: render deterministic A4 publication artifacts"
```

---

### Task 8: Add PDF QA Contract

**Files:**
- Create: `src/modules/publishing-factory/pdf-qa.ts`
- Create: `tests/vitest/publishing-factory/pdf-qa.test.ts`

**Interfaces:**
- Produces: `runPdfQa(input: PdfQaInput): Promise<QaFinding[]>`.

- [ ] **Step 1: Test rendered PDF for page count, A4 size, searchable text, identity text, and blank pages**

- [ ] **Step 2: Add a narrowly scoped Node PDF parser dependency only if required**

- [ ] **Step 3: Implement defect classes**

```text
pdf-unreadable
wrong-page-size
missing-searchable-text
identity-text-missing
blank-page
metadata-mismatch
bookmark-navigation-missing
```

- [ ] **Step 4: Run tests and commit**

```bash
npm run test:run -- tests/vitest/publishing-factory/pdf-qa.test.ts
git add src/modules/publishing-factory/pdf-qa.ts tests/vitest/publishing-factory/pdf-qa.test.ts package.json package-lock.json
git commit -m "feat: add publication PDF QA"
```

---

### Task 9: Implement Repair Signatures and Three-Attempt Block Rule

**Files:**
- Create: `src/modules/publishing-factory/repair.ts`
- Create: `tests/vitest/publishing-factory/repair.test.ts`

**Interfaces:**
- Produces: `defectSignature`, `routeRepair`, `recordRepairAttempt`, `shouldBlockAfterAttempt`.

- [ ] **Step 1: Test routing**

```text
duplicate-paragraph -> manuscript
internal-box-overflow -> typesetting
low-effective-dpi -> visual
metadata-mismatch -> export
unsupported-safety-critical-value -> references
```

- [ ] **Step 2: Test exact attempt limit**

Attempts 1 and 2 remain repairable; after recording attempt 3 the defect must block and no fourth automatic attempt may schedule.

- [ ] **Step 3: Implement SHA-256 signature using gate, defectClass, normalized page, componentId, and normalized message class**

- [ ] **Step 4: Run tests and commit**

```bash
npm run test:run -- tests/vitest/publishing-factory/repair.test.ts
git add src/modules/publishing-factory/repair.ts tests/vitest/publishing-factory/repair.test.ts
git commit -m "feat: add deterministic publishing repair policy"
```

---

### Task 10: Build Release Manifest Arithmetic and Hard Release Gate

**Files:**
- Create: `src/modules/publishing-factory/manifest.ts`
- Create: `tests/vitest/publishing-factory/manifest.test.ts`
- Create: `publishing/manifests/.gitkeep`

**Interfaces:**
- Produces: `canRelease`, `buildReleaseManifest`, `assertCompleteRelease`.

- [ ] **Step 1: Test that `PDF_BUILT` cannot release**
- [ ] **Step 2: Test that any error finding prevents release even if a caller sets `passed: true`**
- [ ] **Step 3: Test summary arithmetic**

```ts
expect(manifest.summary).toEqual({
  planned: 5,
  generated: 3,
  qaPassed: 2,
  qaFailed: 1,
  blocked: 1,
  released: 1,
  unresolved: 4,
});
```

- [ ] **Step 4: Implement completeness assertion**

Release completeness requires `released === planned`, `unresolved === 0`, `qaFailed === 0`, and `blocked === 0`.

- [ ] **Step 5: Run tests and commit**

```bash
npm run test:run -- tests/vitest/publishing-factory/manifest.test.ts
git add src/modules/publishing-factory/manifest.ts tests/vitest/publishing-factory/manifest.test.ts publishing/manifests/.gitkeep
git commit -m "feat: add hard publishing release gate"
```

---

### Task 11: Orchestrate One Deterministic Book Through QA

**Files:**
- Create: `src/modules/publishing-factory/orchestrator.ts`
- Create: `tests/vitest/publishing-factory/orchestrator.test.ts`

**Interfaces:**
- Produces: `runDeterministicBook(input: DeterministicBookInput): Promise<DeterministicBookResult>`.

- [ ] **Step 1: Test good fixture from `TYPESET_READY` to `QA_PASSED`**
- [ ] **Step 2: Test overflow fixture never reaches `QA_PASSED` or `RELEASED`**
- [ ] **Step 3: Implement explicit stage sequence**

```ts
contentFindings = runContentQa(...)
layoutFindings = await runDomLayoutQa(...)
render = await renderPublication(...)
pdfFindings = await runPdfQa(...)
```

Expected validation/render failures become structured findings; programmer errors are rethrown.

- [ ] **Step 4: Run tests and commit**

```bash
npm run test:run -- tests/vitest/publishing-factory/orchestrator.test.ts
git add src/modules/publishing-factory/orchestrator.ts tests/vitest/publishing-factory/orchestrator.test.ts
git commit -m "feat: orchestrate deterministic publication QA"
```

---

### Task 12: Add CLI, Public Exports, and Scripts

**Files:**
- Create: `src/modules/publishing-factory/cli.ts`
- Create: `src/modules/publishing-factory/index.ts`
- Modify: `package.json`
- Create: `tests/vitest/publishing-factory/cli.test.ts`

**Interfaces:**
- Commands: `registry`, `enumerate --programme PAK-D01`, `qa-fixture --fixture good|overflow`.

- [ ] **Step 1: Test exported `runCli(args, io)` handlers without shell spawning**
- [ ] **Step 2: Implement handlers; registry must report 34 programmes and D01 enumeration must report 24 jobs**
- [ ] **Step 3: Add scripts**

```json
"publishing:registry": "tsx src/modules/publishing-factory/cli.ts registry",
"publishing:qa-fixture": "tsx src/modules/publishing-factory/cli.ts qa-fixture --fixture good"
```

If `tsx` is absent, add it as dev dependency.

- [ ] **Step 4: Run focused tests**

```bash
npm run test:run -- tests/vitest/publishing-factory
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/publishing-factory/cli.ts src/modules/publishing-factory/index.ts tests/vitest/publishing-factory/cli.test.ts package.json package-lock.json
git commit -m "feat: expose publishing factory core CLI"
```

---

### Task 13: Full Verification and Core-Milestone PR

- [ ] **Step 1:** `npm run test:run -- tests/vitest/publishing-factory` — expect 0 failures.
- [ ] **Step 2:** `npm run typecheck` — expect exit 0.
- [ ] **Step 3:** `npm run lint` — expect exit 0.
- [ ] **Step 4:** `npm run test:run` — expect exit 0.
- [ ] **Step 5:** `npm run build` — expect exit 0.
- [ ] **Step 6:** run `npm run publishing:registry` and `npm run publishing:qa-fixture`; expect 34-programme registry and good fixture `QA_PASSED` without auto-release.
- [ ] **Step 7:** inspect branch diff and confirm no unrelated marketing-automation behavior changed.
- [ ] **Step 8:** open PR titled `feat: add PAK academic publishing factory core` with summary of deterministic contracts, registry/job enumeration, content/layout/PDF QA, repair policy, A4 renderer, hard release gate, and D01/fixture evidence.
- [ ] **Step 9:** verify CI and do not merge repository-code failures.

---

## Follow-On Plans After Core Milestone

1. **Canonical Knowledge & Reference Packs** — governed railway-domain knowledge, source registers, regulatory anchors, level adaptation contracts.
2. **Curriculum Architecture Completion Factory** — complete missing B03-B05, PGD01-PGD06, and M01-M06 subject/module architecture and chapter blueprints.
3. **Manuscript Generation Workers** — provider adapters, structured generation contracts, chapter assembly, copy-edit/rewrite passes, safety/reference gates.
4. **Technical Visual & Cover Factory** — deterministic SVG schematics, text-free image generation adapters, exact PAK brand composition, 300-DPI/effective-resolution QA.
5. **Portfolio Queue & Parallel Orchestration** — worker pools, concurrency controls, immutable stage artifacts, retry/repair scheduling, observability, cost metrics.
6. **Portfolio Release & Batch QA** — all-book manifest, cross-book consistency checks, page-level vision review, release packaging.

Each follow-on plan preserves the invariant: **a generated artifact is not a released book until all mandatory gates pass.**
