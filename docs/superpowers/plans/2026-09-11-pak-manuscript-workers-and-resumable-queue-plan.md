# PAK Manuscript Workers & Resumable Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn governed PAK curriculum + canonical knowledge packs into automatically written, checkpointed, reproducible textbook manuscripts and route them through the existing deterministic HTML/PDF/QA pipeline with a resumable four-worker production queue.

**Architecture:** Add a deterministic blueprint/manuscript compiler under `src/modules/publishing-factory/`, backed by the existing `TextGenerationProvider`, canonical knowledge context and `BookJob` state model. Persist stage checkpoints atomically in an artifact store and use a queue abstraction with idempotency, leases, bounded retries and configurable concurrency; the hosted adapter reuses the existing `public.jobs` semantics rather than service-role credentials. The first release proves one complete governed D01-style book through a fake provider in CI and exposes real provider CLI entry points for production.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest 3, Node.js 22, existing OpenAI/fake text provider abstraction, existing publishing-factory renderer/QA, existing jobs table semantics.

**Spec:** `docs/superpowers/specs/2026-09-11-pak-academic-publishing-factory-design.md`

## Global Constraints

- Work only on branch `feat/pak-publishing-manuscript-workers`.
- Base is the exact green Phase 2 head `9b026f9aeab9bee4d07c31ccbbdf7c8df30143f4`.
- Do not use a Supabase service-role key.
- Default production concurrency is 4 and must be runtime-configurable.
- A repeated defect/retry may execute at most 3 attempts before the affected book is blocked.
- Checkpoints must survive process restarts and must not restart completed chapters.
- Stable identity is `bookId + edition + revision`; duplicate delivery must not create duplicate books.
- Generated prose may only use governed curriculum, assembled canonical knowledge context and explicitly supplied approved sources.
- Unsupported safety-critical numeric limits are prohibited.
- Manuscripts are structured source first; PDF is a downstream artifact.
- Existing HTML/CSS → Playwright renderer and deterministic QA gates remain authoritative.
- CI uses fake generation only; no external AI network call is permitted in CI.
- TDD is required for deterministic code.

---

## File Structure

Create:

```text
src/modules/publishing-factory/
  blueprint.ts
  knowledge-selection.ts
  manuscript-domain.ts
  manuscript-writer.ts
  manuscript-serializer.ts
  checkpoint-store.ts
  worker-queue.ts
  book-compiler.ts
  production-cli.ts

tests/vitest/publishing-factory/
  blueprint.test.ts
  knowledge-selection.test.ts
  manuscript-domain.test.ts
  manuscript-writer.test.ts
  manuscript-serializer.test.ts
  checkpoint-store.test.ts
  worker-queue.test.ts
  book-compiler.test.ts
  production-cli-process.test.ts

publishing/fixtures/
  manuscript-provider-book.fixture.json
```

Modify:

```text
src/modules/publishing-factory/cli.ts
src/modules/publishing-factory/index.ts
package.json
.github/workflows/ci.yml
```

No generated portfolio PDFs are committed to Git.

---

### Task 1: Book Blueprint Contract and Validation

**Files:**
- Create: `src/modules/publishing-factory/blueprint.ts`
- Create: `tests/vitest/publishing-factory/blueprint.test.ts`

**Interfaces:**
- Produces `BookBlueprintSchema`, `BookBlueprint`, `ChapterBlueprint`, `validateBookBlueprintForJob(job, blueprint)`.
- Consumes `BookJob`, `QualificationLevel`.

Blueprint minimum structure:

```ts
BookBlueprint = {
  bookId: string;
  programmeCode: string;
  subjectCode: string;
  subjectTitle: string;
  level: QualificationLevel;
  purpose: string;
  prerequisites: string[];
  knowledgePackIds: string[];
  chapters: {
    id: string;
    number: number;
    title: string;
    purpose: string;
    learningOutcomes: string[];
    requiredKnowledgePackIds: string[];
    requiredVisualIds: string[];
    workedExampleRequirements: string[];
    practicalRequirements: string[];
    assessmentRequirements: string[];
    safetyCritical: boolean;
    referenceSourceIds: string[];
  }[];
}
```

- [ ] Write RED tests that reject mismatched book/subject identity, duplicate chapter numbers/IDs, empty outcomes, unknown/duplicate selected pack IDs, and a safety-critical chapter with no reference source IDs.
- [ ] Verify RED because `blueprint.ts` is absent.
- [ ] Implement Zod schema + deterministic cross-field validator. Chapter numbers must be contiguous from 1.
- [ ] Verify GREEN.
- [ ] Commit `feat: define governed book blueprint contract`.

### Task 2: Deterministic Knowledge-Pack Selection

**Files:**
- Create: `src/modules/publishing-factory/knowledge-selection.ts`
- Create: `tests/vitest/publishing-factory/knowledge-selection.test.ts`

**Interfaces:**
- Produces `selectKnowledgePacksForSubject({title, orientation, availablePackIds}): string[]`.

