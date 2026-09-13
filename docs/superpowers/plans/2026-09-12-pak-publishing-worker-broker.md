# PAK Publishing Worker Broker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Vercel publishing worker dependence on `SUPABASE_SERVICE_ROLE_KEY` by routing privileged queue, checkpoint, storage and Book Library operations through a Vault-authenticated Supabase Edge broker, then unblock the D01-101 pilot.

**Architecture:** A new `publishing-worker-broker` Edge Function owns privileged Supabase access and accepts only an explicit worker action allow-list after validating the existing Vault dispatch credential. The Vercel worker receives that credential only on the current invocation, uses a small broker client for queue/storage/publication operations, and continues to use `generate-content` for OpenAI text generation.

**Tech Stack:** Next.js 15, TypeScript, Vitest, Supabase Edge Functions/Deno, Supabase Storage, Postgres RPC/Vault, Vercel Node Functions.

**Spec:** `docs/superpowers/specs/2026-09-12-pak-publishing-worker-broker-design.md`

## Global Constraints

- Vercel publishing execution must not require `SUPABASE_SERVICE_ROLE_KEY`.
- The browser must never receive service-role, Vault, OpenAI or publishing-worker credentials.
- Existing 1–32 concurrency, max-three-failure and checkpoint-yield semantics remain unchanged.
- Broker operations must be allow-listed; no generic arbitrary database or storage proxy.
- Only D01-101 may be enqueued before real-provider QA passes.
- Do not touch Lovable.

---

### Task 1: Broker contract and worker-route authentication

**Files:**
- Create: `src/modules/publishing-production/worker-broker-client.ts`
- Modify: `src/modules/publishing-production/node-worker-route.ts`
- Test: `tests/vitest/publishing-production/worker-broker-client.test.ts`
- Test: `tests/vitest/publishing-production/node-worker-route.test.ts`

**Interfaces:**
- Produces `createPublishingWorkerBrokerClient({ credential, fetchImpl? })`.
- Broker client exposes `authorize()` plus queue/storage/publication methods used in later tasks.
- `handlePublishingWorkerRequest` consumes `authorize(credential)` rather than a pre-resolved `secret` value.

- [ ] **Step 1: Write failing broker-client and route-auth tests.**
  Test that the client sends the anon-key Authorization header and `x-publishing-worker-secret`, rejects non-2xx responses without exposing the credential, and that the route returns 401 for missing/rejected credentials and runs only after successful broker authorization.
- [ ] **Step 2: Push the test-only commit and verify GitHub CI fails for the intended missing client/new route contract.**
- [ ] **Step 3: Implement the minimal broker client and route-auth contract.**
- [ ] **Step 4: Verify the focused tests and full CI are green.**
- [ ] **Step 5: Commit the implementation.**

### Task 2: Supabase publishing-worker broker Edge Function

**Files:**
- Create: `supabase/functions/publishing-worker-broker/index.ts`
- Create: `tests/vitest/publishing-production/worker-broker-edge-security.test.ts`

**Interfaces:**
- Accepts POST JSON actions: `authorize`, `claimJobs`, `yieldJob`, `completeJob`, `failJob`, `listCheckpointFiles`, `createCheckpointDownload`, `createStorageUpload`, `upsertPublication`.
- Uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only inside Supabase Edge runtime.
- Validates `x-publishing-worker-secret` against `read_publishing_worker_dispatch_secret()`.

- [ ] **Step 1: Write failing static/security tests proving the Edge Function has an explicit action allow-list, Vault-backed worker auth and no response path that returns the secret.**
- [ ] **Step 2: Verify CI fails before the Edge Function exists.**
- [ ] **Step 3: Implement the Edge Function with strict input validation, canonical job-prefix validation and private-bucket-only storage access.**
- [ ] **Step 4: Verify tests and CI pass.**
- [ ] **Step 5: Commit.**

### Task 3: Refactor Node worker runtime to broker-only privileged access

**Files:**
- Modify: `src/modules/publishing-production/node-worker-runtime.ts`
- Modify: `src/app/api/internal/publishing-worker/route.ts`
- Remove: `src/modules/publishing-production/worker-auth.ts` if no remaining trusted caller needs it.
- Test: `tests/vitest/publishing-production/node-worker.test.ts`
- Test: `tests/vitest/publishing-production/worker-provider-security.test.ts`
- Test: `tests/vitest/publishing-production/worker-dispatch-security.test.ts`

