# Phase 9 — Approval Center Design

**Project:** PAK Marketing Automation  
**Phase:** 9 — Approval Center  
**Status:** Draft for written-spec review  
**Base commit:** `a438632fbc93c2ad37c4502091fea076561d57f7`  
**Branch:** `phase-9/approval-center`  
**Date:** 2026-09-12

## 1. Purpose

Phase 9 introduces the product-wide Approval Center without weakening or duplicating the existing Scene Planning approval lifecycle.

The Approval Center provides one authoritative generic review workflow for reviewable content artifacts and media assets. It binds every decision to the exact version/checksum that was reviewed, records decisions as immutable audit events, invalidates stale approval when substantive target state changes, and exposes a server-side approval prerequisite that Phase 10 Publishing can enforce without trusting browser state.

The feature must preserve PAK's existing organization isolation, RBAC/RLS, immutable audit conventions, private-media access controls and authoritative-server-state principles.

## 2. Governing requirements

### Product requirements

- **PRD-APR-001** Content requiring review has explicit review state.
- **PRD-APR-002** Authorized reviewers can approve, reject or request changes.
- **PRD-APR-003** Approval events are immutable audit records.
- **PRD-APR-004** Publication may enforce approval prerequisites by channel/content policy.
- **PRD-APR-005** Revisions after approval invalidate prior approval when substantive content changes.

### UX requirements

- **UX-APR-001** Queue filters: Awaiting review / Changes requested / Approved / Rejected.
- **UX-APR-002** Review screen shows the exact artifact/revision, source/translation status, Knowledge provenance, media previews and publication intent.
- **UX-APR-003** Approve / Request changes / Reject are explicit actions; request-changes and reject require a comment; decisions become immutable audit history.
- **UX-APR-004** Scene Planning's plan-level approval remains domain-specific and is integrated rather than overwritten.

### Existing platform constraints reused by Phase 9

- Identity comes from Supabase Auth.
- Organization membership is the tenant authorization boundary.
- Roles are `OWNER | ADMIN | EDITOR | REVIEWER | ANALYST`.
- Existing `content:approve` permission belongs to OWNER, ADMIN and REVIEWER; EDITOR does not hold it.
- Browser/session requests remain constrained by RLS and narrowly scoped authenticated server/RPC boundaries.
- Immutable audit records do not expose ordinary authenticated UPDATE/DELETE.
- Private media is previewed through authorized short-lived signed access; raw storage authority is never delegated to the browser.

## 3. Scope

### In scope

1. Generic approval requests for:
   - `CONTENT_ARTIFACT`
   - `MEDIA_ASSET`
2. Exact target snapshot/fingerprint at submission time.
3. Approval queue and request detail/review screen.
4. Explicit decisions:
   - Approve
   - Request changes
   - Reject
5. Immutable event history.
6. Automatic supersession when the bound content revision/media identity is no longer current or eligible.
7. Same-organization RBAC/RLS and negative cross-tenant controls.
8. Content Studio and Media Library submission entry points.
9. A stable server-side `currently approved` prerequisite for future Publishing.
10. Integration with Scene Planning by preserving Scene Planning as the sole authority for plan approval and linking users to that workflow instead of copying its state into generic approval rows.

### Out of scope

- Replacing `scene_plan_versions` review/approval state.
- Publishing or Meta provider execution.
- Channel-specific approval policies beyond exposing a reliable generic approval prerequisite.
- Multi-step approval chains, quorum voting, approver assignment, deadlines/SLAs or escalations.
- Self-approval prohibition. Phase 9 follows role permission; separation-of-duties policy can be added later if required.
- Arbitrary user-defined target types.
- Editing content or media inside the Approval Center.
- Provider-specific review behavior.

## 4. Architectural decision

Use a **generic approval ledger with exact-target snapshots**.

`approval_requests` is the mutable workflow envelope for one exact review target version. `approval_events` is append-only immutable history.

This is preferred over adding approval columns to every domain table because it avoids duplicated state machines/audit behavior and gives Publishing one stable approval contract.

Scene Planning is explicitly not converted into this ledger in Phase 9. Its current lifecycle, QC guards, warning acknowledgements and approval functions remain authoritative. The Approval Center UI may surface a clear link/count for Scene Planning review work, but generic RPCs must never mutate Scene Planning approval state.

## 5. Target model

### 5.1 `CONTENT_ARTIFACT`

Authoritative source: `content_script_artifacts`.

Eligibility at submission:

