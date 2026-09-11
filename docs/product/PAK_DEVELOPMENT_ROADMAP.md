# PAK Marketing Automation — Development Roadmap

**Document ID:** PAK-RM-001  
**Version:** 1.1  
**Status:** Current roadmap after Phase 7

## Governance rule

No new feature slice starts without mapped PRD/TRD/UX/DB requirements and acceptance criteria. Existing requirement IDs retain their original semantic meaning; new behavior receives new IDs. Each slice uses: design/spec where architecture changes → implementation plan → TDD → CI → runtime verification where applicable → PR review → merge.

## Phase 0 — Master baseline and implementation audit — IMPLEMENTED

Deliverables:
- Master PRD
- Master TRD
- UI/UX specification
- Backend schema
- System workflows
- Integration specification
- Roadmap
- Traceability matrix
- Existing implementation gap audit

Post-Phase 7 note: governing PRD/TRD/DB/UX/traceability documents were synchronized to the actual merged architecture before Phase 8.

## Phase 1 — Platform foundation — IMPLEMENTED

Scope:
- Next.js/TypeScript shell
- Supabase foundation
- organization membership/RBAC
- durable jobs foundation
- media/video provider abstractions
- initial scene/media schema
- errors/logging
- CI/E2E baseline

## Phase 2 — AI Content Studio foundation — IMPLEMENTED

Scope:
- provider-neutral text generation
- OpenAI adapter
- fake provider
- content item persistence
- Content Studio generation UI/action

## Phase 3 — Multilingual artifacts — IMPLEMENTED

Scope:
- EN/PL/HI artifacts
- canonical source relationship
- translation source revision
- stale translation model
- regeneration controls

## Phase 4 — Knowledge Base grounding — IMPLEMENTED

Scope:
- DRAFT/ACTIVE/ARCHIVED records
- source metadata
- role-aware visibility/mutations
- deterministic selector
- server-side grounding
- immutable provenance snapshots
- live Supabase RLS/runtime verification

## Phase 5 — Integration Vault & hosted runtime foundation — IMPLEMENTED

Requirements:
- PRD-SET-001..010
- TRD-SEC-001..010
- integration provider requirements

Delivered:
- `integration_connections`
- `integration_secrets` metadata/reference layer
- Supabase Vault-backed secret values
- immutable `integration_audit_events`
- authenticated `integration-vault` Edge Function
- OpenAI configure/replace/remove/test flow
- safe connection metadata and masked hints
- organization-scoped OpenAI runtime credential resolution
- transactional config/test/audit mutations
- security hardening that prevents browser secret retrieval
- Settings → Integrations operator surface

Later Phase 7 extension:
- LTX write-only credential management and no-spend credential verification reuses the same Vault architecture.

Current operational note:
- provider secrets do not require a Vercel redeploy after saving;
- external hosting quota/rate-limit is treated as an infrastructure constraint, not an application correctness failure.

## Phase 6 — Scene Planning — IMPLEMENTED

Requirements:
- PRD-VID-001..004
- PRD-VID-008..011
- UX-SCENE-001..011
- TRD-SCENE-001..008
- relevant original TRD-VID planning/readiness requirements

Delivered:
- persisted Content Studio script-artifact handoff
- tenant-scoped `video_projects`
- versioned Visual Bible state
- versioned Scene Plan / Scene / Shot graph
- exact canonical narration linkage
- provider-neutral structured planner with strict validation
- deterministic QC for source freshness, narration coverage, timing, references and generation requirements
- manual scene/shot editing and reordering with QC invalidation
- granular scene/shot replanning with human-modified protection
- role-gated review, warning acknowledgement and approval
- copy-on-write continuation from approved plans
- database RLS, parent-organization guards, lifecycle guards and approved immutability
- provider-neutral Phase 7 handoff

Verification:
- exact-head typecheck, lint, unit, production build and Playwright
- live PAK Supabase migrations and RLS/function privilege probes
- advisor review/hardening

## Phase 7 — Video generation provider integration — IMPLEMENTED

Requirements:
- PRD-VID-006..007
- PRD-VID-012..018
- UX-VID-001..006
- TRD-VID-004, TRD-VID-007..014
- TRD-JOB/MEDIA provider-execution requirements

Delivered:
- LTX 2.3 Pro adapter behind provider-neutral interface
- approved-shot generation controls
- hardened authenticated enqueue/spend boundary
- `VIDEO_SHOT_GENERATION` durable jobs
- `video_generation_attempts` lineage
- submit/reconcile/bounded retry/submission-unknown/terminal handling
- four-attempt maximum with 5/15/45 retry eligibility
- private generated-video import into PAK Storage + `media_assets`
- unattended 10-second dispatcher using `pg_cron`, `pg_net`, leases and Vault-held internal token
- active `video-generation`, `video-generation-retry`, `video-generation-dispatcher` Edge workers
- Settings → Integrations LTX credential workflow
- no-spend LTX credential test
- browser cannot directly create attempts or paid generation jobs

