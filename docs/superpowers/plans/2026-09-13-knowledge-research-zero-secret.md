# PAK Knowledge Research — Zero-Secret Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a review-first `Research` tab to PAK Knowledge Base that discovers current public web sources through a credential-free Exa MCP route, lets authorized users inspect sources safely, and converts an explicitly selected source into existing DRAFT Knowledge without introducing any new API/access/secret key.

**Architecture:** Extend the current Knowledge Base rather than introducing a parallel trusted-content system. Persist organization-scoped research runs/candidates, keep public search behind a typed server-only provider adapter, reuse the existing URL safety/extraction and Knowledge ingestion lifecycle, and make research-candidate conversion atomic/idempotent while preserving DRAFT-only activation discipline.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.9, Supabase/Postgres/RLS, Zod 4, Vitest 3, Playwright 1.55, `@modelcontextprotocol/sdk` client transport for the fixed public Exa MCP endpoint, existing Node DNS-pinned URL fetcher/extractor.

**Spec:** `docs/superpowers/specs/2026-09-13-knowledge-research-zero-secret-design.md`

## Execution Base

The design branch was created before the active foundation branch finished advancing. Before implementation starts, create the execution worktree/branch from the **latest** `foundation/org-profile-brand-knowledge` HEAD (inspected during planning at `d679f54c377038f31c2836bf0fc9dbd18775abd1`) and carry this spec + plan into that execution branch. Do not implement against the stale planning branch snapshot. If the foundation branch advances again, re-inspect and integrate it before Task 1.

## Global Constraints

- Never touch Lovable.
- No new API key, access token, OAuth credential, cookie, external account login, browser session, or secret key may be introduced.
- Do not add Exa/Jina/social credentials to Supabase Vault, Vercel, Railway, `.env`, browser storage, or Settings.
- The fixed no-key Exa MCP endpoint is the only search provider in the first release. If it starts requiring credentials, return `CREDENTIAL_REQUIRED` and fail closed.
- Do not install the full Agent-Reach runtime, OpenCLI, `mcporter`, Twitter/Reddit/Facebook/Instagram/LinkedIn login tooling, or desktop/browser-session dependencies.
- Reuse existing `src/modules/knowledge-ingestion/url-safety.ts`; do not create a second SSRF/network-safety implementation.
- Reuse existing Knowledge URL ingestion/extraction; research results never bypass the current DRAFT-only Knowledge lifecycle.
- Research candidates are untrusted public-source suggestions. They never enter Content Studio, generation-context, Scene Planning, or prompts directly.
- Only `knowledge:manage` actors (OWNER/ADMIN/EDITOR) may run research, preview source content, dismiss candidates, or create Knowledge drafts from candidates.
- REVIEWER/ANALYST gain no research mutation/read surface in this slice.
- Browser input is intent only: `organizationId + query` or `organizationId + candidateId`. Browser never submits provider output, canonical URL overrides, source text, fingerprints, provider identifiers, conversion status, or Knowledge status.
- `research_runs` and `research_candidates` are organization-scoped, RLS-enabled, and have no secret fields.
- Persist only bounded title/URL/hostname/excerpt/provider/retrieval metadata. Do not persist full article text in research tables.
- Search bounds for first release: query 3–300 chars; maximum 8 candidates/run; candidate title 500 chars; URL 2048 chars; hostname 255 chars; excerpt 4000 chars; provider call timeout 12 seconds.
- Search requests must not include private Knowledge, user files, client/candidate PII, integration secrets, or organization credentials.
- Existing Knowledge Base revision/CAS, Core Knowledge, provenance, RBAC/RLS, and private Media Library behavior must not regress.
- Every feature/bug slice uses TDD RED → GREEN; exact-head typecheck/lint/unit/build/E2E evidence is required before completion claims.
- Implementation execution follows the governed roles: Supervisor/Orchestrator → Architecture → Planning → Coding → Typecheck/Test → E2E Verification → Integration/Release; no single-agent unchecked coding path.

---

## File Structure

### New research domain

- `src/modules/knowledge-research/types.ts` — provider-neutral run/candidate/result types and hard bounds.
- `src/modules/knowledge-research/schema.ts` — Zod schemas for safe browser intent and provider normalization.
- `src/modules/knowledge-research/provider.ts` — `PublicResearchProvider` contract and normalized provider errors.
- `src/modules/knowledge-research/exa-mcp-provider.ts` — server-only Exa MCP adapter, fixed endpoint, no auth.
- `src/modules/knowledge-research/repository.ts` — Supabase persistence/RPC adapter for research state.
- `src/modules/knowledge-research/service.ts` — search orchestration, URL validation, provider normalization, preview and conversion orchestration.

### Knowledge Base UI/actions

- `src/app/(app)/knowledge-base/research-actions.ts` — authenticated server actions for search, source preview, dismiss and conversion.
- `src/app/(app)/knowledge-base/research-panel.tsx` — focused client UI for the Research tab.
- `src/app/(app)/knowledge-base/research-panel.test.tsx` — component tests.
- Modify `src/app/(app)/knowledge-base/knowledge-base-manager.tsx` — add Knowledge/Research view switching without expanding research internals into the manager.
- Modify/add manager tests only for tab/RBAC integration.

### Database

