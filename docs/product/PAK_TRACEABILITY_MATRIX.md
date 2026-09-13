# PAK Marketing Automation — Requirements Traceability Matrix

**Document ID:** PAK-TRACE-001  
**Version:** 1.3  
**Status:** Current baseline through Organization Profile / Brand Kit / Knowledge ingestion foundation

## 1. Legend

- **Implemented** — behavior exists and is verified at required automated/runtime level.
- **Implemented / external acceptance pending** — engineering is released but controlled provider acceptance awaits an external prerequisite.
- **Partial** — supporting behavior exists but one or more baseline journeys remain open.
- **Missing** — product workflow is not implemented; readiness route does not count.
- **Legacy/Foundation** — retained compatibility/infrastructure, not current authoritative domain model.

Existing requirement IDs keep their original meaning. New organization identity/ingestion behavior uses new IDs.

## 2. Current requirement matrix

| Requirement family | UX surface | Primary backend/data | Verification | Status |
|---|---|---|---|---|
| PRD-GEN-005 Tenant isolation | All modules | organizations, memberships, RLS | unit/RLS/live cross-org probes | **Implemented** |
| PRD-GEN-001/003/009/010 Authoritative grounding/provenance | Content Studio / Scene Planning | generation-context resolver, identity + Knowledge provenance | unit/action/SQL/live atomic proof | **Implemented** |
| PRD-RBAC-001..005 Roles | Shell/actions/RLS | organization_memberships, policies/triggers | auth tests + live OWNER/EDITOR/REVIEWER probes | **Implemented / continuous** |
| PRD-ORG-001..004 Organization Profile | Settings → Organization Profile | organization_profiles | schema/repository/action/UI/E2E + live CAS/RLS | **Implemented** |
| PRD-BRAND-001..004 Brand Kit | Settings → Brand Kit | organization_brand_kits, brand_kit_media_assets, media_assets | schema/repository/action/UI + live same/cross-org asset proof | **Implemented** |
| PRD-KB-001..011 Base Knowledge lifecycle | Knowledge Base | knowledge_records | unit/UI/E2E + live RLS | **Implemented** |
| PRD-KB-012..013 Core Knowledge | Knowledge Base / generation resolver | knowledge_records.is_core, Core guards | repository/action/SQL/live EDITOR-negative proof | **Implemented** |
| PRD-KB-014..019 Document/URL ingestion | Knowledge Base | knowledge_documents, knowledge_records, media_assets | extractor/SSRF/action/E2E/live DRAFT proof | **Implemented** |
| PRD-CS-001..012 Content Studio baseline | Content Studio | content_items, artifacts, Knowledge snapshots | unit/E2E/build | **Implemented** |
| PRD-CS-013..019 automatic org context | Content Studio | organization Profile/Brand, resolver, identity provenance | resolver/action/SQL/live provenance proof | **Implemented** |
| PRD-ML-001..008 Multilingual artifacts | Content Studio | content_script_artifacts | unit/E2E/schema | **Implemented** |
| PRD-SET-001/011 identity settings | Settings | Profile/Brand repositories/actions | component/E2E/live RLS | **Implemented for Profile/Brand** |
| PRD-SET-002..010 Integration Vault | Settings → Integrations | integration_connections, Vault, audit | Edge/security/live tests | **Implemented for OpenAI/LTX** |
| PRD-MEDIA-001..007 Media identity | Media Library / Brand / Knowledge / Scene Planning | media_assets, private Storage | schema/RLS/UI/E2E/live storage proof | **Implemented foundation** |
| PRD-VID-001..019 video planning/generation/final assembly | Scene Planning / Media | normalized planning graph, jobs, attempts, assembly/media | unit/QC/E2E/container/live worker proof | **Implemented engineering** |
| PRD-VID-020 institutional Brand defaults | Scene Planning | Brand resolver + plan snapshots | brand-default/workflow/replan tests | **Implemented** |
| PRD-NFR-010 SSRF safety | Knowledge URL ingestion | url-safety boundary | deterministic URL safety tests | **Implemented** |
| PRD-NFR-011 DB least privilege | identity/Knowledge DB boundary | table ACLs + RLS + function grants | SQL assertions + live ACL/advisor probes | **Implemented** |
| Dashboard | Dashboard | aggregate workflow state | UI/E2E | **Partial** |
| Generic Approval / Publishing / Calendar / Analytics | respective modules | roadmap domains | future governed slices | **Roadmap-governed** |
| Specialized modules / Manual Generation | respective routes | future/shared domains | future governed slices | **Missing/Partial per roadmap** |

## 3. Organization Profile traceability

