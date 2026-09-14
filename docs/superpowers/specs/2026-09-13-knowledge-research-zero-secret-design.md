# PAK Knowledge Research — Zero-Secret Research Design

**Date:** 2026-09-13  
**Status:** Design self-reviewed; awaiting user review; implementation not started  
**Repository:** `purchase2adhikpackaging-code/pak-marketing-automation`  
**Design branch:** `feature/knowledge-research-zero-secret`  
**Base:** `foundation/org-profile-brand-knowledge` head at design start (`b2e0b03ba43e8e01d9935a04d80c086d9b6dc79e`)  
**Related active PR:** #40 — Organization Profile, Brand Kit & Knowledge Ingestion

## 1. Goal

Add a **Research** tab inside the existing PAK Knowledge Base so authorized users can discover current public web sources, review them, and deliberately convert selected findings into **DRAFT Knowledge**.

The feature must add useful internet research capability without introducing any new user-managed API key, access token, OAuth credential, cookie, browser login, or secret key.

Approved flow:

`Research query -> Suggested public sources -> Human review -> Create Knowledge Draft -> Existing Knowledge review -> Explicit activation`

Internet research is never automatically trusted grounding.

## 2. Architectural position

This is a Knowledge Base extension, not a replacement lifecycle and not a second trusted-content store.

The existing architecture remains authoritative for:

- organization tenancy and RLS;
- Knowledge Base RBAC;
- `knowledge_records` lifecycle and revision/CAS behavior;
- explicit DRAFT -> ACTIVE promotion;
- Core Knowledge authority;
- immutable generation provenance;
- private Media Library storage;
- document/URL ingestion security boundaries on the active foundation branch.

The research subsystem adds a **public-source discovery and review layer before Knowledge creation**.

## 3. Agent-Reach relationship

Agent-Reach is used as the reference model for credential-free internet research routing, but the full Agent-Reach runtime is intentionally **not embedded** into PAK.

Reasons:

1. Full Agent-Reach orchestrates multiple desktop/CLI and login-backed channels that PAK does not need here.
2. Some channels depend on cookies, local browser sessions, platform logins or credentials.
3. PAK already has provider-neutral server boundaries, organization isolation and established security/provenance contracts.
4. Pulling the full multi-channel runtime into Next.js/Supabase would widen the operational and attack surface without improving this bounded use case.

PAK therefore implements only the approved **zero-secret research subset** behind its own typed server-side adapter boundary.

## 4. Credential policy — hard requirement

### 4.1 Allowed provider paths

The first release may use only transports that require **no new credential** from PAK or the organization:

- Exa public MCP search endpoint, only while its no-key path remains operational;
- PAK's existing safe public-URL fetch/extraction boundary for selected source reading;
- ordinary public RSS/Atom feeds fetched over HTTPS;
- Jina Reader only as an optional no-key readability fallback if implementation proves it necessary; the feature must not depend on Jina for correctness.

Existing PAK infrastructure credentials required for PAK authentication/database/runtime operations remain unchanged and are not research-provider credentials.

### 4.2 Forbidden

This feature must not request, store, add to Vault, or depend on:

- Exa API keys;
- Twitter/X cookies or tokens;
- Reddit credentials/cookies;
- Facebook/Instagram browser sessions or access tokens;
- LinkedIn login state or tokens;
- Google/YouTube API keys;
- OpenCLI browser session access;
- any new API/access/secret key;
- any external account password.

If a provider changes from no-key access to credential-required access, that route fails closed with `CREDENTIAL_REQUIRED` and is disabled. PAK must not prompt the user for a key as a fallback.

## 5. Scope

### 5.1 In scope

- Knowledge Base `Research` tab.
- Organization-scoped research queries.
- Public web discovery through a provider-neutral adapter.
- Persisted research runs and candidates for review/audit.
- Safe source reading only after user selection.
- Human review and explicit conversion to existing DRAFT Knowledge.
- Source provenance retained on conversion.
- RBAC, RLS, tenant isolation, URL safety, timeout/size/rate bounds and safe errors.
- Deterministic provider fakes for CI.

### 5.2 Out of scope

