# PAK Marketing Automation — Requirements Traceability Matrix

**Document ID:** PAK-TRACE-001  
**Version:** 1.0  
**Status:** Baseline for review

## Legend

- **Implemented** — merged behavior exists and is verified at the appropriate level.
- **Partial** — some behavior exists but one or more baseline requirements remain open.
- **Missing** — not yet implemented.
- **Redesign** — implementation exists but does not yet conform to the frozen baseline.

## Matrix

| Requirement family | UX surface | Primary backend/data | Verification | Current status | Planned phase |
|---|---|---|---|---|---|
| PRD-GEN-005 Tenant isolation | All modules | organizations, memberships, tenant RLS | RLS harness + live Supabase probes | Implemented foundation | Continuous |
| PRD-GEN-006 Server-side secrets | Settings/Integrations | integration_connections, integration_secrets | negative client-secret exposure tests | Missing | Phase 5 |
| PRD-RBAC-001..005 Roles | Shell + all actions | organization_memberships, permission map | unit auth tests + RLS | Implemented/ongoing | Continuous |
| PRD-KB-001..011 Knowledge Base | Knowledge Base | knowledge_records | unit/UI/E2E + live RLS | Implemented | Phase 4 |
| PRD-CS-001..011 Content Studio grounding | Content Studio | content_items, provenance snapshots | unit/E2E + live RLS | Implemented except real org vault credential | Phase 5 completion |
| PRD-ML-001..008 Multilingual artifacts | Content Studio artifacts | content_script_artifacts | unit/E2E/schema assertions | Implemented | Phase 3 |
| PRD-JOB-001..004 Durable jobs | Operational status | jobs | unit/state-machine + DB claim security | Foundation implemented | Expand per provider |
| PRD-MEDIA-001..005 Media Library | Media Library | media_assets + storage | schema/RLS/E2E | Partial | Phase 8 |
| PRD-VID-001..003 Scene planning | Scene Planning / Content Studio | video_projects, visual_bibles, scene_plan_versions, scene_plan_scenes, scene_plan_shots, scene_plan_qc_findings | unit/QC/RBAC/RLS/E2E + live Supabase probes | Implemented | Phase 6 |
| PRD-VID-004..007 Video provider/render | Scene Planning / Media | jobs, video_scenes, media_assets | adapter fake + live provider smoke | Missing | Phases 7–8 |
| PRD-APR-001..005 Approval | Approval Center | approval_requests, approval_events | workflow/E2E/RLS | Missing | Phase 9 |
| PRD-CAL-001..003 Calendar | Content Calendar | publication scheduling | E2E/timezone tests | Missing | Phase 11 |
| PRD-PUB-001..006 Publishing | Publishing | integrations, targets, attempts, jobs | provider fake + idempotency + live smoke | Missing | Phase 10 |
| PRD-AN-001..005 Analytics | Analytics | metric sync/daily metrics | ingestion + freshness UI tests | Missing | Phase 12 |
| PRD-AIR-001..004 AI Representative | AI Representative | content/media/jobs/integration | provider fake + lineage tests | Missing | Phase 13 |
| PRD-POD-001..003 Podcast | Podcast | podcast_episodes, artifacts, media | workflow tests | Missing | Phase 14 |
| PRD-CAMP-001..003 Campus | Campus Locations | campus_locations + knowledge linkage | CRUD/RLS tests | Missing | Phase 15 |
| PRD-TST-001..003 Testimonials | Student Testimonials | testimonials + media | consent/RLS/privacy tests | Missing | Phase 16 |
| PRD-MAN-001..003 Manual authoring | Manual Generation | content/artifact model | editor/revision tests | Partial/placeholder route | Phase 17 |
| PRD-SET-001 Settings | Settings | organization/membership/config | E2E/RLS | Partial | Phase 5 onward |
| PRD-SET-002..009 Integration Vault | Settings → Integrations | integration_connections/secrets/audit | crypto/server/RLS/E2E/live smoke | Missing | Phase 5 |
| TRD-DEP-001..005 Hosted staging | Entire app | Vercel + PAK Supabase | build/deployment/runtime logs/Chrome | Missing real app staging | Phase 5 |
| TRD-TEST-001..005 Release gates | CI/release | GitHub Actions + Supabase probes | exact-head CI | Implemented process | Continuous |

