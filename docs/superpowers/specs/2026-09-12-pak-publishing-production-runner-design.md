# PAK Publishing Production Runner — Design Specification

Date: 2026-09-12
Status: Approved architecture, ready for implementation planning
Base branch: `feat/pak-publishing-manuscript-workers`
Successor branch: `feat/pak-publishing-production-runner`

## 1. Purpose

Connect the already-implemented PAK manuscript factory to a real authenticated production execution surface so administrators can launch, pause/resume, monitor, and retrieve automatically generated textbooks without depending on a developer terminal, browser tab, or long-lived chat session.

The production runner must reuse the existing governed publishing stack rather than create a second generation system.

Existing reusable capabilities include governed BookJob identities, curriculum parsing/book enumeration, canonical railway knowledge packs and source provenance, blueprint generation, structured manuscript generation, SHA-256 checkpoints, resumable worker semantics, default four-worker concurrency, bounded retries, HTML/PDF compilation, deterministic QA, and release-manifest semantics.

## 2. Primary User Flow

An authorized PAK administrator opens Publishing → Production, selects a scope, and starts production.

Supported initial scopes:

1. one subject
2. one programme
3. pilot batch
4. full approved portfolio

The system converts the scope into stable governed BookJobs, persists them in a production run, and processes them through the existing manuscript factory.

High-level flow:

`Admin Start → Production Run → Durable Jobs → Supabase Worker Scheduler → up to 4 concurrent claimed jobs → Writer/Compiler → Checkpoints → PDF/QA → Book Library`

## 3. Non-Goals

This subsystem will not:

- replace the existing manuscript compiler
- store raw OpenAI API keys in the browser, Vercel app environment, GitHub Actions, or client-visible configuration
- bypass canonical knowledge packs or source provenance
- silently regenerate already released books
- retry indefinitely
- allow anonymous or unauthenticated launch/control operations
- mark a book released merely because a PDF file exists
- depend on the browser remaining open while workers run

## 4. Authorization Boundary

Production control starts from an authenticated Supabase user session.

Every start/pause/resume/cancel mutation must verify organization membership and role before persisting the requested transition.

Initial policy:

- OWNER: full production control
- ADMIN: full production control
- EDITOR: subject/programme pilot execution only unless existing organization policy grants broader control
- all other roles: read-only or denied

The authenticated start operation persists `organization_id`, `created_by`, requested scope, and authorization/audit metadata. Background workers do **not** impersonate the browser session and do not require a long-lived user access token.

## 5. Concrete Runtime Architecture

The production runner uses **Supabase as the durable execution plane**.

Concrete components:

1. PostgreSQL production-run and production-job tables.
2. Transaction-safe claim/heartbeat/complete/fail RPCs.
3. A server-side Supabase Edge Function named conceptually `publishing-worker`.
4. A database scheduler/cron trigger plus an explicit authenticated “kick” after a run is started or resumed.
5. Supabase Storage for durable publishing artifacts/checkpoints.
6. Existing Next.js admin UI for launch, monitoring, control, and Book Library access.

The browser is never the worker.

A worker invocation is deliberately bounded. It claims no more than the configured concurrency (default 4) and advances each claimed book through a safe resumable unit of work. If a book still has remaining chapters/stages after the invocation budget, its checkpoint is persisted and the job remains eligible for the next worker invocation.

This avoids dependence on one long-running server process while preserving continuous progress through repeated scheduled/kicked worker invocations.

## 6. Production Run Model

A ProductionRun is the durable container for one launch request.

Minimum fields:

- `id`
- `organization_id`
- `created_by`
- `scope_type` (`SUBJECT`, `PROGRAMME`, `PILOT`, `PORTFOLIO`)
- `scope_value`
- `status`
- `requested_concurrency`
- `created_at`
- `started_at`
- `completed_at`
- `cancel_requested_at`
- summary counters

Run states:

`DRAFT → QUEUED → RUNNING → COMPLETED`

Additional states:

- `PAUSED`
- `COMPLETED_WITH_BLOCKED`
- `CANCELLED`
- `FAILED`

A run is complete only when every included book job is terminal.

## 7. Book Production Job Model

Each production-book row maps one-to-one to the existing stable BookJob identity.

Identity key:

`bookId + edition + revision`

Required persisted execution fields:

- `production_run_id`
- `organization_id`
- `book_id`
- `programme_code`
- `subject_code`
- `edition`
- `revision`
- `status`
- `attempt_count`
- `max_attempts = 3`
- `lease_owner`
- `lease_expires_at`
- `last_error`
- `current_stage`
- `qa_status`
- artifact/checkpoint references

