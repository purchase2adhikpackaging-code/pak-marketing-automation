# PAK Publishing Production Runner — Live Activation Status

Date: 2026-09-13
Branch: `feat/pak-publishing-production-runner`
PR: #38

## Verified code state

- Secure publishing-worker broker from PR #41 is merged into the production-runner branch.
- Active Vercel publishing code no longer requires or resolves `SUPABASE_SERVICE_ROLE_KEY`.
- Privileged queue, checkpoint/storage and publication operations are brokered through the trusted Supabase `publishing-worker-broker` Edge Function.
- Publishing production runner smoke, manuscript factory smoke, deterministic QA, build and E2E have passed on the secure broker branch; fresh integrated-head CI is also running on PR #38.
- Supabase production-runner schema/RLS migrations are live.
- Supabase `generate-content` and `publishing-worker-broker` Edge Functions are live with JWT verification enabled.
- Publishing worker dispatch credential exists only inside Supabase Vault.
- Authenticated `publishing_worker_recovery_ready()` is live and exposes only boolean recovery readiness.
- OpenAI integration is CONFIGURED and Vault-backed.
- Recovery scheduling uses Supabase `pg_cron` + `pg_net`, not Vercel Hobby cron.

## Live runtime verification

A READY secure-broker preview at commit `55d86280065da8b62da7a2ebe6c7995f4bf9e703` reaches the application worker route. An unauthenticated request returns:

`401 {"error":"UNAUTHORIZED"}`

This confirms the old `503 WORKER_NOT_CONFIGURED` behavior is removed from the secure runtime.

A one-shot request from Supabase `pg_net` using the Vault-backed worker dispatch credential currently receives Vercel's deployment-protection 401 before it reaches the application. Therefore the remaining runtime gate is Vercel Deployment Protection automation access, not worker authentication or Supabase credentials.

The `pak-marketing-automation` project also currently reports a Vercel Hobby build-rate-limit for a fresh deployment of the integrated PR #38 head. The READY secure-broker preview is runtime-equivalent for publishing code; the additional integrated changes before the secure merge were documentation/configuration-only.

## Current fail-closed live state

- recovery readiness: false
- recovery cron jobs: 0
- production runs: 0
- production jobs: 0
- publications: 0
- D01-101 existing publications: 0

No pilot or portfolio production has been launched accidentally.

## Remaining external gate

Create/enable Vercel **Protection Bypass for Automation** for the `pak-marketing-automation` project, then store that secret only in Supabase Vault under:

`pak/publishing/vercel-automation-bypass`

The recovery dispatcher already knows how to send this value in the `x-vercel-protection-bypass` header. Do not disable Vercel Deployment Protection and do not commit or expose the bypass secret in application code, logs, browser payloads or chat.

## Activation sequence after automation bypass is available

1. Verify a Supabase one-shot authorized request reaches `/api/internal/publishing-worker` through Vercel protection and succeeds with zero work claimed.
2. Install the minute-level recovery dispatcher against the immutable verified secure worker URL.
3. Verify `publishing_worker_recovery_ready()` returns true and cron reaches the worker.
4. Enqueue only D01-101 (`PAK-D01-S1-D01-101-TEXTBOOK`, edition `2026`, revision `0.1.0`) with concurrency 1 using governed planner/curriculum data.
5. Monitor real-provider blueprint and chapter checkpoints until completion or BLOCKED.
6. Verify manuscript, searchable A4 PDF, content/layout/PDF QA, QA report, release manifest, provider/model + knowledge hashes and Book Library persistence.
7. Perform manual owner-quality review against a real railway-college textbook standard.
8. Continue the remaining D01 books only after D01-101 passes every gate.

## Guardrails

- Do not treat generated as released.
- Do not start the full D01 portfolio before D01-101 is QA-passed and manually reviewed.
- Max three genuine failures per job before BLOCKED.
- Normal checkpoint resume does not consume failure budget.
- Do not expose Vault, OpenAI, worker-dispatch or Vercel bypass credentials to browser code, repository plaintext, deployment logs or chat.
- Do not touch Lovable.
