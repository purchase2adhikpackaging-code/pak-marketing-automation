# PAK Publishing Production Runner — Design Specification

Date: 2026-09-12
Status: Approved architecture, ready for implementation planning
Base branch: `feat/pak-publishing-manuscript-workers`
Successor branch: `feat/pak-publishing-production-runner`

## 1. Purpose

Connect the already-implemented PAK manuscript factory to a real authenticated production execution surface so administrators can launch, pause/resume, monitor, and retrieve automatically generated textbooks without depending on a developer terminal or a long-lived chat session.

The production runner must reuse the existing governed publishing stack rather than create a second generation system.

Existing reusable capabilities include:

- governed BookJob identities
- curriculum parsing and book enumeration
- canonical railway knowledge packs and source provenance
- blueprint generation
- structured chapter/manuscript generation
- SHA-256 checkpoints
- resumable durable worker queue
- default four-worker concurrency
- maximum three attempts per queue job
- HTML/PDF compiler
- deterministic content/layout/PDF QA
- release manifest semantics

## 2. Primary User Flow

An authorized PAK administrator opens Publishing → Production, selects a scope, and starts production.

Supported initial scopes:

1. one subject
2. one programme
3. pilot batch
4. full approved portfolio

The system converts the scope into stable governed BookJobs, persists them in a production run, and processes them through the existing manuscript factory.

High-level flow:

`Admin Start → Production Run → Book Jobs → Durable Queue → 4 Workers → Writer/Compiler → Checkpoints → PDF/QA → Book Library`

## 3. Non-Goals

This subsystem will not:

- replace the existing manuscript compiler
- store raw OpenAI API keys in the web app, Vercel, GitHub Actions, or browser
- bypass canonical knowledge packs or source provenance
- silently regenerate already released books
- retry indefinitely
- allow anonymous or unauthenticated production execution
- mark a book as released merely because a PDF file exists

## 4. Authentication and Authorization Boundary

Production execution must run under an authenticated PAK organization context.

The existing production OpenAI boundary remains authoritative:

- user is authenticated through Supabase
- organization membership is checked server-side
- allowed roles are enforced
- `generate-content` resolves the configured OpenAI connection and Vault secret server-side
- the browser never receives the provider API key

Initial production-runner authorization:

- OWNER: full production control
- ADMIN: full production control
- EDITOR: may run subject/programme pilots but cannot launch a full portfolio unless explicitly permitted by existing role policy
- other roles: read-only or denied

All mutation endpoints must verify organization membership and role before changing queue/run state.

## 5. Production Run Model

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

Alternative terminal states:

- `COMPLETED_WITH_BLOCKED`
- `CANCELLED`
- `FAILED`

A run is complete only when every included book job is terminal.

## 6. Book Production Job Model

Each production-book row maps one-to-one to the existing stable BookJob identity.

Identity key:

`bookId + edition + revision`

Required persisted execution fields:

- `production_run_id`
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
- `checkpoint_root`
- `qa_status`
- `pdf_artifact_path`
- `manifest_artifact_path`

The same governed book identity must not be duplicated inside one run.

Released book identities must not be regenerated unless a new revision/edition is explicitly created.

## 7. Worker Concurrency and Leasing

Default production concurrency is 4.

Configuration remains adjustable without code changes, clamped to `1..32`.

Each worker:

1. atomically claims one eligible job
2. sets lease owner and expiry
3. compiles/resumes the book
4. refreshes heartbeat while active
5. completes or fails the job
6. claims the next eligible job
7. becomes idle when none remain

Expired leases are reclaimable.

Completed/released jobs are never reclaimable.

A worker crash must not strand a book indefinitely.

## 8. Resume Semantics

Resume is checkpoint-based, not chat-session-based and not process-memory-based.

Persisted checkpoints already support:

- governed blueprint
- chapter manuscripts
- completed manuscript
- stage marker
- content hashes