- Authenticated social research requiring cookies/logins.
- Publishing, commenting, liking or messaging.
- Automatic activation or automatic Core Knowledge promotion.
- Direct model grounding from research candidates.
- Vector database/RAG redesign.
- General-purpose browser automation.
- Replacing existing document/URL ingestion.
- Installing the full Agent-Reach package in the browser, app bundle or database runtime.
- Paid research providers.
- YouTube transcript extraction in the first release.

## 6. Product requirements

These design-local IDs govern this slice until synchronized into the product PRD/TRD/UX/traceability documents during implementation.

### PRD-RSCH-001 — Research entry point

Knowledge Base exposes a `Research` tab alongside the existing Knowledge management surface.

### PRD-RSCH-002 — RBAC

Only actors with existing `knowledge:manage` permission may create research runs or convert candidates to Knowledge drafts. Read-only Knowledge users gain no research mutation authority.

### PRD-RSCH-003 — Tenant isolation

Every persisted research run and candidate belongs to exactly one organization. Cross-organization reads/mutations are denied by RLS and server authorization.

### PRD-RSCH-004 — Zero-secret execution

Research execution must not require or accept any new API key, access token, OAuth credential, cookie, login state or external-platform secret.

### PRD-RSCH-005 — Review first

A result is a **research candidate**, not Knowledge. No candidate becomes `knowledge_records` until an authorized user deliberately chooses `Create Knowledge Draft`.

### PRD-RSCH-006 — DRAFT only

Research conversion always creates `knowledge_records.status = DRAFT`. Existing Knowledge activation remains the only path to ACTIVE.

### PRD-RSCH-007 — Provenance

Converted Knowledge preserves the canonical source URL and research-origin metadata while reusing the established Knowledge/document provenance model.

### PRD-RSCH-008 — Source safety

Source reading reuses the existing public URL security boundary: public `http/https` only, validated redirect hops, loopback/private/link-local/cloud-metadata rejection, DNS rebinding protection where implemented, bounded bytes and sanitized text.

### PRD-RSCH-009 — Bounded execution

Query length, result count, candidate excerpt size, source bytes, extracted text, redirect count, provider timeout and per-actor/org concurrency are explicitly bounded.

### PRD-RSCH-010 — Fail closed

Malformed responses, provider auth changes, rate limits, timeouts and unsafe source URLs produce normalized non-secret failures. No failure may trigger a credentialed fallback.

### PRD-RSCH-011 — No direct grounding

Content Studio/generation context continue to consume only existing eligible ACTIVE Knowledge. `research_candidates` never enter prompts or generation context directly.

### PRD-RSCH-012 — Auditability

PAK can explain what was queried, which no-secret provider route was used, when it ran, which source was selected and which DRAFT Knowledge record resulted.

## 7. UX design

### 7.1 Knowledge Base views

The existing Knowledge Base gains two views:

- `Knowledge`
- `Research`

Manual create/edit/activate/archive/delete remains under `Knowledge` unchanged.

### 7.2 Research tab

For the selected organization, the Research tab provides:

1. bounded topic/question input;
2. `Search public sources` action;
3. searching/completed/partial/failed run status;
4. source cards showing title, hostname, canonical URL, provider route, concise excerpt and retrieval time;
5. `Open source` external link;
6. `Create Knowledge Draft` action;
7. converted state linking to the resulting DRAFT Knowledge record.

Repeated conversion clicks must not create duplicate Knowledge records.

### 7.3 Trust language

The UI states that returned items are **external public sources requiring review**. A provider result must never be labelled `verified`, `official`, `approved` or `trusted` merely because it was returned by search.

### 7.4 Error language

User-facing errors are normalized, for example:

- `Research provider is temporarily unavailable.`
- `This source could not be read safely.`
- `This source redirected to a blocked network destination.`
- `This research route now requires credentials and has been disabled.`

Raw provider payloads, stack traces, internal network data and secrets are never rendered.

## 8. Data model

### 8.1 `research_runs`

Organization-scoped table:

- `id uuid primary key`
- `organization_id uuid not null`
- `query text not null`
- `provider text not null`
- `status text not null` (`RUNNING|COMPLETED|PARTIAL|FAILED`)
- `result_count integer not null default 0`
- `failure_code text nullable`
- `failure_metadata jsonb nullable` — schema-allowlisted safe metadata only
- `created_by uuid nullable`
- `created_at timestamptz not null`
- `completed_at timestamptz nullable`