**Interfaces:**
- `runConfiguredPublishingWorker({ workerId, concurrency?, credential })`.
- Checkpoint/publication storage uses broker-created signed access rather than a service-role storage client.
- `internalOpenAITransport(job, credential)` forwards the same opaque credential to `generate-content`.

- [ ] **Step 1: Add failing tests asserting the runtime source no longer requires `SUPABASE_SERVICE_ROLE_KEY` and that the invocation credential flows to broker and generation calls.**
- [ ] **Step 2: Verify intended CI failure.**
- [ ] **Step 3: Replace direct admin Supabase operations with broker-client operations and signed storage access.**
- [ ] **Step 4: Remove obsolete worker-auth code only after all references are gone.**
- [ ] **Step 5: Verify focused tests, typecheck, lint and full CI.**
- [ ] **Step 6: Commit.**

### Task 4: Remove foreground Vault-secret dependency and align recovery dispatch

**Files:**
- Modify: `src/app/(app)/publishing/production/actions.ts`
- Modify: `supabase/migrations/202609120004_publishing_worker_dispatch.sql` only if required by the final broker invocation contract.
- Modify: `supabase/migrations/202609120007_publishing_worker_vercel_automation_bypass.sql` only if required by the final endpoint/header contract.
- Test: `tests/vitest/publishing-production/actions.test.ts`
- Test: `tests/vitest/publishing-production/worker-dispatch-security.test.ts`

**Interfaces:**
- Foreground enqueue persists runs/jobs without reading the worker secret in Vercel.
- Durable dispatch remains Vault-backed Supabase `pg_cron`/`pg_net`.

- [ ] **Step 1: Write failing tests proving production actions do not import or call `resolvePublishingWorkerSecret`.**
- [ ] **Step 2: Verify red CI.**
- [ ] **Step 3: Remove the foreground Vault-read kick dependency and preserve durable recovery behavior.**
- [ ] **Step 4: Verify all production action/dispatch tests and CI.**
- [ ] **Step 5: Commit.**

### Task 5: Live broker deployment and security verification

**Files:**
- No source changes unless live verification exposes a reproducible defect.

**Interfaces:**
- Supabase project: `fwwozehhjarisqxwuzby`.
- Edge Function: `publishing-worker-broker`, JWT verification enabled.

- [ ] **Step 1: Deploy the Edge Function.**
- [ ] **Step 2: Verify unauthenticated/custom-invalid requests fail closed.**
- [ ] **Step 3: Verify Vault secret exists and broker authorization succeeds only through the trusted worker path.**
- [ ] **Step 4: Run Supabase security advisors and confirm no new RLS/ACL regression.**

### Task 6: Vercel deployment verification

**Files:**
- No source changes unless deployment/runtime verification finds a defect.

- [ ] **Step 1: Deploy the exact broker-branch head to Vercel preview.**
- [ ] **Step 2: Confirm `/api/internal/publishing-worker` now returns `401` for an unauthenticated request instead of `503 WORKER_NOT_CONFIGURED`.**
- [ ] **Step 3: Confirm runtime logs contain no service-role/worker-secret leakage.**
- [ ] **Step 4: Verify the reachable durable dispatch path for the deployment target; do not weaken Deployment Protection.**

### Task 7: D01-101 real-provider pilot

**Files:**
- No code changes unless QA exposes a concrete reproducible defect.

- [ ] **Step 1: Confirm production tables contain no competing publishing run/job.**
- [ ] **Step 2: Enqueue exactly one `PILOT`/subject job for `PAK-D01` / `D01-101` with governed concurrency.
- [ ] **Step 3: Observe checkpoint resume until manuscript completion; normal yields must not increase `failure_attempts`.
- [ ] **Step 4: Verify real provider metadata and knowledge-pack hashes.
- [ ] **Step 5: Verify QA-passed A4 searchable PDF, manuscript HTML/JSON, blueprint, QA report and release manifest in `publishing-books`.
- [ ] **Step 6: Verify exactly one RELEASED Book Library row and matching job/run counters.
- [ ] **Step 7: Inspect the actual D01-101 textbook against PAK owner-quality requirements before authorizing any remaining D01 book.

### Task 8: D01 controlled scale-out

- [ ] **Step 1: Only after D01-101 owner-quality acceptance, enqueue the next D01 subjects in a bounded batch starting at concurrency 4.
- [ ] **Step 2: Verify failure isolation, rate limits, checkpoint behavior and Book Library persistence before increasing concurrency.
- [ ] **Step 3: Increase toward 8 only after measured stability; do not jump to portfolio-wide production.