- same organization as authenticated membership;
- artifact exists;
- artifact status is `GENERATED`;
- script text is non-empty;
- revision is valid and current;
- parent content item organization matches;
- no browser-supplied script text or revision metadata is trusted.

Exact identity:

- `target_id = content_script_artifacts.id`
- `target_revision = content_script_artifacts.revision`
- deterministic target fingerprint derived server-side from target type, target ID and revision.

Submission snapshot includes, at minimum:

- artifact ID;
- content item ID;
- language;
- canonical/source flag;
- artifact status;
- exact revision;
- source revision where applicable;
- exact script text reviewed;
- safe provider/model metadata where already persisted;
- parent content topic/title context required by the UI.

Knowledge provenance is read from the existing immutable `content_item_knowledge_sources` lineage for the bound content item and displayed alongside the snapshot. Phase 9 does not duplicate or rewrite provenance rows.

### 5.2 `MEDIA_ASSET`

Authoritative source: `media_assets`.

Eligibility at submission:

- same organization;
- asset exists;
- asset status is `ACTIVE`;
- stable checksum exists;
- referenced private object/identity uses existing Media Library rules;
- no browser-supplied storage path, checksum or asset metadata is trusted.

Exact identity:

- `target_id = media_assets.id`
- `target_checksum = media_assets.checksum`
- deterministic target fingerprint derived server-side from target type, target ID and checksum.

Submission snapshot includes, at minimum:

- media asset ID;
- asset type;
- source;
- MIME type;
- width/height/duration where present;
- checksum;
- safe storage bucket/path identity needed by the authorized preview service;
- relevant non-secret lineage metadata already persisted by Media Library/final assembly.

The snapshot is metadata authority for the review record; preview access itself remains short-lived and authorization-checked against current organization membership.

## 6. Data model

### 6.1 `approval_requests`

Purpose: current workflow envelope bound to one exact target fingerprint.

Required logical fields:

- `id uuid PK`
- `organization_id uuid NOT NULL FK organizations`
- `target_type text NOT NULL CHECK CONTENT_ARTIFACT|MEDIA_ASSET`
- `target_id uuid NOT NULL`
- `target_revision integer NULL`
- `target_checksum text NULL`
- `target_fingerprint text NOT NULL`
- `target_snapshot jsonb NOT NULL`
- `publication_intent jsonb NOT NULL DEFAULT '{}'`
- `status text NOT NULL CHECK PENDING|CHANGES_REQUESTED|APPROVED|REJECTED|SUPERSEDED`
- `requested_by uuid NULL FK auth.users ON DELETE SET NULL`
- `requested_at timestamptz NOT NULL`
- `decided_by uuid NULL FK auth.users ON DELETE SET NULL`
- `decided_at timestamptz NULL`
- `superseded_at timestamptz NULL`
- `superseded_reason text NULL`
- `created_at timestamptz NOT NULL`
- `updated_at timestamptz NOT NULL`

Constraints/invariants:

- content targets require `target_revision` and no `target_checksum`;
- media targets require `target_checksum` and no `target_revision`;
- one authoritative request per `(organization_id, target_type, target_fingerprint)`;
- target-identifying columns, target fingerprint and target snapshot are immutable after insert;
- APPROVED/CHANGES_REQUESTED/REJECTED require decision actor/time;
- SUPERSEDED requires superseded time/reason;
- PENDING has no decision actor/time;
- browser clients cannot directly INSERT/UPDATE/DELETE request rows.

### 6.2 `approval_events`

Purpose: immutable audit history.

Required logical fields:

- `id uuid PK`
- `organization_id uuid NOT NULL FK organizations`
- `approval_request_id uuid NOT NULL FK approval_requests`
- `actor_kind text NOT NULL CHECK USER|SYSTEM`
- `actor_user_id uuid NULL FK auth.users ON DELETE SET NULL`
- `event_type text NOT NULL CHECK SUBMITTED|APPROVED|CHANGES_REQUESTED|REJECTED|SUPERSEDED`
- `comment text NULL`
- `target_revision integer NULL`
- `target_checksum text NULL`
- `created_at timestamptz NOT NULL`

Rules:

- USER events require an actor user.
- SYSTEM events may have no user actor.
- `CHANGES_REQUESTED` and `REJECTED` require a non-empty bounded comment.
- event target version/checksum must match the parent request.
- authenticated clients receive no direct INSERT/UPDATE/DELETE privileges.
- UPDATE/DELETE is also blocked by immutable database guards so privileged accidental mutation cannot silently rewrite history.

## 7. Workflow state machine

### 7.1 Submission

Authorized submitters: `OWNER`, `ADMIN`, `EDITOR`.

