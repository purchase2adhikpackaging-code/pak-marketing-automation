# PAK Knowledge Research — Zero-Secret Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Add a review-first `Research` tab to PAK Knowledge Base that discovers current public web sources through Exa's credential-free MCP endpoint, lets authorized users inspect sources safely, and converts an explicitly selected source into existing **DRAFT** Knowledge without introducing any new API key, access token, OAuth credential, cookie, browser login, or secret key.

**Architecture:** Extend the existing Knowledge Base. A new authenticated Supabase Edge Function owns live Exa search and authoritative research-row writes using Supabase's already-provided Edge runtime service-role credential; the browser can submit only `organizationId + query` or `organizationId + candidateId`. PAK's existing Node DNS-pinned URL-safety/extraction boundary owns source preview and conversion. Research candidates are untrusted pre-Knowledge metadata and never become generation grounding directly.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.9, Supabase/Postgres/RLS/Edge Functions, Zod 4, Vitest 3, Playwright 1.55, MCP TypeScript client v2 (`@modelcontextprotocol/client@2.0.0`) imported only by the Edge Function, and the existing Node DNS-pinned Knowledge URL fetcher/extractor.

**Spec:** `docs/superpowers/specs/2026-09-13-knowledge-research-zero-secret-design.md`

## Execution Base

The planning branch was created before the active foundation branch finished advancing. At implementation start, create the execution branch/worktree from the **latest** `foundation/org-profile-brand-knowledge` HEAD, then carry this spec and plan into it. The foundation HEAD inspected during planning was `d679f54c377038f31c2836bf0fc9dbd18775abd1`; re-check it immediately before Task 1 and use the newer head if it advanced. Do not implement against the stale planning-branch snapshot.

The current foundation already contains:
- Core Knowledge authority and manager UI;
- document/URL Knowledge ingestion;
- `KnowledgeIngestionService.ingestUrl()` with DRAFT-only finalization;
- `src/modules/knowledge-ingestion/url-safety.ts` with redirect-hop validation, private/loopback/link-local rejection, DNS validation, DNS-pinned fetch, byte/time bounds and text sanitization;
- Supabase Edge Functions that authenticate a bearer JWT, resolve membership using the Edge runtime's existing `SUPABASE_SERVICE_ROLE_KEY`, and perform privileged persistence without exposing the service role to the browser.

## Non-negotiable constraints

- Never touch Lovable.
- Add **no new API/access/secret key** anywhere: not Vault, `.env`, Vercel, Railway, Supabase secrets, Settings, browser storage or database columns.
- The existing `SUPABASE_SERVICE_ROLE_KEY` automatically available to deployed Supabase Edge Functions is platform infrastructure already used by PAK; this feature must not create, rotate, copy, expose or request a new service-role secret.
- Do not install Agent-Reach, OpenCLI, `mcporter`, Twitter/Reddit/Facebook/Instagram/LinkedIn tooling, or any browser-session/cookie integration.
- The only search provider in v1 is the fixed endpoint `https://mcp.exa.ai/mcp`. If it starts requiring credentials, return `CREDENTIAL_REQUIRED` and disable research. Do not prompt for a key and do not fall back to a credentialed provider.
- Use MCP client v2.0.0 (`npm:@modelcontextprotocol/client@2.0.0`) in the Edge Function; do not add the obsolete monolithic v1 `@modelcontextprotocol/sdk` package to the Next.js app.
- Search input bounds: query 3–300 chars; maximum 8 results; title 500 chars; URL 2048 chars; host 255 chars; excerpt 4000 chars; provider timeout 12 seconds.
- Only OWNER/ADMIN/EDITOR (`knowledge:manage`) may search, preview, dismiss or convert research candidates. REVIEWER/ANALYST receive no Research tab/read surface in v1.
- The Edge Function accepts intent only. It never accepts provider output, candidate title/excerpt/URL, provider identity, status, Knowledge status, API key or auth headers for Exa from the caller.
- `research_runs` and `research_candidates` have RLS enabled, manager-only SELECT, and **no authenticated table writes**. Search/dismiss writes occur only inside the authenticated Edge Function after it verifies membership.
- Search persistence may store only bounded metadata: title, syntactically canonical public HTTP(S) URL, host, excerpt, retrieval time and provider identity. It does not persist full article text.
- Search-time URL validation rejects malformed URLs, credentials-in-URL, localhost names and private/reserved literal IPs. Full DNS/redirect/rebinding validation occurs before any PAK source fetch by reusing existing `fetchSafeKnowledgeUrl`/URL ingestion.
- Research candidates are never passed directly to Content Studio, generation context, Scene Planning or an LLM.
- Conversion is explicit, idempotent, DRAFT-only and never sets `is_core = true`.
- Preserve existing manual Knowledge, document/URL ingestion, Core Knowledge, CAS/revision, provenance, RLS/RBAC and private Media behavior.
- TDD RED → GREEN for every implementation slice. No success claim without fresh exact-head typecheck/lint/unit/build/Playwright and required live RLS/runtime evidence.
- Execute through the governed roles: Supervisor/Orchestrator → Architecture → Planning → Coding → Typecheck/Test → E2E Verification → Integration/Release.