- `supabase/migrations/20260913180000_knowledge_research.sql` — tables, constraints, indexes, RLS/grants and guarded run/candidate RPCs.
- `supabase/migrations/20260913180030_research_candidate_conversion.sql` — atomic/idempotent candidate → existing URL-ingestion DRAFT finalization boundary.

### Existing ingestion reuse

- Modify `src/modules/knowledge-ingestion/ingestion-service.ts` only to expose a server-only reusable URL-ingestion finalizer seam; normal URL ingestion behavior must remain byte-for-byte equivalent at the domain level.
- Modify `src/modules/knowledge-ingestion/repository.ts` only as required for the new finalizer RPC adapter.
- Add regression tests proving ordinary document/URL ingestion remains unchanged.

### Product docs/readiness

- Modify `docs/product/PAK_MASTER_PRD.md`.
- Modify `docs/product/PAK_MASTER_TRD.md`.
- Modify `docs/product/PAK_BACKEND_SCHEMA.md`.
- Modify `docs/product/PAK_UI_UX_SPEC.md`.
- Modify `docs/product/PAK_SYSTEM_WORKFLOWS.md`.
- Modify `docs/product/PAK_INTEGRATION_SPEC.md`.
- Modify `docs/product/PAK_DEVELOPMENT_ROADMAP.md`.
- Modify `docs/product/PAK_TRACEABILITY_MATRIX.md`.
- Modify readiness tests only where the Knowledge Base maturity description changes.

---

### Task 1: Research domain contracts and strict input bounds

**Files:**
- Create: `src/modules/knowledge-research/types.ts`
- Create: `src/modules/knowledge-research/schema.ts`
- Create: `src/modules/knowledge-research/schema.test.ts`

**Interfaces:**
- Produces `ResearchRun`, `ResearchCandidate`, `ResearchRunStatus`, `ResearchCandidateStatus`, `PublicResearchHit`, `ResearchSearchInput`, `ResearchCandidateInput`.
- Produces constants `MAX_RESEARCH_QUERY_CHARS = 300`, `MAX_RESEARCH_RESULTS = 8`, `MAX_RESEARCH_TITLE_CHARS = 500`, `MAX_RESEARCH_URL_CHARS = 2048`, `MAX_RESEARCH_HOST_CHARS = 255`, `MAX_RESEARCH_EXCERPT_CHARS = 4000`, `RESEARCH_PROVIDER_TIMEOUT_MS = 12000`.
- Browser schemas accept only `organizationId/query` or `organizationId/candidateId`.

- [ ] **Step 1: Write RED schema tests**

```ts
import { describe, expect, it } from "vitest";
import {
  researchCandidateInputSchema,
  researchSearchInputSchema,
} from "./schema";
import { MAX_RESEARCH_QUERY_CHARS } from "./types";

describe("knowledge research schemas", () => {
  it("accepts only organizationId + bounded query for search", () => {
    const input = {
      organizationId: "11111111-1111-4111-8111-111111111111",
      query: "Poland railway recruitment trends 2026",
    };
    expect(researchSearchInputSchema.parse(input)).toEqual(input);
    expect(() => researchSearchInputSchema.parse({ ...input, query: "x".repeat(MAX_RESEARCH_QUERY_CHARS + 1) })).toThrow();
    expect(() => researchSearchInputSchema.parse({ ...input, provider: "CUSTOM" })).toThrow();
    expect(() => researchSearchInputSchema.parse({ ...input, apiKey: "secret" })).toThrow();
  });

  it("accepts only organizationId + candidateId for candidate actions", () => {
    expect(researchCandidateInputSchema.safeParse({
      organizationId: "11111111-1111-4111-8111-111111111111",
      candidateId: "22222222-2222-4222-8222-222222222222",
    }).success).toBe(true);
    expect(researchCandidateInputSchema.safeParse({
      organizationId: "11111111-1111-4111-8111-111111111111",
      candidateId: "22222222-2222-4222-8222-222222222222",
      sourceUrl: "https://attacker.example",
    }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npm test -- src/modules/knowledge-research/schema.test.ts
```

Expected: FAIL because the research module does not exist.

- [ ] **Step 3: Implement strict types/constants/schemas**

Core type shape:

```ts
export const RESEARCH_PROVIDERS = ["EXA_MCP"] as const;
export type ResearchProvider = (typeof RESEARCH_PROVIDERS)[number];
export type ResearchRunStatus = "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
export type ResearchCandidateStatus = "SUGGESTED" | "CONVERTED" | "DISMISSED";

export const MAX_RESEARCH_QUERY_CHARS = 300;
export const MAX_RESEARCH_RESULTS = 8;
export const MAX_RESEARCH_TITLE_CHARS = 500;
export const MAX_RESEARCH_URL_CHARS = 2048;
export const MAX_RESEARCH_HOST_CHARS = 255;
export const MAX_RESEARCH_EXCERPT_CHARS = 4000;
export const RESEARCH_PROVIDER_TIMEOUT_MS = 12_000;

export type PublicResearchHit = {
  title: string;
  url: string;
  excerpt: string;
  retrievedAt: string;
};
```

Schemas must use `.strict()` so provider names, API keys, source text and URLs cannot be browser-authoritative fields.

- [ ] **Step 4: Run focused tests + typecheck**

```bash
npm test -- src/modules/knowledge-research/schema.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/knowledge-research/types.ts src/modules/knowledge-research/schema.ts src/modules/knowledge-research/schema.test.ts
git commit -m "feat: add knowledge research domain contracts"
```