The authenticated submission boundary:

1. validates session and organization membership;
2. validates submit role;
3. resolves the target from authoritative DB state;
4. verifies same-organization lineage;
5. verifies target eligibility;
6. constructs exact snapshot and fingerprint server-side;
7. returns the existing request when the same exact fingerprint was already submitted, rather than creating conflicting duplicate requests;
8. otherwise creates a `PENDING` request and immutable `SUBMITTED` event atomically.

No approval snapshot, revision, checksum, script text, storage path or current status is trusted from browser JSON.

### 7.2 Decisions

Authorized decision roles: `OWNER`, `ADMIN`, `REVIEWER`.

Only `PENDING` requests are decisionable.

Before every decision, the server/RPC locks the request and revalidates the target against authoritative current state.

If the target is no longer current/eligible, the function atomically transitions the request to `SUPERSEDED`, records a SYSTEM `SUPERSEDED` event and returns a safe stale-target result/error. It must never approve a stale target.

Valid explicit decision transitions:

- `PENDING -> APPROVED`
- `PENDING -> CHANGES_REQUESTED`
- `PENDING -> REJECTED`

Comment rules:

- Approve: comment optional.
- Request changes: comment required.
- Reject: comment required.

Every successful decision atomically updates the request envelope and appends exactly one immutable event.

### 7.3 After changes requested or rejected

A request remains a permanent audit record for the exact version reviewed.

The old request is not reopened and its target snapshot is not edited.

For content, substantive changes increment the artifact revision. The old request becomes `SUPERSEDED` if it is still approval-relevant, and the new revision is submitted as a new request/fingerprint.

For media, a replacement/re-render is represented by a new authoritative media identity/checksum. The rejected request remains immutable; the new eligible asset is submitted separately.

## 8. Supersession and currentness

### 8.1 Content artifact invalidation

A database-level guard/trigger observes substantive `content_script_artifacts` changes that advance revision or make the artifact no longer approval-eligible.

For prior `PENDING`, `CHANGES_REQUESTED` or `APPROVED` generic requests bound to the previous revision, it atomically:

- marks the request `SUPERSEDED` when not already terminal-superceded;
- records `superseded_at` and a normalized reason;
- appends one SYSTEM `SUPERSEDED` event.

A prior `REJECTED` request remains REJECTED as the historical decision; it is already non-approving and need not be rewritten merely because a later revision exists.

### 8.2 Media invalidation

If an approval-targeted media asset leaves `ACTIVE` state or its checksum identity changes through an authorized backend path, any `PENDING`, `CHANGES_REQUESTED` or `APPROVED` request bound to the old identity becomes `SUPERSEDED` with an immutable SYSTEM event.

Ordinary Phase 8 media rules already make direct checksum mutation highly constrained; Phase 9 must not weaken those rules.

### 8.3 Approval prerequisite

Phase 9 exposes a stable server-side predicate/read boundary equivalent to:

`is_target_currently_approved(organization, target type, target id, exact revision/checksum)`

It returns true only when:

- same-org target exists;
- target is currently eligible;
- exact version/checksum matches current authoritative state;
- corresponding request is `APPROVED` and not superseded.

Phase 10 Publishing must call/reuse this authoritative boundary when a channel/content policy requires approval. Browser-provided approval flags are never trusted.

## 9. Scene Planning integration

Scene Planning already owns:

- plan-level `REVIEW_REQUIRED` / `APPROVED` lifecycle;
- deterministic QC blockers/warnings;
- reviewer acknowledgement rules;
- plan approval role checks;
- approved immutability/copy-on-write behavior.

Phase 9 must not create `approval_requests` for `scene_plan_versions` and must not write generic approval events for Scene Planning decisions.

Approval Center integration is navigational/read-model integration only:

- show a clear Scene Planning review affordance/count when review-required plans exist;
- link directly to the existing Scene Planning review surface;
- identify Scene Planning as `Domain approval` so operators do not mistake it for a generic request;
- decisions remain executed exclusively by existing Scene Planning functions/actions.

This preserves one authority per workflow.

## 10. Authorization and RLS

### 10.1 Visibility

Approval Center generic requests/events are visible to same-org:

- OWNER
- ADMIN
- EDITOR
- REVIEWER

ANALYST does not receive the operational approval queue or private reviewer comments in Phase 9.

### 10.2 Mutation

