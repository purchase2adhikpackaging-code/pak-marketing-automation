# Organization Profile, Brand Kit & Knowledge Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authoritative organization identity, official Brand Kit assets/rules, Core Knowledge, review-first document ingestion, and one shared automatic generation-context resolver.

**Architecture:** Extend the existing organization, Media Library and Knowledge Base models rather than creating parallel stores. Binary brand/document files remain private `media_assets`; profile/brand/knowledge metadata remains organization-scoped in Supabase; browser requests carry IDs while server-only resolvers load trusted content and exact revisions.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.9, Supabase/Postgres/RLS/private Storage, Zod 4, Vitest, Playwright, Node extraction runtime.

**Spec:** `docs/superpowers/specs/2026-09-12-organization-profile-brand-kit-knowledge-ingestion-design.md`

## Global Constraints

- Never touch Lovable.
- Preserve existing Supabase tenant isolation/RLS/RBAC conventions.
- Never expose service-role secrets, raw private storage paths or signed URLs in persisted profile/brand/knowledge records.
- Existing Media Library remains authoritative for binary files.
- Existing Knowledge Base revision/provenance semantics remain authoritative.
- Uploaded/URL sources produce DRAFT Knowledge only; activation is always explicit.
- Only OWNER/ADMIN may mutate Organization Profile/Brand Kit or change Core Knowledge status.
- No OCR, XLSX/CSV ingestion, vector database or multiple named Brand Kits in this slice.
- Use forward-only migrations; never rewrite an applied migration.
- TDD RED → GREEN for each behavior slice.

---

### Task 1: Domain contracts for profile, Brand Kit and organization generation context

**Files:**
- Create: `src/modules/organization-profile/types.ts`
- Create: `src/modules/organization-profile/schema.ts`
- Create: `src/modules/organization-profile/schema.test.ts`
- Create: `src/modules/brand-kit/types.ts`
- Create: `src/modules/brand-kit/schema.ts`
- Create: `src/modules/brand-kit/schema.test.ts`
- Create: `src/modules/generation-context/types.ts`
- Create: `src/modules/generation-context/schema.test.ts`

**Interfaces:**
- Produces `OrganizationProfile`, `OrganizationBrandKit`, `OrganizationGenerationContext` and strict Zod request/update schemas used by later tasks.
- Asset references are UUIDs only; no signed URL/path fields exist in Brand Kit contracts.

- [ ] Write RED tests for field bounds, revision >= 1, social links, hex colors, UUID asset references and rejection of storage/signed URL fields.
- [ ] Run exact focused Vitest files and confirm RED.
- [ ] Implement the minimum strict contracts/schemas.
- [ ] Run focused tests and typecheck; confirm GREEN.
- [ ] Commit `feat: add organization identity domain contracts`.

### Task 2: Database foundation, RLS, revisioning and Core Knowledge

**Files:**
- Create: `supabase/migrations/20260912180000_organization_profile_brand_knowledge.sql`
- Create: `src/modules/organization-profile/schema-sql.test.ts`
- Create: `src/modules/brand-kit/schema-sql.test.ts`
- Modify: Knowledge SQL contract tests as needed.

**Interfaces:**
- Produces `organization_profiles`, `organization_brand_kits`, `brand_kit_media_assets` and `knowledge_records.is_core`.
- Profile/Brand Kit are one-row-per-org and revisioned.
- Brand asset join rows use semantic roles `PRIMARY_LOGO|LIGHT_LOGO|DARK_LOGO|BRAND_MARK|FAVICON|APPROVED_IMAGERY`.

- [ ] Write RED SQL-source tests for tables, constraints, same-org FKs/validation trigger, role-scoped RLS, revision increment guards, and OWNER/ADMIN-only Core toggle boundary.
- [ ] Observe RED.
- [ ] Implement forward migration with indexes, RLS/policies, mutation guards and safe grants.
- [ ] Run focused SQL tests + full unit gate.
- [ ] Commit `feat: add organization profile brand kit schema`.

### Task 3: Profile and Brand Kit repositories/server actions

**Files:**
- Create: `src/modules/organization-profile/repository.ts`
- Create: `src/modules/organization-profile/repository.test.ts`
- Create: `src/modules/brand-kit/repository.ts`
- Create: `src/modules/brand-kit/repository.test.ts`
- Create: `src/app/(app)/settings/organization-profile/actions.ts`
- Create: `src/app/(app)/settings/organization-profile/actions.test.ts`
- Create: `src/app/(app)/settings/brand-kit/actions.ts`
- Create: `src/app/(app)/settings/brand-kit/actions.test.ts`

**Interfaces:**
- Read available to organization members; mutation only OWNER/ADMIN/`settings:manage`.
- Brand asset assignment validates referenced `media_assets.organization_id`, ACTIVE status and compatible image MIME before persistence.

- [ ] Write RED auth/role/cross-org/asset validation tests.
- [ ] Observe RED.
- [ ] Implement repositories and guarded server actions using authenticated server client only.
- [ ] Run focused tests/typecheck.
- [ ] Commit `feat: add profile and brand kit services`.

### Task 4: Settings UI for Organization Profile and Brand Kit