---

### Task 2: Research database schema, RLS and guarded persistence RPCs

**Files:**
- Create: `supabase/migrations/20260913180000_knowledge_research.sql`
- Create: `src/modules/knowledge-research/schema-sql.test.ts`
- Create: `src/modules/knowledge-research/repository.ts`
- Create: `src/modules/knowledge-research/repository.test.ts`

**Interfaces:**
- Produces `research_runs` and `research_candidates`.
- Uses existing DB helpers `public.is_org_member(uuid)` and `public.has_org_role(uuid, text[])`.
- Browser/authenticated clients receive SELECT only through manager-scoped RLS; direct INSERT/UPDATE/DELETE table grants are revoked.
- Produces guarded RPCs `create_research_run`, `complete_research_run`, `fail_research_run`, `dismiss_research_candidate`.
- Repository exposes `createRun`, `completeRun`, `failRun`, `listCandidates`, `getCandidate`, `dismissCandidate`.

- [ ] **Step 1: Write RED SQL-source tests for exact invariants**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve("supabase/migrations/20260913180000_knowledge_research.sql"), "utf8");

describe("knowledge research migration", () => {
  it("creates tenant-scoped research tables and blocks browser writes", () => {
    expect(sql).toContain("create table public.research_runs");
    expect(sql).toContain("create table public.research_candidates");
    expect(sql).toContain("alter table public.research_runs enable row level security");
    expect(sql).toContain("alter table public.research_candidates enable row level security");
    expect(sql).toContain("array['OWNER','ADMIN','EDITOR']");
    expect(sql).toMatch(/revoke\s+insert,\s*update,\s*delete[\s\S]*research_runs/i);
    expect(sql).toMatch(/revoke\s+insert,\s*update,\s*delete[\s\S]*research_candidates/i);
  });

  it("contains no credential columns", () => {
    expect(sql).not.toMatch(/api_key|access_token|secret|cookie|password/i);
  });
});
```

- [ ] **Step 2: Run RED tests**

```bash
npm test -- src/modules/knowledge-research/schema-sql.test.ts
```

Expected: FAIL because migration does not exist.

- [ ] **Step 3: Implement the migration**

Required table invariants:

```sql
create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  query text not null check (char_length(query) between 3 and 300),
  provider text not null check (provider = 'EXA_MCP'),
  status text not null check (status in ('RUNNING','COMPLETED','PARTIAL','FAILED')),
  result_count integer not null default 0 check (result_count between 0 and 8),
  failure_code text,
  failure_metadata jsonb,
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
  review_status text not null default 'SUGGESTED' check (review_status in ('SUGGESTED','CONVERTED','DISMISSED')),
  knowledge_record_id uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, research_run_id)
    references public.research_runs(organization_id, id) on delete cascade,
  foreign key (organization_id, knowledge_record_id)
    references public.knowledge_records(organization_id, id) on delete restrict
);
```

Add indexes on `(organization_id, created_at desc)`, `(research_run_id)`, `(organization_id, review_status, created_at desc)` and a partial unique index preventing more than one candidate from linking to the same Knowledge record.

RLS SELECT policy for both tables must require:

```sql
public.has_org_role(organization_id, array['OWNER','ADMIN','EDITOR'])
```

Guarded RPCs must perform the same role check using `auth.uid()` through `has_org_role`; they must set provider to `EXA_MCP` internally and never accept provider/credential fields from the caller.

- [ ] **Step 4: Write repository RED tests with an injected persistence port**

Test that:
- run creation sends only org/query;
- completion persists at most 8 normalized candidates;
- candidate lookup always scopes by organization;
- dismiss is idempotent and cannot modify CONVERTED rows.

Use concrete fixture IDs and assert exact calls, not snapshots.

- [ ] **Step 5: Implement `SupabaseKnowledgeResearchRepository`**

```ts
export interface KnowledgeResearchRepository {
  createRun(input: { organizationId: string; query: string; actorUserId: string }): Promise<ResearchRun>;
  completeRun(input: { runId: string; organizationId: string; candidates: PublicResearchHit[] }): Promise<ResearchCandidate[]>;
  failRun(input: { runId: string; organizationId: string; failureCode: string }): Promise<void>;
  listCandidates(runId: string, organizationId: string): Promise<ResearchCandidate[]>;
  getCandidate(candidateId: string, organizationId: string): Promise<ResearchCandidate | null>;
  dismissCandidate(candidateId: string, organizationId: string): Promise<ResearchCandidate>;
}
```

Map DB rows explicitly through `unknown -> ResearchRunRow/ResearchCandidateRow`; do not weaken generated Supabase types globally.

- [ ] **Step 6: Run focused unit tests + typecheck**

```bash
npm test -- src/modules/knowledge-research/schema-sql.test.ts src/modules/knowledge-research/repository.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260913180000_knowledge_research.sql src/modules/knowledge-research/schema-sql.test.ts src/modules/knowledge-research/repository.ts src/modules/knowledge-research/repository.test.ts
git commit -m "feat: add tenant-safe knowledge research persistence"
```

---

### Task 3: Credential-free Exa MCP provider adapter

**Files:**
- Modify: `package.json`
- Modify: lockfile
- Create: `src/modules/knowledge-research/provider.ts`
- Create: `src/modules/knowledge-research/exa-mcp-provider.ts`
- Create: `src/modules/knowledge-research/exa-mcp-provider.test.ts`

**Interfaces:**
- Adds `@modelcontextprotocol/sdk` as a runtime library; it is protocol plumbing, not a provider credential.
- Produces `PublicResearchProvider.search({ query, maxResults, signal })`.
- Production endpoint is the constant `https://mcp.exa.ai/mcp`; no endpoint URL is accepted from browser input or environment variables.
- Calls MCP tool `web_search_exa` with `query` and bounded `numResults` only.
- No Authorization/Cookie/API-key header is attached.

