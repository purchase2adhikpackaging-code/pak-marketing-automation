# PAK Marketing Automation — Development Roadmap

**Document ID:** PAK-RM-001  
**Version:** 1.4  
**Status:** Current roadmap through Phase 8, Organization Identity / Brand / Knowledge foundation, and UI/UX Production Convergence

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

## Cross-phase foundation — Organization Profile, Brand Kit & Knowledge Ingestion — IMPLEMENTED

Purpose:
- establish one authoritative organization identity and brand source for downstream generation;
- make approved Core Knowledge automatic while preserving explicit selection of normal ACTIVE Knowledge;
- add review-first PDF/DOCX/PPTX/TXT/URL ingestion without creating a parallel document store.

Delivered:
- one revisioned `organization_profiles` row per organization;
- one revisioned `organization_brand_kits` row per organization plus semantic `brand_kit_media_assets` references to same-org ACTIVE image `media_assets`;
- safe Brand Kit contracts persist Media Library UUIDs only—never signed URLs or raw storage paths;
- `knowledge_records.is_core` with OWNER/ADMIN-only Core mutation, including a live-discovered INSERT guard so EDITOR cannot create Core records through direct Data API writes;
- `knowledge_documents` source lineage for FILE/URL ingestion and `knowledge_records.knowledge_document_id` linkage;
- PDF/DOCX/PPTX/TXT/URL extraction with bounded text and SSRF protection for loopback/private/link-local/cloud-metadata destinations and unsafe redirects;
- ingestion creates DRAFT Knowledge only; activation remains explicit human review;
- shared server-only generation-context resolver with deterministic priority Profile → Brand Kit → ACTIVE Core Knowledge → selected ACTIVE Knowledge → task context;
- duplicate selected IDs collapse; Core explicitly selected appears once; cross-org/non-ACTIVE selected sources cannot become grounding;
- atomic immutable generation provenance for exact Profile revision, Brand Kit revision and Knowledge snapshots;
- Content Studio automatically applies the authoritative context without trusting browser-supplied profile/brand text;
- Scene Planning receives Brand Kit institutional defaults while Visual Bible remains creative-direction authority and cannot replace official logo identity;
- OWNER/ADMIN editable Settings surfaces, REVIEWER/read-only behavior, and deterministic browser fixtures for Profile/Brand/Knowledge smoke tests;
- forward-only live hardening migrations for inherited table ACLs, Core INSERT RBAC, and RLS `auth.uid()` initplan performance.

Live verification on 13 September 2026:
- remote migration history was inspected before applying only missing migrations;
- OWNER Profile/Brand CAS revisioning, same-org official asset enforcement and cross-org rejection were proven with rollback-only fixtures;
- EDITOR normal Knowledge management and DRAFT ingestion succeeded while Profile/Brand/Core boundaries remained denied;
- Core automatic grounding, normal ACTIVE selection behavior, atomic identity/Knowledge provenance and REVIEWER read-only access were proven;
- private Media Library bucket remained private and Brand Kit schema persisted no URL/path fields;
- all synthetic fixture rows were rolled back and post-proof cleanup returned zero residue;
- broad inherited table ACLs were reduced to intended least privilege; provenance tables are SELECT-only to authenticated members and `anon` has no table grants;
- feature-specific Supabase `auth_rls_initplan` warnings were removed; remaining advisor findings pre-date this slice or are maintenance-level index recommendations.

## Cross-phase UI/UX Production Convergence — IMPLEMENTED ON PR #43 BRANCH; MERGE PENDING

Purpose:
- expose already-implemented Phase 0–8 + Organization Identity / Brand / Knowledge capabilities as one coherent operator workflow;
- keep Phase 9–17 routes visible but truthfully Planned/Foundation until their governed slices are built;
- remove stale UI maturity copy without changing backend authority, RLS/RBAC, provider or storage boundaries.

Delivered:
- grouped navigation: Operational → Administration → Roadmap;
- production-command Dashboard backed by existing organization-scoped authoritative state and deterministic next-action resolution;
- Content Studio read-only `Authoritative context` summary for Profile revision, Brand Kit revision and automatic Core Knowledge grounding;
- Scene Planning presentation hierarchy: Plan → Review & approve → Generate shots → Assemble, with completed-media handoff to Media Library;
- operational Media Library framing for the existing catalogue/detail/preview/upload/archive/delete behavior;
- Knowledge Base source-entry hierarchy separating manual entry from document/URL ingestion, with explicit DRAFT/ACTIVE and Core automatic-grounding semantics;
- Settings three-domain landing for Organization Profile, Brand Kit and Integrations, including normalized OpenAI/LTX state and truthful Meta `Planned · Phase 10` status;
- no new domain tables, provider workflows, secret exposure, fake Dashboard metrics, signed-URL persistence or roadmap-domain mutation controls.

Verification on 14 September 2026:
- Task 8 Settings convergence passed exact-head CI #1265 across typecheck, lint, 640 unit tests, production build, final-assembly worker tests/container smoke and Playwright;
- Task 9 convergence browser contract passed exact-head CI #1277 across the same repository gates;
- CI browser fixtures intentionally use the existing development-only auth/role gates and do not seed synthetic organization/domain rows solely to force success-state screens; success branches are covered deterministically by component/service tests while browser tests prove truthful recovery/no-workspace and roadmap boundaries;
- no production auth bypass or synthetic production behavior was added.

Release state:
- PR #43 remains draft and unmerged until explicitly authorized;
- this convergence slice changes presentation/read models/tests/governance only and does not advance Phase 9–17 implementation status.

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