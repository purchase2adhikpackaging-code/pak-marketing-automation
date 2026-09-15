# Phase 9 Approval Center — Reconciliation Release Verification

**Date:** 15 September 2026  
**PR:** #44 — `Phase 9: Reconcile Approval Center onto current main`  
**Branch:** `phase-9/approval-center-reconciled`  
**Verified code head before this handoff commit:** `ab9f3a721889b298b37fc475e69848e4838b449d`

## Scope

This handoff records the release evidence for the reconciled generic Approval Center after current-main convergence. It does not authorize merge. Current repository state, this evidence, and the governed Phase 9 design/plan remain the source of truth.

Phase 9 provides:

- organization-scoped generic `approval_requests`;
- immutable `approval_events`;
- exact content-artifact revision and Media asset checksum binding;
- PENDING / CHANGES_REQUESTED / APPROVED / REJECTED / SUPERSEDED lifecycle;
- OWNER / ADMIN / REVIEWER decision authority;
- OWNER / ADMIN / EDITOR submit authority;
- deterministic review queue/detail UI;
- Content Studio and Media Library review submission handoffs;
- server-authoritative stale-target and supersession behavior;
- coexistence with Scene Planning's domain-specific approval lifecycle rather than bypassing it.

## Repository verification

Exact-head GitHub Actions CI run **#1416** on `ab9f3a721889b298b37fc475e69848e4838b449d` completed successfully.

Successful gates included:

- dependency install;
- Playwright browser install;
- TypeScript typecheck;
- ESLint;
- targeted publishing diagnostics;
- source diagnostics;
- serialized full unit suite;
- default-parallel Vitest diagnostic suite;
- normal `npm run test:run` unit suite;
- publishing registry smoke;
- canonical knowledge validation and lock audit;
- manuscript factory smoke;
- publishing production runner smoke;
- deterministic publishing QA fixture;
- Next.js production build;
- final-assembly worker dependency install, typecheck and tests;
- final-assembly worker Docker build and smoke;
- Playwright E2E smoke.

The final parallel-test blocker was not a production race defect. The test asserted an unscoped `Asset B` heading while both catalogue and selected-detail headings correctly existed. The regression assertion was narrowed to the authoritative `aside[aria-label="Media details"]` boundary; production logic was not weakened.

## Release-hardening migrations 015 / 016

The RED release-hardening contract required exactly two missing forward migrations:

1. `202609120015_approval_media_delete_supersession.sql`
   - supersedes reviewed Media approvals before a Media asset row disappears;
   - records `media_asset_deleted` as the supersession reason;
   - uses a trigger-only `SECURITY DEFINER` function;
   - direct EXECUTE is revoked from PUBLIC, `anon`, and `authenticated`.

2. `202609120016_content_artifact_revision_guard.sql`
   - advances `content_script_artifacts.revision` whenever `script_text` substantively changes;
   - runs BEFORE the existing AFTER-update Approval Center supersession trigger;
   - guarantees an old exact-revision approval cannot remain current after a script edit.

Repository tests and full CI passed with both migrations present.

## Production Supabase rollout

Resolved live Supabase project:

- project ref: `fwwozehhjarisqxwuzby`
- region: `ap-southeast-1`
- PostgreSQL engine: 17

Migration history was inspected before any write. Existing Phase 9 migrations were already live:

- `approval_center_schema`
- `approval_center_workflow`
- `approval_center_supersession`
- `approval_center_table_acl_hardening`
- `approval_center_pgcrypto_schema_fix`
- `approval_events_org_index`

Those migrations were **not replayed**.

Only the two missing release-hardening migrations were applied, in order:

- `20260915192224 approval_media_delete_supersession`
- `20260915192232 content_artifact_revision_guard`

Both applications returned success.

## Live schema / security verification

Post-DDL checks confirmed:

- `public.supersede_target_approvals(uuid,text,uuid,text)` exists;
- required Media and content-artifact columns exist;
- `trg_media_assets_supersede_approvals_before_delete` exists as BEFORE DELETE;
- `trg_content_script_artifacts_advance_revision` exists as BEFORE UPDATE OF `script_text, revision`;
- existing `content_artifact_approval_supersession` remains AFTER UPDATE OF `revision, status, script_text`;
- the Media delete function is `SECURITY DEFINER` and not executable by PUBLIC / `anon` / `authenticated`;
- Approval event UPDATE/DELETE table privileges remain denied to `anon` and `authenticated`;
- live `approval_events_immutable` BEFORE DELETE OR UPDATE trigger is present.

Supabase security advisors reported no new warning for the new Media-delete trigger function. Remaining advisor findings are pre-existing project-level items, including intentional authenticated `SECURITY DEFINER` RPCs that enforce their own authorization, leaked-password protection being disabled, two RLS-enabled internal tables without policies, and existing performance/index recommendations. These findings were not introduced by migrations 015/016.

## Rollback-only live behavioral proof

A savepoint-backed synthetic proof executed against production and rolled all fixture data back.

Verified:

- substantive content edit advanced revision `1 -> 2`;
- the prior exact-revision approval became `SUPERSEDED`;
- supersession reason was `CONTENT_ARTIFACT_CHANGED`;
- exactly one SYSTEM `SUPERSEDED` event was written for the old revision;
- deleting a reviewed Media asset removed the Media row only after its approval was superseded;
- Media supersession reason was `media_asset_deleted`;
- exactly one SYSTEM `SUPERSEDED` event preserved the reviewed checksum identity.

A second rollback-only authorization matrix verified:

- EDITOR can submit for review;
- EDITOR cannot make approval decisions;
- OWNER can approve;
- ADMIN can approve;
- REVIEWER can approve;
- submission against an organization where the actor is not a member is denied;
- submitted content approval snapshot binds the exact target revision.

After rollback:

- temporarily changed membership role returned to OWNER;
- synthetic content items: 0;
- synthetic content artifacts: 0;
- synthetic Media assets: 0;
- synthetic approval requests: 0;
- synthetic approval events: 0.

## Vercel state

The main `pak-marketing-automation` Vercel project is healthy. A PR #44 preview for prior head `510355b87635aa429f57354bffbed0dc2258b6f5` is `READY` (`dpl_8AHuWVtB3cr727rQY6B2WmBd9mnR`).

The latest verified code head `ab9f3a721889b298b37fc475e69848e4838b449d` was created after that preview and must receive its own exact-head preview/runtime check after this documentation commit chain settles. Do not treat the earlier READY preview as proof for a later head.

## Remaining release-review work

Before merge authorization:

1. reconcile stale product governance maturity/status text so master PRD/TRD/DB/UX/workflow/integration/roadmap/traceability documents describe Phase 9 as implemented rather than future/readiness-only;
2. verify exact current PR head after governance commits;
3. rerun exact-head CI;
4. verify exact-head Vercel preview/runtime;
5. perform final code/security review and confirm no unresolved PR review threads;
6. merge only with explicit user authorization.

## Non-negotiable constraints

- Do not replay already-live Phase 9 schema/workflow migrations.
- Do not touch Lovable.
- Do not weaken RLS/RBAC, tenant isolation, private-media identity, Integration Vault, or server-authoritative state transitions.
- Do not merge PR #44 automatically.
