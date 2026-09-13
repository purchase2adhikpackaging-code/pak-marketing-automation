# PAK Knowledge Research — Zero-Secret Research Design

**Date:** 2026-09-13  
**Status:** Proposed design approved in chat; implementation not started  
**Repository:** `purchase2adhikpackaging-code/pak-marketing-automation`  
**Design branch:** `feature/knowledge-research-zero-secret`  
**Base:** current `foundation/org-profile-brand-knowledge` head at design start (`b2e0b03ba43e8e01d9935a04d80c086d9b6dc79e`)  
**Related active PR:** #40 — Organization Profile, Brand Kit & Knowledge Ingestion

## 1. Goal

Add a **Research** tab inside the existing PAK Knowledge Base so authorized users can discover current public web sources, review them, and deliberately convert selected findings into **DRAFT Knowledge**.

The feature must add useful internet research capability without introducing any new user-managed API key, access token, OAuth credential, cookie, browser login, or secret key.

The approved product choice is review-first:

`Research query -> Suggested research sources -> Human review -> Create Knowledge Draft -> Existing Knowledge review -> Explicit activation`

Internet research is never automatically trusted grounding.

## 2. Architectural position

This is a Knowledge Base extension, not a replacement for the existing Knowledge Base lifecycle and not a second content store.

The existing architecture remains authoritative for:

- organization tenancy and RLS;
- Knowledge Base RBAC;
- `knowledge_records` lifecycle and revision/CAS behavior;
- explicit DRAFT -> ACTIVE promotion;
- Core Knowledge authority;
- immutable generation provenance;
- private Media Library storage;
- document/URL ingestion security boundaries introduced by the organization-profile/brand/knowledge foundation work.

The research subsystem adds a **public-source discovery and review layer** before existing Knowledge creation.

## 3. Why not install the full Agent-Reach runtime

Agent-Reach is useful as a routing/reference model for internet research, but its full installation is intentionally **not** embedded into the PAK application runtime.

Reasons:

1. Full Agent-Reach orchestrates multiple CLIs and login-backed channels that PAK does not need for this slice.
2. Some Agent-Reach channels can depend on cookies, local browser sessions, platform logins, or platform-specific credentials.
3. PAK already has a provider-neutral integration architecture and strict server-side security boundaries.
4. Pulling a desktop/CLI-oriented multi-channel runtime directly into Next.js/Supabase would unnecessarily widen the attack and operational surface.

PAK therefore adopts only the **credential-free research capabilities and routing concepts** needed for this feature behind its own typed server-side adapter boundary.

## 4. Credential policy — hard requirement

### 4.1 Allowed

The first release may use only providers/transports that require **no new credential** from PAK or the organization:

- Exa public MCP search endpoint, while it remains available without an API key;
- Jina Reader public URL-reading endpoint, while it remains available without an API key;
- ordinary public RSS/Atom feeds fetched over HTTPS.

Existing PAK infrastructure credentials already required by the application may continue to be used for PAK authentication/database/runtime operations. They are not research-provider credentials.

### 4.2 Forbidden in this feature

The feature must not request, store, add to Vault, or depend on:

- Exa API keys;
- Twitter/X cookies or tokens;
- Reddit credentials/cookies;
- Facebook/Instagram browser sessions or access tokens;
- LinkedIn login state or tokens;
- Google/YouTube API keys;
- OpenCLI browser session access;
- any new API/access/secret key;
- any user password supplied for external research sources.

If a provider later changes from no-key access to credential-required access, that provider must fail closed and be disabled until a separate product decision explicitly approves a credentialed integration.

## 5. Scope

### 5.1 In scope

- Knowledge Base `Research` tab.
- Organization-scoped research queries.
- Public web discovery through a provider-neutral research adapter.
- Safe source reading for selected public URLs.
- Optional RSS/Atom discovery/reading where directly relevant.
- Persisted research runs and candidates for review/audit.
- Human review and selective conversion to existing DRAFT `knowledge_records`.
- Source provenance retained when a candidate becomes Knowledge.
- RBAC, tenant isolation, URL safety, rate limits, timeout/size bounds, safe errors and deterministic tests.

### 5.2 Out of scope