Requirements:
- PRD-ORG-001..004
- UX-SET-008..009
- TRD-AUTH-008..010
- TRD-TEN-001..003

Implementation:
- `src/modules/organization-profile/*`
- `src/app/(app)/settings/organization-profile/*`
- `supabase/migrations/20260912180000_organization_profile_brand_knowledge.sql`

Verified:
- one revisioned Profile per org;
- same-org members read;
- OWNER/ADMIN mutation only;
- revision/CAS conflict protection;
- creation audit immutability;
- rollback-only live proof advanced revision then left zero fixture residue.

## 4. Brand Kit traceability

Requirements:
- PRD-BRAND-001..004
- UX-SET-010..012
- TRD-ARC-010
- TRD-TEN-006

Implementation:
- `src/modules/brand-kit/*`
- `src/app/(app)/settings/brand-kit/*`
- `organization_brand_kits`
- `brand_kit_media_assets`
- `save_organization_brand_kit(...)`
- migrations `20260912180000` + `20260912180030`

Verified:
- one revisioned Brand Kit per org;
- safe Media asset UUIDs only;
- same-org ACTIVE IMAGE validation;
- cross-org logo rejection;
- OWNER/ADMIN mutation; REVIEWER read-only;
- schema contains no signed URL/storage-path Brand fields;
- official logo identity remains distinct from project creative styling.

## 5. Core Knowledge traceability

Requirements:
- PRD-KB-012..013
- UX-KB-007
- TRD-KB-008..009

Implementation:
- `knowledge_records.is_core`
- Core action/repository/UI tests
- shared generation-context resolver
- forward migration `20260913175126_core_knowledge_insert_guard.sql`

Verified:
- all ACTIVE Core records are automatically included;
- selected duplicate/Core IDs appear once;
- EDITOR cannot toggle Core;
- live-discovered direct INSERT bypass was reproduced under rollback, then regression-tested and closed with forward trigger migration;
- live rerun proved EDITOR Core insert is blocked.

## 6. Knowledge ingestion traceability

Requirements:
- PRD-KB-014..019
- UX-KB-008..011
- TRD-KB-010..014
- PRD-NFR-010

Implementation:
- `src/modules/knowledge-ingestion/*`
- Knowledge Base ingestion actions/panel
- existing private Media Library upload path
- `knowledge_documents`
- `finalize_knowledge_document_ingestion(...)`
- migrations `20260912180100_knowledge_documents.sql` and `20260912180130_knowledge_ingestion_finalize.sql`

Verification:
- PDF/DOCX/PPTX/TXT extraction tests;
- URL SSRF tests for private/loopback/link-local/metadata/unsafe redirects;
- role/cross-org action tests;
- Playwright OWNER document upload → DRAFT record + explicit Activate action;
- live EDITOR ingestion produced exactly one DRAFT and no automatic activation;
- cross-org source ID rejected without tenant disclosure requirement.

## 7. Shared generation-context / provenance traceability

Requirements:
- PRD-GEN-001/003/009/010
- PRD-CS-013..019
- UX-CS-002/006/008
- TRD-AI-005/008..010
- TRD-CONT-007..008

Implementation:
- `src/modules/generation-context/types.ts`
- `repository.ts`
- `resolver.ts`
- Content Studio actions integration
- `content_item_identity_provenance`
- existing `content_item_knowledge_sources`
- `persist_content_generation_provenance(...)`
- migration `20260912180200_generation_identity_provenance.sql`

Verified:
- exact context order Profile → Brand Kit → Core → selected → task context;
- selected order/dedupe and Core dedupe;
- cross-org/non-ACTIVE selected sources rejected;
- Profile/Brand absence fails before generation;
- provenance persistence validates current Profile/Brand revisions and exact ACTIVE Knowledge snapshot data;
- identity + Knowledge snapshots write atomically;
- persistence failure marks content failed before source artifact success;
- live proof produced 1 identity provenance row + 2 Knowledge snapshots, then rollback cleanup returned zero residue.

## 8. Scene Planning Brand integration traceability

Requirements:
- PRD-VID-020
- UX-SCENE-012..013
- TRD-SCENE-009..010

Implementation:
- `src/modules/scene-planning/brand-defaults.ts`
- planner institutional brand block
- workflow/granular replan server actions
- plan creative-brief snapshot carries Brand Kit revision/institutional brand.

Verified:
- Brand defaults fill missing palette/typography/logo treatment;
- explicit Visual Bible values remain project creative direction;
- official primary logo asset ID remains separate institutional authority;
- planner prompt explicitly forbids logo substitution/redrawing by Visual Bible.

## 9. Database least-privilege traceability