The same governed book identity must not be duplicated inside one run.

Released book identities must not be regenerated unless a new revision/edition is explicitly created.

## 8. Worker Concurrency and Leasing

Default production concurrency is 4 and is configurable without code changes, clamped to `1..32`.

Each worker slot:

1. atomically claims one eligible job
2. sets lease owner and expiry
3. advances that job through one or more safe resumable units within the invocation budget
4. refreshes heartbeat while active
5. persists progress/checkpoints
6. completes, blocks, or returns the job to runnable state

Expired leases are reclaimable.

Completed/released jobs are never reclaimable.

A crashed worker or interrupted Edge invocation must not strand a book indefinitely.

## 9. Resume Semantics

Resume is checkpoint-based, not chat-session-based and not process-memory-based.

Persisted checkpoints support:

- governed blueprint
- chapter manuscripts
- completed manuscript
- stage marker
- content hashes

On restart:

- completed chapters are validated and reused
- generation resumes from the first incomplete governed chapter/stage
- identical repeated saves are idempotent
- conflicting completed content fails closed
- corrupt checkpoint data blocks the affected job rather than silently restarting from chapter 1

## 10. Retry and Loop Prevention

Infinite loops are prohibited.

Queue-job maximum attempts: 3.

Existing chapter/repair behavior remains bounded by the manuscript factory’s current policy.

After the final unsuccessful attempt:

- job transitions to `BLOCKED`
- failure reason is persisted
- unrelated books continue
- the scheduler does not automatically re-enqueue the blocked job

Reactivation of a blocked job requires an explicit authorized operator action and must increment or create a governed revision according to the final implementation plan.

## 11. Pause, Resume, and Cancel

### Pause

Pause prevents new claims. Currently running work reaches a safe checkpoint boundary and releases/persists its lease state.

### Resume

Resume makes eligible jobs runnable again and explicitly kicks the worker in addition to normal scheduled execution.

### Cancel

Cancel prevents new claims and causes queued work to become cancelled after active workers reach a safe checkpoint boundary.

Cancellation never deletes completed artifacts or checkpoints.

## 12. Real OpenAI Generation Boundary

The existing Integration Vault remains the source of provider credentials and configuration, but the background worker does not depend on the browser-only bearer-token call path.

The implementation must extract/reuse the existing server-side provider policy into a shared secure helper so both interactive `generate-content` and background `publishing-worker` enforce the same controls:

- organization-scoped OpenAI connection
- configured/allowlisted model
- Vault-backed provider secret
- normalized provider errors
- quota/cost guardrails
- no plaintext secret persistence outside Vault

The background worker may use the Supabase service role **inside the Edge runtime only** to validate the persisted production run, read authorized organization-scoped configuration, claim jobs, and resolve the Vault secret. The service role is never exposed to the browser or Next.js client bundle.

The worker must verify that the run was created by an authorized organization member and remains active before making a provider request.

## 13. Pilot-to-Portfolio Rollout

Stage 1 — Real-provider pilot:

- generate 2–3 D01 books
- use real Vault-backed OpenAI generation
- inspect academic quality, provenance, PDF appearance, QA findings, and restart behavior

Stage 2 — D01 programme:

- release remaining D01 jobs through the same runner
- verify no duplicate publications, runaway retries, or queue starvation

Stage 3 — governed portfolio:

- release all architecture-approved programmes
- architecture-pending programmes remain excluded

A “641 remaining books” run may only include jobs that can be deterministically enumerated from approved curriculum architecture. The runner must never invent missing programme architecture.

## 14. Book Library

Every QA-passed book is stored in a persistent Book Library.

Logical hierarchy:

`Programme → Academic Period → Subject → Edition/Revision`

Each Book Library item exposes:

- final PDF
- manuscript source
- QA report
- release manifest
- provenance/knowledge-pack hashes
- edition/revision
- generation timestamps
- production-run identity
- status
- blocked reason when applicable

Only QA-passed/released publications may be labelled ready for academic use.

## 15. Artifact Storage

Use organization-scoped Supabase Storage with deterministic paths.

Logical layout:

`publishing/{organization}/{programme}/{academic-period}/{subject}/{edition}/{revision}/`

Artifacts:

- `textbook.pdf`
- `manuscript.html`
- `manuscript.json`
- `blueprint.json`
- `qa-report.json`
- `release-manifest.json`
- checkpoint artifacts

Paths are generated from governed identifiers only. User-supplied arbitrary storage paths are not accepted.

Storage policies must prevent cross-organization access.

## 16. Production UI

Add Publishing → Production for authorized administrators.