- [ ] RED tests cover D01-101 railway/rolling-stock, engineering mathematics/mechanics, drawing/CAD, materials/corrosion, workshop/metrology, and railway safety subjects; unknown subjects must at minimum receive `railway-systems` when available and must never return a non-existent pack ID.
- [ ] Implement normalized keyword/domain scoring with stable deterministic ordering and no model call.
- [ ] Verify GREEN.
- [ ] Commit `feat: select governed knowledge packs for book jobs`.

### Task 3: Structured Manuscript Contracts

**Files:**
- Create: `src/modules/publishing-factory/manuscript-domain.ts`
- Create: `tests/vitest/publishing-factory/manuscript-domain.test.ts`

**Interfaces:**
- Produces `ChapterManuscriptSchema`, `BookManuscriptSchema`, `ChapterManuscript`, `BookManuscript`, `validateChapterAgainstBlueprint`.

Every chapter requires:

```ts
{
  chapterId: string;
  number: number;
  title: string;
  purpose: string;
  learningOutcomes: string[];
  keyTerms: { term: string; explanation: string }[];
  sections: { heading: string; paragraphs: string[] }[];
  workedExamples: { title: string; problem: string; solutionSteps: string[]; conclusion: string }[];
  practicalActivities: { title: string; objective: string; safety: string[]; tasks: string[]; records: string[] }[];
  safetyNotes: string[];
  knowledgeChecks: string[];
  summary: string[];
  reviewQuestions: string[];
  sourceIds: string[];
}
```

Book manuscript includes exact book identity, blueprint hash, selected knowledge-pack hashes, provider/model metadata and chapters.

- [ ] RED tests reject blank/filler content, chapter identity mismatch, missing outcomes, duplicate section headings, repeated paragraph text, and source IDs outside the supplied grounding context.
- [ ] Implement schemas + semantic validator using existing duplicate/placeholder concepts.
- [ ] Verify GREEN.
- [ ] Commit `feat: define structured textbook manuscript contracts`.

### Task 4: Chapter Writer and Blueprint Generator

**Files:**
- Create: `src/modules/publishing-factory/manuscript-writer.ts`
- Create: `tests/vitest/publishing-factory/manuscript-writer.test.ts`

**Interfaces:**
- Consumes `TextGenerationProvider`, `BookJob`, `BookBlueprint`, `ManuscriptKnowledgeContext`.
- Produces:
  - `generateBookBlueprint(input): Promise<BookBlueprint>`
  - `generateChapterManuscript(input): Promise<ChapterManuscript>`
- Model output contract is strict JSON only.

- [ ] RED tests use an injected fake provider transport and prove prompt grounding includes exact book identity, level, allowed source IDs, prohibited unsupported claims and safety boundary.
- [ ] RED test proves malformed/non-JSON provider output is rejected rather than silently repaired into prose.
- [ ] RED test proves unsupported source IDs returned by the provider are rejected.
- [ ] Implement strict JSON parsing + Zod/semantic validation. The writer must not invent operational authorization or unsupported numeric acceptance limits.
- [ ] Verify GREEN.
- [ ] Commit `feat: generate governed blueprints and textbook chapters`.

### Task 5: Canonical Markdown/HTML Source Serialization

**Files:**
- Create: `src/modules/publishing-factory/manuscript-serializer.ts`
- Create: `tests/vitest/publishing-factory/manuscript-serializer.test.ts`

**Interfaces:**
- Produces `serializeBookManuscript(manuscript): string` and `renderBookHtml({job, blueprint, manuscript, css}): string`.

- [ ] RED tests require deterministic output, escaped user/model HTML, one learning-outcome block per chapter, stable chapter/figure labels, source notes and no instructor-only labels.
- [ ] Implement semantic HTML with DOM containment markers (`data-component-id`, `data-box-bounds`) compatible with existing layout QA. Callout blocks use content-driven height, not fixed-height clipping.
- [ ] Verify GREEN.
- [ ] Commit `feat: serialize manuscripts into deterministic textbook source`.

### Task 6: Atomic Checkpoint Store and Resume

**Files:**
- Create: `src/modules/publishing-factory/checkpoint-store.ts`
- Create: `tests/vitest/publishing-factory/checkpoint-store.test.ts`

**Interfaces:**
- Produces `FileCheckpointStore` with:
  - `loadRun(bookId, edition, revision)`
  - `saveBlueprint(...)`
  - `saveChapter(...)`
  - `saveManuscript(...)`
  - `saveStage(...)`
- Writes underneath `artifacts/publishing/checkpoints/<bookId>/<edition>/<revision>/` using write-temp + rename atomicity.

- [ ] RED tests prove restart after chapters 1–2 resumes at chapter 3, a repeated save with identical hash is idempotent, conflicting content for a completed chapter is rejected, and corrupted checkpoint JSON fails closed.
- [ ] Implement SHA-256 hashes and atomic files.
- [ ] Verify GREEN.
- [ ] Commit `feat: persist resumable manuscript checkpoints`.

