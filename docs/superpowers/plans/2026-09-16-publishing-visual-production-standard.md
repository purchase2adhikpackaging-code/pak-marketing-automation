# Publishing Visual Production Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make realistic cover/back-cover and pedagogically relevant internal visuals mandatory, renderer-safe, checkpointed and release-blocking for every Publishing Factory textbook, then regenerate D01-101 as a new visual revision.

**Architecture:** Add a provider-neutral visual-production domain between manuscript planning and serialization. Resolved visual assets are checkpointed, embedded deterministically into HTML, decoded by Chromium before PDF printing, and verified by a new blocking visual QA gate integrated into the compiler. Existing content QA, layout QA, PDF QA, broker/Vault security and bounded D01 worker remain intact.

**Tech Stack:** TypeScript, Vitest, Next.js, Playwright Core/Chromium, existing Publishing Factory and Publishing Production broker/checkpoint infrastructure.

**Spec:** `docs/superpowers/specs/2026-09-16-publishing-visual-production-standard-design.md`

## Global Constraints

- Publishing Production Runner / textbook factory only; no Marketing Automation changes.
- Every releasable textbook requires realistic front and back cover images.
- Every chapter requires at least one pedagogically relevant resolved visual.
- Technical labeled diagrams are required where the visual plan marks labelsRequired.
- Cover minimum resolution is 1600x2400; internal raster visual long edge minimum is 1200 pixels.
- No placeholder/unresolved visual may pass QA.
- No new paid API is hard-coded and no new secret is exposed.
- No service-role key in Vercel/browser; preserve broker/Vault, RLS/RBAC and tenant isolation.
- Existing D01-101 academic content is reused wherever possible; visual revision must not silently rewrite approved claims.

---

### Task 1: Visual production domain and validation

**Files:**
- Create: `src/modules/publishing-factory/visual-production.ts`
- Create: `tests/vitest/publishing-factory/visual-production.test.ts`
- Modify: `src/modules/publishing-factory/index.ts`

**Interfaces:**
- Produces `BookVisualRequirement`, `BookVisualPlan`, `ResolvedBookVisual`, `ResolvedBookVisualBundle`, `createBookVisualPlan(manuscript, blueprint)`, and `validateResolvedBookVisualBundle(plan, bundle)`.

- [ ] Write failing tests proving a plan always has one front cover, one back cover, and >=1 visual requirement per chapter; validation rejects missing cover/chapter visual, unsupported MIME, low resolution, missing provenance/caption/alt, missing required labels and placeholder markers.
- [ ] Run `npx vitest run tests/vitest/publishing-factory/visual-production.test.ts` and confirm RED.
- [ ] Implement the typed domain and deterministic planner/validator with cover >=1600x2400 and internal long-edge >=1200 rules.
- [ ] Run the focused test and confirm GREEN.
- [ ] Commit `feat: add textbook visual production contract`.

### Task 2: Provider-neutral visual resolver boundary

**Files:**
- Create: `src/modules/publishing-factory/visual-resolver.ts`
- Create: `tests/vitest/publishing-factory/visual-resolver.test.ts`

**Interfaces:**
- Consumes `BookVisualPlan`.
- Produces `BookVisualResolver.resolve(plan): Promise<ResolvedBookVisualBundle>` and `VisualAssetSource` abstraction.

- [ ] Write failing tests proving approved-library/generated/licensed sources normalize to renderer-safe data URIs with provenance, and unresolved/remote-only/signed-URL-only assets fail closed.
- [ ] Run focused test and confirm RED.
- [ ] Implement resolver boundary without adding a provider credential or hard-coded paid service.
- [ ] Run focused test and confirm GREEN.
- [ ] Commit `feat: resolve textbook visuals behind provider boundary`.

### Task 3: Visual checkpoints and retry reuse

**Files:**
- Modify: `src/modules/publishing-factory/checkpoint-store.ts`
- Modify: `src/modules/publishing-factory/domain.ts`
- Modify: `tests/vitest/publishing-factory/checkpoint-store.test.ts`

**Interfaces:**
- Adds checkpoint files `visual-plan.json` and `visual-assets.json` with deterministic schema/version.

- [ ] Write failing tests proving plan/assets round-trip and an existing resolved bundle is restored instead of regenerated.
- [ ] Run focused checkpoint tests and confirm RED.
- [ ] Implement checkpoint serialization/restoration without persisting signed URLs.
- [ ] Run focused tests and confirm GREEN.
- [ ] Commit `feat: checkpoint textbook visual assets`.

### Task 4: Manuscript serialization with covers and figures

**Files:**
- Modify: `src/modules/publishing-factory/manuscript-serializer.ts`
- Modify: `publishing/templates/textbook-base.css`
- Modify: `tests/vitest/publishing-factory/manuscript-serializer.test.ts`

**Interfaces:**
- Serializer accepts optional/required `ResolvedBookVisualBundle` in the production path and emits stable `data-visual-id` cover/figure elements.

- [ ] Write failing tests for full-page `front-cover`, `back-cover`, chapter figures, `<figcaption>`, alt text, data URI embedding, and cover pages without ordinary running header/footer.
- [ ] Run focused serializer tests and confirm RED.
- [ ] Implement semantic figure/cover HTML and print CSS using the existing PAK navy/red visual language.
- [ ] Run focused tests and confirm GREEN.
- [ ] Commit `feat: render textbook covers and chapter visuals`.

### Task 5: Chromium image-readiness contract

**Files:**
- Modify: `src/modules/publishing-factory/renderer.ts`
- Modify: `tests/vitest/publishing-factory/renderer.test.ts`

**Interfaces:**
- Adds deterministic image readiness check before `page.pdf()`; render fails when any image cannot decode.