## Requirement-to-file traceability for implemented foundation

### Knowledge Base
- PRD-KB-001..011
- UX-KB-001..006
- TRD-KB-001..007

Implementation areas:
- `src/modules/knowledge-base/*`
- `src/app/(app)/knowledge-base/*`
- `supabase/migrations/202609090008_knowledge_base.sql`
- `supabase/migrations/202609100002_knowledge_integrity_hardening.sql`
- `supabase/migrations/202609100003_fk_audit_cleanup_fix.sql`
- `supabase/migrations/202609100004_inline_fk_cleanup_guards.sql`
- `supabase/migrations/202609100005_knowledge_org_immutability.sql`
- `tests/rls/foundation-rls.sql`

### Content Studio
- PRD-CS-001..011
- UX-CS-001..006
- TRD-AI-001..007

Implementation areas:
- `src/app/(app)/content-studio/*`
- `src/modules/content-studio/*`
- `src/modules/ai/text/*`
- `supabase/migrations/202609090006_content_items.sql`
- `supabase/migrations/202609090007_content_script_artifacts.sql`

### Scene Planning
- PRD-VID-001..003
- UX-SCENE-001..003
- TRD-VID-002/006

Implementation areas:
- `src/app/(app)/scene-planning/*`
- `src/modules/scene-planning/*`
- Content Studio downstream `Create Scene Plan` integration
- `supabase/migrations/202609110001_scene_planning.sql`
- `supabase/migrations/202609110002_scene_planning_atomic_persistence.sql`
- `supabase/migrations/202609110003_scene_plan_lifecycle_guards.sql`
- `supabase/migrations/202609110004_scene_plan_reviewer_qc_ack.sql`
- `supabase/migrations/202609110005_scene_plan_draft_editing.sql`
- `supabase/migrations/202609110006_scene_plan_review_qc_guard.sql`
- `supabase/migrations/202609110007_scene_plan_performance_hardening.sql`
- `tests/e2e/scene-planning.spec.ts`

Verified boundaries:
- canonical narration remains authoritative and source-integrity bound;
- OWNER/ADMIN/EDITOR may create/edit/generate/replan/QC within tenant scope;
- OWNER/ADMIN/REVIEWER approval is server- and database-constrained;
- anonymous users cannot read Scene Planning rows under live RLS;
- approved plans are immutable except lifecycle staleness/supersession metadata transitions;
- Phase 6 persists provider-neutral planning data only and performs no video-provider execution.

### Foundation tenancy/jobs/media/scenes
- PRD-GEN-005/007
- TRD-AUTH/TEN/JOB/VID

Implementation areas:
- `src/modules/auth/*`
- `src/modules/organizations/*`
- `src/modules/jobs/*`
- `src/modules/media/*`
- `src/modules/video/*`
- `supabase/migrations/202609090002_organizations_memberships.sql`
- `supabase/migrations/202609090003_jobs.sql`
- `supabase/migrations/202609090004_media.sql`
- `supabase/migrations/202609090005_video_scenes.sql`

## Drift-control rules

1. Every new PR must list requirement IDs implemented or modified.
2. A requirement change must update this matrix before/with implementation.
3. A UI route without a mapped workflow/backend requirement is not considered a product feature.
4. A backend table without an owning PRD workflow is considered speculative and should not be added.
5. Security-sensitive features require both positive and negative traceability: who may perform the action and who must be denied.
6. Any item marked `Redesign` blocks downstream dependence until reconciled.
7. Phase 5 must not start implementation until the existing implementation gap audit is reviewed.