### Task 7: Bounded Resumable Worker Queue

**Files:**
- Create: `src/modules/publishing-factory/worker-queue.ts`
- Create: `tests/vitest/publishing-factory/worker-queue.test.ts`

**Interfaces:**
- Produces deterministic queue primitives `ProductionQueue`, `runWorkerPool({queue, worker, concurrency})`.
- Default concurrency: `Number(process.env.PUBLISHING_WORKER_CONCURRENCY ?? "4")`, clamped to `1..32`.
- Job identity uses `bookId:edition:revision`.

- [ ] RED tests prove four jobs can run concurrently, duplicate enqueue returns the original job, lease expiry permits reclaim, completed work is never reclaimed, failure retries stop at three and transition to BLOCKED/terminal failure, and an empty queue makes workers idle instead of cycling.
- [ ] Implement in-memory deterministic adapter for tests plus durable JSON snapshot adapter for CLI execution. Mirror existing DB job semantics (`idempotencyKey`, `leaseOwner`, `leaseExpiresAt`, `attemptCount`, `maxAttempts`).
- [ ] Add guarded SQL migration only if needed for hosted publishing-specific claim/heartbeat/complete RPC; it must authorize organization membership/role and must not require service-role credentials.
- [ ] Verify GREEN.
- [ ] Commit `feat: add bounded resumable publishing worker queue`.

### Task 8: End-to-End Book Compiler

**Files:**
- Create: `src/modules/publishing-factory/book-compiler.ts`
- Create: `tests/vitest/publishing-factory/book-compiler.test.ts`
- Create: `publishing/fixtures/manuscript-provider-book.fixture.json`

**Interfaces:**
- Produces `compileBook({job, curriculumText, provider, registry, checkpointStore, artifactRoot})`.
- Reuses `assembleKnowledgeContext`, serializer, existing renderer, `runDeterministicBook`, repair policy and release manifest logic.

- [ ] RED integration test drives a small complete D01-style book using a deterministic fixture provider; assert blueprint → chapter checkpoints → manuscript → HTML → searchable A4 PDF → QA_PASSED.
- [ ] RED resume test stops after chapter 1 and proves the second compiler invocation does not call the provider again for chapter 1.
- [ ] RED failure test injects a repeated invalid chapter and proves the book blocks after bounded retries while unrelated queue jobs continue.
- [ ] Implement stage orchestration and deterministic artifact paths.
- [ ] Verify GREEN.
- [ ] Commit `feat: compile governed manuscripts through PDF QA`.

### Task 9: Production CLI, Four-Worker Runner and CI Gate

**Files:**
- Create: `src/modules/publishing-factory/production-cli.ts`
- Create: `tests/vitest/publishing-factory/production-cli-process.test.ts`
- Modify: `src/modules/publishing-factory/cli.ts`
- Modify: `src/modules/publishing-factory/index.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Commands:**

```text
book-plan --programme PAK-D01 --subject D01-102
book-write --programme PAK-D01 --subject D01-102 --provider fake|openai
workers --programme PAK-D01 --concurrency 4 --provider fake|openai
resume --book-id <stable-book-id> --provider fake|openai
production-status
```

- [ ] RED process tests prove `book-plan` and fake `book-write` run through the real `tsx` process, worker default concurrency is 4, `--concurrency 0` fails closed, and status output is machine-readable JSON.
- [ ] Production `openai` path must require organization context and use the existing integration-backed provider; no raw API key handling is added.
- [ ] Add scripts `publishing:book-plan`, `publishing:book-write`, `publishing:workers`, `publishing:status`.
- [ ] Add CI `Publishing manuscript factory smoke` using fake provider only.
- [ ] Verify exact-head typecheck, lint, full unit/process suite, knowledge gates, manuscript factory smoke, deterministic PDF QA fixture, build and E2E.
- [ ] Open a stacked PR with base `feat/pak-publishing-knowledge-packs` and leave it unmerged for review.
- [ ] Commit `ci: gate autonomous PAK manuscript factory`.

## Acceptance Criteria

The writer phase is accepted only when:

1. A governed book job can automatically produce a valid blueprint and structured manuscript through the provider interface.
2. Every chapter is grounded in canonical pack hashes/source IDs and rejects unknown provenance.
3. A process restart resumes at the first incomplete chapter, not chapter 1.
4. Duplicate job delivery cannot create a duplicate publication.
5. Default worker concurrency is 4 and configurable without code changes.
6. Lease expiry reclaims abandoned work; completed work is never reclaimed.
7. Retries are bounded to 3 and cannot form an infinite loop.
8. A deterministic fake-provider book passes the full HTML → PDF → QA path in CI.
9. Production OpenAI generation is exposed through the existing integration-backed provider and does not introduce service-role/API-key storage.
10. Exact-head full CI is green before this branch is called complete.
