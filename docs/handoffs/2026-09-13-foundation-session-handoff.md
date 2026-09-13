# PAK Marketing Automation — Foundation Session Handoff

**Date:** 2026-09-13  
**Purpose:** Resume the current software thread exactly from this point in a new ChatGPT session without restarting completed work or drifting to an older branch/phase.

## 1. Resume exactly here

- Repository: `purchase2adhikpackaging-code/pak-marketing-automation`
- Active branch: `foundation/org-profile-brand-knowledge`
- Pull request: **#40** (open, draft, base `main`)
- Software HEAD immediately before this handoff commit: `2a1048fdbe1327287c774c94acdf1d00d29da598`
- Canonical implementation plan: `docs/superpowers/plans/2026-09-12-organization-profile-brand-kit-knowledge-ingestion.md`

**Source-of-truth rule:** On resume, inspect the live branch HEAD, PR #40, latest CI, this handoff, the canonical plan, and governing product docs. Current repository state wins over stale chat summaries. Do **not** switch back to `phase-9/approval-center` or restart already-completed tasks.

## 2. Governing product documents

Read and preserve these contracts before changing behavior:

- `docs/product/PAK_MASTER_PRD.md`
- `docs/product/PAK_MASTER_TRD.md`
- `docs/product/PAK_BACKEND_SCHEMA.md`
- `docs/product/PAK_UI_UX_SPEC.md`
- `docs/product/PAK_SYSTEM_WORKFLOWS.md`
- `docs/product/PAK_INTEGRATION_SPEC.md`
- `docs/product/PAK_DEVELOPMENT_ROADMAP.md`
- `docs/product/PAK_TRACEABILITY_MATRIX.md`

## 3. Non-negotiable constraints

1. **NEVER touch Lovable.** Do not spend Lovable credits, open a Lovable task, or route implementation through Lovable.
2. Continue autonomously; do not ask routine confirmation when the plan/repo already answers the question.
3. Preserve existing RLS/RBAC, revision/CAS semantics, immutable provenance, private storage boundaries, and organization isolation.
4. Follow TDD for feature/bug slices. A real RED should precede the minimum coherent implementation, followed by exact-head verification.
5. On failures, debug the root cause first; do not weaken contracts or paper over tests.
6. Never expose service-role keys, tokens, signed URLs, storage coordinates, or other secrets in user-visible output.
7. Do not make destructive changes to real business data. Live database proof must use reversible synthetic fixtures.
8. Do not claim tests/build/E2E/live migration success without fresh evidence for the relevant HEAD.

## 4. Work completed before this handoff

### Tasks 1–5

The earlier slices in the canonical foundation plan have been implemented on this branch. Do not reimplement them unless current code/CI proves a regression.

### Task 6 — bounded extraction and URL-security boundary

Implemented/verified:

- Server-only document extraction in `src/modules/knowledge-ingestion/extractors.ts`.
- `officeparser` used behind the application's own bounded extraction API for PDF/DOCX/PPTX parsing; raw parser API does not leak through the rest of the app.
- Extraction input/output is bounded; OCR is disabled.
- URL ingestion security in `src/modules/knowledge-ingestion/url-safety.ts` validates every redirect hop.
- SSRF protection rejects localhost/private/link-local/internal targets.
- The default HTTP client pins requests to the DNS address that was validated, preventing a second DNS lookup from silently rebinding the hostname to private infrastructure.

### Task 7 — authoritative ingestion orchestration

TDD contract files:

- `src/modules/knowledge-ingestion/repository.test.ts`
- `src/modules/knowledge-ingestion/ingestion-service.test.ts`
- `src/app/(app)/knowledge-base/ingestion-actions.test.ts`
- `src/modules/knowledge-ingestion/finalize-sql.test.ts`

Production implementation:

- `src/modules/knowledge-ingestion/repository.ts`
- `src/modules/knowledge-ingestion/ingestion-service.ts`
- extended `src/app/(app)/knowledge-base/actions.ts`
- `supabase/migrations/20260912180130_knowledge_ingestion_finalize.sql`

Task 7 security/data invariants:

- Browser supplies only safe identity: `organizationId + mediaAssetId` for file ingestion, or the URL for URL ingestion.
- Browser never supplies authoritative storage bucket/path, extracted text, source fingerprint, or activation state.
- File ingestion accepts only same-organization, ACTIVE, `DOCUMENT` media.
- MIME/type is re-derived from the authoritative media row rather than trusted from the browser.
- Private storage bytes are read server-side.
- Successful ingestion creates **DRAFT Knowledge only**. It never auto-activates Knowledge.
- Atomic finalization RPC locks the expected PROCESSING document revision, marks extraction EXTRACTED, creates the DRAFT `knowledge_records` row, and snapshots the exact `knowledge_document_revision`.
- Document source identity/revision linkage is immutable.
- Extraction failures get a best-effort FAILED transition. An uncertain atomic-finalization error is not subsequently forced to FAILED because the transaction may actually have committed.