**Files:**
- Create: `src/app/(app)/settings/organization-profile/page.tsx`
- Create: `src/app/(app)/settings/organization-profile/profile-client.tsx`
- Create: corresponding tests.
- Create: `src/app/(app)/settings/brand-kit/page.tsx`
- Create: `src/app/(app)/settings/brand-kit/brand-kit-client.tsx`
- Create: corresponding tests.
- Modify: `src/components/app-shell/navigation.ts` and navigation/readiness tests only as required to expose the two Settings surfaces without breaking existing Integrations routing.

**Interfaces:**
- OWNER/ADMIN editable; other roles read-only.
- Brand Kit asset picker lists safe ACTIVE organization image assets from Media Library; persisted assignment uses asset IDs only.

- [ ] Write RED component/navigation tests.
- [ ] Observe RED.
- [ ] Implement responsive forms, validation, loading/error/success states and safe asset selection.
- [ ] Run focused UI tests + typecheck/lint.
- [ ] Commit `feat: add organization profile and brand kit settings`.

### Task 5: Knowledge document schema and ingestion lifecycle

**Files:**
- Create: `supabase/migrations/20260912180100_knowledge_documents.sql`
- Create: `src/modules/knowledge-ingestion/types.ts`
- Create: `src/modules/knowledge-ingestion/schema.ts`
- Create: `src/modules/knowledge-ingestion/schema.test.ts`
- Create: `src/modules/knowledge-ingestion/schema-sql.test.ts`

**Interfaces:**
- `knowledge_documents` supports FILE/URL and PDF/DOCX/PPTX/TXT/URL formats.
- Extraction statuses PENDING/PROCESSING/EXTRACTED/FAILED.
- File documents reference same-org DOCUMENT `media_assets`; URL documents persist canonical safe URL only.
- `knowledge_records.knowledge_document_id` links resulting DRAFT knowledge.

- [ ] Write RED domain/SQL tests.
- [ ] Observe RED.
- [ ] Implement migration/contracts/RLS/indexes and immutable source identity rules.
- [ ] Run focused tests/full units.
- [ ] Commit `feat: add knowledge document lifecycle`.

### Task 6: Safe extraction and URL ingestion boundary

**Files:**
- Modify: `package.json` / lockfile with narrowly scoped extraction dependencies if required.
- Create: `src/modules/knowledge-ingestion/extractors.ts`
- Create: `src/modules/knowledge-ingestion/extractors.test.ts`
- Create: `src/modules/knowledge-ingestion/url-safety.ts`
- Create: `src/modules/knowledge-ingestion/url-safety.test.ts`
- Create: `src/modules/knowledge-ingestion/service.ts`
- Create: `src/modules/knowledge-ingestion/service.test.ts`

**Interfaces:**
- `extractKnowledgeText({format, bytes})` returns bounded sanitized text.
- URL safety permits only http/https public destinations and rejects loopback/private/link-local/cloud-metadata targets and unsafe redirects.
- Maximum source and extracted-text sizes are explicit constants and covered by tests.

- [ ] Write RED extractor and SSRF tests using deterministic fixture buffers/URLs.
- [ ] Observe RED.
- [ ] Add minimal supported parsing: TXT direct decode; PDF parser; DOCX extraction; PPTX slide XML extraction; URL HTML/text sanitization.
- [ ] Implement strict MIME/size/error mapping.
- [ ] Run focused tests/typecheck.
- [ ] Commit `feat: add safe knowledge extraction`.

### Task 7: Knowledge ingestion server actions and DRAFT creation

**Files:**
- Modify: `src/app/(app)/knowledge-base/actions.ts`
- Add focused action tests.
- Create: `src/modules/knowledge-ingestion/repository.ts`
- Create: `src/modules/knowledge-ingestion/repository.test.ts`

**Interfaces:**
- File ingestion accepts an existing uploaded DOCUMENT media asset ID; it does not accept raw storage path.
- URL ingestion accepts one validated URL.
- Successful extraction creates/updates only DRAFT Knowledge and links source revision.
- No ingestion code activates Knowledge automatically.

- [ ] Write RED actions/repository tests for roles, cross-org source rejection, DRAFT-only creation and safe failure messages.
- [ ] Observe RED.
- [ ] Implement guarded actions/repository/service orchestration.
- [ ] Run focused/full units.
- [ ] Commit `feat: add knowledge ingestion actions`.

### Task 8: Knowledge Base UI — Core Knowledge and document/URL ingestion

**Files:**
- Modify: `src/app/(app)/knowledge-base/knowledge-base-manager.tsx`
- Modify/add Knowledge Base component tests.
- Add small focused upload/URL components if needed instead of growing the manager beyond maintainable size.

**Interfaces:**
- OWNER/ADMIN see Core toggle; all existing knowledge managers preserve normal lifecycle permissions.
- Upload flow accepts PDF/DOCX/PPTX/TXT and routes through private Media Library upload before ingestion.
- URL flow shows extraction state and opens resulting DRAFT record for review.