On restart:

- completed chapters are validated and reused
- generation resumes from the first incomplete governed chapter
- identical repeated saves remain idempotent
- conflicting completed content fails closed
- corrupt checkpoint data blocks the affected job rather than silently restarting from chapter 1

A server restart therefore must continue from durable state rather than resetting the portfolio.

## 9. Retry and Loop Prevention

Infinite loops are prohibited.

Queue-job maximum attempts: 3.

Within a book, existing automatic repair logic is also bounded by its current three-attempt defect policy.

After the final unsuccessful attempt:

- job transitions to `BLOCKED`
- failure reason is persisted
- run continues processing unrelated books
- blocked jobs remain visible for manual review

No automatic scheduler may re-enqueue terminal blocked jobs without an explicit operator action.

## 10. Pause, Resume, and Cancel

### Pause

Pause stops new job claims. Running workers may finish their current atomic stage and persist checkpoints.

Run state becomes `PAUSED`.

### Resume

Resume re-enables claims and picks up from persisted queue/checkpoints.

### Cancel

Cancel prevents new claims and marks queued work cancelled after active workers reach a safe checkpoint boundary.

Cancellation must not delete completed artifacts or checkpoints.

## 11. Pilot-to-Portfolio Release Strategy

Production rollout must be staged.

Stage 1 — Real-provider pilot:

- generate 2–3 D01 books
- use real authenticated OpenAI provider
- inspect academic quality, provenance, PDF appearance, QA findings, checkpoint/resume behavior

Stage 2 — D01 programme:

- release remaining D01 jobs through the same runner
- verify no duplicate publications, runaway retries, or queue starvation

Stage 3 — governed portfolio:

- release all architecture-approved programmes
- programmes whose academic architecture is not frozen remain `ARCHITECTURE_REQUIRED` and are not silently invented

A full “641 remaining books” launch may only include jobs that can be deterministically enumerated from approved curriculum architecture.

## 12. Book Library

Every QA-passed book must appear in a persistent Book Library.

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
- status
- blocked reason when applicable

Only QA-passed publications may be labelled ready for academic use.

Blocked and draft artifacts remain available to authorized staff but must not appear as released textbooks.

## 13. Artifact Storage

Production artifacts must use deterministic paths and durable storage.

Logical layout:

`publishing/{organization}/{programme}/{academic-period}/{subject}/{edition}/{revision}/`

Artifacts:

- `textbook.pdf`
- `manuscript.html`
- `manuscript.json`
- `blueprint.json`
- `qa-report.json`
- `release-manifest.json`
- checkpoint files

Storage implementation should follow the repository’s existing Supabase/storage conventions and organization isolation policies.

No artifact path supplied by a user may be trusted directly; paths must be generated from governed identifiers.

## 14. Production UI

Add a Publishing Production screen for authorized administrators.

Minimum UI:

- scope selector
- programme/subject selector where relevant
- concurrency display/control
- Start Production button
- Pause
- Resume
- Cancel
- run progress summary
- queue table
- blocked-job table
- Book Library link

Summary counters:

- planned
- queued
- running
- QA passed
- blocked
- cancelled
- released

The UI must clearly distinguish generated, QA-passed, blocked, and released states.

## 15. Server Execution Model

The browser must not be the worker.

Starting a run is a short authenticated mutation that persists work.

Long-running generation is executed server-side by production workers that repeatedly claim durable jobs.

The worker mechanism must support restart-safe execution. Suitable implementation mechanisms may include the project’s existing Supabase Edge/runtime patterns plus a scheduled/triggered worker endpoint, provided the implementation preserves leases, authorization, checkpointing, and bounded retries.

The final implementation plan must choose the concrete runtime after checking existing deployment constraints, but must not move provider secrets into the runner.

## 16. OpenAI Provider Boundary

The production runner reuses the existing integration-backed OpenAI provider.

For every real generation request:

1. organization context is known
2. authenticated authorization is verified
3. request is sent through `generate-content`
4. the Edge Function resolves the Vault secret
5. the Edge Function invokes the allowlisted model
6. normalized generated content is returned

No raw API-key flag, environment variable, database plaintext secret, or GitHub secret is introduced for textbook production.

## 17. Curriculum and Architecture Gate

Before enqueueing a job, production validates:

- programme exists in academic registry
- subject/module exists in governed curriculum source
- book identity is stable
- canonical knowledge selection succeeds
- required architecture is available

Programmes marked catalogue-only or architecture-pending may not be auto-expanded by the production runner.

Their jobs remain excluded until curriculum architecture is approved.

## 18. QA and Release Gate

The existing deterministic QA pipeline remains mandatory.

A book cannot become released unless all configured release gates pass, including:

- content QA
- identity consistency
- placeholder/duplicate checks
- internal box containment
- overlap/layout checks
- searchable PDF
- A4 geometry
- required metadata
- provenance/source checks
- safety-critical claim rules

A generated PDF with failed QA is not a finished book.

## 19. Observability

Persist enough structured data to answer:

- which run created this book?
- which worker processed it?
- how many attempts occurred?
- where did it resume?
- what provider/model was used?
- which canonical knowledge hashes grounded it?
- why was it blocked?
- which QA gates passed/failed?

Do not log provider secrets or full authentication tokens.

## 20. Idempotency

Start-production operations must be idempotent for the same requested run identity where practical.

Worker completion must also be idempotent.

Duplicate delivery or repeated UI submission must not create duplicate textbook publications.

## 21. Failure Handling

Failures are isolated per book wherever possible.

Examples:

- provider timeout → bounded retry
- invalid model response → bounded chapter retry
- PDF QA defect → bounded repair path
- corrupt checkpoint → block affected job
- expired worker → lease reclaim
- one blocked book → unrelated books continue

Only systemic failures that prevent safe queue execution should fail the entire run.

## 22. Security Requirements

- organization isolation on every production row and artifact
- authenticated mutation endpoints
- role authorization for start/pause/resume/cancel
- no service-role key exposed to browser
- no OpenAI key exposed to browser/server page runtime
- generated artifact paths sanitized/deterministic
- no cross-organization book access
- audit fields for actor and timestamps

## 23. Testing Strategy

Implementation must follow TDD.

Required automated coverage:

- authorization failures
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
- real provider adapter requires organization/auth context
- deterministic fake-provider end-to-end production-run smoke

Exact-head CI must include typecheck, lint, full tests, production-runner smoke, existing knowledge gates, manuscript-factory smoke, PDF QA, build and E2E.

## 24. Acceptance Criteria

The Production Runner is accepted only when all of the following are true:

1. An authorized admin can start a governed production run from the application.
2. The start request persists work and does not depend on the browser remaining open.
3. Four workers operate concurrently by default.
4. Worker crashes/restarts recover through durable leases and checkpoints.
5. Completed chapters/books are not regenerated unnecessarily.
6. Duplicate delivery cannot create duplicate textbook publications.
7. Retries are bounded and cannot create an infinite loop.
8. Blocked books do not stop unrelated books.
9. A real OpenAI request remains behind the existing authenticated Integration Vault boundary.
10. QA-passed PDFs and their supporting artifacts appear in Book Library.
11. Failed-QA/blocked books are visibly distinct and cannot be released as finished textbooks.
12. Pilot D01 books can be produced end-to-end before a portfolio release.
13. Architecture-pending programmes are excluded rather than silently invented.
14. Exact-head full CI is green before the production-runner branch is called complete.

## 25. Implementation Boundary

This design covers the execution and retrieval layer only.

It does not redesign the already-green manuscript factory. Implementation should be additive and should call the existing blueprint, writer, checkpoint, queue, compiler, renderer, QA, and manifest modules through stable interfaces wherever possible.