### 8.2 `research_candidates`

Organization-scoped table:

- `id uuid primary key`
- `organization_id uuid not null`
- `research_run_id uuid not null`
- `provider text not null`
- `title text not null`
- `canonical_url text not null`
- `source_host text not null`
- `excerpt text not null` — bounded provider excerpt only
- `result_fingerprint text nullable`
- `retrieved_at timestamptz not null`
- `review_status text not null` (`SUGGESTED|CONVERTED|DISMISSED`)
- `knowledge_record_id uuid nullable`
- `created_at timestamptz not null`

Research candidates deliberately do **not** persist full article/page snapshots. Full selected-source text is fetched only through PAK's existing safe URL boundary at conversion time and stored through the established Knowledge/document provenance model.

### 8.3 Invariants

- candidate organization equals run organization;
- linked Knowledge organization equals candidate organization;
- browser cannot insert authoritative research rows or set conversion linkage;
- candidate conversion is idempotent;
- one candidate creates at most one Knowledge record;
- `knowledge_record_id` is set only by authoritative conversion logic;
- no secret/token/cookie field exists in either research table.

## 9. Provider-neutral research contract

Server-only domain interface:

```ts
export interface PublicResearchProvider {
  search(input: PublicResearchQuery): Promise<PublicResearchSearchResult>;
}
```

Domain output contains only normalized fields such as title, canonical URL, excerpt, retrieved time and safe provider metadata.

Provider-specific MCP/HTTP payloads stay inside adapters.

### 9.1 Exa no-key adapter

The initial search adapter uses Exa's public MCP route only while no-key access remains supported.

Implementation requirements:

- server-only execution;
- no auth header sourced from PAK secrets;
- direct typed MCP client/transport rather than a required global `mcporter` CLI installation;
- bounded result count;
- strict response validation;
- normalized timeout/rate-limit/provider errors;
- no provider HTML rendered directly;
- canonicalized result URLs before persistence/use.

If Exa begins requiring authentication, the adapter returns `CREDENTIAL_REQUIRED` and the feature remains usable through manual Knowledge/URL ingestion rather than collecting a key.

### 9.2 Source reading

The authoritative source reader is the existing PAK safe URL ingestion/extraction boundary from the active foundation work. Research must reuse it rather than create a second arbitrary URL-fetcher.

Jina Reader is optional only if a later implementation step proves a readability gap. If used, PAK still validates the public URL first, does not expose private content to Jina, and does not treat Jina as a substitute for the authoritative PAK URL safety rules.

### 9.3 RSS/Atom

RSS/Atom support is optional within the first implementation plan and may be added only through bounded HTTPS fetch/parsing with the same public-network safety principles. It must not delay the core Exa -> candidate -> DRAFT workflow.

## 10. Server execution boundary

The browser sends only safe intent:

```text
organizationId + query
```

or:

```text
organizationId + researchCandidateId
```

The browser does **not** send authoritative provider responses, provider overrides, source text, fingerprints, conversion state or target Knowledge status.

The server:

1. authenticates the actor;
2. resolves organization membership;
3. checks `knowledge:manage`;
4. applies query/rate bounds;
5. invokes the allowlisted no-secret provider adapter;
6. validates/canonicalizes returned URLs;
7. persists normalized run/candidate metadata;
8. on explicit conversion, reloads the candidate by organization;
9. safely fetches/extracts the selected URL through the established URL boundary;
10. finalizes candidate -> URL provenance -> DRAFT Knowledge through an authoritative idempotent transaction.

## 11. Research-to-Knowledge conversion

Conversion must **reuse or factor the existing URL-ingestion finalization path**, not create a competing URL-ingestion lifecycle.

Required behavior:

- authorize `knowledge:manage`;
- reload the candidate server-side;
- reject cross-org/missing/dismissed candidates;
- safe-fetch and sanitize selected source content using existing URL-security/extraction code;
- create the established URL `knowledge_document`/revision provenance where the current foundation architecture requires it;
- create only DRAFT Knowledge;
- atomically link the candidate to the created Knowledge record;
- never set `is_core = true`;
- never activate automatically;
- if already converted, return the existing Knowledge record.

