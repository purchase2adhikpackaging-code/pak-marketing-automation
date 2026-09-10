# Supabase-Native Integration Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete PAK Phase 5 by moving provider-secret management and real OpenAI execution behind authenticated Supabase Edge Functions backed by Supabase Vault, while removing the placeholder root page.

**Architecture:** Supabase Vault stores raw credentials; Edge Functions validate the caller JWT and organization role before secret operations or OpenAI execution. Next.js handles UI/session forwarding and consumes only safe metadata or generated content, never decrypted provider keys.

**Tech Stack:** Next.js, TypeScript, Supabase Auth/Postgres/Vault/Edge Functions, OpenAI Responses API, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-10-supabase-native-integration-vault-design.md`

## Global Constraints

- PAK repository and PAK Supabase only; do not touch Aurexis, Lovable, or any Lovable-attached Supabase.
- Provider secrets must never be returned to browser APIs, HTML, client state, URLs, logs, or audit metadata.
- OWNER/ADMIN are the only roles allowed to mutate integration credentials.
- Edge Functions derive actor identity from the JWT and validate organization membership.
- RLS remains enabled for application metadata.
- No production-success claim before exact-head CI and staging verification.

---

### Task 1: Vault persistence migration

**Files:**
- Create: `supabase/migrations/202609100008_supabase_native_integration_vault.sql`
- Test/probe: SQL against PAK Supabase after review

**Interfaces:**
- Produces server-only SQL RPCs for Vault save/read/remove and metadata/audit mutation.
- Consumed only by service-role Edge Function code.

- [ ] **Step 1: Add migration SQL** defining server-only functions that validate connection identity, create/update deterministic Vault entries, update masked metadata/version/status, and append audit records.
- [ ] **Step 2: Revoke function execution** from `PUBLIC`, `anon`, and `authenticated`; grant only `service_role`.
- [ ] **Step 3: Apply migration** to PAK Supabase.
- [ ] **Step 4: Run live probes** confirming authenticated callers cannot select Vault secrets, cannot read `integration_secrets`, and cannot execute server-only Vault RPCs.
- [ ] **Step 5: Commit** with `feat: add Supabase Vault persistence functions`.

### Task 2: Shared Edge authorization and safe integration contracts

**Files:**
- Create: `supabase/functions/_shared/auth.ts`
- Create: `supabase/functions/_shared/http.ts`
- Create: `supabase/functions/_shared/integrations.ts`
- Test: focused unit/helper tests where supported by repository test setup

**Interfaces:**
- Produces `requireUser(req)`, `requireOrganizationRole(client,userId,organizationId,["OWNER","ADMIN"])`, CORS/JSON helpers, safe connection response mapper.

- [ ] **Step 1: Write failing tests** for missing bearer token, non-member, forbidden role, and safe response masking.
- [ ] **Step 2: Run tests and verify RED**.
- [ ] **Step 3: Implement minimal shared helpers** with no secret logging.
- [ ] **Step 4: Run tests and verify GREEN**.
- [ ] **Step 5: Commit** with `feat: add Edge integration authorization helpers`.

### Task 3: Integration Vault Edge Function

**Files:**
- Create: `supabase/functions/integration-vault/index.ts`
- Modify: integration action schemas/types only where needed
- Test: integration function request/response tests

**Interfaces:**
- Consumes shared auth helpers and Task 1 RPCs.
- Accepts `{ action, organizationId, provider, secretName?, secretValue?, disabled? }`.
- Returns only safe connection metadata/status.

- [ ] **Step 1: Write failing request tests** for `save`, `test`, `remove`, forbidden role, malformed payload, and response secret-leak scan.
- [ ] **Step 2: Run tests and verify RED**.
- [ ] **Step 3: Implement function** with Zod-equivalent validation, JWT user derivation, OWNER/ADMIN authorization, Vault RPC calls, OpenAI credential test, normalized error codes, and safe JSON responses.
- [ ] **Step 4: Run tests and verify GREEN**.
- [ ] **Step 5: Deploy function** to PAK Supabase with JWT verification enabled.
- [ ] **Step 6: Probe live endpoint** with invalid/unauthorized requests and confirm no secret leakage.
- [ ] **Step 7: Commit** with `feat: add Integration Vault Edge Function`.

### Task 4: Next.js Settings integration client

**Files:**
- Create: `src/modules/integrations/edge-client.ts`
- Modify: `src/app/(app)/settings/integrations/actions.ts`
- Modify: `src/modules/integrations/service.ts` and/or callers to remove reachable legacy secret mutation path
- Test: existing integration action/service tests plus new edge-client tests

**Interfaces:**
- Produces authenticated `invokeIntegrationVault()` using the current Supabase session access token.
- Settings actions continue returning `SafeIntegrationConnection` only.

- [ ] **Step 1: Write failing tests** proving Settings actions forward the session token, reject missing session, map Edge errors, and never echo secret values.
- [ ] **Step 2: Run tests and verify RED**.
- [ ] **Step 3: Implement Edge client and switch Settings actions** from Vercel-side encryption/admin-client secret operations to the Edge Function.
- [ ] **Step 4: Run tests and verify GREEN**.
- [ ] **Step 5: Commit** with `refactor: route integration settings through Supabase Edge`.

### Task 5: OpenAI generation Edge Function

**Files:**
- Create: `supabase/functions/generate-content/index.ts`
- Create/modify shared OpenAI request/response types as needed
- Test: provider routing and error normalization tests

**Interfaces:**
- Accepts organization-scoped generation input plus authenticated caller JWT.
- Resolves OpenAI key from Vault server-side.
- Returns generated text/artifact payload, not credentials.

- [ ] **Step 1: Write failing tests** for unauthorized membership, missing credential, disabled/invalid connection, successful provider response mapping, and secret-leak scan.
- [ ] **Step 2: Run tests and verify RED**.
- [ ] **Step 3: Implement authenticated generation function** with organization authorization, Vault secret resolution, OpenAI call, normalized errors, and no secret logging.
- [ ] **Step 4: Run tests and verify GREEN**.
- [ ] **Step 5: Deploy function** to PAK Supabase with JWT verification enabled.
- [ ] **Step 6: Commit** with `feat: execute OpenAI generation through Supabase Edge`.

### Task 6: Content Studio runtime routing

**Files:**
- Modify: `src/modules/ai/text/openai-provider.ts`
- Modify related content-generation service/factory files discovered by existing imports
- Test: `src/modules/ai/text/*.test.ts` and Content Studio action tests

**Interfaces:**
- Production OpenAI route invokes `generate-content` with user session and organization context.
- Fake provider remains available for CI/unit tests where explicitly configured.

- [ ] **Step 1: Write failing tests** proving real OpenAI generation no longer calls `createIntegrationVaultService().getSecret()` in the Next.js runtime.
- [ ] **Step 2: Run tests and verify RED**.
- [ ] **Step 3: Implement Edge-backed provider path** while preserving provider-neutral interfaces.
- [ ] **Step 4: Run tests and verify GREEN**.
- [ ] **Step 5: Commit** with `refactor: move OpenAI credential resolution out of Vercel runtime`.

### Task 7: Remove obsolete Vercel secret dependencies

**Files:**
- Modify: `src/lib/env/schema.ts`
- Modify: `src/lib/env/server.ts`
- Modify: `.env.example`
- Modify/delete legacy crypto/admin-client integration code only if no reachable callers remain
- Test: env schema tests/build

**Interfaces:**
- `SUPABASE_SERVICE_ROLE_KEY` and `INTEGRATION_VAULT_ENCRYPTION_KEY` are no longer mandatory for normal production app startup or integration workflows.

- [ ] **Step 1: Write/update env tests** to show the app validates with public Supabase vars and supported runtime vars only.
- [ ] **Step 2: Run tests and verify RED** against current mandatory schema.
- [ ] **Step 3: Remove obsolete requirements and dead reachable paths**.
- [ ] **Step 4: Run tests and build; verify GREEN**.
- [ ] **Step 5: Commit** with `chore: remove obsolete Vercel vault secrets`.

### Task 8: Root auth-aware redirect

**Files:**
- Modify: `src/app/page.tsx`
- Test: root-page behavior test / E2E smoke

**Interfaces:**
- `/` redirects authenticated users to `/dashboard`, unauthenticated users to `/login`.

- [ ] **Step 1: Write failing test** for both redirect states.
- [ ] **Step 2: Run test and verify RED**.
- [ ] **Step 3: Implement auth-aware redirect** with the existing server Supabase client.
- [ ] **Step 4: Run test and verify GREEN**.
- [ ] **Step 5: Commit** with `fix: route root URL into PAK workspace`.

### Task 9: Full verification, review, merge, staging smoke

**Files:**
- Modify docs if implementation details differ from approved spec

**Interfaces:**
- Produces exact green PR head and verified staging deployment.

- [ ] **Step 1: Run full local/CI-equivalent suite**: typecheck, lint, unit tests, build, Playwright smoke.
- [ ] **Step 2: Run Supabase security/performance advisors** after migration and Edge deployment.
- [ ] **Step 3: Open PR** from `feat/supabase-native-integration-vault-v2` to `main` with requirements/verification evidence.
- [ ] **Step 4: Resolve every review thread** and rerun CI on the exact head.
- [ ] **Step 5: Merge only exact green head**.
- [ ] **Step 6: Redeploy Vercel from merged `main`** and verify `/`, `/login`, `/settings`, and Content Studio on the exact live domain.
- [ ] **Step 7: User enters OpenAI key only in hosted Settings**, then run save/test/generate/remove-or-replace smoke checks and inspect runtime logs/HTML for leakage.
