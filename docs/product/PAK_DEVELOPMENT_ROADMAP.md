# PAK Marketing Automation — Development Roadmap

**Document ID:** PAK-RM-001  
**Version:** 1.3  
**Status:** Current roadmap after Phase 9

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

## Phase 8 — Final video assembly & Media Library expansion — IMPLEMENTED

Requirements:
- PRD-VID-005
- PRD-VID-019
- PRD-MEDIA-001..006
- TRD-VID-005..006
- UX-SCENE-003
- UX-MEDIA-001..004

Delivered:
- deterministic `FINAL_VIDEO_ASSEMBLY` durable job and immutable component snapshot
- approved/current/blocker-free plan and required-shot media readiness validation
- PAK-owned `PAK_MASTER_1080P_V1` final render profile
- Vault-authenticated Supabase worker claim/complete/fail control plane
- dedicated Railway FFmpeg/ffprobe render worker with no Supabase service-role credential
- private signed-input/signed-output render flow
- final organization-scoped `media_assets` identity and lineage
- operational Media Library catalogue/detail/preview/upload/archive/delete boundaries
- private `media-library` uploads plus existing private `generated-media` compatibility
- browser mutation hardening for authoritative media/assembly state
- Scene Planning final-render readiness/status controls
- secret-safe worker runtime observability

Verification:
- TDD RED/GREEN coverage including live-discovered claim-RPC ambiguity regression
- exact-head typecheck, lint, unit, production build, worker tests/container smoke and Playwright
- live Phase 8 migrations through `phase_8_video_assembly_claim_qualification`
- live `video-assembly-worker` and `media-library` Edge Functions
- unauthorized worker probe verified 401; Vault-authenticated claim path verified
- real zero-provider-cost two-clip live render completed through claim → signed downloads → FFmpeg → signed upload → finalize
- final fixture output verified 1920×1080, 1.00s MP4 with persisted checksum/lineage before controlled cleanup
- exact-head Railway deployment verified successful
- fixture storage/database residue removed and fixture seeder disabled behind JWT
- Supabase security/performance advisors rerun; remaining non-blocking findings documented for maintenance

## Phase 9 — Approval Center — IMPLEMENTED

Requirements:
- PRD-APR-001..005
- UX-APR-001..004

Delivered:
- generic organization-scoped `approval_requests` workflow envelope for exact content-artifact revisions and media-asset checksums
- immutable `approval_events` audit ledger
- queue/detail Approval Center with Awaiting review / Changes requested / Approved / Rejected filters and superseded history
- exact artifact snapshot, source/translation context, Knowledge provenance, media preview metadata and publication-intent review context
- OWNER/ADMIN/EDITOR submission boundary and OWNER/ADMIN/REVIEWER decision boundary
- approve / request changes / reject actions with required comments for changes/rejection
- idempotent exact-target submission
- automatic supersession after substantive content revision, media checksum/state change, or stale decision revalidation
- stable `is_target_currently_approved(...)` predicate for future Publishing policy enforcement
- Content Studio and Media Library submission entry points
- Scene Planning remains the independent domain-specific approval authority; Approval Center integrates by navigation/read affordance only
- browser mutation lockdown, tenant RLS, explicit table ACLs, bounded SECURITY DEFINER RPCs and immutable event guards

Verification:
- TDD RED/GREEN across schema, workflow, supersession, ACLs, runtime pgcrypto regression and advisor-driven organization-index hardening
- exact-head typecheck, lint, unit, production build, final-assembly worker tests/container smoke and Playwright
- live Phase 9 migrations `approval_center_schema`, `approval_center_workflow`, `approval_center_supersession`, `approval_center_table_acl_hardening`, `approval_center_pgcrypto_schema_fix`, and `approval_events_org_index`
- live catalog proof: RLS enabled; anon has no table access; authenticated has SELECT-only table access; internal trigger/helper functions are not authenticated-callable
- controlled rollback-only live lifecycle proved PENDING → APPROVED → SUPERSEDED with current-approval predicate true → false and stale re-decision denied
- immutable approval-event UPDATE/DELETE guards proved live
- fixture cleanup verified zero residue
- only real production membership role available for controlled probes was OWNER; EDITOR/REVIEWER/ANALYST and two-tenant negatives remain covered by automated/RLS contract tests rather than manufactured production memberships
- Supabase security/performance advisors rerun; the Phase 9 approval-events foreign-key index finding was remediated, while intentional authenticated approval RPC warnings and unrelated pre-existing findings remain documented

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