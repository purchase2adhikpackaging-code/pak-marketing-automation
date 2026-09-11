# PAK Marketing Automation — Requirements Traceability Matrix

**Document ID:** PAK-TRACE-001  
**Version:** 1.1  
**Status:** Current baseline after Phase 7

## 1. Legend

- **Implemented** — merged behavior exists and is verified at the required automated/runtime level.
- **Implemented / external acceptance pending** — engineering/infrastructure is released, but a controlled provider/operational acceptance step cannot run until an external prerequisite such as credential/credits exists.
- **Partial** — real supporting behavior exists but one or more baseline journeys remain open.
- **Missing** — product workflow is not implemented; a readiness route does not count.
- **Legacy/Foundation** — retained compatibility/infrastructure exists but is not the current authoritative domain model.
- **Redesign** — implementation exists but conflicts with the current frozen contract and blocks downstream dependence.

## 2. Current requirement matrix

| Requirement family | UX surface | Primary backend/data | Verification | Current status | Next closure phase |
|---|---|---|---|---|---|
| PRD-GEN-005 Tenant isolation | All implemented modules | organizations, memberships, tenant RLS | RLS tests + live Supabase probes | **Implemented** | Continuous |
| PRD-GEN-006 / PRD-SET-003..007 Server-side secrets | Settings / provider workers | integration_connections, integration_secrets metadata, Supabase Vault, audit events | negative exposure tests + live privilege probes | **Implemented** | Continuous |
| PRD-RBAC-001..005 Roles | Shell + actions + RLS | organization_memberships, permission map | unit auth tests + RLS | **Implemented / ongoing** | Continuous |
| PRD-KB-001..011 Knowledge Base | Knowledge Base | knowledge_records | unit/UI/E2E + live RLS | **Implemented** | Maintenance |
| PRD-CS-001..012 Content Studio grounding/handoff | Content Studio | content_items, artifacts, provenance | unit/E2E + live RLS/provider boundary tests | **Implemented** | Maintenance |
| PRD-ML-001..008 Multilingual artifacts | Content Studio artifacts | content_script_artifacts | unit/E2E/schema assertions | **Implemented** | Maintenance |
| PRD-SET-002..010 Integration Vault | Settings → Integrations | integration_connections, integration_secrets→Vault, integration_audit_events | Edge/security/RLS/component/live tests | **Implemented for OpenAI + LTX; Meta pending** | Phase 10 for Meta |
| PRD-JOB-001..005 Durable jobs | Provider/job workflows | jobs | state/idempotency/claim/retry tests + live privilege probes | **Implemented foundation** | Continuous |
| PRD-VID-001..007 Scene Planning | Scene Planning | video_projects, visual_bibles, scene_plan_versions/scenes/shots/qc | unit/QC/RBAC/RLS/E2E + live probes | **Implemented** | Maintenance |
| PRD-VID-008..014 Per-shot provider generation | Scene Planning / Settings | jobs, video_generation_attempts, Edge workers, Vault | provider/state/retry/security/media tests + live Edge probes | **Implemented / external paid acceptance pending** | Operational acceptance when LTX credential/credits exist |
| PRD-VID-015..017 Final assembly | Scene Planning / Media | future final-assembly job + final media asset | readiness/assembly/E2E | **Missing** | Phase 8 |
| PRD-MEDIA-001..006 Media | Media Library / Scene Planning | media_assets, Storage, generating_job lineage | schema/RLS/import tests | **Partial** — generated video import implemented; operator library missing | Phase 8 |
| PRD-DASH-001..004 Dashboard | Dashboard | aggregate current workflow state | UI/E2E | **Partial** | After Phases 8–12 provide complete signals |
| PRD-APR-001..005 Generic Approval | Approval Center | approval_requests, approval_events | workflow/E2E/RLS | **Missing**; Scene Plan has domain approval only | Phase 9 |
| PRD-PUB-001..006 Publishing | Publishing | integration targets/attempts/jobs | fake provider + idempotency + live smoke | **Missing** | Phase 10 |
| PRD-CAL-001..003 Calendar | Content Calendar | publication scheduling state | E2E/timezone tests | **Missing** | Phase 11 |
| PRD-AN-001..005 Analytics | Analytics | metric sync/daily metrics | ingestion/freshness tests | **Missing** | Phase 12 |
| PRD-AIR-001..004 AI Representative | AI Representative | future representative/media/jobs | provider fake + lineage tests | **Missing** | Phase 13 |
| PRD-POD-001..003 Podcast | Podcast | future episode/audio/media domain | workflow tests | **Missing** | Phase 14 |
| PRD-CAMP-001..003 Campus | Campus / Locations | future campus/location records | CRUD/RLS tests | **Missing** | Phase 15 |
| PRD-TST-001..003 Testimonials | Student Testimonials | future testimonial/consent/media domain | consent/RLS/privacy tests | **Missing** | Phase 16 |
| PRD-MAN-001..003 Manual authoring | Manual Generation | shared content/artifact model | editor/revision tests | **Partial/Foundation only** | Phase 17 |
| PRD-SET-001 Full Settings | Settings | organization/membership/config + integrations | E2E/RLS | **Partial** — Integrations implemented; Organization/Members/Operational config incomplete | Future settings slices |
| TRD-DEP Hosted app | Entire app | Next.js host + PAK Supabase | build/deployment/runtime verification | **Partial operationally** — app build green; Vercel quota may independently block deployment | Infrastructure/operations |
| TRD-TEST-001..006 Release gates | CI/release | GitHub Actions + live Supabase probes | exact-head CI + runtime checks | **Implemented process** | Continuous |

