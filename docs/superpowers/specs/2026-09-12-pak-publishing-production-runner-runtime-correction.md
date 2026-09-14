# PAK Publishing Production Runner — Approved Runtime Correction

Date: 2026-09-12  
Status: Approved by product owner and implemented as the runtime authority for the production runner  
Supersedes: the Edge-worker execution details in `2026-09-12-pak-publishing-production-runner-design.md` and the corresponding Task 4 wording in the implementation plan. All other governance, authorization, QA, storage and release requirements remain in force.

## Why the correction is required

The existing governed book compiler uses Node.js filesystem APIs and Playwright/Chromium for print rendering and PDF QA. A Supabase Edge Function runs in a Deno-based Edge runtime and cannot execute that compiler unchanged. Reimplementing the compiler in a second runtime would violate the approved reuse boundary and create divergent publishing behavior.

A complete textbook may also require multiple model calls plus PDF rendering. Treating one claim as one full-book attempt would make ordinary checkpoint resume consume the three-failure budget and would encourage excessively long serverless invocations.

## Authoritative runtime

1. Supabase Postgres is the durable source of truth for production runs, jobs, leases, counters and publication records.
2. Supabase Storage persists organization-scoped checkpoints and released Book Library artifacts.
3. A Vercel Node.js worker route executes the existing Node/Playwright publishing factory.
4. Vercel Cron and authenticated immediate kicks wake the worker. The browser is never the worker and may close after a run is persisted.
5. The worker claims at most the configured concurrency, default 4, and advances each book by a bounded resumable unit. Current manuscript work is bounded to at most one newly generated chapter per claimed invocation before yielding when more work remains.
6. `claim_count` records scheduling/lease activity. It is independent of `failure_attempts`.
7. A successful partial checkpoint yields the job back to `QUEUED` without consuming a failure.
8. Only an actual failed processing attempt increments `failure_attempts`. The hard terminal ceiling remains exactly 3, after which the job becomes `BLOCKED` and is not automatically re-enqueued.
9. Supabase `generate-content` remains the secure provider boundary. The Node worker never reads the OpenAI API key directly; it authenticates an internal production-job request, and the Edge function validates the running job/run before resolving the organization-scoped Vault secret.
10. Interactive and background provider quotas remain bounded but use separate limits so four-worker background production cannot accidentally inherit the much smaller interactive request allowance.
11. Final PDF rendering, deterministic QA and Book Library publication occur through the existing authoritative compiler/release gates. A generated artifact is not released unless QA passes.

## Security boundary

- Service-role credentials are server-only in the Node worker runtime and Supabase Edge internals; they never enter the browser bundle.
- OpenAI credentials remain in the Integration Vault and are never returned to the Node worker or browser.
- Worker endpoint access requires the configured worker/cron secret.
- Internal provider requests are tied to a concrete `productionJobId` and `organizationId`; the job must be RUNNING and its parent run active.
- Authenticated run creation and enqueue remain protected by organization-scoped RLS. EDITOR cannot create or control PORTFOLIO scope.

## Resume semantics

A normal sequence may be:

`claim → generate chapter → persist checkpoint → yield → later claim → next chapter → ... → compile → PDF/QA → publish`

This sequence may contain many claims but consumes zero failure attempts unless a processing unit actually fails. Expired leases are reclaimable. Completed/released jobs and BLOCKED jobs are not automatically reclaimed.

## Acceptance impact

The original acceptance criteria remain unchanged. The correction strengthens them by ensuring the actual deployed runtime can reuse the existing compiler, survives browser/process restarts, avoids false retry exhaustion, and preserves the hard three-failure loop-prevention rule.
