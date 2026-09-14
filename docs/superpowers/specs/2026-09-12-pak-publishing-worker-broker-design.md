# PAK Publishing Worker Broker Design

Date: 2026-09-12
Branch: `feat/pak-publishing-worker-broker`
Parent: `feat/pak-publishing-production-runner`

## Problem

The publishing runner currently requires `SUPABASE_SERVICE_ROLE_KEY` inside the Vercel worker runtime. The live preview therefore returns `503 WORKER_NOT_CONFIGURED` when that privileged key is unavailable. This places a high-value database credential in the wrong trust boundary and prevents the D01-101 real-provider pilot from running.

## Goal

Remove the Supabase service-role dependency from the Vercel publishing worker while preserving the existing durable queue, checkpoint resume, three-failure ceiling, QA release gate, private `publishing-books` storage and Book Library persistence.

## Trust Boundary

- Supabase Edge Functions may use `SUPABASE_SERVICE_ROLE_KEY`; Vercel worker code must not.
- The existing publishing worker dispatch credential remains generated and stored in Supabase Vault as `pak/publishing/worker-dispatch`.
- A worker invocation carries that dedicated credential in its bearer header. Vercel treats it as an opaque capability for that invocation and does not persist it.
- Calls from Vercel to Supabase Edge Functions use the public anon key for the Edge gateway plus the dedicated worker credential in `x-publishing-worker-secret`.
- The browser never receives the worker credential, service-role key, OpenAI API key or signed storage tokens.

## Architecture

### 1. `publishing-worker-broker` Supabase Edge Function

A new Edge Function becomes the only privileged broker for background publishing operations. It authenticates `x-publishing-worker-secret` against the Vault-backed dispatch secret and exposes a strict action allow-list:

- `authorize`
- `claimJobs`
- `yieldJob`
- `completeJob`
- `failJob`
- `listCheckpointFiles`
- `createCheckpointDownload`
- `createStorageUpload`
- `upsertPublication`

The broker uses a service-role Supabase client internally. It never returns the service-role key or Vault secret.

Queue actions call only the existing publishing RPCs. Storage actions operate only in the private `publishing-books` bucket and validate every path against the canonical job prefix derived from the referenced production job. Publication upserts validate the active job lease, organization, production run, book identity, edition and revision before persisting.

### 2. Vercel broker client

`src/modules/publishing-production/worker-broker-client.ts` encapsulates all broker HTTP calls. It receives the opaque worker credential from the current invocation and has no service-role dependency.

The client uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` only. Errors are converted to bounded publishing-worker errors without leaking credentials or response bodies containing secrets.

### 3. Worker route authentication

`/api/internal/publishing-worker` no longer resolves a worker secret through a service-role RPC. It extracts the bearer credential from the incoming request and asks the broker to authorize it before any work is claimed.

Missing or rejected credentials return `401`. Broker infrastructure failure returns `503`. Valid requests continue to enforce concurrency 1–32 and forbidden credential-like payload fields.

Self-chaining reuses only the opaque credential from the current invocation.

### 4. Worker runtime

`node-worker-runtime.ts` replaces the direct service-role Supabase client with the broker client.

- Queue lifecycle operations go through broker actions.
- Checkpoint listing/download/upload goes through broker-issued signed storage access.
- Real manuscript generation continues through the existing secured `generate-content` Edge Function, using the same opaque worker credential.
- Publication artifact upload uses broker-issued signed upload access.
- Book Library registration uses `upsertPublication` through the broker.

No browser-visible or Vercel-persisted service-role credential is introduced.

### 5. Foreground enqueue and recovery

Authenticated users continue creating runs/jobs through existing RLS-protected server actions. Immediate worker execution is no longer allowed to depend on reading the Vault secret from Vercel.

Durable dispatch remains the Supabase `pg_cron` + `pg_net` recovery mechanism. It reads the worker dispatch credential from Vault and sends it to the worker endpoint. Protected previews may additionally require Vercel automation-bypass configuration; public production deployment does not change this broker design.

## Security invariants

1. Vercel source/runtime must not require `SUPABASE_SERVICE_ROLE_KEY` for publishing execution.
2. Broker action names are explicit; no arbitrary table query, arbitrary RPC name or arbitrary storage bucket is accepted.
3. Storage paths are derived from and checked against the production job identity.
4. Publication registration requires an active matching worker lease and `QA_PASSED` compiler output remains the application-level release gate.
5. Worker credential values are never logged or returned in JSON.
6. Max three genuine failures remains unchanged.
7. Normal checkpoint yield/resume does not consume failure budget.
8. Full portfolio production remains blocked until D01-101 passes real-provider QA.

## D01-101 activation sequence

1. Deploy `publishing-worker-broker` with JWT verification enabled.
2. Deploy the updated Vercel publishing runner.
3. Verify unauthenticated worker requests return `401`, not `503 WORKER_NOT_CONFIGURED`.
4. Verify the trusted dispatch path can authorize and claim zero jobs safely.
5. Install/verify durable recovery dispatch against a reachable worker URL.
6. Enqueue only `D01-101`.
7. Verify chapter checkpoints, manuscript, A4 searchable PDF, QA report, release manifest and Book Library row.
8. Inspect the actual textbook against the PAK academic quality standard before authorizing the remaining D01 books.

## Non-goals

- No change to PAK curriculum content or D01 subject architecture.
- No change to the three-attempt failure policy.
- No full portfolio enqueue.
- No Lovable changes.
- No weakening of RLS, Vault or Vercel deployment protection.