Minimum controls:

- scope selector
- programme/subject selector
- concurrency display/control
- Start Production
- Pause
- Resume
- Cancel
- progress summary
- queue/job table
- blocked-job table
- Book Library navigation

Summary counters:

- planned
- queued
- running
- QA passed
- blocked
- cancelled
- released

The UI must clearly distinguish generated, QA-passed, blocked, and released states.

## 17. Curriculum and Architecture Gate

Before enqueueing a job, production validates:

- programme exists in academic registry
- subject/module exists in governed curriculum source
- book identity is stable
- canonical knowledge selection succeeds
- required architecture is approved/available

Catalogue-only or architecture-pending programmes are excluded rather than auto-expanded.

## 18. QA and Release Gate

The existing deterministic QA pipeline remains mandatory.

A publication cannot become released until all configured gates pass, including content QA, identity consistency, placeholder/duplicate checks, internal box containment, overlap/layout checks, searchable PDF, A4 geometry, metadata, provenance/source checks, and safety-critical claim rules.

A generated PDF with failed QA is not a finished book.

## 19. Observability

Persist enough structured data to answer:

- which run created this book?
- who launched the run?
- which worker claimed it?
- how many attempts occurred?
- where did it resume?
- what provider/model was used?
- which knowledge hashes grounded it?
- why was it blocked?
- which QA gates passed/failed?

Provider secrets and authentication tokens must never be logged.

## 20. Idempotency

Start-production operations are idempotent for the same governed launch key.

Worker claim/completion and artifact registration are idempotent.

Duplicate UI submission, scheduler invocation, or message delivery must not create duplicate textbook publications.

## 21. Failure Handling

Failures are isolated per book whenever possible.

Examples:

- provider timeout → bounded retry
- invalid model response → bounded chapter retry
- PDF QA defect → bounded repair path
- corrupt checkpoint → block affected job
- expired worker lease → reclaim
- one blocked book → unrelated books continue
- worker invocation timeout → persisted checkpoint + lease expiry recovery

Only systemic failures that make queue execution unsafe should fail the entire run.

## 22. Security Requirements

- organization isolation on every production row and artifact
- authenticated/authorized control mutations
- RLS for user-facing reads/writes
- service-role use limited to Supabase Edge worker internals
- no service-role key exposed to browser or client bundle
- no OpenAI key exposed outside Vault/Edge runtime
- deterministic sanitized artifact paths
- no cross-organization Book Library access
- audit fields for actor and timestamps

## 23. Testing Strategy

Implementation follows TDD.

Required automated coverage:

- authorization failures
- background worker refuses invalid/inactive/unauthorized run state
- duplicate start/enqueue idempotency
- default four-worker concurrency
- lease expiry/reclaim
- pause/resume
- cancel behavior
- restart from chapter checkpoint
- three-attempt hard ceiling
- one blocked job does not stop other jobs
- Book Library receives QA-passed artifacts
- failed-QA book is not released
- architecture-pending programme is not auto-generated
- worker provider adapter resolves organization-scoped Vault configuration without browser credentials
- deterministic fake-provider end-to-end production-run smoke

Exact-head CI must include typecheck, lint, full tests, production-runner smoke, existing knowledge gates, manuscript-factory smoke, deterministic PDF QA, build, and E2E.

## 24. Acceptance Criteria

The Production Runner is accepted only when all of the following are true:

1. An authorized admin can start a governed production run from the application.
2. Start persists work and does not depend on the browser remaining open.
3. Four worker slots operate concurrently by default.
4. Worker crashes/restarts recover through durable leases and checkpoints.
5. Completed chapters/books are not regenerated unnecessarily.
6. Duplicate delivery cannot create duplicate textbook publications.
7. Retries are bounded and cannot create an infinite loop.
8. Blocked books do not stop unrelated books.
9. Real OpenAI generation resolves credentials only inside the existing Vault-backed Supabase security boundary.
10. QA-passed PDFs and supporting artifacts appear in Book Library.
11. Failed-QA/blocked books are visibly distinct and cannot be released as finished textbooks.
12. Pilot D01 books can be produced end-to-end before portfolio release.
13. Architecture-pending programmes are excluded rather than silently invented.
14. Exact-head full CI is green before the production-runner branch is called complete.

## 25. Implementation Boundary

This design covers only the durable execution/control/retrieval layer and the secure background-provider adapter required for it.

It does not redesign the already-green manuscript factory. Implementation remains additive and reuses existing blueprint, writer, checkpoint, queue semantics, compiler, renderer, QA, knowledge, and manifest modules through stable interfaces wherever possible.
