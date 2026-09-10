# PAK Marketing Automation — Existing Implementation Gap Audit

**Document ID:** PAK-AUDIT-001  
**Version:** 1.0  
**Audit baseline:** `main` after PR #4 merge (`8576e391d9ff62afd001da7b85afc87c16c87054`)

## 1. Executive assessment

The existing codebase is not wasted and does not require a restart. The strongest implemented areas are tenancy/RBAC foundation, AI text-provider abstraction, Content Studio, multilingual artifacts and Knowledge Base grounding. The largest gap is that the visible 14-module shell currently overstates functional completeness: several routes are placeholders while their backend workflows do not yet exist.

The corrective action is **reconciliation, not rewrite**. Existing implemented slices should be preserved where they satisfy the master PRD/TRD; new development should proceed only through the roadmap and traceability matrix.

## 2. Platform foundation

**Status: IMPLEMENTED / REQUIRES CONTINUOUS HARDENING**

Implemented:
- Next.js + TypeScript application foundation
- Supabase client and environment boundaries
- organization/membership model
- RBAC role/permission model
- RLS helpers
- durable job state machine/repository/claim foundation
- provider-neutral video interface/fake provider
- media/scene schema foundation
- application shell
- CI/typecheck/lint/unit/build/Playwright gates

Remaining gaps:
- hosted staging environment using real PAK runtime
- environment/bootstrap deployment wiring
- operational observability UI
- complete role-based navigation behavior

## 3. Authentication & organization management

**Status: PARTIAL**

Implemented:
- Supabase Auth-compatible session architecture
- organization memberships and roles
- server-side membership checks used in implemented workflows
- RLS organization isolation

Missing/partial:
- complete login/onboarding UX verification on real staging
- Settings → Members management UX
- ownership transfer/governance policy if needed later
- full browser-role regression suite across every future module

## 4. Content Studio

**Status: IMPLEMENTED CORE / PARTIAL PRODUCT EXPERIENCE**

Implemented:
- topic/context/language input
- server-side authorized organization resolution
- provider-neutral text generation
- OpenAI adapter
- fake provider for CI
- content_items persistence
- Knowledge selector
- server-side approved Knowledge resolution
- 12,000-character total grounding budget
- immutable provenance persistence
- safe failure if provenance persistence fails

Remaining:
- real organization OpenAI credential resolution from Integration Vault
- hosted real-provider Chrome verification
- richer source-traceability detail UX
- async/durable generation may be considered if provider latency/volume requires moving beyond current request-response generation

## 5. Multilingual artifacts

**Status: IMPLEMENTED CORE**

Implemented:
- EN/PL/HI
- one current artifact per content item/language
- one canonical source
- revisions
- source_revision on translations
- stale translation state
- translation generation controls
- schema integrity assertions

Remaining:
- real provider/staging verification using Integration Vault credentials
- approval linkage to exact artifact revision
- scene-plan linkage to artifact revision

## 6. Knowledge Base

**Status: IMPLEMENTED AND LIVE-VERIFIED**

Implemented:
- DRAFT / ACTIVE / ARCHIVED
- source types MANUAL / DOCUMENT / URL
- source metadata edits
- activate/archive/delete controls
- CAS revisions
- immutable organization ownership
- audit-field integrity
- role-aware visibility
- server-side grounding resolution
- immutable provenance snapshots
- client provenance-forging prevention
- auth-user FK cleanup behavior

Verification already performed:
- CI on exact merged feature head
- live PAK Supabase RLS/runtime probes
- cross-org negative tests
- reviewer/editor role tests
- provenance immutability tests

Remaining:
- document ingestion, chunking, semantic search/RAG intentionally out of current baseline

## 7. Integration Vault

**Status: MISSING — NEXT BLOCKER**

Currently:
- environment schema includes host-level OPENAI_API_KEY and service-role key
- OpenAI adapter is server-only

Missing:
- integration_connections
- encrypted integration_secrets
- integration_audit_events
- Settings → Integrations UX
- configure/replace/remove/test connection
- organization-level runtime credential resolver
- OpenAI migration from host key to org-managed credential
- Meta/LTX provider schemas

Classification: new subsystem required before real product staging can be meaningfully user-configured.

## 8. Settings

**Status: PLACEHOLDER/PARTIAL**

Existing route shell is not equivalent to implemented Settings product functionality.

Required first functional Settings slice:
- Integrations
- then organization/member administration as roadmap requires

## 9. Scene Planning

**Status: PARTIAL FOUNDATION / NOT PRODUCT-COMPLETE**

Implemented:
- video_scenes schema foundation
- scene types/readiness logic/tests exist