- Social-account login or social scraping requiring authenticated sessions.
- Publishing, commenting, liking or messaging.
- Automatic activation of Knowledge.
- Automatic promotion to Core Knowledge.
- Automatic content generation directly from unreviewed research candidates.
- Vector database/RAG redesign.
- General-purpose browser automation.
- Replacing current document/URL ingestion.
- Installing the full Agent-Reach package in the browser, Next.js app bundle or Supabase database runtime.
- Paid research providers.
- YouTube transcript extraction in the first release.

## 6. Product requirements

The following design-local requirement IDs are authoritative for this slice until synchronized into the governing PRD/TRD/UX/traceability documents during implementation.

### PRD-RSCH-001 — Research entry point

Knowledge Base exposes a `Research` tab alongside the existing Knowledge management surface.

### PRD-RSCH-002 — RBAC

Only users with existing `knowledge:manage` permission may create research runs, inspect full candidates through the research workflow, or create Knowledge drafts from candidates. Read-only Knowledge users do not receive research mutation authority.

### PRD-RSCH-003 — Tenant isolation

Every persisted research run and candidate belongs to exactly one organization. Cross-organization reads/mutations are denied by RLS and server-side authorization.

### PRD-RSCH-004 — Zero-secret execution

Research execution must not require or accept any new API key, access token, OAuth credential, cookie, login state or external-platform secret.

### PRD-RSCH-005 — Review first

A research result is a **candidate**, not Knowledge. No result becomes `knowledge_records` until an authorized user deliberately selects `Create Knowledge Draft`.

### PRD-RSCH-006 — DRAFT only

Research-to-Knowledge conversion always creates `knowledge_records.status = DRAFT`. Existing activation actions remain the only route to ACTIVE.

### PRD-RSCH-007 — Provenance

Converted Knowledge retains enough source metadata to identify the originating research candidate, provider, canonical source URL, retrieval time and source snapshot/fingerprint where available.

### PRD-RSCH-008 — Source safety

Source reading follows the existing safe URL ingestion boundary: public `http/https` only, validated DNS/redirect hops, no loopback/private/link-local/cloud-metadata targets, bounded response sizes and sanitized text.

### PRD-RSCH-009 — Bounded results

Query length, result count, candidate text, fetched source bytes, redirect count, execution time and persisted snapshot sizes are explicitly bounded.

### PRD-RSCH-010 — Fail closed

Provider authentication/terms changes, malformed responses, timeouts, rate limits and unsafe source URLs return normalized non-secret failures. They never cause a fallback to credentialed providers.

### PRD-RSCH-011 — No direct grounding

Content Studio and generation-context resolution continue to use ACTIVE Knowledge only. `research_candidates` never enter prompts or generation context directly.

### PRD-RSCH-012 — Auditability

Research runs store safe metadata sufficient to explain what was queried, which provider path was used, when it ran, and which candidate was converted to which Knowledge record.

## 7. UX design

### 7.1 Knowledge Base tabs

The existing Knowledge Base surface gains two top-level views:

- `Knowledge`
- `Research`

The current manual create/edit/activate/archive/delete experience remains under `Knowledge` with no lifecycle regression.

### 7.2 Research tab layout

For a selected organization, the Research tab contains:

1. **Search input** — bounded research question/topic.
2. **Search button** — disabled while a run is executing.
3. **Run status** — searching, completed, partial, failed.
4. **Suggested source cards** — each card shows:
   - source title;
   - hostname/source label;
   - canonical URL;
   - provider path (`Exa`, `Jina`, `RSS` as applicable);
   - concise excerpt;
   - retrieval timestamp;
   - source-read status;
   - `Read source`;
   - `Create Knowledge Draft`.
5. **Converted state** — after conversion, card links to the created DRAFT Knowledge record and cannot silently create duplicates from repeated clicks.

### 7.3 Research result trust language

The UI clearly states that research results are external public sources and require review. It must not label an internet result as `approved`, `verified`, `official` or `trusted` merely because it was returned by a provider.

### 7.4 Error states

Errors are actionable but secret-safe, e.g.:

- `Research provider is temporarily unavailable.`
- `This source could not be read safely.`
- `This public source redirected to a blocked network destination.`
- `Research service currently requires credentials and has been disabled.`

Raw provider payloads, stack traces, internal network details and secrets are never rendered.

## 8. Data model

### 8.1 `research_runs`

Proposed organization-scoped table:

- `id uuid primary key`
- `organization_id uuid not null`
- `query text not null`
- `provider text not null`
- `status text not null` (`RUNNING|COMPLETED|PARTIAL|FAILED`)
- `result_count integer not null default 0`
- `failure_code text nullable`
- `failure_metadata jsonb nullable` — strictly safe/normalized metadata only
- `created_by uuid nullable`
- `created_at timestamptz not null`
- `completed_at timestamptz nullable`

`provider` records the provider route used for the run, not a credential/config object.

### 8.2 `research_candidates`

Proposed organization-scoped table:

- `id uuid primary key`
- `organization_id uuid not null`
- `research_run_id uuid not null`
- `provider text not null`
- `title text not null`
- `canonical_url text not null`
- `source_host text not null`
- `excerpt text not null`
- `source_text_snapshot text nullable` — bounded sanitized text only
- `source_fingerprint text nullable`
- `retrieved_at timestamptz not null`
- `review_status text not null` (`SUGGESTED|CONVERTED|DISMISSED`)
- `knowledge_record_id uuid nullable`
- `created_at timestamptz not null`

### 8.3 Invariants

- candidate organization must match research-run organization;
- linked Knowledge organization must match candidate organization;
- `knowledge_record_id` is set only by authoritative conversion logic;
- a candidate may create at most one authoritative Knowledge draft;
- conversion is idempotent;
- browser cannot directly insert authoritative research rows or set conversion linkage;
- research candidates do not reuse `knowledge_records.status`; they remain a separate pre-Knowledge review state;
- no secret/token/cookie fields exist in either table.

## 9. Provider-neutral research contracts

Proposed server-only domain interface:

```ts
export interface PublicResearchProvider {
  search(input: PublicResearchQuery): Promise<PublicResearchSearchResult>;
}

export interface PublicSourceReader {
  read(input: PublicSourceReadRequest): Promise<PublicSourceReadResult>;
}
```

Domain models contain only provider-neutral fields such as title, canonical URL, excerpt, retrieved timestamp and safe provider metadata.

Provider-specific MCP/HTTP payloads remain inside adapters.

### 9.1 Exa search adapter

The initial search adapter may call Exa's public MCP endpoint only while the no-key route is operational.

Requirements:

- no auth header generated from PAK secrets;
- bounded result count;
- strict response schema validation;
- normalized timeout/rate-limit/provider failure mapping;
- no provider-returned HTML rendered directly;
- URLs pass canonicalization/safety checks before source reading.

If the endpoint begins requiring authentication, the adapter returns `CREDENTIAL_REQUIRED` and is disabled rather than asking the user for a key.

### 9.2 Jina Reader adapter

Jina Reader may be used to obtain readable text for an already-selected public URL.

PAK must still enforce its own URL safety boundary before and across redirects. A third-party reader does not replace PAK SSRF controls or source validation.

### 9.3 RSS/Atom adapter

RSS/Atom may be fetched directly for explicitly supported public HTTPS feeds. Feed entries are normalized into the same candidate shape. Feed parsing is bounded and script/HTML content is sanitized.

## 10. Server execution boundary

Research calls occur server-side only.

The browser sends safe intent:

```text
organizationId + query
```

or, for candidate enrichment/conversion:

```text
organizationId + researchCandidateId
```

The browser does **not** submit authoritative provider responses, source snapshots, fingerprints, provider identity overrides, conversion status, or target Knowledge status.

The server:

1. authenticates actor;
2. resolves organization membership;
3. checks `knowledge:manage`;
4. applies input/rate bounds;
5. invokes the allowlisted no-secret research adapter;
6. validates/canonicalizes returned URLs;
7. persists normalized run/candidate records under the organization;
8. optionally reads a selected source through the existing safe URL boundary;
9. converts an approved candidate through an authoritative transaction/RPC to DRAFT Knowledge.

## 11. Research-to-Knowledge conversion

Conversion must reuse the existing Knowledge repository/domain rules wherever possible.

Authoritative conversion behavior:

- validates actor and `knowledge:manage` permission;
- reloads candidate by `organization_id + candidate_id`;
- rejects cross-org or missing candidate;
- if already converted, returns the existing Knowledge record rather than creating another;
- composes bounded Knowledge title/content from the reviewed candidate/source snapshot;
- writes `source_type = URL` (or the existing compatible URL/source enum);
- writes source label/URL provenance;
- creates `status = DRAFT` only;
- atomically links `research_candidates.knowledge_record_id` to the new record;
- never sets `is_core = true`;
- never auto-activates.