Verification:
- TDD RED/GREEN coverage across adapter, spend boundary, retry, reconciliation, import, dispatcher and UI
- exact-head typecheck, lint, unit, production build and Playwright
- live migrations `202609110008` through `202609110012`
- live Edge/runtime/security probes
- scheduled dispatcher requests verified 200; missing internal token verified 401
- security/performance advisors reviewed

External operational acceptance:
- no organization LTX credential/credits are currently configured in production;
- therefore the first real paid end-to-end LTX render remains a controlled acceptance step to run when a valid organization credential/credits are supplied;
- this deferred paid smoke does not represent missing engineering, but paid rendering must not be relied on operationally until that check succeeds.

## Phase 8 — Final video assembly & Media Library expansion — NEXT

Requirements:
- PRD-VID-005
- PRD-VID-019
- PRD-MEDIA-001..006
- TRD-VID-005..006
- UX-SCENE-003
- UX-MEDIA-001..004

Deliverables:
- final assembly durable job
- component shot/media readiness validation
- final video composition/order pipeline
- final QA/readiness state
- final organization-scoped video asset
- Media Library operator catalogue/list
- generated/uploaded/imported asset visibility
- preview/detail/lineage
- controlled upload flow
- archive/delete/storage authorization
- signed/authorized access where required

Exit criteria:
- approved current plan with successful required shots can produce one final PAK-owned video asset;
- no final render can start with missing/failed/stale required components;
- generated Phase 7 assets are visible and traceable in Media Library;
- Media Library critical workflows pass desktop/mobile and storage/RLS verification.

## Phase 9 — Approval Center

Requirements:
- PRD-APR-001..005
- UX-APR-001..004

Deliverables:
- `approval_requests`
- immutable `approval_events`
- exact artifact/revision/media review
- approve/request-changes/reject
- supersede approval after substantive revision
- integration with existing Scene Planning approval rather than replacement of domain rules

## Phase 10 — Publishing foundation + Meta

Requirements:
- PRD-PUB-001..006
- PRD-SET-009
- INT-META requirements
- UX-PUB-001..003

Deliverables:
- Meta integration credential/config schema/forms using existing Vault
- `publication_targets`
- `publication_attempts`
- durable publish jobs
- idempotency/reconciliation
- initial Facebook/Instagram publishing path
- WhatsApp only where product use case is explicitly defined and compliant

## Phase 11 — Content Calendar

Requirements:
- PRD-CAL-001..003
- UX-CAL-001..002

Deliverables:
- scheduled publication projection
- timezone-safe scheduling
- reschedule/cancel
- calendar/list UX

## Phase 12 — Analytics

Requirements:
- PRD-AN-001..005
- UX-AN-001..003

Deliverables:
- metric sync jobs
- provider watermarks
- normalized daily metrics
- freshness/error UX
- analyst read-only dashboard

## Phase 13 — AI Representative

Requirements:
- PRD-AIR-001..004
- UX-AIR-001..002

Deliverables:
- approved-script selection
- representative profile/provider abstraction
- generation job
- media lineage
- review/publishing integration

## Phase 14 — Podcast

Requirements:
- PRD-POD-001..003
- UX-POD-001

Deliverables:
- episode workspace
- script/Knowledge flow
- audio provider abstraction
- media output
- approval/publishing linkage

## Phase 15 — Campus / Locations

Requirements:
- PRD-CAMP-001..003
- UX-CAMP-001..002

Deliverables:
- structured campus/location records
- approved facts
- location-specific content templates/workflows

## Phase 16 — Student Testimonials

Requirements:
- PRD-TST-001..003
- UX-TST-001..002

Deliverables:
- testimonial records
- consent/publication state
- restricted-data boundary
- media linkage
- adapted-content governance

## Phase 17 — Manual Generation completion

Requirements:
- PRD-MAN-001..003
- UX-MAN-001

Deliverables:
- rich manual authoring using shared artifact/revision/approval model
- no AI dependency

## Release policy

For every phase:
1. create feature branch;
2. write/approve slice design when architecture changes;
3. write implementation plan for multi-step work;
4. TDD RED/GREEN for behavior changes;
5. run typecheck/lint/unit/build/E2E;
6. run live Supabase RLS/runtime probes for auth/schema/security changes;
7. resolve review threads;
8. merge only exact green head;
9. verify deployment/runtime according to environment policy;
10. perform controlled live-provider smoke when credentials/credits and safety permit it;
11. never fabricate provider acceptance or weaken security to work around external quota/credential constraints.