## 3. Implemented foundation traceability

### 3.1 Authentication / tenancy / jobs

Requirement families:
- PRD-GEN-005, PRD-GEN-007
- PRD-RBAC-001..005
- PRD-JOB-001..005
- TRD-AUTH, TRD-TEN, TRD-JOB

Implementation areas:
- `src/modules/auth/*`
- `src/modules/organizations/*`
- `src/modules/jobs/*`
- `supabase/migrations/202609090002_organizations_memberships.sql`
- `supabase/migrations/202609090003_jobs.sql`
- subsequent security/performance hardening migrations

Verified boundaries:
- organization-scoped membership roles;
- RLS final boundary for session clients;
- durable job state/idempotency/leases;
- worker claim not exposed to browser roles.

### 3.2 Knowledge Base

Requirement families:
- PRD-KB-001..011
- UX-KB-001..006
- TRD-KB-001..007

Implementation areas:
- `src/modules/knowledge-base/*`
- `src/app/(app)/knowledge-base/*`
- Knowledge foundation/integrity migrations
- RLS/security tests

Verified boundaries:
- DRAFT/ACTIVE/ARCHIVED lifecycle;
- role-aware visibility;
- revision increment and stale-edit protection;
- organization immutability;
- provenance-safe FK cleanup behavior.

### 3.3 Content Studio + multilingual artifacts

Requirement families:
- PRD-CS-001..012
- PRD-ML-001..008
- UX-CS-001..007
- TRD-AI, TRD-CONT, TRD-KB

Implementation areas:
- `src/app/(app)/content-studio/*`
- `src/modules/content-studio/*`
- `src/modules/ai/text/*`
- content/artifact/provenance migrations

Verified boundaries:
- browser submits source IDs rather than trusted Knowledge content;
- same-org ACTIVE Knowledge reloaded server-side;
- bounded context;
- immutable source snapshots;
- EN/PL/HI canonical/translation revision and stale behavior;
- persisted artifact handoff to Scene Planning.

### 3.4 Integration Vault — OpenAI + LTX

Requirement families:
- PRD-GEN-006
- PRD-SET-002..010
- UX-SET-001..006
- TRD-SEC-001..010

Implementation areas:
- `src/app/(app)/settings/integrations/*`
- `src/modules/integrations/*`
- `supabase/functions/integration-vault/*`
- Integration Vault/audit/transaction migrations
- `supabase/migrations/202609100010_supabase_native_integration_vault.sql`

Current data path:

`integration_connections` → `integration_secrets.vault_secret_id` → Supabase Vault

Verified boundaries:
- OWNER/ADMIN credential management;
- write-only secret input;
- safe masked metadata only in browser;
- service-role-only raw secret resolution;
- immutable audit events;
- OpenAI configured runtime use;
- LTX configure/remove/enable/disable/test flow;
- LTX connection test uses read-only provider request and does not submit a paid generation.

### 3.5 Scene Planning

Requirement families:
- PRD-VID-001..007
- UX-SCENE-001..009
- TRD-SCENE-001..008

Implementation areas:
- `src/app/(app)/scene-planning/*`
- `src/modules/scene-planning/*`
- Content Studio `Create Scene Plan` handoff
- `supabase/migrations/202609110001_scene_planning.sql`
- `202609110002_scene_planning_atomic_persistence.sql`
- `202609110003_scene_plan_lifecycle_guards.sql`
- `202609110004_scene_plan_reviewer_qc_ack.sql`
- `202609110005_scene_plan_draft_editing.sql`
- `202609110006_scene_plan_review_qc_guard.sql`
- `202609110007_scene_plan_performance_hardening.sql`
- `tests/e2e/scene-planning.spec.ts`

Verified boundaries:
- source-integrity-bound Video Project;
- versioned Visual Bible/Plan graph;
- canonical narration authority and exact span coverage;
- provider-neutral structured planning;
- deterministic QC;
- manual editing/reordering with QC invalidation;
- granular replan with human-edit protection;
- role-gated review/approval;
- approved immutability and copy-on-write continuation;
- no video-provider execution inside the planning domain.