### 11.1 Idempotency and concurrency

External source fetching occurs before final database finalization. The final database operation locks/rechecks the candidate and is idempotent:

- first successful finalizer creates/links the DRAFT Knowledge record;
- concurrent/retried finalizers return the already-linked record;
- an uncertain RPC response is safe to reconcile by re-reading the candidate link rather than blindly creating another record.

If the then-current URL ingestion code cannot share this atomic boundary cleanly, implementation must factor a common server/SQL finalizer used by both URL ingestion and research conversion rather than duplicating provenance rules.

## 12. Relationship with active Knowledge ingestion work

The active foundation branch already introduces safe document and URL ingestion. Research reuses:

- URL canonicalization;
- redirect validation;
- DNS/private-network rejection;
- bounded extraction/sanitization;
- DRAFT-only Knowledge creation discipline;
- Knowledge document/revision provenance;
- existing Knowledge revision/CAS semantics.

Research differs only by adding a discovery/review stage before the user chooses a URL to convert.

## 13. RBAC and RLS

### 13.1 Application authorization

Research mutation maps to existing `knowledge:manage`. No new broad role is introduced.

### 13.2 Database authorization

`research_runs` and `research_candidates` enable RLS and use existing organization membership helpers/conventions.

Required protections:

- `anon` receives no research privileges;
- cross-tenant select/insert/update is denied;
- browser clients cannot forge conversion linkage;
- authoritative mutation occurs through guarded server actions and narrow RPCs where atomicity is required;
- same-org parent/child/link invariants are database enforced.

Exact policies/grants are derived from the then-current branch during planning/implementation.

## 14. Security design

### 14.1 SSRF

Every source URL PAK reads passes the existing URL-safety implementation, including redirect-hop checks and DNS rebinding protection already established on the foundation branch.

### 14.2 Prompt/content injection

External source text is untrusted data. Research candidates never reach generation models directly. Only explicitly activated Knowledge can later enter the existing generation-context resolver.

AI summarization of raw research is not part of this slice.

### 14.3 XSS

Provider HTML is never injected into the UI. Excerpts are normalized plain text and links are safely encoded.

### 14.4 Resource exhaustion

Implementation defines hard limits for query length, result count, provider timeout, redirects, source bytes, extracted characters, candidate count/size and concurrent research runs per actor/organization.

### 14.5 Egress

The research search adapter connects only to explicitly allowlisted no-secret research endpoints. Selected-source fetch uses the existing validated public-URL path. No generic internal proxy is introduced.

### 14.6 Privacy

Research queries must not be automatically populated with candidate/client PII, private Knowledge, secrets or private document contents. UI copy warns against searching with sensitive personal data.

## 15. Reliability and provider drift

No-key services can change without notice. Therefore:

- provider responses are runtime-schema validated;
- auth challenges become `CREDENTIAL_REQUIRED`;
- no automatic credential fallback exists;
- research failure never blocks manual Knowledge or document/URL ingestion;
- provider routes can be disabled independently;
- existing Knowledge Base remains fully usable when Research is unavailable.

## 16. Observability

Persist/log only safe operational metadata such as research run ID, organization ID, provider, status, duration metric, result count, normalized failure code and authorized actor reference.

Never log cookies, auth headers, passwords, external credentials, unbounded raw provider payloads or private Knowledge context.

## 17. Testing strategy

Implementation follows TDD RED -> GREEN per slice.

### 17.1 Unit/contract

Cover:

- query schema bounds;
- provider-neutral result validation;
- Exa normal response;
- malformed payload;
- timeout/rate limit;
- `CREDENTIAL_REQUIRED` fail-closed path;
- URL canonicalization and unsafe source rejection;
- candidate persistence normalization;
- candidate-to-DRAFT conversion;
- conversion idempotency/concurrency;
- no auto-activation/no Core mutation.

### 17.2 Authorization

Cover current `knowledge:manage` roles, read-only denial, unauthenticated denial and cross-org denial.

### 17.3 SQL/RLS