Requirements:
- PRD-NFR-011
- TRD-AUTH-005/009/010
- TRD-DB-007..008
- TRD-PERF-006

Live-discovered forward hardening:

### `20260913174704_organization_identity_provenance_acl_hardening.sql`
Reason: project default ACLs inherited broad table privileges for `anon`/`authenticated` including non-RLS row-independent privileges.

Result:
- Profile/Brand: authenticated SELECT+UPDATE only;
- Brand assets: authenticated CRUD only;
- identity and Knowledge provenance: authenticated SELECT only;
- no `anon` grants on these feature tables.

Regression:
- `src/modules/generation-context/provenance-sql.test.ts`.

### `20260913175126_core_knowledge_insert_guard.sql`
Reason: UPDATE guard did not prevent EDITOR direct insertion with `is_core=true`.

Result:
- INSERT and UPDATE Core state require OWNER/ADMIN.

Regression:
- `src/modules/knowledge-base/core-knowledge-sql.test.ts`.

### `20260913180118_organization_identity_rls_initplan_hardening.sql`
Reason: Supabase performance advisor identified per-row `auth.uid()` reevaluation in two new insert policies.

Result:
- Brand asset and Knowledge document insert policies use `(select auth.uid())` while preserving same RBAC/audit semantics;
- advisor `auth_rls_initplan` count fell from 11 to 9 and both feature-specific findings disappeared.

Regression:
- `src/modules/generation-context/rls-initplan-hardening-sql.test.ts`.

## 10. E2E/readiness traceability

Implementation:
- strict development-only E2E fixture resolver requires both the existing auth-bypass gate and `x-pak-e2e-fixture`;
- production mode cannot activate fixtures;
- fixture role parser currently models OWNER and REVIEWER only;
- synthetic Profile/Brand/Media/Knowledge values do not persist to Supabase.

Playwright verifies:
- OWNER editable Organization Profile and Brand Kit;
- REVIEWER populated read-only surfaces with no save controls;
- OWNER private document upload → Knowledge DRAFT review flow;
- existing tests without the second fixture header retain normal safe no-membership behavior.

Exact Task 12 CI #1180 passed typecheck, lint, units, production build, worker/container and Playwright.

## 11. Live rollout traceability

Project: PAK Supabase production project used by this repository.

Procedure/evidence:
1. remote migration history inspected first;
2. only five missing planned identity/ingestion/provenance migrations applied in order;
3. live-discovered issues fixed only via three later forward migrations;
4. OWNER/EDITOR/REVIEWER + cross-org rollback-only fixture probes executed;
5. private Media Library bucket confirmed private;
6. Brand schema confirmed no signed URL/path columns;
7. atomic provenance and DRAFT ingestion verified;
8. synthetic fixture cleanup verified zero rows across every touched table;
9. Supabase security/performance advisors rerun;
10. exact code-head CI #1186 passed all gates including Playwright.

Remote migration names/versions for this rollout:
- `20260913174003 organization_profile_brand_knowledge`
- `20260913174015 organization_identity_save_rpcs`
- `20260913174033 knowledge_documents`
- `20260913174045 knowledge_ingestion_finalize`
- `20260913174102 generation_identity_provenance`
- `20260913174704 organization_identity_provenance_acl_hardening`
- `20260913175126 core_knowledge_insert_guard`
- `20260913180118 organization_identity_rls_initplan_hardening`.

## 12. Existing platform traceability retained

The previously implemented and governed areas remain intact:
- authentication/tenancy/durable jobs;
- Integration Vault for OpenAI/LTX;
- multilingual artifacts;
- normalized Scene Planning/QC/approval;
- approved-shot video generation, reconciliation and private import;
- Phase 8 final assembly + Media Library worker/storage path.

External paid LTX acceptance remains dependent on valid organization credential/credits and must not be fabricated.

## 13. Drift-control rules

1. Every feature PR lists requirement IDs implemented/modified.
2. Existing requirement IDs retain meaning; new behavior gets new IDs.
3. Requirement changes update PRD/TRD/UX/DB/workflows/integration/traceability together.
4. A UI route without workflow/backend requirements is not completed functionality.
5. A backend table without product workflow ownership is speculative and should not be added.
6. Security-sensitive features require positive and negative authorization traceability.
7. External/paid workflows require explicit idempotency/spend-boundary tests.
8. Legacy/Foundation entities are not extended without compatibility reason.
9. Applied migrations are immutable; live defects use forward migrations + regression tests.
10. Exact-head CI evidence is required for merge claims.
11. Live verification uses reversible fixtures and must prove cleanup.
12. Provider acceptance is never fabricated when external prerequisites are absent.