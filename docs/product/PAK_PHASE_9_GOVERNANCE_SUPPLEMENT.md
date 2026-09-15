# PAK Phase 9 Approval Center — Governance Supplement

**Document ID:** PAK-PH9-GOV-001  
**Version:** 1.0  
**Status:** Canonical Phase 9 governance delta pending PR #44 merge  
**Date:** 16 September 2026  
**Applies to:** PAK Master PRD, Master TRD, Backend Schema, UI/UX Specification, System Workflows, Integration Architecture, Development Roadmap and Traceability Matrix

## 1. Purpose and precedence

This supplement records the verified Phase 9 Approval Center state without rewriting unrelated Publishing / Book Factory governance that was developed concurrently on `main`.

For Phase 9 Approval Center questions only, this document and the current Phase 9 design/plan override stale pre-Phase-9 maturity/status wording in the master governance documents until those master files are next consolidated. Existing requirement IDs retain their original meaning. No Phase 10+ requirement is advanced by this supplement.

This supplement does not authorize PR #44 merge.

## 2. Phase 9 product status

The generic Approval Center is **IMPLEMENTED and LIVE-HARDENED** on PR #44.

Implemented operator capabilities:

- organization-scoped review queue and detail/history surfaces;
- explicit submit-for-review handoffs from Content Studio and Media Library;
- PENDING / CHANGES_REQUESTED / APPROVED / REJECTED / SUPERSEDED lifecycle;
- explicit confirmation before irreversible review decisions;
- required comments for REQUEST_CHANGES and REJECT;
- deterministic queue continuation pagination;
- exact-version review identity: content artifact revision or Media asset checksum;
- request-bound/checksum-bound private Media preview;
- stale/current target visibility;
- immutable audit-event history.

Role contract:

- OWNER / ADMIN / EDITOR may submit or re-submit eligible targets for review;
- OWNER / ADMIN / REVIEWER may make approval decisions;
- EDITOR may not self-approve through the generic decision boundary;
- organization membership and tenant isolation remain database/server enforced.

Scene Planning retains its own authoritative plan approval lifecycle. Generic Approval Center integration does not bypass or replace `scene_plan_versions` lifecycle rules.

## 3. PRD delta

The following master-PRD maturity statements are superseded for Phase 9:

- `Generic Approval Center | Roadmap-governed separately` → **Implemented and live-hardened (Phase 9)**.
- PRD-APR-001..005 current maturity → **Implemented and live-verified**.
- Dashboard copy that treats Approval as a future dependency should be read as referring only to remaining Publishing / Calendar aggregation work; generic Approval Center itself is operational.

Normative Phase 9 semantics:

- **PRD-APR-001:** reviewable content/media uses explicit persisted review state.
- **PRD-APR-002:** authorized reviewers approve, reject or request changes through server-authoritative transitions.
- **PRD-APR-003:** Approval events are immutable audit records.
- **PRD-APR-004:** downstream publication eligibility may require an exact current approval; Phase 10 publishing consumes the narrow current-approval predicate rather than browser state.
- **PRD-APR-005:** substantive target change invalidates/supersedes prior approval.

## 4. TRD delta

Phase 9 adds the following implemented technical authority:

- `approval_requests` is the authoritative generic review-request record, organization-scoped and exact-target-bound.
- `approval_events` is append-only/immutable audit history.
- browser input supplies safe identifiers; server/database logic resolves authoritative target revision/checksum/snapshot.
- decision and submission transitions use guarded server/database boundaries with tenant and role checks.
- Media approval preview is bound to approval request identity and expected checksum before a signed URL is produced; signed URLs are never persisted as approval identity or event history.
- queue pagination uses deterministic server ordering with a stable continuation cursor.
- `is_target_currently_approved(...)` is the narrow server-side eligibility predicate for future publication enforcement.
- generic Approval Center does not change Scene Planning's domain-specific approval authority.

Security invariants:

- browser roles cannot authoritatively set approval status directly;
- exact target revision/checksum is resolved server-side;
- cross-organization target/reference use fails closed;
- immutable Approval events expose no ordinary authenticated UPDATE/DELETE path;
- internal supersession helpers are not browser-callable when their function is trigger/internal-only.

## 5. Backend schema delta

Add the following to the implemented domain map:

```text
content_script_artifacts ─┐
                          ├─> approval_requests ──> approval_events
media_assets ─────────────┘
```

### `approval_requests`

Purpose: organization-scoped generic review authority for exact target versions.

Implemented logical fields include:

- `id uuid PK`
- `organization_id uuid FK organizations`
- `target_type`: `CONTENT_ARTIFACT | MEDIA_ASSET`
- `target_id uuid`
- `target_revision integer nullable`
- `target_checksum text nullable`
- `target_fingerprint text`
- `target_snapshot jsonb`
- `publication_intent jsonb`
- `status`: `PENDING | CHANGES_REQUESTED | APPROVED | REJECTED | SUPERSEDED`
- request / decision / supersession audit fields and timestamps.

Shape rule:

- CONTENT_ARTIFACT binds an exact revision and no checksum;
- MEDIA_ASSET binds an exact checksum and no revision.

### `approval_events`

Purpose: immutable lifecycle/audit history for Approval requests.

Events include request, decision and supersession history with exact revision/checksum identity preserved. UPDATE/DELETE is denied to normal browser roles and database immutability protection is active.

### Release hardening

Production contains the forward hardening migrations:

- `approval_media_delete_supersession`
- `content_artifact_revision_guard`

The Media delete trigger supersedes live approvals before the target row disappears. Substantive content script edits automatically advance revision before the existing approval supersession logic evaluates the change.

## 6. UI/UX delta

Approval Center moves from Roadmap/readiness UX to **Operational** workflow status.

Implemented UX requirements:

- **UX-APR-001:** queue/list with explicit review state and deterministic continuation.
- **UX-APR-002:** review detail exposes authoritative target snapshot, exact revision/checksum identity and safe history.
- **UX-APR-003:** role-valid approve / request changes / reject actions use explicit confirmation; comment requirements remain enforced.
- **UX-APR-004:** stale/superseded state is visible and cannot masquerade as current approval.

Content Studio and Media Library expose review submission handoffs. Private Media preview remains signed/request-scoped transport only.

Approval Center must not appear in Planned/future readiness matrices. Other Phase 10+ routes keep their existing truthful readiness state.

## 7. System workflow delta

Generic content/media approval workflow:

1. eligible OWNER / ADMIN / EDITOR submits target identifier;
2. server resolves same-org authoritative target and exact revision/checksum;
3. server creates/reuses the appropriate Approval request and immutable REQUESTED history;
4. OWNER / ADMIN / REVIEWER inspects authoritative detail/history;
5. decision requires explicit confirmation; REQUEST_CHANGES/REJECT require comment;
6. guarded server/database transition records decision and immutable event;
7. later substantive content revision or reviewed Media deletion supersedes affected current approval before it can remain falsely current;
8. downstream systems query exact current-approval eligibility rather than trusting browser/UI labels.

Scene Planning continues using its existing plan review/approval workflow and is not routed through generic Approval Center as a replacement lifecycle.

## 8. Integration architecture delta

No new external provider secret is introduced by Phase 9.

Approval Center integrates only with existing authoritative application boundaries:

- Content Studio / content artifacts;
- Media Library / private Storage identity;
- Supabase PostgreSQL / RLS / guarded functions;
- future Phase 10 publishing through the current-approval predicate.

Media preview obtains a request-scoped signed URL only after server-side approval-request, organization, target type/id and checksum verification. Signed URLs are not durable business identity and are not stored in Approval events.

Meta remains governed by Phase 10 and is not made operational by Phase 9.

## 9. Traceability delta

| Requirement family | Implementation | Verification | Status |
|---|---|---|---|
| PRD-APR-001..005 | `src/modules/approval/*`, Approval Center routes/actions, migrations 009–016 | schema/state-machine/repository/read-model/security tests + live rollback-only proof | **Implemented / live-verified** |
| UX-APR-001..004 | `/approval-center`, review client, Content Studio + Media Library handoffs | component tests + Playwright E2E + exact-head CI | **Implemented** |
| Exact content revision binding | `approval_requests.target_revision`, content revision guard, supersession trigger | release-hardening tests + live revision 1→2 rollback proof | **Implemented / live-verified** |
| Exact Media checksum binding | `approval_requests.target_checksum`, request-bound preview, media-delete supersession | action/Edge tests + live delete-before-disappear rollback proof | **Implemented / live-verified** |
| Immutable history | `approval_events`, immutable guard + ACL hardening | SQL tests + live privilege/trigger inspection | **Implemented / live-verified** |
| Tenant/RBAC | guarded submit/decide RPCs + RLS/ACL | positive/negative role tests and cross-org probes | **Implemented / continuous** |
| Deterministic queue continuation | approval read model + cursor | unit/component tests + exact-head CI | **Implemented** |
| Phase 10 eligibility handoff | `is_target_currently_approved(...)` | workflow/runtime hardening tests | **Implemented boundary; Publishing consumption remains Phase 10** |

## 10. Production verification evidence

Production Supabase project migration history contains both Phase 9 release-hardening changes:

- `20260915192224 approval_media_delete_supersession`
- `20260915192232 content_artifact_revision_guard`

Live inspection confirmed both triggers are active and match repository intent.

Rollback-only production proof confirmed:

- deleting a reviewed Media asset supersedes its approval first with reason `media_asset_deleted` and writes exactly one SYSTEM supersession event;
- substantive script edit advances revision `1 → 2`;
- all synthetic Approval/Media rows rolled back to zero;
- the real content artifact used for the revision probe returned to revision 1 with no probe marker.

The trigger-only Media supersession function is `SECURITY DEFINER` with direct PUBLIC / anon / authenticated EXECUTE removed.

## 11. CI and release evidence

Exact PR #44 head `cad700272ae8e51d496361b0360b59286549c47b` passed GitHub Actions CI run **#1418**.

Successful gates included:

- TypeScript typecheck;
- lint;
- publishing/source diagnostics;
- serialized full unit tests;
- normal parallel unit tests;
- canonical knowledge checks and publishing smokes;
- production Next.js build;
- final-assembly worker install/typecheck/tests;
- final-assembly worker container build/smoke;
- Playwright E2E smoke.

A new exact-head CI run is required after this governance commit before release-ready status may be claimed.

## 12. Release boundary

Phase 9 is engineering-complete and production-database-hardened subject to the final exact-head post-governance verification chain:

1. exact-head CI after governance commit;
2. exact-head Vercel preview READY and runtime smoke;
3. unresolved PR-review-thread check;
4. final diff/security review;
5. explicit user authorization before merge.

PR #44 must remain unmerged until step 5.