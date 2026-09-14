# PAK Publishing Production Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated, durable production execution and Book Library layer that runs the existing PAK manuscript factory in the background, survives browser/server restarts, defaults to four concurrent jobs, caps retries at three, and exposes QA-passed books to authorized administrators.

**Architecture:** Persist production runs and book jobs in Supabase with organization-scoped RLS and SECURITY DEFINER RPCs for atomic claim/heartbeat/complete/fail transitions. A scheduled/kicked Supabase Edge worker processes bounded units from that queue, resolves OpenAI through the existing Integration Vault server-side, and writes deterministic publication artifacts to Supabase Storage. The Next.js admin UI creates/controls runs and reads run/library state; it never performs long-running generation in the browser.

**Tech Stack:** Next.js 15 App Router, TypeScript 5.9, React 19, Supabase Postgres/RLS/RPC/Storage/Edge Functions, existing PAK publishing-factory modules, Vitest, Playwright, Zod.

**Spec:** `docs/superpowers/specs/2026-09-12-pak-publishing-production-runner-design.md`

## Global Constraints

- Default production concurrency is 4; accepted configuration range is `1..32`.
- Queue/job retry ceiling is exactly 3 attempts; terminal `BLOCKED` jobs are never auto-requeued.
- Stable identity is `bookId + edition + revision`; duplicate delivery must not create duplicate publications.
- OWNER and ADMIN may start all scopes; EDITOR may start SUBJECT/PROGRAMME/PILOT but not PORTFOLIO.
- Browser must never receive service-role credentials or OpenAI API keys.
- Production OpenAI generation resolves the organization-scoped Vault secret server-side.
- Only QA-passed books may be promoted into the released Book Library.
- Architecture-pending programmes remain excluded; the runner must never silently invent curriculum architecture.
- Existing manuscript compiler/QA remains authoritative and is reused rather than duplicated.
- Exact-head full CI must be green before the branch is called complete.

---

### Task 1: Durable Production Schema, RLS and Queue RPCs

**Files:**
- Create: `supabase/migrations/202609120001_publishing_production_runner.sql`
- Create: `tests/vitest/publishing-production/production-schema-security.test.ts`

**Interfaces:**
- Produces tables `publishing_production_runs`, `publishing_production_jobs`, `publishing_publications`.
- Produces RPCs `claim_publishing_jobs`, `heartbeat_publishing_job`, `complete_publishing_job`, `fail_publishing_job`, `set_publishing_run_state`.
- Storage bucket name: `publishing-books`.

- [ ] **Step 1: Write RED schema-security tests** that read the migration text and assert organization foreign keys, unique `(production_run_id, book_id, edition, revision)`, `max_attempts = 3`, RLS enabled, explicit membership-role checks, revoke-public/anon execute, deterministic storage bucket/policies, and RPC lease columns.
- [ ] **Step 2: Run** `npx vitest run tests/vitest/publishing-production/production-schema-security.test.ts` and confirm failure because the migration does not exist.
- [ ] **Step 3: Implement migration** with:
  - run states: `QUEUED,RUNNING,PAUSED,COMPLETED,COMPLETED_WITH_BLOCKED,CANCELLED,FAILED`
  - job states: `QUEUED,RUNNING,QA_PASSED,BLOCKED,CANCELLED`
  - partial/indexed claim path on `(status, lease_expires_at, created_at)`
  - atomic `FOR UPDATE SKIP LOCKED` claiming limited by requested concurrency
  - lease owner/expiry + heartbeat
  - failure increments attempt count and transitions to `BLOCKED` at attempt 3
  - SECURITY DEFINER functions with fixed `search_path`
  - authenticated organization/role authorization inside mutation RPCs
  - `publishing-books` private bucket and organization-keyed object policies.
- [ ] **Step 4: Run focused test GREEN.**
- [ ] **Step 5: Commit** `feat: add durable publishing production schema`.

### Task 2: Server Domain and Repository Adapter

**Files:**
- Create: `src/modules/publishing-production/domain.ts`
- Create: `src/modules/publishing-production/repository.ts`
- Create: `tests/vitest/publishing-production/repository.test.ts`

**Interfaces:**
- `ProductionRunSchema`, `ProductionJobSchema`, `PublicationSchema`.
- `PublishingProductionRepository` methods: `createRun`, `listRuns`, `getRun`, `claimJobs`, `heartbeatJob`, `completeJob`, `failJob`, `pauseRun`, `resumeRun`, `cancelRun`, `listPublications`.