- [ ] Write failing test/source contract proving renderer awaits `document.images`, checks `complete`/`naturalWidth`, invokes `decode()` where supported, and throws before PDF for broken assets.
- [ ] Run renderer tests and confirm RED.
- [ ] Implement image readiness after `page.setContent` and before PDF generation while retaining `printBackground: true`.
- [ ] Run renderer tests and confirm GREEN.
- [ ] Commit `fix: block PDF render on broken textbook images`.

### Task 6: Blocking visual QA

**Files:**
- Create: `src/modules/publishing-factory/visual-qa.ts`
- Create: `tests/vitest/publishing-factory/visual-qa.test.ts`
- Modify: `src/modules/publishing-factory/domain.ts`
- Modify: `src/modules/publishing-factory/index.ts`

**Interfaces:**
- Produces `runVisualQa({plan,bundle,html}): QaIssue[]` with blocking issue codes `VISUAL_FRONT_COVER_MISSING`, `VISUAL_BACK_COVER_MISSING`, `VISUAL_CHAPTER_COVERAGE_MISSING`, `VISUAL_ASSET_INVALID`, `VISUAL_LABELS_MISSING`, `VISUAL_HTML_MISSING`.

- [ ] Write failing tests for every blocking condition and one benchmark-compliant passing bundle.
- [ ] Run focused visual QA test and confirm RED.
- [ ] Implement QA using domain validator plus serialized HTML coverage.
- [ ] Run focused test and confirm GREEN.
- [ ] Commit `feat: add release-blocking textbook visual QA`.

### Task 7: Compiler/orchestrator integration

**Files:**
- Modify: `src/modules/publishing-factory/book-compiler.ts`
- Modify: `src/modules/publishing-factory/orchestrator.ts`
- Modify: `tests/vitest/publishing-factory/book-compiler.test.ts`
- Modify: `tests/vitest/publishing-factory/orchestrator.test.ts`

**Interfaces:**
- Compiler flow becomes manuscript -> visual plan -> restore/resolve assets -> serialize -> visual QA -> layout/PDF QA -> QA_PASSED.

- [ ] Write failing tests proving text-only manuscript can no longer reach QA_PASSED and resolved compliant visuals can; content QA still runs unchanged.
- [ ] Run focused compiler/orchestrator tests and confirm RED.
- [ ] Integrate visual plan/resolution/checkpoints/QA without changing academic claims or direct bounded queue semantics.
- [ ] Run focused tests and confirm GREEN.
- [ ] Commit `feat: enforce visual standard in textbook compiler`.

### Task 8: Production runner and artifact manifest integration

**Files:**
- Modify: `src/modules/publishing-production/node-worker-runtime.ts`
- Modify: `src/modules/publishing-factory/manifest.ts`
- Modify: `src/modules/publishing-production/artifact-publisher.ts`
- Modify: `tests/vitest/publishing-production/production-runner.e2e.test.ts`
- Modify: `tests/vitest/publishing-factory/manifest.test.ts`

**Interfaces:**
- Release manifest records visual asset counts, front/back cover presence, chapter coverage and provenance summary; worker publishes only QA_PASSED visual-compliant artifacts.

- [ ] Write failing E2E/unit tests proving a missing visual blocks publication and compliant bundle appears in manifest without raw secret/signed URL leakage.
- [ ] Run focused tests and confirm RED.
- [ ] Implement worker/manifest/artifact wiring.
- [ ] Run focused tests and confirm GREEN.
- [ ] Commit `feat: publish visual-compliant textbook artifacts`.

### Task 9: Full regression and exact-head preview verification

**Files:**
- No production file unless a verified regression requires a scoped fix.

- [ ] Run all Publishing Factory tests.
- [ ] Run all Publishing Production tests.
- [ ] Run typecheck, lint and full unit suite through exact-head CI.
- [ ] Verify Vercel preview is READY.
- [ ] Call authenticated `/api/internal/publishing-browser-health` and verify real `setContent -> image readiness -> PDF` succeeds.
- [ ] Review changed-file scope and prove no Marketing Automation/Scene Planning/video files changed.

### Task 10: Controlled D01-101 visual revision

**Files:**
- Runtime operation only; no source change unless a verified D01-specific defect is found.

**Interfaces:**
- Reuses approved D01-101 manuscript; produces next revision with mandatory visuals and preserved prior publication history.

- [ ] Read-only verify D01-101 current publication/checkpoints and no unrelated claimable textbook job.
- [ ] Create/queue only the D01-101 visual revision with concurrency 1.
- [ ] Verify restored academic manuscript hash/content is unchanged except serializer/visual placement metadata.
- [ ] Resolve/generate front cover, back cover and chapter visuals; stop rather than publish if provider/asset capability is absent.
- [ ] Run content, visual, layout and PDF QA; require all PASS.
- [ ] Verify PDF, manuscript, QA report, release manifest and visual checkpoints exist with plausible sizes.
- [ ] Open/review generated PDF against the Polish Railway Academy Textbook Preview benchmark: photographic front/back covers, chapter imagery, labeled technical visuals and practical/case-study imagery.
- [ ] Release only the new revision; retain old revision in Library history.

### Task 11: Review and merge

**Files:**
- No additional feature files.

- [ ] Invoke `superpowers:requesting-code-review` and resolve findings without weakening contracts.
- [ ] Invoke `superpowers:verification-before-completion` and capture fresh exact-head evidence.
- [ ] Invoke `superpowers:finishing-a-development-branch`.
- [ ] Merge only after exact-head CI, Vercel preview runtime and controlled D01-101 E2E are green.
- [ ] Verify production deploy and authenticated browser/PDF health on production.