- [ ] **Step 1: Write RED adapter tests around an injected MCP client port**

```ts
it("calls the fixed no-key Exa search tool with bounded arguments", async () => {
  const calls: unknown[] = [];
  const provider = new ExaMcpResearchProvider({
    callTool: async (input) => {
      calls.push(input);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ results: [{ title: "Rail report", url: "https://example.com/report", text: "Railway hiring expanded." }] }),
        }],
      };
    },
  });

  const results = await provider.search({ query: "railway hiring", maxResults: 8 });
  expect(calls).toEqual([{ name: "web_search_exa", arguments: { query: "railway hiring", numResults: 8 } }]);
  expect(results[0]?.url).toBe("https://example.com/report");
});
```

Also test:
- malformed result payload → `PROVIDER_INVALID_RESPONSE`;
- HTTP/auth-like MCP failure → `CREDENTIAL_REQUIRED` when failure indicates authentication is now required;
- timeout/abort → `PROVIDER_TIMEOUT`;
- returned result count is truncated to `MAX_RESEARCH_RESULTS`;
- title/excerpt are plain bounded strings.

- [ ] **Step 2: Run RED provider tests**

```bash
npm test -- src/modules/knowledge-research/exa-mcp-provider.test.ts
```

Expected: FAIL because provider classes do not exist.

- [ ] **Step 3: Install only the official MCP client SDK**

```bash
npm install @modelcontextprotocol/sdk
```

Do not install Agent-Reach, `mcporter`, OpenCLI or any social CLI.

- [ ] **Step 4: Implement normalized provider errors and adapter**

```ts
export type ResearchProviderFailureCode =
  | "CREDENTIAL_REQUIRED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_INVALID_RESPONSE";

export interface PublicResearchProvider {
  search(input: {
    query: string;
    maxResults: number;
    signal?: AbortSignal;
  }): Promise<PublicResearchHit[]>;
}
```

Production client construction:

```ts
const EXA_MCP_ENDPOINT = new URL("https://mcp.exa.ai/mcp");
const transport = new StreamableHTTPClientTransport(EXA_MCP_ENDPOINT);
const client = new Client({ name: "pak-knowledge-research", version: "1.0.0" });
```

Connect, call the tool, validate/normalize the response, then close in `finally`. The adapter must not read any Exa credential from `process.env` or Vault.

- [ ] **Step 5: Run provider tests, typecheck and dependency grep**

```bash
npm test -- src/modules/knowledge-research/exa-mcp-provider.test.ts
npm run typecheck
grep -R "EXA_API\|EXA_KEY\|apiKey.*exa\|mcp.exa.ai.*Authorization" -n src package.json || true
```

Expected: tests/typecheck PASS and grep has no credential plumbing.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/modules/knowledge-research/provider.ts src/modules/knowledge-research/exa-mcp-provider.ts src/modules/knowledge-research/exa-mcp-provider.test.ts
git commit -m "feat: add zero-secret Exa research adapter"
```

---

### Task 4: Search orchestration, authorization and safe candidate persistence

**Files:**
- Create: `src/modules/knowledge-research/service.ts`
- Create: `src/modules/knowledge-research/service.test.ts`
- Create: `src/app/(app)/knowledge-base/research-actions.ts`
- Create: `src/app/(app)/knowledge-base/research-actions.test.ts`

**Interfaces:**
- `KnowledgeResearchService.search()` creates RUNNING row, calls provider with a 12s abort, validates every returned URL through existing `validateKnowledgeSourceUrl`, deduplicates by canonical URL, persists at most 8 candidates, and completes/fails the run.
- Server action reuses authenticated actor + membership authorization and maps exactly to existing `knowledge:manage`.

- [ ] **Step 1: Write RED service tests**

```ts
it("validates and deduplicates provider URLs before persistence", async () => {
  const persisted: PublicResearchHit[][] = [];
  const service = new KnowledgeResearchService({
    repository: fakeRepository({ onComplete: (hits) => persisted.push(hits) }),
    provider: fakeProvider([
      { title: "A", url: "https://example.com/a#fragment", excerpt: "one", retrievedAt: "2026-09-13T12:00:00.000Z" },
      { title: "A duplicate", url: "https://example.com/a", excerpt: "two", retrievedAt: "2026-09-13T12:00:00.000Z" },
    ]),
    validateUrl: async (url) => new URL(url).origin + new URL(url).pathname,
  });

  await service.search({ organizationId: ORG_ID, query: "rail", actorUserId: USER_ID });
  expect(persisted[0]).toHaveLength(1);
});
```

Also test unsafe/private URL rejection, provider failure normalization, no credential fallback, and max-result truncation.

- [ ] **Step 2: Write RED action tests**

Test exact cases:
- unauthenticated → `You must be signed in to use Knowledge Research.`;
- REVIEWER/ANALYST → permission denied;
- OWNER/ADMIN/EDITOR → service called;
- malformed query rejected before provider call;
- provider failure returns safe message without raw payload.

- [ ] **Step 3: Run RED tests**

```bash
npm test -- src/modules/knowledge-research/service.test.ts src/app/\(app\)/knowledge-base/research-actions.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement service and guarded action**