---

## Task 1 — Research contracts, bounds and safe browser intent

**Create:**
- `src/modules/knowledge-research/types.ts`
- `src/modules/knowledge-research/schema.ts`
- `src/modules/knowledge-research/schema.test.ts`

**Contract:**

```ts
export const MAX_RESEARCH_QUERY_CHARS = 300;
export const MAX_RESEARCH_RESULTS = 8;
export const MAX_RESEARCH_TITLE_CHARS = 500;
export const MAX_RESEARCH_URL_CHARS = 2048;
export const MAX_RESEARCH_HOST_CHARS = 255;
export const MAX_RESEARCH_EXCERPT_CHARS = 4000;
export const RESEARCH_PROVIDER_TIMEOUT_MS = 12_000;

export type ResearchRunStatus = "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
export type ResearchCandidateStatus = "SUGGESTED" | "CONVERTED" | "DISMISSED";
export type ResearchProvider = "EXA_MCP";
```

`researchSearchInputSchema` must be strict and accept only `{ organizationId, query }`. `researchCandidateInputSchema` must be strict and accept only `{ organizationId, candidateId }`.

- [ ] Write RED tests proving extra fields such as `provider`, `apiKey`, `sourceUrl`, `excerpt`, `status` and `knowledgeStatus` are rejected.
- [ ] Run `npm test -- src/modules/knowledge-research/schema.test.ts` and confirm RED.
- [ ] Implement types/constants/strict schemas.
- [ ] Run `npm test -- src/modules/knowledge-research/schema.test.ts && npm run typecheck` and confirm GREEN.
- [ ] Commit: `feat: add knowledge research domain contracts`.

---

## Task 2 — Research tables, manager-only RLS and write lockout

**Create:**
- `supabase/migrations/20260913180000_knowledge_research.sql`
- `src/modules/knowledge-research/schema-sql.test.ts`
- `src/modules/knowledge-research/repository.ts`
- `src/modules/knowledge-research/repository.test.ts`

**Database model:**

```sql
create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  query text not null check (char_length(query) between 3 and 300),
  provider text not null check (provider = 'EXA_MCP'),
  status text not null check (status in ('RUNNING','COMPLETED','PARTIAL','FAILED')),
  result_count integer not null default 0 check (result_count between 0 and 8),
  failure_code text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, id)
);

create table public.research_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  research_run_id uuid not null,
  provider text not null check (provider = 'EXA_MCP'),
  title text not null check (char_length(title) between 1 and 500),
  canonical_url text not null check (char_length(canonical_url) between 1 and 2048),
  source_host text not null check (char_length(source_host) between 1 and 255),
  excerpt text not null check (char_length(excerpt) between 1 and 4000),
  retrieved_at timestamptz not null,
  review_status text not null default 'SUGGESTED'
    check (review_status in ('SUGGESTED','CONVERTED','DISMISSED')),
  knowledge_record_id uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, research_run_id)
    references public.research_runs(organization_id, id) on delete cascade,
  foreign key (organization_id, knowledge_record_id)
    references public.knowledge_records(organization_id, id) on delete restrict
);
```

