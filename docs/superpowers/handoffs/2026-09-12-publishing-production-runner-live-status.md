# PAK Publishing Production Runner — Live Activation Status

Date: 2026-09-12
Branch: `feat/pak-publishing-production-runner`
PR: #38

## Verified code state

- Exact-head GitHub CI was green before the latest documentation/config-only correction.
- Publishing production runner smoke is green.
- Manuscript factory smoke is green.
- Build and E2E are green.
- Supabase production-runner schema/RLS migrations are live.
- Supabase `generate-content` v3 is live with JWT verification enabled.
- Publishing worker dispatch credential is generated inside Supabase Vault.
- Dispatch-secret read RPC is service-role only.
- Recovery scheduling is designed to use Supabase `pg_cron` + `pg_net` rather than Vercel Hobby cron.

## Current live runtime finding

The latest feature-branch deployment is buildable and the stable branch alias reaches the application worker route, but an unauthenticated request currently returns:

`503 {"error":"WORKER_NOT_CONFIGURED"}`

Root cause: the approved Vercel Node worker runtime requires `SUPABASE_SERVICE_ROLE_KEY` server-side for privileged production queue RPCs, private `publishing-books` Storage checkpoint/publication operations, and reading the Vault-backed dispatch credential when no explicit worker secret env var is configured. The current `.env.example` previously omitted this required server-only runtime variable; that documentation drift has now been corrected.

This is a runtime configuration gate, not a build-rate-limit or application-code failure.

## Required runtime configuration

Configure `SUPABASE_SERVICE_ROLE_KEY` only in the trusted Vercel server runtime for the relevant Preview/Production environments. Never expose it through `NEXT_PUBLIC_*`, browser code, logs, or client payloads.

After configuration and redeployment, verify:

1. `/api/internal/publishing-worker` no longer returns `WORKER_NOT_CONFIGURED`.
2. Unauthenticated requests reach the app route and return `401 UNAUTHORIZED`.
3. Vault-backed authorized worker invocation succeeds.
4. Install the Supabase minute-level recovery dispatcher against the stable feature-branch alias (or final production URL after promotion).
5. Enqueue only the D01-101 real-provider pilot.
6. Verify manuscript, PDF, QA report, release manifest and Book Library persistence.
7. Continue D01 only after the pilot passes all defined QA gates.

## Guardrails

- Do not treat generated as released.
- Do not start the full portfolio before the D01-101 pilot is QA-passed.
- Max three genuine failures per job before BLOCKED.
- Normal checkpoint resume does not consume failure budget.
- Do not expose Vault credentials or Supabase service-role credentials to browser code, repository secrets-in-plaintext, or deployment logs.