Where application-level repository composition cannot guarantee idempotent conversion under concurrency, a narrow SQL RPC/transaction becomes the authoritative boundary.

## 12. Relationship with existing document/URL ingestion

The active foundation work already introduces safe document and URL ingestion. Research must **reuse**, not duplicate, those controls.

Reuse targets include:

- public URL canonicalization;
- redirect-hop validation;
- DNS/private-network rejection;
- bounded extraction/sanitization patterns;
- DRAFT-only Knowledge creation discipline;
- existing Knowledge revision/provenance semantics.

Research differs from URL ingestion only in the discovery stage: a provider suggests public sources before the user elects to ingest/convert one.

## 13. RBAC and RLS

### 13.1 Application authorization

Research mutation permission maps to existing `knowledge:manage`.

No new broad role is introduced.

### 13.2 Database authorization

Both research tables enable RLS.

Policies must follow existing organization membership helpers/conventions. At minimum:

- organization members with appropriate read visibility can see allowed research state only as required by UX;
- create/update/conversion operations are performed through guarded server actions and/or narrow RPCs;
- authenticated browser clients cannot forge cross-org rows;
- `anon` receives no research-table privileges;
- conversion linkage cannot be arbitrarily changed by ordinary clients.

The implementation plan must define exact grants/policies after inspecting the then-current branch schema and existing Knowledge policies.

## 14. Security design

### 14.1 SSRF

Every URL that PAK itself reads must pass the existing URL-safety implementation, including redirect-hop validation and DNS pinning/rebinding protection where applicable.

### 14.2 Prompt/content injection

External source text is untrusted data.

Research candidates are not sent directly to generation models. After conversion, only ACTIVE Knowledge may later enter the existing generation-context resolver, which preserves the established grounding boundary.

Any future AI summarization of research must treat source text as quoted data and must be separately designed; it is not part of this slice.

### 14.3 XSS/content safety

Provider HTML is never injected into the UI. Persisted excerpts/snapshots are plain sanitized text. URLs are encoded/rendered through safe links.

### 14.4 Resource exhaustion

Implementation defines and tests hard limits for:

- query length;
- results per run;
- concurrent research operations per actor/org;
- provider timeout;
- redirects;
- source bytes;
- extracted text characters;
- persisted candidate count/size.

### 14.5 Egress allowlist

The server-side research adapter may connect only to the explicitly approved public research endpoints and the validated public source URL being read. No generic arbitrary internal proxy endpoint is created.

### 14.6 Privacy

Research queries may contain business topics but must not be populated automatically with candidate/client PII. The UI should advise users not to search using sensitive personal data. Provider requests must not include PAK secrets or private Knowledge content in this slice.

## 15. Reliability and provider drift

No-key public services may change behavior without notice.

Therefore:

- adapter health is treated as external dependency health, not PAK auth health;
- provider schema is validated at runtime;
- unexpected auth challenge becomes `CREDENTIAL_REQUIRED`;
- no automatic fallback may introduce credentials;
- no-key providers can be disabled independently;
- existing Knowledge Base remains fully usable when Research is unavailable;
- research failures never block manual Knowledge or document/URL ingestion.

A future credentialed provider would require a separate design/approval and existing Integration Vault rules.

## 16. Observability

Persist safe operational metadata:

- research run ID;
- organization ID;
- provider;
- status;
- duration bucket/metric;
- result count;
- normalized failure code;
- actor ID in authorized audit context.

Do not log:

- cookies;
- auth headers;
- external account credentials;
- full private Knowledge context;
- raw unbounded provider responses.

## 17. Testing strategy

Implementation follows TDD RED -> GREEN for every behavior slice.

### 17.1 Unit/contract tests

- research query schema bounds;
- provider-neutral result validation;
- Exa adapter normal response;
- malformed provider payload;
- timeout/rate limit;
- `CREDENTIAL_REQUIRED` fail-closed behavior;
- URL canonicalization and unsafe URL rejection;
- Jina/RSS normalization;
- candidate-to-DRAFT conversion;
- conversion idempotency;
- no auto-activation/no Core mutation.

### 17.2 Authorization tests

- OWNER/ADMIN/EDITOR according to current `knowledge:manage` contract;
- read-only roles denied mutation;
- unauthenticated denied;
- cross-org candidate/run access denied.

### 17.3 SQL/RLS tests

- RLS enabled;
- anon denied;
- cross-tenant select/insert/update denied;
- authoritative conversion linkage protected;
- same-org foreign-key/invariant guards;
- DRAFT-only conversion.