Add indexes on `(organization_id, created_at desc)`, `(research_run_id)`, and `(organization_id, review_status, created_at desc)`. Add a partial unique index on non-null `knowledge_record_id`.

RLS SELECT for both tables:

```sql
public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
```

Explicitly revoke INSERT/UPDATE/DELETE on both tables from `anon` and `authenticated`; grant only SELECT to `authenticated` under RLS. There is no browser-callable RPC that accepts provider-result rows.

**Repository contract:** read-only from normal Next.js user session:

```ts
export interface KnowledgeResearchRepository {
  listRuns(organizationId: string): Promise<ResearchRun[]>;
  listCandidates(runId: string, organizationId: string): Promise<ResearchCandidate[]>;
  getCandidate(candidateId: string, organizationId: string): Promise<ResearchCandidate | null>;
  getKnowledgeRecord(recordId: string, organizationId: string): Promise<KnowledgeRecord | null>;
}
```

- [ ] Write RED SQL-source tests for tables, bounds, composite organization FKs, indexes, RLS, manager role list and direct-write revocations.
- [ ] Add a negative SQL-source assertion that no `api_key`, `access_token`, `cookie`, `password`, `secret_value` or full `source_text` column exists.
- [ ] Run `npm test -- src/modules/knowledge-research/schema-sql.test.ts` and confirm RED.
- [ ] Implement migration.
- [ ] Write RED repository tests proving every candidate/run query scopes by organization and returns no cross-org row.
- [ ] Implement explicit `unknown -> ResearchRunRow/ResearchCandidateRow` mapping without weakening generated Supabase types.
- [ ] Run focused tests + `npm run typecheck`; confirm GREEN.
- [ ] Commit: `feat: add tenant-safe knowledge research persistence`.

---

## Task 3 — Authenticated zero-secret Exa Edge Function

**Create:**
- `supabase/functions/knowledge-research/index.ts`
- `supabase/functions/knowledge-research/normalize.ts`
- `src/modules/knowledge-research/exa-normalize.test.ts`
- `src/modules/knowledge-research/edge-source-contract.test.ts`

**Do not modify `package.json` for MCP.** The Edge Function imports exactly:

```ts
import { Client, StreamableHTTPClientTransport } from "npm:@modelcontextprotocol/client@2.0.0";
```

Production endpoint is a source constant:

```ts
const EXA_MCP_ENDPOINT = new URL("https://mcp.exa.ai/mcp");
```

The Edge Function request body is one of:

```ts
{ action: "search", organizationId: string, query: string }
{ action: "dismiss", organizationId: string, candidateId: string }
```

No other keys are accepted.

**Authentication/authorization pattern:** follow `supabase/functions/integration-vault/index.ts`:
1. require Bearer token;
2. use existing Edge runtime `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`;
3. `admin.auth.getUser(token)`;
4. load membership by organization/user;
5. require role OWNER/ADMIN/EDITOR;
6. only then perform search/dismiss.

**Search flow:**
1. insert `research_runs` RUNNING using admin client;
2. connect MCP client to fixed Exa endpoint with no Exa auth material;
3. call `web_search_exa` with `{ query, numResults: 8 }`;
4. normalize provider response to at most 8 hits;
5. syntactically canonicalize each URL; reject URL credentials, non-http(s), localhost names and private/reserved literal IPs; strip fragments;
6. dedupe by canonical URL;
7. insert bounded candidates with `provider='EXA_MCP'`;
8. mark run COMPLETED/PARTIAL; on normalized failure mark FAILED;
9. always close MCP client/transport in `finally`.