Gap/risk:
- no complete script-artifact-to-scene-plan workflow/UI
- source artifact revision linkage must be finalized
- scene stale/replan behavior missing
- zero-required-scene readiness behavior must be explicitly tested against TRD-VID-006 before relying on current implementation

## 10. Video Generation

**Status: FOUNDATION ONLY**

Implemented:
- provider-neutral interface
- fake provider
- durable jobs foundation
- media foundation

Missing:
- real LTX/provider adapter
- Integration Vault credentials
- provider job polling/webhook reconciliation
- scene job orchestration
- retry policy per provider
- final render assembly
- real media ingest/storage verification

## 11. Media Library

**Status: PARTIAL**

Implemented:
- media domain/types/storage path foundation
- media_assets migration
- organization-scoped database foundation

Missing:
- complete Media Library UX
- real upload lifecycle
- object storage policies/runtime verification for final workflows
- preview/detail/lineage experience

## 12. Approval Center

**Status: MISSING / ROUTE SHELL ONLY**

Missing:
- approval_requests
- approval_events
- review queue/detail
- exact artifact revision review
- approve/request-changes/reject
- supersede approval on revision
- publish eligibility integration

## 13. Publishing

**Status: MISSING / ROUTE SHELL ONLY**

Missing:
- Meta Integration Vault configuration
- publication_targets
- publication_attempts
- durable publish workers/jobs
- idempotency/reconciliation
- provider adapters
- webhook signature handling
- retry and health invalidation

## 14. Content Calendar

**Status: MISSING / ROUTE SHELL ONLY**

Missing:
- authoritative scheduled publication records
- timezone-safe rescheduling/cancellation
- date-grouped/calendar UX

## 15. Analytics

**Status: MISSING / ROUTE SHELL ONLY**

Missing:
- metric sync jobs
- provider watermarks
- normalized metrics schema
- freshness state
- dashboards

## 16. AI Representative

**Status: MISSING / ROUTE SHELL ONLY**

Missing:
- approved content selection
- representative/avatar/voice profile
- provider abstraction/credentials
- generation jobs
- media lineage
- review/publishing integration

## 17. Podcast

**Status: MISSING / ROUTE SHELL ONLY**

Missing:
- podcast episode domain
- episode workspace
- script/audio workflow
- provider abstraction
- review/publishing integration

## 18. Campus Locations

**Status: MISSING / ROUTE SHELL ONLY**

Missing:
- campus_locations data model
- management UI
- approved-fact linkage into Knowledge Base

## 19. Student Testimonials

**Status: MISSING / ROUTE SHELL ONLY**

Missing:
- testimonial/consent model
- PII access policy
- media linkage
- generated adaptation governance

## 20. Manual Generation

**Status: PLACEHOLDER/PARTIAL**

Required:
- manual authoring backed by the same content/artifact revision model
- downstream approval/publishing compatibility
- no AI provider dependency

## 21. Deployment

**Status: MISSING REAL PRODUCT STAGING**

What exists:
- GitHub repository/CI
- real PAK Supabase project with migrations through Knowledge Base hardening

What does not yet exist:
- actual merged Next.js app deployed to a user-accessible staging URL
- host bootstrap env configured for PAK
- real login + Settings + Content Studio Chrome verification

The previous Macaly surface is intentionally excluded; it is not the Next.js/Supabase PAK application.

## 22. Security posture

**Status: STRONG FOUNDATION, INCOMPLETE SYSTEM**

Strengths:
- RLS-first tenant model
- live negative RLS verification
- explicit function privilege hardening
- provenance immutability
- server-only privileged path pattern

Open security work:
- Integration Vault encryption/key-management implementation
- Meta webhook/signature model
- object storage policy completion
- publication idempotency/reconciliation
- PII policy for testimonials
- production/staging secret bootstrap

## 23. Priority corrections

### P0 — before more feature development
1. Merge/review this master documentation baseline.
2. Implement Integration Vault.
3. Deploy real Next.js staging application connected to PAK Supabase.
4. Verify real Supabase Auth and role-scoped browser workflows.
5. Configure OpenAI through PAK Settings and prove Content Studio uses it.

### P1 — next product workflows
6. Scene Planning.
7. Video provider integration.
8. Media Library completion.
9. Approval Center.
10. Publishing/Meta.

### P2
11. Calendar.
12. Analytics.
13. AI Representative.
14. Podcast.
15. Campus Locations.
16. Student Testimonials.
17. Manual Generation completion.

## 24. No-rewrite rule

Existing merged code that conforms to PRD/TRD requirements should remain. Refactoring is justified only when required to satisfy a documented requirement, security invariant, testability issue or clear architectural boundary. This audit does not authorize wholesale redevelopment of working foundation code.