- [ ] **Step 1: Write RED repository tests** using a narrow injected Supabase-like transport; prove stable idempotency key, organization filtering, role-denied errors, claim limit, attempt count propagation, and terminal-state mapping.
- [ ] **Step 2: Run focused test and confirm missing module failure.**
- [ ] **Step 3: Implement Zod schemas + repository adapter** using existing server Supabase conventions; no service-role access in Next.js runtime.
- [ ] **Step 4: Run focused test GREEN.**
- [ ] **Step 5: Commit** `feat: add publishing production repository`.

### Task 3: Governed Run Planner and Architecture Gate

**Files:**
- Create: `src/modules/publishing-production/run-planner.ts`
- Create: `tests/vitest/publishing-production/run-planner.test.ts`

**Interfaces:**
- `planProductionRun({ scope, registry, curriculumLoader, releasedIdentities })` returns stable BookJobs + exclusions.
- Scope union: SUBJECT, PROGRAMME, PILOT, PORTFOLIO.

- [ ] **Step 1: Write RED planner tests** proving D01 subject/programme enumeration, pilot subset selection, duplicate released identity exclusion, stable order, and architecture-pending programme exclusion with explicit reason `ARCHITECTURE_REQUIRED`.
- [ ] **Step 2: Run focused test and confirm failure.**
- [ ] **Step 3: Implement planner** by reusing `parseAcademicIndex`, `enumerateBookJobs`, curriculum files and existing stable BookJob IDs; do not synthesize missing semester/module files.
- [ ] **Step 4: Run focused test GREEN.**
- [ ] **Step 5: Commit** `feat: plan governed publishing production runs`.

### Task 4: Background Edge Worker and Vault-Backed Provider

**Files:**
- Create: `supabase/functions/publishing-worker/index.ts`
- Create: `src/modules/publishing-production/worker-contract.ts`
- Create: `tests/vitest/publishing-production/publishing-worker-security.test.ts`
- Modify: `supabase/config.toml` only if function scheduling/config registration is required by existing project conventions.

**Interfaces:**
- Worker accepts only scheduler/internal kick requests, never raw provider credentials.
- Claims at most four jobs per invocation by default.
- Provider request uses existing organization Integration Vault records and OpenAI Responses endpoint with the existing model allowlist.

- [ ] **Step 1: Write RED worker-security tests** asserting worker validates internal scheduler signature/secret, never accepts API key in request body, loads organization/provider configuration server-side, claims bounded jobs, respects PAUSED/CANCELLED runs, and never loops indefinitely in one invocation.
- [ ] **Step 2: Run focused test and confirm missing function failure.**
- [ ] **Step 3: Implement bounded Edge worker**:
  - authenticate scheduler/internal invocation
  - claim up to configured concurrency through RPC
  - process each claimed job as an independent bounded task
  - call existing governed generation contract using organization Vault secret
  - heartbeat between durable stages
  - complete/fail through RPC
  - never requeue `BLOCKED` automatically.
- [ ] **Step 4: Add deterministic fake-provider mode only for CI**, selected by explicit test config and unavailable to normal production requests.
- [ ] **Step 5: Run focused worker tests GREEN.**
- [ ] **Step 6: Commit** `feat: add background publishing production worker`.

### Task 5: Durable Artifact Publisher and Book Library

**Files:**
- Create: `src/modules/publishing-production/artifact-publisher.ts`
- Create: `src/modules/publishing-production/book-library.ts`
- Create: `tests/vitest/publishing-production/book-library.test.ts`

**Interfaces:**
- `publishQaPassedBook({ organizationId, job, compilerResult, storage })`.
- Deterministic prefix: `publishing/{organization}/{programme}/{academic-period}/{subject}/{edition}/{revision}/`.
- Library record points to `textbook.pdf`, `manuscript.html`, `manuscript.json`, `blueprint.json`, `qa-report.json`, `release-manifest.json`.

- [ ] **Step 1: Write RED tests** proving failed-QA result cannot publish, QA-passed result writes deterministic paths, same identity is idempotent, cross-org paths are rejected, and publication metadata includes provider/model/knowledge hashes/QA status.
- [ ] **Step 2: Run focused test and confirm failure.**
- [ ] **Step 3: Implement publisher/library adapter** around injected storage/repository interfaces; use existing release-manifest semantics as the hard publication gate.
- [ ] **Step 4: Run focused test GREEN.**
- [ ] **Step 5: Commit** `feat: publish QA-passed books to durable library`.