### 17.4 UI tests

- Research tab visible in Knowledge Base;
- role-aware controls;
- loading/empty/error/partial states;
- candidate cards render safe metadata;
- `Create Knowledge Draft` produces DRAFT state;
- repeated conversion does not duplicate Knowledge;
- existing Knowledge tab behavior remains intact.

### 17.5 E2E

Playwright deterministic provider fake verifies:

`Knowledge Base -> Research -> query -> candidates -> inspect -> Create Knowledge Draft -> Knowledge tab -> DRAFT record`

No live Exa/Jina request is required in CI.

### 17.6 Live acceptance

A controlled non-secret live smoke may verify the public provider path in a staging/production-like runtime only after deterministic CI is green. Live-provider availability is not fabricated by tests.

## 18. Deployment and runtime

Preferred first implementation stays within the existing PAK server/Supabase architecture.

No separate Railway research worker is required unless runtime constraints discovered during implementation prove it necessary. If a new worker would become necessary, implementation stops and the architecture is re-reviewed before adding infrastructure.

No new research credential is added to:

- Vercel environment variables;
- Supabase Vault;
- Railway variables;
- organization Integration Settings.

## 19. Governing-document updates required during implementation

Before the feature is declared complete, implementation must synchronize:

- `docs/product/PAK_MASTER_PRD.md`
- `docs/product/PAK_MASTER_TRD.md`
- `docs/product/PAK_BACKEND_SCHEMA.md`
- `docs/product/PAK_UI_UX_SPEC.md`
- `docs/product/PAK_SYSTEM_WORKFLOWS.md`
- `docs/product/PAK_INTEGRATION_SPEC.md`
- `docs/product/PAK_DEVELOPMENT_ROADMAP.md`
- `docs/product/PAK_TRACEABILITY_MATRIX.md`

The feature should be scheduled so it does not disrupt completion/merge readiness of the active organization-profile/brand/knowledge foundation work.

## 20. Engineering governance

Implementation must use the governed development workflow:

1. Supervisor/Orchestrator — protects scope, architecture and completion criteria.
2. Architecture Agent — checks compatibility with Knowledge, integration, tenancy and security contracts.
3. Planning Agent — writes the implementation plan and dependency order.
4. Coding Agent — implements only approved slices with TDD.
5. Typecheck/Test Agent — verifies focused tests through full CI gates.
6. E2E Verification Agent — runs Playwright/runtime validation where applicable.
7. Integration/Release Agent — reconciles migrations/docs/CI/PR readiness and rollout evidence.

These are development roles, not runtime agents inside PAK.

## 21. Acceptance criteria

The feature is complete only when all of the following are true:

1. Knowledge Base has a Research tab integrated with the existing organization context.
2. Authorized users can perform bounded public research without adding any new key/token/secret/login.
3. Search results are persisted as organization-scoped research candidates, not Knowledge.
4. A candidate becomes Knowledge only after an explicit authorized action.
5. Converted Knowledge is DRAFT and cannot auto-activate or auto-Core.
6. Content Studio/generation never consumes research candidates directly.
7. Research-to-Knowledge conversion is idempotent and provenance-preserving.
8. RLS/RBAC prevents cross-organization access and unauthorized mutation.
9. Unsafe/private-network source URLs are rejected through the existing URL-safety boundary.
10. Existing manual Knowledge and document/URL ingestion remain fully functional if research providers fail.
11. Provider drift to credential-required access fails closed; no credential prompt/fallback is introduced.
12. Deterministic unit, SQL/RLS, typecheck, lint, build and Playwright gates are green on exact HEAD.
13. Required governing docs/traceability/readiness evidence are updated.
14. No Lovable changes or credits are used.
15. No new API/access/secret key is required anywhere in PAK for this feature.

## 22. Implementation sequencing constraint

Because PR #40 is active and modifies the same Knowledge Base area, this feature must not be implemented by independently duplicating or racing unfinished foundation code.

The implementation plan must begin from the then-current repository state and choose one safe integration route:

- implement after the relevant PR #40 Knowledge Base/ingestion seams are complete and stable; or
- if PR #40 remains open, base the feature branch on its verified head and preserve its exact invariants.

In either case, current repository state plus governing docs take precedence over this design if the foundation evolves. Any material architectural conflict requires an explicit design update before code changes.
