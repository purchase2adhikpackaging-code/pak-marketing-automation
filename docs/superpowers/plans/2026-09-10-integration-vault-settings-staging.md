# Integration Vault, Settings & Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the organization-scoped Integration Vault, expose secure Settings → Integrations credential management, switch OpenAI runtime credential resolution to the vault, and prepare the real Next.js staging path for PAK.

**Architecture:** Keep host/bootstrap authority (Supabase service role, vault encryption root, deployment credentials) in server environment variables. Store organization provider metadata in `integration_connections`, encrypted secret envelopes in `integration_secrets`, and immutable change/test history in `integration_audit_events`. Browser sessions never read raw secrets; all secret mutations and reads occur through `server-only` modules after normal Supabase user-session authorization proves `settings:manage` for the selected organization.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase/PostgreSQL/RLS, Zod, Vitest/Testing Library, Playwright, OpenAI SDK, Vercel staging.

**Spec:** `docs/product/PAK_INTEGRATION_SPEC.md` together with `docs/product/PAK_BACKEND_SCHEMA.md`, `docs/product/PAK_UI_UX_SPEC.md`, `docs/product/PAK_MASTER_TRD.md`, and `docs/product/PAK_TRACEABILITY_MATRIX.md`.

## Global Constraints

- `INT-GEN-002`: secrets are organization-scoped and server-resolved.
- `INT-GEN-003`: browser clients never receive stored raw secrets.
- `INT-GEN-006`: provider errors are normalized and secrets redacted before persistence/UI.
- `INT-OAI-001`: OpenAI key is entered in PAK Settings and stored encrypted/server-side.
- `INT-OAI-002`: OpenAI key is never returned after save.
- `INT-OAI-003`: OpenAI adapter consumes the key at runtime from Integration Vault.
- Supabase service-role key, vault encryption root/key material, worker shared secrets, and deployment credentials remain host-level bootstrap secrets.
- PAK remains isolated from Aurexis/Lovable and any Lovable-attached Supabase project.
- Every tenant mutation remains organization-scoped and role-authorized; RLS remains the browser/session boundary.
- No live provider call is required by CI.

---

### Task 1: Vault schema and RLS

**Files:**
- Create: `supabase/migrations/202609100006_integration_vault.sql`
- Modify: `tests/rls/foundation-rls.sql`

**Interfaces:**
- Produces tables `integration_connections`, `integration_secrets`, `integration_audit_events` and their constraints/RLS policies.
- Browser/session clients may read safe connection metadata according to role, but receive no policy granting raw secret SELECT/INSERT/UPDATE/DELETE.

- [ ] Write RLS/schema assertions first for tenant scope, allowed metadata roles, server-only secret table, immutable audit events, unique provider connection, and FK organization integrity.
- [ ] Run the RLS/static test harness and confirm RED for absent vault schema.
- [ ] Add the migration with provider status checks, unique `(organization_id, provider)`, secret uniqueness, immutable audit policy surface, required indexes, and explicit grants/revokes.
- [ ] Re-run tests and confirm GREEN.
- [ ] Apply migration only to PAK Supabase project and execute positive/negative role probes in a rollback transaction.

### Task 2: Vault domain types, schemas and cryptography boundary