### Task 6: Authenticated Production Actions and Admin UI

**Files:**
- Create: `src/app/(app)/publishing/production/page.tsx`
- Create: `src/app/(app)/publishing/production/actions.ts`
- Create: `src/app/(app)/publishing/production/production-client.tsx`
- Create: `src/app/(app)/publishing/library/page.tsx`
- Create: `tests/vitest/publishing-production/actions.test.ts`
- Create: `tests/vitest/publishing-production/production-ui.test.tsx`
- Modify navigation component only at the existing app-shell location discovered during implementation.

**Interfaces:**
- Actions: `startProductionRun`, `pauseProductionRun`, `resumeProductionRun`, `cancelProductionRun`.
- Start validates current user + organization membership + role before creating run/jobs.

- [ ] **Step 1: Write RED action tests** proving unauthenticated denial, OWNER/ADMIN permission, EDITOR portfolio denial, duplicate submission idempotency, and no browser-side long-running generation.
- [ ] **Step 2: Write RED UI tests** proving scope selector, programme/subject controls, default concurrency 4, progress counters, blocked rows, Pause/Resume/Cancel controls and Book Library navigation.
- [ ] **Step 3: Run focused tests and confirm failures.**
- [ ] **Step 4: Implement server actions** with existing authenticated Supabase server client and repository/planner.
- [ ] **Step 5: Implement Production page/client** with polling/revalidation only for status; starting a run persists work and returns immediately.
- [ ] **Step 6: Implement Book Library page** showing only released/QA-passed books as ready, while blocked/draft records remain visually distinct to authorized users.
- [ ] **Step 7: Run focused tests GREEN.**
- [ ] **Step 8: Commit** `feat: add PAK publishing production console`.

### Task 7: Pilot Controls, Worker Kick/Scheduling and End-to-End Smoke

**Files:**
- Create: `tests/vitest/publishing-production/production-runner.e2e.test.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json` only if a deterministic production-runner smoke script is needed.
- Modify deployment/scheduler configuration only where the repository already keeps Supabase function schedule metadata.

**Interfaces:**
- Deterministic fake-provider production smoke creates one run, processes one D01 job, persists QA-passed publication, and finishes run terminally.
- Real pilot remains gated to explicit authenticated production invocation; CI must never spend real OpenAI credits.

- [ ] **Step 1: Write RED end-to-end test** that simulates start → claim → generate/compile → publish → run completion and verifies restart resume, one blocked sibling not stopping a passing book, and attempt ceiling 3.
- [ ] **Step 2: Run focused test and confirm failure until all production pieces are wired.**
- [ ] **Step 3: Wire scheduled/kick execution** using the project’s Supabase deployment conventions; ensure paused/cancelled runs are respected.
- [ ] **Step 4: Add CI step `Publishing production runner smoke`** using fake provider only.
- [ ] **Step 5: Run exact-head verification:**
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test:run`
  - `npm run publishing:knowledge-validate`
  - `npm run publishing:knowledge-list`
  - existing manuscript-factory smoke
  - new production-runner smoke
  - `npm run publishing:qa-fixture`
  - `npm run build`
  - `npm run test:e2e`
- [ ] **Step 6: Verify GitHub Actions exact head is green.**
- [ ] **Step 7: Open stacked PR** with base `feat/pak-publishing-manuscript-workers`, leave unmerged for review, and document that real D01 pilot execution requires authenticated deployment + connected OpenAI integration.
- [ ] **Step 8: Commit** `ci: gate PAK publishing production runner`.

## Acceptance Checklist

- [ ] Authenticated run creation persists durable work and returns before generation completes.
- [ ] Default concurrency 4; allowed range 1..32.
- [ ] Durable leases recover abandoned jobs.
- [ ] Chapter/book checkpoints resume rather than restarting completed work.
- [ ] Attempt count stops at 3; terminal blocked jobs do not loop.
- [ ] One blocked book does not stop unrelated books.
- [ ] Architecture-pending programmes are excluded.
- [ ] Browser never receives OpenAI/service-role credentials.
- [ ] Background worker resolves provider secret server-side.
- [ ] QA-passed artifacts publish into organization-isolated Book Library.
- [ ] Failed-QA books are not released.
- [ ] Pause/resume/cancel work from admin UI.
- [ ] Exact-head full CI is green.