If provider response indicates authentication/credential is now required, map to `CREDENTIAL_REQUIRED`, mark run FAILED and return a safe error. Never read an Exa key from `Deno.env`.

`normalize.ts` contains pure functions only, so Vitest can import and test response normalization and URL syntax filtering.

- [ ] Write RED normalization tests for bounded results, duplicate URLs, fragment removal, malformed URL, `user:pass@host`, localhost and private literal IPv4/IPv6 rejection.
- [ ] Write RED source-contract tests asserting fixed endpoint, `@modelcontextprotocol/client@2.0.0`, `web_search_exa`, `numResults`, membership role list, service-role runtime use, and **absence** of `EXA_API_KEY`, `EXA_KEY`, Authorization-to-Exa, OpenCLI and `mcporter`.
- [ ] Run `npm test -- src/modules/knowledge-research/exa-normalize.test.ts src/modules/knowledge-research/edge-source-contract.test.ts` and confirm RED.
- [ ] Implement `normalize.ts` and Edge Function.
- [ ] Run focused tests and `npm run typecheck`; confirm GREEN for app code/source tests.
- [ ] During implementation, run a local/remote read-only MCP compatibility probe that calls `listTools()` and confirms `web_search_exa` exists before finalizing parsing assumptions. Record the observed tool schema in the provider test fixture; do not persist credentials because none are used.
- [ ] Commit: `feat: add zero-secret Exa research edge function`.

---

## Task 4 — Next.js research actions and safe Edge invocation

**Create:**
- `src/app/(app)/knowledge-base/research-actions.ts`
- `src/app/(app)/knowledge-base/research-actions.test.ts`
- `src/modules/knowledge-research/edge-client.ts`
- `src/modules/knowledge-research/edge-client.test.ts`

The Next.js server action remains the UI boundary. It validates strict intent, authenticates current user, re-checks `knowledge:manage`, gets the user's current Supabase access token, and calls the deployed `knowledge-research` Edge Function with that user token. It does not send provider output and does not use service role.

**Action contracts:**

```ts
export async function searchKnowledgeResearchAction(input: unknown): Promise<
  | { ok: true; run: ResearchRun; candidates: ResearchCandidate[] }
  | { ok: false; error: string; code?: "CREDENTIAL_REQUIRED" | "TEMPORARY_UNAVAILABLE" }
>;

export async function dismissKnowledgeResearchCandidateAction(input: unknown): Promise<
  | { ok: true; candidate: ResearchCandidate }
  | { ok: false; error: string }
>;
```

The Edge client endpoint is derived only from the existing public Supabase project URL; no new endpoint secret/config is introduced.

- [ ] Write RED tests: unauthenticated denied; REVIEWER/ANALYST denied; OWNER/ADMIN/EDITOR allowed; malformed/extra fields rejected before Edge call; user token forwarded; no provider payload can be passed.
- [ ] Write Edge-client RED tests for safe mapping of 401/403, `CREDENTIAL_REQUIRED`, provider timeout/rate limit and malformed response.
- [ ] Run focused tests and confirm RED.
- [ ] Implement action + Edge client.
- [ ] Run focused tests plus existing Knowledge actions/ingestion action regression and `npm run typecheck`.
- [ ] Commit: `feat: govern Knowledge Research actions`.

---

## Task 5 — Safe on-demand source preview through existing URL safety

**Create/modify:**
- `src/modules/knowledge-research/service.ts`
- `src/modules/knowledge-research/service.test.ts`
- modify `src/app/(app)/knowledge-base/research-actions.ts`
- modify `src/app/(app)/knowledge-base/research-actions.test.ts`

`previewCandidateSource({ organizationId, candidateId })` must:
1. load the candidate by `(organizationId, candidateId)` through manager RLS;
2. use only the stored `candidate.canonicalUrl`;
3. call existing `fetchSafeKnowledgeUrl(candidate.canonicalUrl)`;
4. return `{ canonicalUrl, text, contentType }` only; never return raw bytes;
5. persist no full article text in research tables.

