# PAK Publishing Autonomous Portfolio — Design Amendment

Date: 2026-09-14
Status: Approved by owner in chat
Parent: `docs/superpowers/specs/2026-09-12-pak-publishing-production-runner-design.md`

## Goal

After the real-provider pilot is QA-passed and the automation gate is enabled, the publishing system must automatically keep all eligible unreleased governed books queued and progressing without requiring a human to press Start Production. Production concurrency is fixed at 4 for the current rollout.

## Architecture

Supabase remains the durable privileged execution plane. Vercel keeps only the opaque publishing-worker capability and never receives a Supabase service-role key. A tenant-scoped automation setting enables portfolio bootstrap after pilot approval. The trusted `publishing-worker-broker` validates the worker capability, reads enabled automation settings, and creates an idempotent PORTFOLIO production run from governed job payloads supplied by the repository runtime. Repeated cron invocations cannot duplicate a run or publication.

The worker runtime uses the existing academic registry, curriculum loader, `planProductionRun`, checkpoint semantics, renderer, deterministic QA, artifact publisher, and Book Library. Existing released identities remain excluded.

## Safety Gates

- Automation is disabled by default.
- Current rollout concurrency is exactly 4.
- Portfolio auto-bootstrap is allowed only when `pilot_approved_at` is non-null.
- Architecture-pending programmes remain excluded.
- Existing released book identities are excluded.
- At most one active automatic portfolio run exists per organization/revision key.
- No browser session is required after enablement.
- No service-role credential enters Vercel.
- BLOCKED books do not stop unrelated books.
- Retry ceiling remains 3 genuine failures per job.

## Runtime Flow

`pg_cron → Vercel publishing worker → broker authorize → discover enabled/pilot-approved automation → plan governed PORTFOLIO → broker idempotent bootstrap/enqueue → claim up to 4 jobs → checkpointed generation → PDF/QA → Book Library → repeat until queue empty`

The recovery dispatcher remains the durable wake-up mechanism. After one auto run reaches a terminal state, a later tick may create another deterministic portfolio run only if new eligible unreleased revisions have appeared.

## Data

Add `publishing_automation_settings` keyed by `organization_id`:

- `enabled boolean default false`
- `concurrency integer`, constrained to 4 for this rollout
- `pilot_approved_at timestamptz null`
- `enabled_by uuid null`
- timestamps

Add service-role-only broker/RPC support for idempotent automatic run bootstrap. The idempotency key must include edition/revision plus a deterministic hash/identity of the planned governed book set so retries cannot duplicate a run.

## Acceptance

1. With automation disabled, no run is auto-created.
2. With automation enabled but pilot not approved, no portfolio run is auto-created.
3. With automation enabled and pilot approved, an idle tick creates exactly one governed PORTFOLIO run with concurrency 4.
4. Repeated ticks do not duplicate the active run or jobs.
5. After publications exist, already released identities are not re-enqueued.
6. Four jobs may execute concurrently.
7. Browser closure has no effect on progress.
8. Exact-head CI is green before rollout.