Production action contract:

```ts
export type ResearchSearchActionResult =
  | { ok: true; run: ResearchRun; candidates: ResearchCandidate[] }
  | { ok: false; error: string; code?: "CREDENTIAL_REQUIRED" | "TEMPORARY_UNAVAILABLE" };

export async function searchKnowledgeResearchAction(input: unknown): Promise<ResearchSearchActionResult>;
```

Use existing server Supabase auth to resolve actor/membership; never use service-role for ordinary user research.

- [ ] **Step 5: Run focused tests + full existing Knowledge action regression**

```bash
npm test -- src/modules/knowledge-research/service.test.ts src/app/\(app\)/knowledge-base/research-actions.test.ts src/app/\(app\)/knowledge-base/actions.test.ts src/app/\(app\)/knowledge-base/ingestion-actions.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/knowledge-research/service.ts src/modules/knowledge-research/service.test.ts src/app/\(app\)/knowledge-base/research-actions.ts src/app/\(app\)/knowledge-base/research-actions.test.ts
git commit -m "feat: orchestrate governed public knowledge research"
```

---

### Task 5: Safe on-demand source preview using the existing URL boundary

**Files:**
- Modify: `src/modules/knowledge-research/service.ts`
- Modify: `src/modules/knowledge-research/service.test.ts`
- Modify: `src/app/(app)/knowledge-base/research-actions.ts`
- Modify: `src/app/(app)/knowledge-base/research-actions.test.ts`
- Test existing: `src/modules/knowledge-ingestion/url-safety.test.ts`

**Interfaces:**
- `previewCandidateSource({ organizationId, candidateId })` reloads the candidate server-side, then calls existing `fetchSafeKnowledgeUrl(candidate.canonicalUrl)`.
- Returns bounded sanitized preview text to the authenticated manager; does not persist full article text into `research_candidates`.
- Browser cannot provide source URL.

- [ ] **Step 1: Write RED service test proving candidate URL is authoritative**

```ts
it("previews the stored candidate URL, never a browser-supplied URL", async () => {
  const fetched: string[] = [];
  const service = createResearchService({
    candidate: { ...candidateFixture, canonicalUrl: "https://trusted.example/article" },
    fetchSource: async (url) => {
      fetched.push(url);
      return { canonicalUrl: url, text: "sanitized article", bytes: new Uint8Array([1]), contentType: "text/plain" };
    },
  });

  const preview = await service.previewCandidateSource({ organizationId: ORG_ID, candidateId: CANDIDATE_ID });
  expect(fetched).toEqual(["https://trusted.example/article"]);
  expect(preview.text).toBe("sanitized article");
});
```

- [ ] **Step 2: Add action schema/result tests**

`previewKnowledgeResearchSourceAction` input must be exactly `organizationId + candidateId`; test that a forged `sourceUrl` field is rejected.

- [ ] **Step 3: Run RED tests**

```bash
npm test -- src/modules/knowledge-research/service.test.ts src/app/\(app\)/knowledge-base/research-actions.test.ts
```

- [ ] **Step 4: Implement preview through existing `fetchSafeKnowledgeUrl`**

```ts
export type ResearchSourcePreview = {
  canonicalUrl: string;
  text: string;
  contentType: string;
};
```

Return at most the existing extraction text bound; do not return raw bytes to the browser.

- [ ] **Step 5: Run research + SSRF regression tests**

```bash
npm test -- src/modules/knowledge-research/service.test.ts src/app/\(app\)/knowledge-base/research-actions.test.ts src/modules/knowledge-ingestion/url-safety.test.ts
npm run typecheck
```

Expected: PASS, including private/loopback/redirect/DNS-rebinding tests already owned by URL ingestion.

- [ ] **Step 6: Commit**

```bash
git add src/modules/knowledge-research/service.ts src/modules/knowledge-research/service.test.ts src/app/\(app\)/knowledge-base/research-actions.ts src/app/\(app\)/knowledge-base/research-actions.test.ts
git commit -m "feat: add safe research source preview"
```

---

### Task 6: Atomic idempotent research-candidate → DRAFT Knowledge conversion

**Files:**
- Create: `supabase/migrations/20260913180030_research_candidate_conversion.sql`
- Create: `src/modules/knowledge-research/conversion-sql.test.ts`
- Modify: `src/modules/knowledge-ingestion/ingestion-service.ts`
- Modify: `src/modules/knowledge-ingestion/ingestion-service.test.ts`
- Modify: `src/modules/knowledge-research/repository.ts`
- Modify: `src/modules/knowledge-research/repository.test.ts`
- Modify: `src/modules/knowledge-research/service.ts`
- Modify: `src/modules/knowledge-research/service.test.ts`
- Modify: `src/app/(app)/knowledge-base/research-actions.ts`
- Modify: `src/app/(app)/knowledge-base/research-actions.test.ts`