Input remains exactly `{ organizationId, candidateId }`; a caller-supplied `sourceUrl` must fail schema validation.

- [ ] Write RED test proving stored candidate URL is authoritative.
- [ ] Write RED test proving a forged `sourceUrl` field is rejected.
- [ ] Run focused tests and confirm RED.
- [ ] Implement preview using `src/modules/knowledge-ingestion/url-safety.ts`; do not duplicate DNS/private-IP/redirect logic.
- [ ] Run research tests plus `src/modules/knowledge-ingestion/url-safety.test.ts` and `npm run typecheck`.
- [ ] Commit: `feat: add safe research source preview`.

---

## Task 6 — Atomic idempotent candidate → DRAFT Knowledge conversion

**Create/modify:**
- `supabase/migrations/20260913180030_research_candidate_conversion.sql`
- `src/modules/knowledge-research/conversion-sql.test.ts`
- modify `src/modules/knowledge-ingestion/ingestion-service.ts`
- modify `src/modules/knowledge-ingestion/ingestion-service.test.ts`
- modify `src/modules/knowledge-research/repository.ts`
- modify `src/modules/knowledge-research/repository.test.ts`
- modify `src/modules/knowledge-research/service.ts`
- modify `src/modules/knowledge-research/service.test.ts`
- modify `src/app/(app)/knowledge-base/research-actions.ts`
- modify `src/app/(app)/knowledge-base/research-actions.test.ts`

Add a server-only reusable finalizer seam without changing ordinary URL ingestion behavior:

```ts
export type KnowledgeUrlFinalizer = (
  input: FinalizeKnowledgeIngestionInput,
) => Promise<KnowledgeIngestionFinalization>;

async ingestUrlWithFinalizer(
  input: UrlIngestionRequest,
  finalize: KnowledgeUrlFinalizer,
): Promise<{ documentId: string; record: KnowledgeRecord }>;
```

`ingestUrl()` delegates to `ingestUrlWithFinalizer(input, value => this.repository.finalize(value))`.

New SQL RPC `finalize_research_candidate_ingestion` must:
- require authenticated actor and OWNER/ADMIN/EDITOR role;
- lock candidate by `(organization_id,id) FOR UPDATE`;
- if already CONVERTED, return existing linked Knowledge row (idempotent repeat);
- otherwise require SUGGESTED;
- lock the exact PROCESSING Knowledge document/revision created from the candidate's stored URL;
- require document source URL/source label identity to match the locked candidate;
- apply the same title/content/fingerprint/metadata bounds as existing Knowledge finalization;
- finalize document, create `knowledge_records.status='DRAFT'`, `is_core=false`, preserve document revision linkage;
- set candidate `review_status='CONVERTED'` and `knowledge_record_id` in the same transaction;
- never set ACTIVE/Core.

The RPC may accept extracted text/fingerprint from the server ingestion path just as the existing finalization RPC does, but it must never accept a replacement candidate URL/provider/status/Knowledge status.

`createKnowledgeDraftFromResearchAction` accepts only `{ organizationId, candidateId }`, reloads candidate, and uses `ingestUrlWithFinalizer` on the candidate's stored URL.

- [ ] Write RED SQL-source tests for role checks, `FOR UPDATE`, idempotent already-converted return, candidate/document URL identity, DRAFT-only, non-Core and conversion linkage.
- [ ] Write RED ingestion regression tests proving ordinary `ingestUrl()` still uses existing finalizer and produces the same DRAFT result.
- [ ] Write RED conversion service/action tests for double-click idempotency, cross-org denial, dismissed-candidate denial, unsafe URL failure and no ACTIVE/Core path.
- [ ] Run focused tests and confirm RED.
- [ ] Implement migration, reusable finalizer seam, repository RPC adapter, conversion service and action.
- [ ] Run conversion + existing `ingestion-service.test.ts`, `finalize-sql.test.ts`, `ingestion-actions.test.ts`, typecheck.
- [ ] Commit: `feat: convert research candidates to draft knowledge`.