Core Knowledge already exists as database authority:

- `knowledge_records.is_core`
- OWNER/ADMIN-only mutation is enforced by the existing database trigger in `20260912180000_organization_profile_brand_knowledge.sql`.
- Do not create a second Core Knowledge state in client/UI code.

## 5. Latest Task 7 CI evidence and caveat

Observed after implementation:

- Initial TypeScript failure was traced to Supabase generated client types not knowing the new `knowledge_documents` table. The fix added the same explicit `unknown -> KnowledgeDocumentRow` mapping boundary used elsewhere; domain types were not weakened.
- A subsequent run reached typecheck GREEN, lint GREEN, and units **582 / 583 passed**.
- The single unit failure was a test-harness assertion that expected UPDATE syntax (`knowledge_document_revision = ...`) while the migration correctly writes the revision through INSERT column/value order. The test was corrected to assert the actual INSERT relationship.
- The exact rerun after that test fix was GitHub Actions run **34761566613** / run number **1148**, job **103735208386**. At the last observation in this session it was still executing units. **Do not assume the final result; re-check latest CI on resume.**

Known baseline/tooling noise:

- `npm install` currently reports **6 vulnerabilities: 3 moderate, 3 high** after the parser dependency. This is not claimed fixed.
- Latest relevant lint observation: **13 warnings, 0 errors**. Do not claim warnings are fixed unless changed and verified.
- GitHub Actions may emit Node action-runtime deprecation warnings; distinguish infrastructure noise from application failures.

## 6. Exact next action on resume

1. Inspect current live branch HEAD, PR #40, and latest CI status. The branch may have advanced because this handoff commit itself changes HEAD.
2. If Task 7 exact-head verification is green, proceed directly to **Task 8** from the canonical plan using fresh RED tests.
3. If CI is red, read the exact failing step/log and debug the root cause before Task 8. Do not relax security or correctness contracts merely to make CI green.

### Task 8 intended implementation seam

Extend the existing Knowledge Base manager rather than replacing its manual lifecycle.

Existing UI:
- `src/app/(app)/knowledge-base/knowledge-base-manager.tsx`
- It already supports manual create/edit/activate/archive/delete with RBAC.

Document ingestion UI must reuse the existing private Media Library upload path:

`issueMediaUploadAction -> private PUT -> finalizeMediaUploadAction -> ingestKnowledgeFileAction`

Relevant existing media code:
- `src/app/(app)/media-library/media-upload.tsx`
- `src/app/(app)/media-library/actions.ts`

Task 8 rules:

- Preserve manual Knowledge create/edit/archive/delete behavior.
- Add document and URL ingestion through the guarded server boundaries already implemented.
- A successful ingestion result remains **DRAFT**; activation is an explicit later action.
- Expose Core Knowledge through the existing `is_core` database authority.
- Core Knowledge mutation must be a dedicated OWNER/ADMIN action; EDITOR must not gain that authority.
- Do not create duplicate upload/storage mechanics or a second core-state model.
- Write RED tests first for the intended UI/action behavior, then implement the smallest coherent slice.

## 7. Remaining project execution

After Task 8, continue every remaining task in `docs/superpowers/plans/2026-09-12-organization-profile-brand-kit-knowledge-ingestion.md` in dependency order. Do not invent substitute milestones.

Before final completion/release claims:

- verify from narrow affected tests to typecheck/lint/full units/build/E2E and any worker/container gates required by CI;
- perform required security/RBAC/RLS/currentness regression proof;
- update governing docs/traceability/readiness evidence required by the plan;
- use verification-before-completion and request code review;
- make PR #40 merge-ready only after evidence is green;
- do not merge merely because the implementation is complete unless the user/authorized plan explicitly calls for the merge.

### Before any live Supabase change

- Read/use the Supabase skill/instructions first.
- Inspect the actual remote migration list/state before applying anything.
- Never reapply already-applied migrations.
- Use only reversible synthetic fixtures for validation.
- Preserve real business data.
- Run appropriate security/performance advisors after schema changes when the plan reaches live rollout.

## 8. Continuation behavior for the next ChatGPT session

- First read this handoff, then the canonical plan, then inspect current repo/PR/CI.
- Treat repository evidence as authoritative if chat memory conflicts with it.
- Continue from the exact next unfinished task; do not restart Tasks 1–7 just to reconstruct context.
- Maintain architecture, TDD, RLS/RBAC, revision integrity, atomicity, SSRF/private-storage boundaries, provenance, regression coverage, and release discipline.
- Keep the user updated every few tool calls during long work, but do not interrupt execution with routine confirmation questions.
- If the user says **“continue”**, proceed with the next sanctioned step automatically.
- **Never touch Lovable.**