**Interfaces:**
- Existing ordinary `KnowledgeIngestionService.ingestUrl()` remains behaviorally unchanged.
- Add a server-only reusable URL-ingestion method that accepts a trusted finalizer callback, not browser data.
- New RPC `finalize_research_candidate_ingestion` locks candidate + expected PROCESSING knowledge document, calls/duplicates the exact existing finalization invariants transactionally, creates DRAFT Knowledge, and sets candidate `CONVERTED + knowledge_record_id` in the same transaction.
- If candidate already CONVERTED, RPC returns the existing linked Knowledge record: repeated/double-click requests are idempotent.

- [ ] **Step 1: Write RED SQL tests for locking/idempotency/DRAFT-only**

```ts
expect(sql).toContain("create or replace function public.finalize_research_candidate_ingestion");
expect(sql).toMatch(/for update[\s\S]*research_candidates/i);
expect(sql).toMatch(/review_status\s*=\s*'CONVERTED'/i);
expect(sql).toMatch(/status[\s\S]*'DRAFT'/i);
expect(sql).not.toMatch(/status[\s\S]*'ACTIVE'/i);
expect(sql).toContain("knowledge_record_id");
```

Also assert execute is revoked from `public`/`anon` and granted only to `authenticated` after internal role checks.

- [ ] **Step 2: Write RED ingestion regression test for custom finalizer seam**

```ts
it("keeps ordinary URL ingestion on the existing finalizer", async () => {
  const finalize = vi.fn().mockResolvedValue(finalizationFixture);
  const service = createIngestionService({ finalize });
  await service.ingestUrl({ organizationId: ORG_ID, sourceUrl: "https://example.com", actorUserId: USER_ID });
  expect(finalize).toHaveBeenCalledOnce();
});
```

Add a second test proving the trusted custom finalizer receives the same `FinalizeKnowledgeIngestionInput` produced by ordinary URL ingestion.

- [ ] **Step 3: Run RED tests**

```bash
npm test -- src/modules/knowledge-research/conversion-sql.test.ts src/modules/knowledge-ingestion/ingestion-service.test.ts src/modules/knowledge-research/service.test.ts src/app/\(app\)/knowledge-base/research-actions.test.ts
```

- [ ] **Step 4: Implement the forward migration and repository RPC adapter**

The RPC must:
1. validate `has_org_role(p_organization_id, array['OWNER','ADMIN','EDITOR'])`;
2. lock candidate by `(organization_id,id)`;
3. immediately return linked Knowledge if already CONVERTED;
4. require SUGGESTED otherwise;
5. lock the expected PROCESSING `knowledge_documents` revision;
6. create the same DRAFT Knowledge + exact document revision snapshot as current ingestion finalization;
7. update candidate to CONVERTED and set `knowledge_record_id`;
8. return document + Knowledge identity.

No provider/search network call happens inside SQL.

- [ ] **Step 5: Add the trusted finalizer seam to ingestion service**

Target signature:

```ts
export type KnowledgeUrlFinalizer = (
  input: FinalizeKnowledgeIngestionInput,
) => Promise<KnowledgeIngestionFinalization>;

async ingestUrlWithFinalizer(
  input: UrlIngestionRequest,
  finalize: KnowledgeUrlFinalizer,
): Promise<{ documentId: string; record: KnowledgeRecord }>;
```

`ingestUrl()` delegates to `ingestUrlWithFinalizer(input, value => this.repository.finalize(value))`. Only server code can supply the callback.

- [ ] **Step 6: Implement `convertCandidateToDraft`**

Service flow:
- reload stored candidate by org/id;
- if already CONVERTED, return existing record through repository lookup;
- call `ingestUrlWithFinalizer` using candidate canonical URL and title as source label;
- custom finalizer calls `finalize_research_candidate_ingestion` with candidate ID plus the trusted extracted/fingerprint metadata;
- verify returned Knowledge status is DRAFT.

- [ ] **Step 7: Add action `createKnowledgeDraftFromResearchAction`**

Return:

```ts
export type ResearchConversionActionResult =
  | { ok: true; candidate: ResearchCandidate; record: KnowledgeRecord }
  | { ok: false; error: string };
```

Authorize `knowledge:manage` before conversion. Do not expose an `isCore` or `status` input.

- [ ] **Step 8: Run focused + complete ingestion regression tests**

```bash
npm test -- src/modules/knowledge-research/conversion-sql.test.ts src/modules/knowledge-research/repository.test.ts src/modules/knowledge-research/service.test.ts src/app/\(app\)/knowledge-base/research-actions.test.ts src/modules/knowledge-ingestion/ingestion-service.test.ts src/modules/knowledge-ingestion/finalize-sql.test.ts src/app/\(app\)/knowledge-base/ingestion-actions.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260913180030_research_candidate_conversion.sql src/modules/knowledge-research/conversion-sql.test.ts src/modules/knowledge-ingestion/ingestion-service.ts src/modules/knowledge-ingestion/ingestion-service.test.ts src/modules/knowledge-research/repository.ts src/modules/knowledge-research/repository.test.ts src/modules/knowledge-research/service.ts src/modules/knowledge-research/service.test.ts src/app/\(app\)/knowledge-base/research-actions.ts src/app/\(app\)/knowledge-base/research-actions.test.ts
git commit -m "feat: convert research candidates to draft knowledge"
```