---

## Task 7 — Knowledge Base `Research` tab and review-first UX

**Create/modify:**
- `src/app/(app)/knowledge-base/research-panel.tsx`
- `src/app/(app)/knowledge-base/research-panel.test.tsx`
- modify `src/app/(app)/knowledge-base/knowledge-base-manager.tsx`
- modify `src/app/(app)/knowledge-base/knowledge-base-manager.test.tsx`

Keep `KnowledgeBaseManager` responsible for selected organization and Knowledge records. Keep research behavior in the focused `ResearchPanel`.

`ResearchPanel` receives:

```ts
{
  organization: { id: string; label: string; role: AppRole };
  onDraftCreated(record: KnowledgeRecord): void;
}
```

UI requirements:
- top-level `Knowledge` / `Research` tabs only for OWNER/ADMIN/EDITOR;
- REVIEWER/ANALYST remain on approved Knowledge view with no Research tab;
- search input + loading state;
- result cards: title, hostname, canonical URL, excerpt, retrieval timestamp;
- `Read source`, `Create Knowledge Draft`, `Dismiss`;
- safe plain-text preview; never `dangerouslySetInnerHTML`;
- conversion card state: `Converted to DRAFT Knowledge`; duplicate create disabled/removed;
- no Activate/Core control inside Research tab;
- current manual create/edit/activate/archive/delete/Core/document/URL ingestion controls remain in Knowledge view.

Trust copy:

> Research results are external public sources. Review the source before creating Knowledge. Research results are not automatically trusted or used for AI grounding.

Credential-drift copy:

> Public research is currently unavailable because the provider now requires credentials. No key will be requested or stored.

- [ ] Write RED panel tests for search-disabled-until-valid, safe trust copy, result cards, preview, dismissal, conversion and credential-required state.
- [ ] Write RED manager tests for role-based tabs and existing Knowledge-flow preservation.
- [ ] Run panel/manager/Core/ingestion-panel tests and confirm RED.
- [ ] Implement panel + thin manager tab integration.
- [ ] Run UI tests, typecheck and lint; no new lint errors.
- [ ] Commit: `feat: add review-first Knowledge Base research tab`.

---

## Task 8 — Product governance, deterministic E2E and CI gates

**Modify/create exact files:**
- `docs/product/PAK_MASTER_PRD.md`
- `docs/product/PAK_MASTER_TRD.md`
- `docs/product/PAK_BACKEND_SCHEMA.md`
- `docs/product/PAK_UI_UX_SPEC.md`
- `docs/product/PAK_SYSTEM_WORKFLOWS.md`
- `docs/product/PAK_INTEGRATION_SPEC.md`
- `docs/product/PAK_DEVELOPMENT_ROADMAP.md`
- `docs/product/PAK_TRACEABILITY_MATRIX.md`
- `tests/e2e/knowledge-base.spec.ts`
- readiness tests only if existing Knowledge Base maturity text changes.

Synchronize permanent `PRD-RSCH-001..012` and corresponding TRD/UX/DB/workflow requirements.

Required governed flow:

```text
Knowledge Base Research
  -> authenticated zero-secret Exa Edge search
  -> manager-only persisted candidate metadata
  -> existing safe Node source preview
  -> explicit Create Knowledge Draft
  -> existing URL extraction + atomic research conversion
  -> DRAFT Knowledge
  -> explicit later activation
  -> ACTIVE-only generation grounding
```

For E2E, do not call live Exa in CI. Add a deterministic test seam to the Edge client that is enabled only by the existing test environment and cannot be selected by production browser input. Extend `tests/e2e/knowledge-base.spec.ts` to cover Research → preview → DRAFT conversion and assert no auto-activation/Core.