- [ ] Write RED UI tests for Core toggle permissions, accepted formats, DRAFT result and no auto-activation.
- [ ] Observe RED.
- [ ] Implement UI with accessible progress/errors and source provenance.
- [ ] Run UI/typecheck/lint gates.
- [ ] Commit `feat: expand knowledge base ingestion`.

### Task 9: Shared automatic organization generation-context resolver

**Files:**
- Create: `src/modules/generation-context/resolver.ts`
- Create: `src/modules/generation-context/resolver.test.ts`
- Create: `src/modules/generation-context/repository.ts`
- Create: `src/modules/generation-context/repository.test.ts`

**Interfaces:**
- `resolveOrganizationGenerationContext(input)` server-resolves profile, Brand Kit, Core Knowledge and selected Knowledge.
- Core is deterministic; selected IDs preserve requested order; duplicates collapse; non-ACTIVE/cross-org inputs cannot become grounding.
- Produces provenance revisions and safe brand asset IDs.

- [ ] Write RED resolver tests covering automatic profile/brand/core application, dedupe/order and cross-org/non-active rejection.
- [ ] Observe RED.
- [ ] Implement repository/resolver with bounded context composition.
- [ ] Run focused/full units.
- [ ] Commit `feat: add automatic organization generation context`.

### Task 10: Content Studio integration and immutable profile/brand provenance

**Files:**
- Modify: `src/app/(app)/content-studio/actions.ts`
- Modify: Content Studio action tests.
- Create: `supabase/migrations/20260912180200_generation_identity_provenance.sql`
- Add SQL tests for profile/brand revision snapshots.

**Interfaces:**
- Browser continues to send topic/selected Knowledge IDs only.
- Server automatically resolves Profile + Brand + Core + selected Knowledge.
- Generated content stores exact profile/brand revisions in immutable provenance metadata while existing knowledge snapshot records remain unchanged.

- [ ] Write RED action/SQL tests proving automatic context and revision snapshots.
- [ ] Observe RED.
- [ ] Implement shared resolver integration and persistence.
- [ ] Run Content Studio/full unit/build gate.
- [ ] Commit `feat: ground content in organization identity`.

### Task 11: Scene Planning brand-default integration

**Files:**
- Modify: `src/app/(app)/scene-planning/workflow-actions.ts`
- Modify: `src/app/(app)/scene-planning/granular-replan-actions.ts`
- Add focused tests.

**Interfaces:**
- Brand Kit supplies institutional default palette/typography/logo asset identity and voice constraints.
- Visual Bible remains project creative-direction authority but cannot substitute a different official logo identity silently.

- [ ] Write RED tests for automatic Brand Kit resolution and preservation of Visual Bible behavior.
- [ ] Observe RED.
- [ ] Implement bounded mapping into planner inputs.
- [ ] Run Scene Planning regression tests.
- [ ] Commit `feat: apply brand kit to scene planning`.

### Task 12: End-to-end/readiness tests and full exact-head CI

**Files:**
- Add/modify Playwright specs for Settings Profile, Brand Kit and Knowledge ingestion.
- Modify readiness/navigation tests where route maturity changes.

- [ ] Add browser smoke coverage for authorized/read-only surfaces and document-to-DRAFT workflow using deterministic test doubles/fixtures.
- [ ] Run typecheck, lint, all units, production build, worker gates and Playwright.
- [ ] Fix regressions without broadening scope.
- [ ] Commit `test: verify organization identity and knowledge ingestion`.

### Task 13: Live Supabase rollout and reversible proof

**Files:** no code unless a live-discovered defect requires a forward migration + regression test.

- [ ] Inspect remote migration history before applying anything.
- [ ] Apply only missing new forward migrations.
- [ ] Prove profile/brand RLS and role boundaries with reversible fixtures.
- [ ] Prove same-org ACTIVE media enforcement for official logos.
- [ ] Prove Core Knowledge automatic selection and normal ACTIVE non-core exclusion unless selected.
- [ ] Prove document ingestion creates DRAFT only and cross-org source IDs fail.
- [ ] Verify no signed URLs/storage paths persist.
- [ ] Remove fixtures and run Supabase security/performance advisors.

### Task 14: Governance synchronization, review and integration readiness

**Files:**
- Modify: `docs/product/PAK_MASTER_PRD.md`
- Modify: `docs/product/PAK_MASTER_TRD.md`
- Modify: `docs/product/PAK_BACKEND_SCHEMA.md`
- Modify: `docs/product/PAK_UI_UX_SPEC.md`
- Modify: `docs/product/PAK_SYSTEM_WORKFLOWS.md`
- Modify: `docs/product/PAK_INTEGRATION_SPEC.md` where URL ingestion/storage boundary is relevant.
- Modify: `docs/product/PAK_DEVELOPMENT_ROADMAP.md`
- Modify: `docs/product/PAK_TRACEABILITY_MATRIX.md`

- [ ] Record exact implemented data model, automatic context order, permissions and ingestion lifecycle.
- [ ] Run final exact-head CI after docs.
- [ ] Request/fetch PR review; resolve valid findings with TDD.
- [ ] Verify Vercel preview/build state where available.
- [ ] Keep branch merge-ready; integrate only after all required predecessor branch/order constraints are reconciled.