- Submit request: OWNER/ADMIN/EDITOR through authenticated trusted boundary only.
- Decide request: OWNER/ADMIN/REVIEWER through authenticated trusted boundary only.
- Direct authenticated INSERT/UPDATE/DELETE on `approval_requests`: revoked.
- Direct authenticated INSERT/UPDATE/DELETE on `approval_events`: revoked.
- Anonymous access: none.
- Service-role access exists only for trusted backend/system supersession and maintenance paths.

### 10.3 Tenant integrity

Every request/event is organization-scoped.

Database guards verify:

- target organization equals request organization;
- event organization equals parent request organization;
- current user membership belongs to the same organization;
- cross-org target IDs fail before any snapshot or preview URL is returned.

RLS remains the final defense even when application/server checks exist.

## 11. Application/service boundaries

Phase 9 should introduce a focused Approval module rather than placing workflow logic in route components.

Logical units:

1. **Approval domain/types** — target/state/event contracts and normalized errors.
2. **Approval repository/read model** — queue/detail/history queries.
3. **Approval submission service** — validates role/input and invokes the authoritative submission RPC.
4. **Approval decision service** — validates decision/comment and invokes the authoritative decision RPC.
5. **Approval currentness service** — stable prerequisite used by future Publishing.
6. **Approval media preview adapter** — reuses Media Library's authorized private-preview boundary.
7. **Approval Center UI** — queue, filters, detail/review, event timeline, actions.

Route/server actions accept IDs, decision enum, bounded comment and non-authoritative publication-intent metadata only. They do not accept trusted target snapshots, revisions, checksums or storage paths.

## 12. UX design

### 12.1 Queue — `/approval-center`

Primary filters:

- Awaiting review → `PENDING`
- Changes requested → `CHANGES_REQUESTED`
- Approved → `APPROVED`
- Rejected → `REJECTED`

`SUPERSEDED` is available as a secondary/history filter, not one of the four normative primary tabs.

Each row/card shows:

- target type;
- content/media label;
- language or media type where relevant;
- exact revision/checksum short identity;
- request status;
- requester;
- requested time;
- decision time/actor where applicable.

Optional target-type filtering (`Content` / `Media`) may be included without changing workflow semantics.

A separate compact Scene Planning review affordance routes to the domain-specific review queue/surface and does not masquerade as a generic request.

### 12.2 Review detail — `/approval-center/[requestId]`

Content artifact detail shows:

- exact snapshotted script;
- revision/language/source-vs-translation state;
- source revision where relevant;
- parent content context;
- immutable Knowledge provenance;
- publication intent;
- event history.

Media detail shows:

- authorized preview when still available;
- exact checksum;
- media metadata;
- safe lineage context;
- publication intent;
- event history.

If the current target no longer matches the reviewed fingerprint, the screen clearly marks the request superseded/stale and disables decision actions.

### 12.3 Actions

Visible only when role and authoritative state permit:

- Approve
- Request changes
- Reject

Request changes/reject require a comment before submission. Buttons use explicit confirmation semantics and server-returned authoritative state after mutation.

## 13. Submission entry points

### Content Studio

Generated artifact UI gains `Submit for review` when:

- role is OWNER/ADMIN/EDITOR;
- artifact is GENERATED;
- exact artifact revision is eligible;
- no request already exists for the same fingerprint.

After submission, UI links to the Approval Center request.

### Media Library

Eligible ACTIVE checksum-bearing media detail gains `Submit for review` for OWNER/ADMIN/EDITOR.

Final assembled videos require no special approval entity; they are ordinary `MEDIA_ASSET` targets with final-video lineage visible in review context.

## 14. Error model

Use normalized safe domain errors such as:

- `APPROVAL_UNAUTHORIZED`
- `APPROVAL_TARGET_NOT_FOUND`
- `APPROVAL_TARGET_CROSS_ORG`
- `APPROVAL_TARGET_NOT_ELIGIBLE`
- `APPROVAL_REQUEST_NOT_FOUND`
- `APPROVAL_REQUEST_NOT_PENDING`
- `APPROVAL_COMMENT_REQUIRED`
- `APPROVAL_TARGET_SUPERSEDED`
- `APPROVAL_PREVIEW_UNAVAILABLE`
- `APPROVAL_INTERNAL`

Do not return SQL errors, stack traces, signed URLs in logs, raw storage authority or unrelated target metadata.

## 15. Observability and audit

Operational logs may contain:

- normalized event name;
- request ID;
- organization ID when appropriate for server operations;
- target type;
- normalized error code;
- decision enum;
- retryability if relevant.

Logs must not contain:

- script body;
- reviewer comment body unless an explicitly approved audit sink is introduced later;
- signed media URLs;
- provider secrets;
- raw storage credentials;
- auth tokens.