- [ ] Write RED traceability/readiness assertions for the new requirement IDs.
- [ ] Add RED Playwright scenario to `tests/e2e/knowledge-base.spec.ts` using deterministic research fixture behavior.
- [ ] Update governing docs and deterministic test seam.
- [ ] Run affected tests.
- [ ] Run the repository's exact CI-equivalent commands from `.github/workflows/ci.yml`:

```bash
npm install
npm run typecheck
npm run lint
npm run test:run
npm run build
npm install --prefix workers/video-assembly
npm run typecheck --prefix workers/video-assembly
npm test --prefix workers/video-assembly
docker build -t pak-video-assembly-worker workers/video-assembly
docker run --rm --entrypoint node pak-video-assembly-worker dist/smoke.js
npx playwright install --with-deps chromium
npm run test:e2e
```

- [ ] Commit: `docs: govern and verify zero-secret knowledge research`.

---

## Task 9 — Live Supabase rollout, live zero-secret acceptance and release evidence

**Before live changes:** invoke/read the Supabase skill; inspect the actual remote migration list and function state; never reapply an applied migration; use reversible synthetic fixtures only.

- [ ] Verify exact implementation HEAD is green locally/CI before touching live Supabase.
- [ ] Confirm migrations `20260913180000_knowledge_research.sql` and `20260913180030_research_candidate_conversion.sql` are absent remotely, then apply them in order.
- [ ] Deploy `knowledge-research` Edge Function using the repository's existing Supabase project/runtime. Do not configure any Exa key or new secret.
- [ ] Live RLS/RBAC probes with synthetic users/data:
  - OWNER/ADMIN/EDITOR can read own-org research state;
  - REVIEWER/ANALYST cannot read/use research;
  - cross-org reads fail;
  - direct authenticated INSERT/UPDATE/DELETE on research tables fail;
  - Edge search accepts only intent and rejects extra provider/candidate payload fields;
  - repeated conversion returns exactly one DRAFT Knowledge record;
  - ACTIVE/Core are never set by conversion.
- [ ] Run one controlled live Exa search with **no Exa credential configured**. Confirm bounded results persist and one selected result can be previewed through existing safe URL logic.
- [ ] If Exa now requires credentials, verify `CREDENTIAL_REQUIRED` and leave research disabled; do not add a key.
- [ ] Run Supabase security/performance advisors; fix research-caused findings before release and document unrelated pre-existing findings separately.
- [ ] Push exact HEAD and inspect all GitHub Actions jobs. Distinguish external platform/quota noise from application failures, but waive no application gate.
- [ ] Invoke `verification-before-completion` and `requesting-code-review`; Supervisor verifies Architecture, Planning, Coding, Typecheck/Test, E2E and Integration/Release evidence before declaring merge-ready.
- [ ] Add/update a handoff only if needed to preserve unfinished rollout/review state; do not create an empty evidence commit.

---

## Acceptance checklist

The slice is complete only when all are true:

- Knowledge Base has a manager-only Research tab.
- Search runs through fixed `https://mcp.exa.ai/mcp` with no Exa/API/access/secret key.
- No Agent-Reach runtime, OpenCLI, `mcporter` or authenticated-social tooling is installed.
- Exa credential requirement causes fail-closed `CREDENTIAL_REQUIRED`, never a key prompt.
- Browser can submit only research intent; it cannot insert/update research tables or submit provider output.
- Research candidates store bounded metadata only; full article text is not persisted in research tables.
- Any source fetch reuses existing DNS-pinned redirect-safe URL logic.
- Research candidates never directly enter generation grounding.
- Conversion is explicit, idempotent, DRAFT-only and non-Core.
- Existing manual/document/URL/Core Knowledge flows remain green.
- REVIEWER/ANALYST and cross-org callers are denied at UI/action/RLS/runtime boundaries.
- Governing docs/traceability match implementation.
- Exact-head CI, Playwright, live RLS/RBAC/security probes and zero-secret provider acceptance are green (or provider is safely disabled if it now requires credentials).
