# PAK Publishing Production Runner — Approved Runtime Amendment

Date: 2026-09-12
Status: Approved
Supersedes: runtime portions of Sections 5, 7, 8, 10, 12 and 22 of `2026-09-12-pak-publishing-production-runner-design.md`

## Why this amendment exists

The governed textbook compiler uses Node filesystem APIs and Playwright/Chromium to render and inspect PDFs. A Supabase Edge Function runs in Deno and cannot execute that existing compiler unchanged. Moving or rewriting the compiler into Edge would violate the approved requirement to reuse the already-green manuscript/compiler/QA stack.

A second correctness issue was identified in the first queue draft: a normal lease claim was counted as an execution attempt. Because textbook production is deliberately checkpointed across multiple bounded invocations, claims and failures must be tracked separately or successful resume cycles would exhaust the three-failure ceiling.

## Corrected execution architecture

- Supabase Postgres remains the durable source of truth for production runs, jobs, leases, counters and publications.
- The existing Node/Playwright textbook compiler executes in a dedicated **Vercel Node production worker route**.
- A Vercel Cron and authenticated internal kick invoke that route. The route is not a browser worker and does not depend on a user session remaining open.
- Default concurrency remains 4, configurable in the existing `1..32` range.
- A claimed book advances only a bounded checkpoint unit in one invocation. Chapter generation is limited per invocation; later invocations resume from persisted checkpoints. Final manuscript/typesetting/PDF/QA/publish stages are also checkpointed.
- Supabase Edge/Vault remains the secure provider boundary for organization-scoped OpenAI generation. The Node worker passes prompts/context, never raw API keys.
- Service-role and OpenAI secrets are not exposed to the browser. Queue/storage privileged operations must remain behind a server-only broker/security boundary; the Node route works through injected server adapters rather than client credentials.

## Claim versus failure semantics

Each production job persists separate counters:

- `claim_count`: increments whenever a worker successfully claims/reclaims a runnable lease. It is observational and does **not** consume retry budget.
- `failure_attempts`: increments only when a bounded unit of work fails.
- `max_failure_attempts = 3`: immutable automatic failure ceiling.

A successful bounded step that has more work remaining yields the job back to `QUEUED`, persists `current_stage` and checkpoint reference, clears the lease, and leaves `failure_attempts` unchanged.

A failed bounded step increments `failure_attempts`; attempts 1–2 return to `QUEUED`, attempt 3 transitions to terminal `BLOCKED`.

Expired leases are reclaimable regardless of `claim_count` while `failure_attempts < 3`.

## Required queue RPC addition

In addition to claim/heartbeat/complete/fail/run-state RPCs, the durable queue provides a `yield_publishing_job` operation for successful checkpoint progress that is not yet terminal. It clears the lease and persists checkpoint/stage data without marking a failure.

## Node worker execution contract

One invocation:

1. authenticates cron/internal invocation;
2. claims at most configured concurrency (default 4);
3. processes each claimed book independently;
4. advances each book by a bounded checkpoint unit;
5. heartbeats around long operations;
6. yields incomplete successful work without incrementing failures;
7. completes only after QA passes and publication succeeds;
8. calls fail only on actual execution/validation failures;
9. never automatically requeues `BLOCKED` jobs;
10. returns after its bounded batch rather than looping forever.

## Compiler compatibility requirement

The manuscript compiler must expose a bounded mode while preserving its existing default behavior. Existing CLI/tests that compile a complete book remain unchanged by default. Production runner mode may cap newly generated chapters per call, return an explicit incomplete/resumable result, and reuse the same checkpoint store on the next invocation.

## Security boundary

This amendment does not relax the original browser-security requirements. No service-role credential or provider API key may enter a client bundle or browser response. Vercel Node worker endpoints require a server-only cron/internal secret. Organization-scoped OpenAI credentials continue to be resolved through the existing Vault-backed server boundary.

## Acceptance additions

The runner is not complete until automated tests prove:

- repeated successful claims/yields do not increase `failure_attempts`;
- a book can be claimed more than three times while making successful checkpoint progress;
- three real failures still cause terminal `BLOCKED`;
- a bounded compiler invocation generates no more than its configured new-chapter budget;
- a later invocation resumes completed chapters instead of regenerating them;
- the Node worker route rejects unauthenticated calls and processes at most four jobs by default;
- exact-head CI remains green.