The database `approval_events` ledger, not application logs, is the authoritative business audit history.

## 16. Testing strategy

### Unit/domain tests

- role matrix;
- decision/comment validation;
- target fingerprint construction contract;
- state transition guards;
- supersession semantics;
- safe error normalization;
- exact snapshot/read-model mapping.

### SQL/schema tests

- required tables/constraints/indexes;
- one request per exact fingerprint;
- target field shape by target type;
- immutable request identity/snapshot columns;
- immutable event UPDATE/DELETE guards;
- direct authenticated mutation revoked;
- submit/decision RPC execute grants only as intended;
- cross-org guards;
- supersession trigger behavior;
- current-approval predicate behavior.

### Integration/service tests

- content submission reconstructs snapshot server-side;
- media submission reconstructs checksum/path metadata server-side;
- duplicate exact submission is idempotent;
- stale target cannot be approved;
- request-changes/reject require comments;
- approved exact revision returns currently-approved=true;
- newer content revision invalidates prior approval;
- archived/replaced media invalidates prior approval;
- ANALYST cannot access operational approval data;
- REVIEWER can decide but cannot submit/edit target content through Approval Center.

### UI/E2E

- queue four primary filters;
- exact content review with provenance;
- authorized media preview;
- role-aware action visibility;
- approve flow;
- request-changes flow with required comment;
- reject flow with required comment;
- superseded request disables actions;
- submission from Content Studio;
- submission from Media Library;
- Scene Planning integration routes to existing domain review rather than generic mutation;
- cross-org fixture cannot be surfaced.

## 17. Live verification and release gates

Phase 9 is not complete until all applicable gates pass:

1. exact-head typecheck;
2. lint;
3. unit/integration tests;
4. production build;
5. Playwright E2E;
6. Phase 9 migrations applied to the PAK Supabase project in order;
7. live table/RLS/grant inspection;
8. live authenticated role probes where safely possible;
9. cross-org negative verification when two tenant fixtures/accounts are available; otherwise document the live limitation and rely on deterministic DB/RLS tests without fabricating evidence;
10. immutable event mutation probes;
11. supersession/current-approval live probe using controlled fixture data;
12. Supabase security/performance advisors rerun;
13. fixture cleanup verified;
14. roadmap/traceability/backend/UX maturity synchronized;
15. PR review threads resolved;
16. exact green head merged with expected-head protection;
17. main re-read after merge.

No paid provider credential or render spend is required for Phase 9 acceptance.

## 18. Security review checklist

Before release, verify:

- no browser direct authoritative approval mutations;
- no cross-org target resolution;
- no ANALYST operational queue access;
- `approval_events` UPDATE/DELETE impossible through authenticated role and protected against privileged accidental mutation;
- snapshots cannot be browser-forged;
- content decision re-checks exact revision/current status;
- media decision re-checks exact checksum/current ACTIVE status;
- request/comment length bounds prevent unbounded payloads;
- JSON publication intent is size-bounded and treated as context, not authorization;
- signed preview URLs are short-lived and not persisted in approval snapshots/events;
- Scene Planning approval authority remains untouched.

## 19. Acceptance criteria

Phase 9 is complete when:

1. OWNER/ADMIN/EDITOR can submit an eligible same-org content artifact or media asset for review.
2. Submission stores an exact server-built snapshot/fingerprint and immutable SUBMITTED event.
3. OWNER/ADMIN/REVIEWER can approve, request changes or reject a PENDING request.
4. Request changes and reject require a comment.
5. Decisions create immutable events and cannot be rewritten/deleted by authenticated clients.
6. A changed content revision or invalidated media identity cannot retain a usable approval.
7. Future Publishing has a server-side exact-target approval prerequisite that fails closed on stale/unapproved state.
8. Queue/detail UX satisfies UX-APR-001..003.
9. Scene Planning remains the only authority for Scene Plan approval while Approval Center clearly links to that workflow.
10. Tenant isolation, role restrictions, live RLS/grant probes, CI/E2E and advisor review are green.
11. Controlled live fixtures leave no production residue after verification.
12. Lovable is not used or modified.

## 20. Deferred extensions

Future phases may add, with separate requirements/design:

- channel-specific approval policies;
- scheduled publication approval constraints;
- multi-approver/quorum policies;
- reviewer assignment;
- approval expiry;
- SLA/escalation;
- approval for additional target domains;
- separation-of-duties/self-approval restrictions;
- richer approval analytics.

They must not be speculatively implemented in Phase 9.