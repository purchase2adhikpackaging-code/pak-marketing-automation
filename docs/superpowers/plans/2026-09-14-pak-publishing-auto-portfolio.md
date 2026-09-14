# PAK Publishing Autonomous Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically bootstrap and continuously process eligible unreleased PAK textbooks with four concurrent workers after the pilot approval gate, without a manual Start Production action.

**Architecture:** Supabase stores the tenant automation gate and performs privileged idempotent run/job creation through the existing broker boundary. The Vercel worker remains credential-minimal, plans governed portfolio jobs from repository academic sources, and asks the broker to bootstrap only when automation is enabled and pilot-approved. Existing recovery cron repeatedly wakes the four-worker queue.

**Tech Stack:** Next.js 15, TypeScript, Supabase Postgres/Edge Functions/Storage, Vercel Functions, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-pak-publishing-auto-portfolio-design.md`

## Global Constraints

- Concurrency is 4 for this rollout.
- Automation is disabled by default and requires `pilot_approved_at` before portfolio bootstrap.
- No Supabase service-role key in Vercel or browser code.
- Preserve tenant isolation, RLS, Vault worker capability, retry ceiling, checkpoints, deterministic QA, and release gates.
- Architecture-pending programmes and already released book identities are excluded.

---

### Task 1: Automation Settings and Secure Bootstrap RPC

**Files:**
- Create: `supabase/migrations/202609140004_publishing_auto_portfolio.sql`
- Test: `tests/vitest/publishing-production/auto-portfolio-sql.test.ts`

**Interfaces:**
- Produces: tenant automation settings and service-role-only idempotent bootstrap RPC.

- [ ] Write failing SQL contract tests for default-disabled settings, pilot approval gate, concurrency=4, idempotent run creation, and service-role-only execution.
- [ ] Verify RED.
- [ ] Implement migration/RPC minimally.
- [ ] Verify GREEN and existing production schema tests.
- [ ] Commit.

### Task 2: Broker Automation Boundary

**Files:**
- Modify: `supabase/functions/publishing-worker-broker/index.ts`
- Modify: `src/modules/publishing-production/worker-broker-client.ts`
- Test: `tests/vitest/publishing-production/worker-broker-client.test.ts`
- Test: `tests/vitest/publishing-production/worker-broker-edge-security.test.ts`

**Interfaces:**
- Produces: `listAutomationTargets()` and `bootstrapPortfolio()` capability-bound calls.

- [ ] Write failing broker tests.
- [ ] Verify RED.
- [ ] Add only the two automation actions with strict validation and tenant-safe RPC calls.
- [ ] Verify GREEN/security tests.
- [ ] Commit.

### Task 3: Governed Portfolio Planner Bootstrap

**Files:**
- Create: `src/modules/publishing-production/auto-portfolio.ts`
- Modify: `src/modules/publishing-production/node-worker-runtime.ts`
- Test: `tests/vitest/publishing-production/auto-portfolio.test.ts`

**Interfaces:**
- Consumes: automation target org, existing `planProductionRun`, academic registry/curriculum loader, released identities.
- Produces: deterministic portfolio bootstrap request with concurrency 4.

- [ ] Write failing tests for disabled/no-target, pilot-approved target, release exclusion, deterministic idempotency, and exactly four concurrency.
- [ ] Verify RED.
- [ ] Implement planner/bootstrap service.
- [ ] Verify GREEN.
- [ ] Commit.

### Task 4: Worker Tick Auto-Bootstrap

**Files:**
- Modify: `src/app/api/internal/publishing-worker/route.ts`
- Modify: `src/modules/publishing-production/node-worker-route.ts`
- Test: `tests/vitest/publishing-production/node-worker-route.test.ts`

**Interfaces:**
- Worker tick attempts safe auto-bootstrap before normal four-job claim.

- [ ] Write failing route test that an authorized cron tick bootstraps eligible auto portfolio before running worker.
- [ ] Verify RED.
- [ ] Integrate bootstrap call while preserving authorization and recovery scheduling.
- [ ] Verify GREEN.
- [ ] Commit.

### Task 5: Pilot Enablement and End-to-End Verification

**Files:**
- Modify only if required by verified failures.

- [ ] Run exact-head typecheck/lint/full unit tests/publishing smoke/build/E2E.
- [ ] Deploy exact head when Vercel quota permits.
- [ ] Finish D01-101 PDF/QA on same persisted job and verify all six publication artifacts.
- [ ] Set pilot approval only after owner-quality gate is satisfied.
- [ ] Enable automation setting with concurrency 4.
- [ ] Verify one and only one automatic PORTFOLIO run is created and four jobs can be claimed concurrently.
- [ ] Keep recovery dispatcher active and verify progress continues with browser closed.
