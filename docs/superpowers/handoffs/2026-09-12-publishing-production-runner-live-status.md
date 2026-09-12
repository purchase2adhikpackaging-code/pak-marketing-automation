# PAK Publishing Production Runner — Live Activation Status

Date: 2026-09-12
Branch: `feat/pak-publishing-production-runner`
PR: #38

## Verified code state

- Exact-head GitHub CI is green.
- Publishing production runner smoke is green.
- Manuscript factory smoke is green.
- Build and E2E are green.
- Supabase production-runner schema/RLS migrations are live.
- Supabase `generate-content` v3 is live with JWT verification enabled.
- Publishing worker dispatch credential is generated inside Supabase Vault.
- Dispatch-secret read RPC is service-role only.
- Manual Vercel worker-secret configuration is no longer required.
- Recovery scheduling is designed to use Supabase `pg_cron` + `pg_net` rather than Vercel Hobby cron.

## Activation sequence

1. Deploy this latest branch head to the `pak-marketing-automation` Vercel project.
2. Verify `/api/internal/publishing-worker` rejects unauthenticated requests and accepts the Vault-backed server path.
3. Install the Supabase minute-level recovery dispatcher against the READY Vercel preview/production worker URL.
4. Enqueue only the D01-101 real-provider pilot.
5. Verify manuscript, PDF, QA report, release manifest and Book Library persistence.
6. Continue D01 only after the pilot passes all defined QA gates.

## Guardrails

- Do not treat generated as released.
- Do not start the full portfolio before the D01-101 pilot is QA-passed.
- Max three genuine failures per job before BLOCKED.
- Normal checkpoint resume does not consume failure budget.
- Do not expose Vault credentials to browser code, repository files or deployment logs.