---

### Task 7: Knowledge Base Research tab and review-first UX

**Files:**
- Create: `src/app/(app)/knowledge-base/research-panel.tsx`
- Create: `src/app/(app)/knowledge-base/research-panel.test.tsx`
- Modify: `src/app/(app)/knowledge-base/knowledge-base-manager.tsx`
- Modify: `src/app/(app)/knowledge-base/knowledge-base-manager.test.tsx`

**Interfaces:**
- Manager remains owner of selected organization and `recordsByOrganization`.
- Research panel receives `{ organization, onDraftCreated }` and handles its own query/run/candidate state.
- `onDraftCreated(record)` inserts/replaces the created DRAFT Knowledge into existing Knowledge state and may switch user back to Knowledge view.
- Research tab is rendered only when `can(role, "knowledge:manage")`.

- [ ] **Step 1: Write RED Research panel tests**

Concrete expectations:

```tsx
render(<ResearchPanel organization={editorOrg} onDraftCreated={onDraftCreated} />);
expect(screen.getByRole("heading", { name: "Research public sources" })).toBeTruthy();
expect(screen.getByText(/external public sources/i)).toBeTruthy();
expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
```

After typing a valid query and mocking search success, assert candidate card displays title, hostname, URL/excerpt/retrieval time and buttons `Read source`, `Create Knowledge Draft`, `Dismiss`.

After conversion, assert:
- `onDraftCreated` receives a DRAFT record;
- card shows `Converted to DRAFT Knowledge`;
- second create button is absent/disabled;
- no `Activate` button exists in Research panel.

- [ ] **Step 2: Write RED manager integration tests**

Assert:
- OWNER/ADMIN/EDITOR see `Knowledge` and `Research` tabs;
- REVIEWER/ANALYST do not see Research tab;
- current manual Knowledge create/edit/core/archive/delete controls remain present in Knowledge view.

- [ ] **Step 3: Run RED UI tests**

```bash
npm test -- src/app/\(app\)/knowledge-base/research-panel.test.tsx src/app/\(app\)/knowledge-base/knowledge-base-manager.test.tsx src/app/\(app\)/knowledge-base/core-knowledge-manager.test.tsx src/app/\(app\)/knowledge-base/knowledge-ingestion-panel.test.tsx
```

- [ ] **Step 4: Implement focused panel and thin manager tab integration**

Research panel state must include explicit loading/error/preview states. Use plain text rendering for excerpts/previews; never `dangerouslySetInnerHTML`.

Show copy:

```text
Research results are external public sources. Review the source before creating Knowledge. Research results are not automatically trusted or used for AI grounding.
```

If server returns `CREDENTIAL_REQUIRED`, show:

```text
Public research is currently unavailable because the provider now requires credentials. No key will be requested or stored.
```

- [ ] **Step 5: Run UI regression + accessibility-oriented selectors**

```bash
npm test -- src/app/\(app\)/knowledge-base/research-panel.test.tsx src/app/\(app\)/knowledge-base/knowledge-base-manager.test.tsx src/app/\(app\)/knowledge-base/core-knowledge-manager.test.tsx src/app/\(app\)/knowledge-base/knowledge-ingestion-panel.test.tsx
npm run typecheck
npm run lint
```