Verify RLS enabled, anon denied, cross-tenant operations denied, same-org invariants enforced, conversion linkage protected and DRAFT-only finalization.

### 17.4 UI

Verify Research tab, organization context, role-aware controls, loading/empty/error/partial states, safe candidate metadata, external source links, DRAFT conversion and no regression to existing Knowledge UI.

### 17.5 E2E

Playwright uses a deterministic provider fake to verify:

`Knowledge Base -> Research -> query -> candidates -> Create Knowledge Draft -> Knowledge -> DRAFT record`

CI does not depend on live Exa/Jina availability.

### 17.6 Live acceptance

After deterministic exact-head gates are green, a controlled no-secret live smoke may verify the public Exa route and one safe source conversion in a staging/production-like runtime using reversible synthetic data.

## 18. Runtime/deployment

Preferred implementation stays inside the existing PAK server/Supabase architecture.

No separate Railway research worker, global `mcporter` installation, browser extension or desktop session is required. If implementation discovers that a new long-running worker is technically necessary, work stops and architecture is re-reviewed before infrastructure is added.

No new research credential is added to Vercel environment variables, Supabase Vault, Railway variables or organization Integration Settings.

## 19. Governing-document synchronization

Before completion, implementation updates as required:

- `docs/product/PAK_MASTER_PRD.md`
- `docs/product/PAK_MASTER_TRD.md`
- `docs/product/PAK_BACKEND_SCHEMA.md`
- `docs/product/PAK_UI_UX_SPEC.md`
- `docs/product/PAK_SYSTEM_WORKFLOWS.md`
- `docs/product/PAK_INTEGRATION_SPEC.md`
- `docs/product/PAK_DEVELOPMENT_ROADMAP.md`
- `docs/product/PAK_TRACEABILITY_MATRIX.md`

The feature must not disrupt completion/merge readiness of active PR #40.

## 20. Engineering governance

Implementation uses the governed development workflow:

1. Supervisor/Orchestrator protects scope, architecture and completion criteria.
2. Architecture Agent checks Knowledge, integration, tenancy and security compatibility.
3. Planning Agent writes dependency-ordered implementation tasks.
4. Coding Agent implements approved slices with TDD.
5. Typecheck/Test Agent verifies focused through full CI gates.
6. E2E Verification Agent performs Playwright/runtime proof where applicable.
7. Integration/Release Agent reconciles migrations, docs, CI, PR readiness and rollout evidence.

These are development roles, not runtime PAK agents.

## 21. Acceptance criteria

The feature is complete only when:

1. Knowledge Base contains a Research tab in existing organization context.
2. Authorized research works without any new key/token/secret/login.
3. Search results persist as organization-scoped candidates, not Knowledge.
4. A candidate becomes Knowledge only through explicit authorized conversion.
5. Conversion creates DRAFT only and never auto-activates or auto-Core.
6. Full selected-source text is fetched through the existing safe URL boundary rather than persisted blindly from search results.
7. Research candidates never directly enter Content Studio/generation grounding.
8. Conversion is idempotent, concurrency-safe and provenance-preserving.
9. RLS/RBAC blocks cross-org/unauthorized access.
10. Unsafe/private-network URLs are rejected.
11. Existing manual Knowledge and document/URL ingestion continue to work if research is unavailable.
12. Provider drift to credential-required access fails closed without a credential prompt.
13. Deterministic unit, SQL/RLS, typecheck, lint, build and Playwright gates are green on exact HEAD.
14. Governing docs/traceability/readiness evidence are synchronized.
15. Lovable is untouched.
16. No new API/access/secret key is required anywhere in PAK for this feature.

## 22. Implementation sequencing constraint

PR #40 is active and modifies the same Knowledge Base/ingestion area. This feature must not race or duplicate unfinished foundation code.

The implementation plan must start from the then-current repository state and use one safe route:

- preferably wait until the relevant PR #40 Knowledge Base/URL-ingestion seams are complete and verified, then implement on top; or
- if PR #40 remains open but those seams are verified, base the feature work on its current head and preserve its exact invariants.

Current repository state plus governing docs override this design if the foundation evolves. Any material conflict requires an explicit design amendment before code changes.