**Files:**
- Create: `src/modules/integrations/types.ts`
- Create: `src/modules/integrations/schema.ts`
- Create: `src/modules/integrations/schema.test.ts`
- Create: `src/modules/integrations/crypto.ts`
- Create: `src/modules/integrations/crypto.test.ts`
- Modify: `src/lib/env/schema.ts`
- Modify: `src/lib/env/server.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces `IntegrationProvider`, `IntegrationConnectionStatus`, safe connection DTOs, credential mutation schemas, and `encryptSecret`/`decryptSecret` server-only functions.
- Adds required host bootstrap env `INTEGRATION_VAULT_ENCRYPTION_KEY` without making it public.

- [ ] Write failing schema/crypto tests, including invalid provider/secret names and encryption round-trip/non-plaintext behavior.
- [ ] Add a versioned AES-256-GCM envelope using a 32-byte root key loaded only from server env; ciphertext representation includes nonce/auth-tag/version and never logs plaintext.
- [ ] Re-run focused tests.

### Task 3: Repositories and authorization-safe service

**Files:**
- Create: `src/modules/integrations/repository.ts`
- Create: `src/modules/integrations/repository.test.ts`
- Create: `src/modules/integrations/service.ts`
- Create: `src/modules/integrations/service.test.ts`

**Interfaces:**
- Produces metadata list/get operations via normal user-session client and privileged server-only secret write/read operations via admin client.
- Produces `IntegrationCredentialResolver` matching `PAK_INTEGRATION_SPEC.md`.

- [ ] Write failing tests for org scoping, write-only secret behavior, masking, version increments, audit creation, replacement/removal, and safe missing-secret errors.
- [ ] Implement user-session authorization before privileged writes.
- [ ] Persist encrypted values only; never expose ciphertext or plaintext through safe DTOs.
- [ ] Re-run focused tests.

### Task 4: Settings → Integrations server actions

**Files:**
- Create: `src/app/(app)/settings/integrations/actions.ts`
- Create: `src/app/(app)/settings/integrations/actions.test.ts`

**Interfaces:**
- Actions: save/replace OpenAI API key, update non-secret OpenAI model config, remove/disable connection, test connection.
- Returns only safe serializable status/error data.

- [ ] Write failing authorization/input/error-redaction tests.
- [ ] Require authenticated actor + organization membership + `settings:manage` before any change.
- [ ] Resolve secret writes server-side through vault service.
- [ ] Implement safe OpenAI connection test through the current supported OpenAI API, avoiding unnecessary generation cost where possible.
- [ ] Re-run focused tests.

### Task 5: Settings → Integrations UI

**Files:**
- Replace: `src/app/(app)/settings/page.tsx`
- Create: `src/app/(app)/settings/integrations/integrations-manager.tsx`
- Create: `src/app/(app)/settings/integrations/integrations-manager.test.tsx`

**Interfaces:**
- OWNER/ADMIN sees organization-scoped integration cards and management controls.
- OpenAI card shows `Not configured | Configured | Invalid | Disabled`, safe masked hint, default model, last verified time, and write-only key field.

- [ ] Write failing UI tests for no secret echo, role-aware controls, save/replace/test/disable states, loading/error state.
- [ ] Implement server-loaded eligible organization context and safe provider metadata.
- [ ] Ensure secret input is cleared after successful save and never hydrated from DB.
- [ ] Re-run UI tests.

### Task 6: Runtime OpenAI credential resolution

**Files:**
- Modify: `src/modules/ai/text/openai-provider.ts`
- Modify/create focused provider tests as required.
- Modify Content Studio dependency construction only where needed.

**Interfaces:**
- OpenAI provider obtains API key from `IntegrationCredentialResolver` for the active organization; host `OPENAI_API_KEY` is no longer the normal organization runtime credential.
- Fake provider remains CI default.

- [ ] Write failing tests showing OpenAI construction/generation requires vault-resolved credential and does not use browser/env-exposed key.
- [ ] Refactor adapter/dependency injection minimally to accept organization-scoped credential resolution.
- [ ] Preserve fake provider behavior and existing Content Studio tests.
- [ ] Run full unit suite.

### Task 7: Auth/staging readiness

**Files:**
- Inspect and modify existing auth/middleware/login routes only as required to permit a real PAK user to authenticate on staging.
- Add/update E2E tests for unauthenticated redirect/login boundary if missing.

**Interfaces:**
- Real staging user can authenticate with PAK Supabase Auth and enter the app shell; organization context derives from membership rather than arbitrary client org IDs.

- [ ] Audit current auth UX and identify exact missing path.
- [ ] Write failing E2E/unit test for the missing auth behavior.
- [ ] Implement minimum secure staging login/session behavior.
- [ ] Verify no service-role or vault root key reaches browser bundles.

### Task 8: Full verification and PR

- [ ] Run typecheck.
- [ ] Run lint.
- [ ] Run complete Vitest suite.
- [ ] Run Next.js production build.
- [ ] Run Playwright E2E.
- [ ] Re-run live PAK Supabase RLS/security probes for vault tables.
- [ ] Inspect security/performance advisors for new blocking findings.
- [ ] Open feature PR with requirement mapping and verification evidence.
- [ ] Resolve review findings and require exact-head green CI before merge.

### Task 9: Real Next.js staging deployment

**External configuration:** Vercel project connected to `purchase2adhikpackaging-code/pak-marketing-automation`.

- [ ] Create/link the real Vercel project after feature merge or deploy the exact verified feature/main commit as staging, depending on available connector workflow.
- [ ] Configure host bootstrap environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INTEGRATION_VAULT_ENCRYPTION_KEY`, and worker/bootstrap values required by current app.
- [ ] Do not store organization OpenAI/Meta/LTX credentials as ordinary deployment env once Vault UI is available.
- [ ] Deploy and inspect build/runtime logs.
- [ ] Confirm staging URL serves the actual Next.js repository.

### Task 10: Manual + automated real-flow validation

- [ ] Open staging in browser automation if available and verify login → Settings → Integrations.
- [ ] User opens the same staging URL in Chrome and enters OpenAI API key directly into PAK Settings.
- [ ] After save, verify only masked/status metadata is rendered.
- [ ] Test OpenAI connection.
- [ ] Generate a real grounded Content Studio script using the stored vault key.
- [ ] Verify generated result/provenance persists in PAK Supabase.
- [ ] Inspect runtime logs for secret leakage/errors.
- [ ] Mark Integration Vault/staging slice complete only after evidence passes.

### Task 11: Scene Planning handoff

- [ ] Re-read the approved Scene Planning requirements from PRD/TRD/workflow/backend documents.
- [ ] Start Scene Planning as its own spec/plan/feature branch; do not mix it into the vault PR.
