# PAK Publishing Production Runner — Runtime Amendment Plan

> This plan supersedes Task 4 runtime details and the `attempt_count` wording in Task 1/7 of `2026-09-12-pak-publishing-production-runner.md`. Tasks 1–3 already implemented on the feature branch remain valid except where explicitly amended below.

## Amendment A — Queue counters and successful yield

**Files**
- Modify `supabase/migrations/202609120001_publishing_production_runner.sql`
- Modify `tests/vitest/publishing-production/production-schema-security.test.ts`
- Modify `src/modules/publishing-production/domain.ts`
- Modify `src/modules/publishing-production/repository.ts`
- Modify `tests/vitest/publishing-production/repository.test.ts`

**Contract**
- replace `attempt_count` with `claim_count` + `failure_attempts`
- replace `max_attempts` with immutable `max_failure_attempts = 3`
- claim increments only `claim_count`
- add `current_stage`
- add `yield_publishing_job(job, worker, checkpoint, stage)` which returns RUNNING → QUEUED without increasing failures
- fail increments `failure_attempts` and blocks exactly at failure 3

## Amendment B — Bounded existing compiler

**Files**
- Modify `src/modules/publishing-factory/book-compiler.ts`
- Modify `tests/vitest/publishing-factory/book-compiler.test.ts`

**Contract**
- optional `maxNewChapters` keeps existing complete-book behavior when omitted
- bounded production calls generate at most the requested number of new chapters
- incomplete calls persist chapter/stage checkpoints and return `incomplete: true` plus next chapter identity
- resumed later call reuses completed chapters

## Amendment C — Vercel Node worker instead of Edge compiler

**Files**
- Create `src/modules/publishing-production/node-worker.ts`
- Create `src/app/api/internal/publishing-worker/route.ts`
- Create `tests/vitest/publishing-production/node-worker.test.ts`
- Create `tests/vitest/publishing-production/node-worker-route.test.ts`
- Add provider/broker adapters only behind server-side interfaces

**Contract**
- route runtime is Node.js and protected by `CRON_SECRET`/internal bearer secret
- default batch concurrency 4, hard range 1..32
- one bounded unit per claimed job per invocation
- success-with-more-work calls yield, not fail
- actual failure calls fail RPC
- QA-passed result proceeds to durable publication
- route never accepts provider credentials/API keys in request payload
- no unbounded polling/while-loop

## Amendment D — Provider and privileged broker boundary

Supabase Edge/Vault remains the organization-scoped OpenAI credential boundary. The Node worker calls injected server-only generation/storage/queue adapters and never receives a raw provider key from the browser. Tests must prove request bodies reject credential-like fields and worker-facing result types do not expose secrets.

## Amendment E — Final runner completion

Continue original Tasks 5–7 after the Node worker is green:
- durable artifact publisher + Book Library
- authenticated production actions/UI
- cron/kick configuration
- deterministic fake-provider start → claim → bounded generate/resume → QA → publish smoke
- exact-head typecheck/lint/all tests/knowledge gates/manuscript smoke/production smoke/PDF QA/build/E2E
- stacked PR against `feat/pak-publishing-manuscript-workers`

The real D01 pilot remains a deployment operation after code/CI completion because it requires the deployed Supabase migration, worker route, cron/internal secrets, Storage policies and connected organization OpenAI Vault credential.