### 3.6 Phase 7 video provider generation

Requirement families:
- PRD-VID-008..014
- UX-VID-001..006
- TRD-VID-004..012
- TRD-JOB-001..007
- TRD-MEDIA-001..004

Implementation areas:
- `src/modules/video/providers/*`
- `src/modules/video/generation/*`
- `src/app/(app)/scene-planning/shot-video-generation-controls.tsx`
- `src/app/(app)/scene-planning/video-generation-actions.ts`
- Settings LTX integration UI/actions
- `supabase/functions/video-generation/*`
- `supabase/functions/video-generation-retry/*`
- `supabase/functions/video-generation-dispatcher/*`
- `supabase/migrations/202609110008_video_generation_attempts.sql`
- `202609110009_video_generation_enqueue.sql`
- `202609110010_video_generation_reconciliation.sql`
- `202609110011_generated_video_media_import.sql`
- `202609110012_video_generation_dispatch.sql`

Verified boundaries:
- OWNER/ADMIN/EDITOR only across authenticated spend enqueue;
- approved, current, blocker-free plan/shot required;
- browser sends IDs only;
- direct browser INSERT/UPDATE of paid generation jobs blocked;
- direct browser creation/mutation of attempts blocked;
- LTX adapter remains behind provider-neutral contract;
- attempt lineage supports submit/process/import/failure/submission-unknown;
- maximum four attempts and 5/15/45 retry eligibility;
- `SUBMISSION_UNKNOWN` is not blindly retried;
- generated provider output imported to private `generated-media` object before completion;
- PAK media identity uses `media_assets`, not provider URL;
- unattended 10-second dispatcher with leased `SKIP LOCKED` claiming;
- internal cron/Edge execution uses Vault-held dispatcher token;
- unauthorized dispatcher request verified 401;
- scheduled empty dispatcher requests verified 200;
- paid provider smoke explicitly deferred because no production org LTX credential/credits are configured.

## 4. Partial / future module traceability

### Media Library — Phase 8

Already available:
- `media_assets` data model and RLS;
- private generated-video storage/import;
- generation/job lineage.

Still required:
- operator catalogue/list;
- upload path;
- preview/detail;
- archive/delete/storage authorization;
- final assembled video visibility/lineage.

### Final video assembly — Phase 8

Still required:
- final-assembly job;
- plan/shot/media readiness calculation;
- composition/order pipeline;
- final QA state;
- final media asset.

### Approval Center — Phase 9

Scene Plan approval exists but generic product approval does not.

Still required:
- `approval_requests`;
- immutable `approval_events`;
- artifact/revision/media targets;
- approve/request-changes/reject;
- supersession after revision.

### Publishing — Phase 10

Still required:
- Meta provider configuration beyond generic Vault foundation;
- targets/accounts;
- publication attempts;
- idempotent publish jobs;
- provider reconciliation/error mapping;
- supported Facebook/Instagram path.

### Content Calendar — Phase 11

Still required:
- authoritative scheduled publication projection;
- timezone-safe scheduling;
- reschedule/cancel;
- calendar/list UI.

### Analytics — Phase 12

Still required:
- sync jobs/watermarks;
- normalized metrics;
- freshness/error UI;
- analyst dashboard.

### Specialized modules — Phases 13–17

Routes currently expose truthful Planned/Foundation readiness state only.

- Phase 13: AI Representative
- Phase 14: Podcast
- Phase 15: Campus / Locations
- Phase 16: Student Testimonials
- Phase 17: Manual Generation completion

## 5. Legacy / compatibility traceability

### `video_scenes`

Status: **Legacy/Foundation**.

It remains in the schema from Phase 1 but is not the authoritative Scene Planning model. New planning/provider work maps to the normalized Scene Planning graph.

### `media_assets.scene_id`

Status: **Legacy compatibility field**.

Phase 7 does not force `scene_plan_scenes` into this legacy relationship. Current generated-video lineage is preserved through `generating_job_id`, `video_generation_attempts` and job result metadata.

## 6. Drift-control rules

1. Every feature PR lists requirement IDs implemented or modified.
2. Requirement changes update PRD/TRD/UX/DB and this matrix before or with implementation.
3. A UI route without mapped workflow/backend requirements is not a completed feature.
4. A backend table without an owning product workflow is speculative and should not be added.
5. Security-sensitive features require positive and negative traceability: who may act and who must be denied.
6. Paid-provider workflows require explicit spend-boundary traceability and duplicate-spend/idempotency tests.
7. Items marked `Redesign` block downstream dependence until reconciled.
8. Legacy/Foundation entities are not extended by new features without a documented compatibility reason.
9. Exact-head CI evidence is required for merge claims.
10. Live provider smoke must never be fabricated when credentials/credits are absent; deferred operational acceptance is recorded explicitly.