Expected: PASS (existing unrelated lint warnings may remain documented; no new lint errors).

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/knowledge-base/research-panel.tsx src/app/\(app\)/knowledge-base/research-panel.test.tsx src/app/\(app\)/knowledge-base/knowledge-base-manager.tsx src/app/\(app\)/knowledge-base/knowledge-base-manager.test.tsx
git commit -m "feat: add review-first Knowledge Base research tab"
```

---

### Task 8: Product docs, traceability and deterministic E2E coverage

**Files:**
- Modify: `docs/product/PAK_MASTER_PRD.md`
- Modify: `docs/product/PAK_MASTER_TRD.md`
- Modify: `docs/product/PAK_BACKEND_SCHEMA.md`
- Modify: `docs/product/PAK_UI_UX_SPEC.md`
- Modify: `docs/product/PAK_SYSTEM_WORKFLOWS.md`
- Modify: `docs/product/PAK_INTEGRATION_SPEC.md`
- Modify: `docs/product/PAK_DEVELOPMENT_ROADMAP.md`
- Modify: `docs/product/PAK_TRACEABILITY_MATRIX.md`
- Create/modify Playwright spec for Knowledge Base research.
- Modify readiness tests only if Knowledge Base status text changes.

**Interfaces:**
- Governing docs receive permanent `PRD-RSCH-001..012` mapping and corresponding TRD/UX/DB/workflow requirements.
- E2E uses deterministic fake provider behavior; CI never depends on live Exa.

- [ ] **Step 1: Add RED traceability/readiness tests if current repo has doc assertions**

At minimum add a test that loads the traceability matrix and asserts `PRD-RSCH-001..012` appears with implementation/test mappings.

- [ ] **Step 2: Add Playwright smoke using deterministic provider injection/fixture**

Scenario:
1. sign in as knowledge manager fixture;
2. open Knowledge Base;
3. click Research;
4. search `railway safety modernization`;
5. see deterministic candidate;
6. preview source;
7. create Knowledge draft;
8. switch to Knowledge and assert record is DRAFT;
9. assert it is not automatically ACTIVE/Core.

Use the existing test-double pattern in the repository; never call live Exa in CI.

- [ ] **Step 3: Synchronize governing docs**

Document exact flow:

```text
Knowledge Base Research -> no-key Exa MCP search -> persisted candidate -> safe source preview -> explicit human conversion -> existing URL extraction/finalization -> DRAFT Knowledge -> explicit later activation -> ACTIVE-only generation grounding
```

Integration spec must explicitly state:
- no research secret schema;
- fixed public MCP endpoint;
- fail-closed `CREDENTIAL_REQUIRED` behavior;
- no authenticated social channels;
- no direct candidate grounding.

- [ ] **Step 4: Run docs/unit/E2E affected gates**

```bash
npm test -- src/modules/knowledge-research src/app/\(app\)/knowledge-base
npm run typecheck
npm run lint
npm run build
npm run test:e2e -- --grep "Knowledge.*Research|Research.*Knowledge"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/product tests src
# Include only files actually changed by this task.
git commit -m "docs: govern and verify zero-secret knowledge research"
```

---

### Task 9: Full exact-head verification, security review and live Supabase rollout

**Files:**
- No feature-code changes unless verification exposes a real defect.
- Update handoff/readiness evidence only after fresh verification.

**Interfaces:**
- Produces release evidence for the exact implementation HEAD.
- Applies only new unapplied migrations after inspecting live Supabase migration state.
- Uses reversible synthetic fixtures only.

- [ ] **Step 1: Run the complete local/CI-equivalent gate**

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Also run any worker/container/publishing smoke commands currently required by repository CI; do not omit newly-added gates from the live workflow.

- [ ] **Step 2: Security/architecture review before rollout**

Verify by code search:

```bash
grep -R "EXA_API\|EXA_KEY\|TWITTER_AUTH\|REDDIT_\|LINKEDIN_\|opencli\|mcporter" -n src supabase package.json || true
grep -R "dangerouslySetInnerHTML" -n src/app/\(app\)/knowledge-base src/modules/knowledge-research || true
```

Expected:
- no research credential plumbing;
- no OpenCLI/mcporter/social login dependency;
- no raw external HTML rendering.

Review migration grants/RLS for direct-browser mutation bypass and confirm `research_candidates` can never be direct generation grounding.

- [ ] **Step 3: Inspect live Supabase state before mutation**

Use the Supabase skill/tooling required by the repo. Confirm whether `20260913180000_knowledge_research.sql` and `20260913180030_research_candidate_conversion.sql` are absent before applying them. Never reapply an existing migration.

- [ ] **Step 4: Apply migrations in order and run reversible live probes**

Synthetic proof must cover:
- OWNER/ADMIN/EDITOR authorized path;
- REVIEWER/ANALYST denial;
- cross-org candidate denial;
- direct INSERT/UPDATE table denial;
- idempotent conversion returning one DRAFT Knowledge record under repeated calls;
- ACTIVE/Core never set by research conversion.

Clean up synthetic rows after proof.

- [ ] **Step 5: Live provider acceptance with zero secret**

Run one controlled research query through the production no-key Exa MCP route. Verify:
- no API/access/secret key was configured;
- results are bounded and persisted;
- one selected public URL can be previewed through the existing safe URL boundary;
- no result is automatically converted or grounded.

If Exa now requires a credential, verify `CREDENTIAL_REQUIRED` fail-closed behavior instead and leave research disabled; do not add a key.

- [ ] **Step 6: Run Supabase security/performance advisors**

Classify findings. Fix research-caused issues before release; document unrelated pre-existing findings without weakening security.

- [ ] **Step 7: Exact-head GitHub CI and release gate**

Push exact HEAD, inspect every required workflow job, and require GREEN before merge-ready status. Vercel preview failure caused purely by known external quota/protection must be distinguished from application failures, but no application test may be waived.

- [ ] **Step 8: Final governed review**

Use verification-before-completion and requesting-code-review. Supervisor confirms Architecture, Planning, Coding, Typecheck/Test, E2E and Integration/Release evidence is complete.

- [ ] **Step 9: Commit only evidence/doc changes produced by verification**

```bash
git add docs/handoffs docs/product
# Add only files that actually changed.
git commit -m "test: verify zero-secret knowledge research rollout"
```

Do not create an empty commit if no documentation changed.

---

## Acceptance Checklist

The slice is complete only when all are true:

- Knowledge Base has a manager-only Research tab.
- Search uses fixed `https://mcp.exa.ai/mcp` with no new credential.
- Provider requiring credentials disables research rather than prompting for a key.
- Research candidates persist under organization RLS but full article text does not.
- Candidate URLs are validated/canonicalized before persistence/preview.
- Source preview reuses existing DNS-pinned redirect-safe URL fetch logic.
- Research candidate cannot directly enter Content Studio/generation context.
- Conversion is explicit, DRAFT-only, non-Core and idempotent.
- Ordinary Knowledge manual/document/URL flows still pass regression tests.
- REVIEWER/ANALYST cannot use the research surface.
- Cross-org access fails at both action and RLS/RPC boundaries.
- No Agent-Reach full runtime, `mcporter`, OpenCLI, social-login tooling or provider secret was added.
- Governing docs and traceability match actual implementation.
- Full exact-head CI + Playwright + live RLS/security probes are green.
