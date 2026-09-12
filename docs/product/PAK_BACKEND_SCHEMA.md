# PAK Marketing Automation — Backend Schema & Data Architecture

**Document ID:** PAK-DB-001  
**Version:** 1.2  
**Status:** Current baseline after Phase 9

## 1. Schema principles

- **DB-PRIN-001** Every tenant-owned root record is organization-scoped.
- **DB-PRIN-002** RLS is the final authorization boundary for browser/session clients.
- **DB-PRIN-003** Security-critical invariants use constraints/triggers/functions, not UI validation alone.
- **DB-PRIN-004** Immutable audit/provenance records never expose ordinary authenticated UPDATE/DELETE.
- **DB-PRIN-005** Privileged backend writes are narrowly scoped and occur only after user/session or trusted-worker authorization succeeds.
- **DB-PRIN-006** Shared applied migrations are corrected by forward migrations, never history rewriting.
- **DB-PRIN-007** Paid-provider execution input is reconstructed from approved persisted state rather than trusted from browser JSON.
- **DB-PRIN-008** Ephemeral provider result URLs are not durable PAK media identity.

## 2. Current implemented domain map

```text
organizations
└─ organization_memberships

knowledge_records
content_items
├─ content_script_artifacts
└─ content_item_knowledge_sources

integration_connections
├─ integration_secrets ──> Supabase Vault
└─ integration_audit_events

video_projects
├─ visual_bibles
└─ scene_plan_versions
   ├─ scene_plan_scenes
   │  └─ scene_plan_shots
   └─ scene_plan_qc_findings

jobs
└─ video_generation_attempts
   └─ media_assets (via generating_job_id/media_asset_id)

approval_requests
└─ approval_events

legacy/foundation compatibility:
video_scenes
```

The authoritative post-Phase 6 planning model is the normalized Scene Planning hierarchy above. `video_scenes` remains a legacy/foundation table and is not the current Scene Planning source of truth. Generic Phase 9 approval records do not replace Scene Planning's domain-specific approval lifecycle.

## 3. `organizations`

Purpose: tenant root.

Required/current logical fields:
- `id uuid PK`
- `name text`
- timestamps

## 4. `organization_memberships`

Purpose: user-to-organization authorization mapping.

Fields:
- `id uuid PK`
- `organization_id uuid FK organizations`
- `user_id uuid FK auth.users`
- `role text CHECK OWNER|ADMIN|EDITOR|REVIEWER|ANALYST`
- timestamps
- unique `(organization_id, user_id)`

RLS: users read permitted membership context; mutation is restricted by organization governance rules.

## 5. `jobs`

Purpose: durable asynchronous work authority.

Current logical fields:
- `id uuid PK`
- `organization_id uuid`
- `job_type text`
- `resource_type text`
- `resource_id uuid/text as defined by migration`
- `state`: QUEUED|PROCESSING|COMPLETED|FAILED|RETRYING|CANCELLED
- `input_payload jsonb`
- `result_payload jsonb`
- `idempotency_key text`
- `attempt_count integer`
- `max_attempts integer`
- `retry_policy jsonb`
- `failure_metadata jsonb`
- `lease_owner text nullable`
- `lease_expires_at timestamptz nullable`
- completion/update timestamps

Rules:
- provider/publish operations use deterministic idempotency semantics;
- browser roles cannot claim worker jobs;
- generic authenticated job policies exclude `VIDEO_SHOT_GENERATION` direct INSERT/UPDATE;
- video-generation job creation occurs only through the validated enqueue RPC.

## 6. `content_items`

Purpose: parent workflow for generated/manual content.

Fields include:
- `id`
- `organization_id`
- `topic`
- optional generation-time context/metadata
- canonical requested `language`
- workflow status
- generated-script compatibility field
- provider/provider_model where applicable
- normalized failure metadata
- `created_by`
- timestamps

RLS:
- same-org read;
- OWNER/ADMIN/EDITOR create/update according to content workflow;
- destructive policy follows product permissions.

## 7. `content_script_artifacts`

Purpose: one current script artifact per language for a content item.

Fields:
- `id`
- `organization_id`
- `content_item_id`
- `language`: EN|PL|HI
- `is_source boolean`
- `status`: PENDING|GENERATING|GENERATED|STALE|FAILED
- `script_text`
- `revision >= 1`
- `source_revision nullable`
- provider/model/failure metadata
- `created_by`
- timestamps

Constraints:
- unique `(content_item_id, language)`;
- partial unique one-source invariant;
- GENERATED requires nonempty script;
- source artifact has `source_revision IS NULL`;
- non-source artifact uses canonical source revision;
- parent organization integrity is enforced.

## 8. `knowledge_records`

Purpose: approved institutional grounding records.

Fields:
- `id`
- `organization_id`
- `title`
- `content`
- `status`: DRAFT|ACTIVE|ARCHIVED
- `source_type`: MANUAL|DOCUMENT|URL
- `source_label`
- `source_reference`
- `revision >= 1`
- `created_by`, `updated_by`
- `created_at`, `updated_at`

Rules:
- organization immutable after insertion;
- creation audit fields immutable for business mutations;
- update actor/time system-controlled;
- each business update increments revision exactly once;
- FK-only auth-user nullification does not fabricate a business revision.

RLS matrix:
- SELECT ACTIVE: all same-org roles;
- SELECT DRAFT/ARCHIVED: OWNER/ADMIN/EDITOR;
- INSERT/UPDATE: OWNER/ADMIN/EDITOR;
- DELETE: OWNER/ADMIN.

## 9. `content_item_knowledge_sources`

Purpose: immutable generation-time Knowledge provenance snapshot.

Fields:
- `id`
- `organization_id`
- `content_item_id`
- `knowledge_record_id nullable ON DELETE SET NULL`
- `knowledge_revision`
- title/content/source metadata snapshots
- `created_at`

Rules:
- snapshot organization equals content organization;
- referenced Knowledge organization must match;
- same-org authenticated SELECT only;
- no authenticated INSERT/UPDATE/DELETE;
- creation is trusted backend persistence after authenticated source resolution.

## 10. Integration Vault domain

### `integration_connections`

Purpose: non-secret provider configuration and health metadata.

Current fields/logical shape:
- `id uuid PK`
- `organization_id uuid NOT NULL`
- `provider text`: OPENAI|META|LTX
- `display_name text`
- `status`: NOT_CONFIGURED|CONFIGURED|INVALID|DISABLED
- `config jsonb` — non-secret identifiers/settings only
- `secret_version integer`
- `masked_hint text nullable`
- `last_verified_at timestamptz nullable`
- `last_error_code text nullable`
- `created_by`, `updated_by`
- timestamps
- unique `(organization_id, provider)` in current single-connection baseline

### `integration_secrets`

Purpose: secret metadata/reference row; raw secret value is stored in Supabase Vault.

Current logical fields:
- `id uuid PK`
- `organization_id`
- `connection_id FK integration_connections`
- `secret_name`
- legacy `ciphertext` compatibility field, nullable in Vault-backed mode
- `encryption_version`
- `vault_secret_id uuid`
- `created_by`
- `created_at`
- `rotated_at`
- unique `(connection_id, secret_name)`

Security:
- no ordinary browser read of plaintext or Vault decrypted value;
- current storage mode uses `vault_secret_id` → `vault.secrets` / privileged `vault.decrypted_secrets` access;
- save/read/remove functions are privilege-restricted;
- plaintext never enters client read models.

### `integration_audit_events`

Purpose: immutable record of credential/config changes and connection tests.

Fields:
- `id`
- `organization_id`
- `connection_id`
- `actor_user_id`
- event type such as CREATED, UPDATED, SECRET_REPLACED, SECRET_REMOVED, TEST_SUCCEEDED, TEST_FAILED, DISABLED, ENABLED
- non-secret `metadata jsonb`
- `created_at`

Rules:
- authorized same-org read as permitted;
- privileged insert;
- no authenticated update/delete.

## 11. Scene Planning domain

### `video_projects`

Purpose: source-bound video planning root.

Current fields include:
- `id uuid PK`
- `organization_id`
- `source_content_id`
- `source_artifact_id`
- `source_artifact_revision`
- `source_integrity_hash`
- `language`
- `title`, `purpose`
- `target_platform text[]`
- `aspect_ratio`
- `target_duration_seconds`
- `quality_profile`
- `audience jsonb`
- `production_constraints jsonb`
- `status`: DRAFT|ACTIVE|ARCHIVED
- `created_by`
- timestamps

Rules:
- source artifact and project organization must match;
- project read/mutation follows organization role policies.

### `visual_bibles`

Purpose: versioned creative/continuity language for a Video Project.

Fields include:
- `id`
- `organization_id`
- `video_project_id`
- `version_number`
- `is_active`
- characters/wardrobe/locations/props JSON
- palette
- lighting/cinematography/realism/logo/typography language
- cultural and forbidden/global-negative constraints
- `created_by`
- timestamps

Constraints:
- unique `(video_project_id, version_number)`;
- one active Visual Bible per project.

### `scene_plan_versions`

Purpose: immutable/versioned Scene Plan header and snapshots.

Fields include:
- `id`
- `organization_id`
- `video_project_id`
- `version_number`
- `source_integrity_hash`
- `parent_version_id nullable`
- `status`: DRAFT|PLANNING|QC_REQUIRED|REVIEW_REQUIRED|APPROVED|FAILED|STALE|SUPERSEDED
- planner provider/model metadata
- `creative_brief_snapshot jsonb`
- `visual_bible_snapshot jsonb`
- `canonical_narration`
- `language`
- `aspect_ratio`
- `total_duration_seconds`
- `narration_coverage_hash`
- `qc_summary jsonb`
- `created_by`, `approved_by`, `approved_at`
- timestamps

Rules:
- unique `(video_project_id, version_number)`;
- approval requires approver/time;
- approved versions are immutable except explicitly allowed lifecycle transitions;
- plan organization must match project organization.

### `scene_plan_scenes`

Purpose: ordered narrative units within one Scene Plan version.

Fields include:
- `id`
- `organization_id`
- `scene_plan_version_id`
- `ordinal`
- `title`
- `narrative_role`: HOOK|SETUP|EXPLANATION|PROOF|TRANSITION|CTA|OTHER
- narration text and source char span
- narrative/emotional objectives
- `duration_seconds`
- `continuity_context jsonb`
- `creative_direction`
- timestamps

Constraints:
- unique `(scene_plan_version_id, ordinal)`;
- valid narration span shape;
- parent org integrity.

### `scene_plan_shots`

Purpose: provider-generation unit beneath a Scene.

Fields include:
- `id`
- `organization_id`
- `scene_id`
- `ordinal`
- `duration_seconds`
- narration text + exact char span
- `creative_direction`
- `master_visual_prompt`
- negative constraints and subject/location refs
- composition, shot size, camera angle, lens/camera/subject/environment motion
- depth-of-field, lighting, mood, transitions, ambience/SFX/music intent
- `aspect_ratio`
- `continuity_state jsonb`
- `generation_requirements jsonb`
- `human_modified boolean`
- timestamps

Constraints:
- unique `(scene_id, ordinal)`;
- positive duration;
- valid narration span shape;
- approved-plan child immutability.

### `scene_plan_qc_findings`

Purpose: deterministic blocker/warning/info results for a Scene Plan version.

Fields:
- `id`
- `organization_id`
- `scene_plan_version_id`
- optional `scene_id`, `shot_id`
- `severity`: BLOCKER|WARNING|INFO
- `code`, `message`
- optional acknowledgement actor/time
- `created_at`

Rules:
- same-org read;
- mutation constrained by plan lifecycle and reviewer/editor roles;
- approved plan children are immutable.

## 12. Video provider execution domain

### `video_generation_attempts`

Purpose: durable provider execution lineage for one video-generation job attempt.

Fields:
- `id uuid PK`
- `organization_id`
- `job_id`
- `plan_version_id`
- `scene_id` → `scene_plan_scenes`
- `shot_id` → `scene_plan_shots`
- optional `media_asset_id`
- `attempt_number` constrained to 1..4
- `provider`
- `provider_model`
- optional `provider_job_id`
- `state`: QUEUED|SUBMITTING|SUBMITTED|PROCESSING|IMPORT_PENDING|COMPLETED|FAILED|CANCELLED|SUBMISSION_UNKNOWN
- requested/effective duration
- resolution/fps
- `generate_audio boolean`
- `prompt_hash`
- normalized error code/message/retryable
- submitted/polled/terminal/imported timestamps
- `created_by`
- timestamps

Rules:
- immutable tenant/job/plan/scene/shot lineage after creation;
- INSERT requires approved plan parentage;
- browser roles have SELECT-only visibility through organization membership;
- authenticated browser cannot directly INSERT/UPDATE attempts;
- unique `(job_id, attempt_number)`;
- provider job ID uniqueness when present.

### Enqueue boundary

`enqueue_video_shot_generation(...)` is the only authenticated creation path for paid shot generation.

It verifies:
- authenticated OWNER/ADMIN/EDITOR role;
- supported profile;
- plan exists and is APPROVED;
- source artifact is still GENERATED and integrity hash is current;
- no BLOCKER QC finding;
- shot belongs to the approved plan and organization;
- aspect ratio/duration are supported;
- idempotency key reuse returns the latest attempt rather than creating duplicate spend.

The function constructs trusted job `input_payload` from persisted shot data and creates both the job and first attempt atomically.

### Retry / reconciliation

`schedule_video_generation_retry(...)`:
- service-role only;
- accepts only FAILED + retryable attempt;
- maximum four attempts;
- creates a new QUEUED attempt rather than mutating failed lineage;
- resets job to RETRYING.

`claim_due_video_generation_dispatch(...)`:
- service-role only;
- bounded batch;
- `FOR UPDATE ... SKIP LOCKED` job leasing;
- claims SUBMIT, RECONCILE or RETRY work;
- retry eligibility follows 5/15/45-second delays.

## 13. `media_assets`

Purpose: normalized provider-agnostic media library foundation.

Current fields:
- `id uuid PK`
- `organization_id`
- `asset_type`: IMAGE|VIDEO|AUDIO|DOCUMENT
- `storage_path`
- `source`: UPLOAD|GENERATED|IMPORT
- `mime_type`
- optional width/height/duration
- `checksum`
- optional `generating_job_id`
- optional legacy `scene_id`
- `status`: ACTIVE|ARCHIVED|FAILED
- timestamps
- unique `(organization_id, storage_path)`

Important current architecture rule:
- `media_assets.scene_id` belongs to the earlier `video_scenes` foundation and is not used as a forced FK to `scene_plan_scenes`;
- Phase 7 generated-video lineage is preserved through `generating_job_id`, `video_generation_attempts.plan_version_id/scene_id/shot_id`, and job result metadata.

### Generated-media storage

Private bucket: `generated-media`

Generated object path pattern:

`<organization_id>/generated-video/<plan>-<shot>-<attempt>.mp4`

`complete_generated_video_import(...)` is service-role only and:
- validates same-org deterministic path;
- accepts only `IMPORT_PENDING` attempt;
- idempotently inserts/updates the `media_assets` row;
- links attempt to media;
- marks attempt/job COMPLETED only after durable PAK storage succeeds.

## 14. Legacy/foundation `video_scenes`

Purpose: early scene/media foundation retained for compatibility.

It is **not** the authoritative Phase 6+ Scene Planning model. New planning, approval and shot-generation features must use `video_projects`, `visual_bibles`, `scene_plan_versions`, `scene_plan_scenes` and `scene_plan_shots`.

No new feature should extend `video_scenes` without an explicit migration/compatibility reason.

## 15. Internal dispatch/Vault infrastructure

Current Phase 7 infrastructure includes:
- Vault secret `pak/video-generation/dispatcher` for internal worker authentication;
- Vault `project_url` for environment-specific scheduled Edge invocation;
- `pg_cron` job `pak-video-generation-dispatch` on a 10-second cadence where installed;
- `pg_net` POST to `video-generation-dispatcher`;
- Edge workers `video-generation`, `video-generation-retry`, `video-generation-dispatcher`;
- user-path authorization plus internal dispatcher-token authorization as appropriate.

These are infrastructure capabilities, not browser-managed organization integrations.

## 16. `approval_requests`

Purpose: mutable workflow envelope for one exact generic review target identity while preserving immutable target context.

Current fields/logical shape:
- `id uuid PK`
- `organization_id uuid NOT NULL FK organizations`
- `target_type`: CONTENT_ARTIFACT|MEDIA_ASSET
- `target_id uuid NOT NULL`
- `target_revision integer nullable` — required only for CONTENT_ARTIFACT
- `target_checksum text nullable` — required only for MEDIA_ASSET
- `target_fingerprint text NOT NULL`
- `target_snapshot jsonb NOT NULL`
- `publication_intent jsonb NOT NULL default {}`
- `status`: PENDING|CHANGES_REQUESTED|APPROVED|REJECTED|SUPERSEDED
- `requested_by`, `requested_at`
- `decided_by`, `decided_at`
- `superseded_at`, `superseded_reason`
- timestamps
- unique `(organization_id, target_type, target_fingerprint)`

Security/integrity rules:
- CONTENT_ARTIFACT identity uses exact authoritative artifact revision and no checksum;
- MEDIA_ASSET identity uses exact authoritative checksum and no revision;
- target identifying fields, fingerprint, snapshot, publication intent and request identity fields are immutable after insertion;
- publication intent must be an object and is bounded to 8 KiB; it is review context, never authorization;
- direct authenticated INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER privileges are revoked; authenticated users receive SELECT only subject to RLS;
- same-org SELECT is restricted to OWNER/ADMIN/EDITOR/REVIEWER; ANALYST has no operational Approval Center queue;
- anon has no approval-table access.

Authenticated workflow boundaries:
- `submit_approval_request(...)` accepts organization ID, target type, target ID and bounded publication intent only, then reconstructs revision/checksum/snapshot/fingerprint server-side. OWNER/ADMIN/EDITOR may submit. Exact duplicate submissions are idempotent.
- `decide_approval_request(...)` locks/revalidates one PENDING request before APPROVE/REQUEST_CHANGES/REJECT. OWNER/ADMIN/REVIEWER may decide. Request-changes/reject require nonempty bounded comments.
- `is_target_currently_approved(...)` returns true only when the current same-org authoritative target remains eligible and the exact current revision/checksum has a non-superseded APPROVED request.
- user-callable RPCs are SECURITY DEFINER with pinned `search_path = public`, authenticated-only EXECUTE grants, and internal auth/org/role rechecks; pgcrypto hashing is schema-qualified as `extensions.digest(...)` rather than broadening search_path.

Supersession:
- content artifact revision/status/script changes supersede PENDING/CHANGES_REQUESTED/APPROVED requests for the old exact identity;
- media status/checksum changes supersede PENDING/CHANGES_REQUESTED/APPROVED requests for the old exact identity;
- stale decision revalidation may supersede the request atomically;
- REJECTED history remains rejected rather than being rewritten as superseded.

## 17. `approval_events`

Purpose: immutable audit ledger for generic approval workflow events.

Fields:
- `id uuid PK`
- `organization_id uuid NOT NULL FK organizations`
- `approval_request_id uuid NOT NULL FK approval_requests`
- `actor_kind`: USER|SYSTEM
- `actor_user_id nullable`
- `event_type`: SUBMITTED|APPROVED|CHANGES_REQUESTED|REJECTED|SUPERSEDED
- `comment nullable` bounded to 2000 characters
- `target_revision nullable`
- `target_checksum nullable`
- `created_at`

Rules:
- USER events require an actor user; SYSTEM events may have no user;
- CHANGES_REQUESTED and REJECTED require a nonempty comment;
- event target revision/checksum must match the parent request identity;
- browser/session clients have same review-role SELECT visibility as requests and no direct INSERT/UPDATE/DELETE;
- database trigger `approval_events_immutable` rejects UPDATE/DELETE even for accidental privileged mutation paths;
- parent/org/target identity is enforced at insertion;
- history index covers `(approval_request_id, created_at, id)` and `approval_events_organization_id_idx` covers the organization FK/tenant history scans.

Scene Planning relationship:
- no Scene Plan request/event rows are created in this generic ledger;
- `scene_plan_versions` review/approval remains the sole domain authority for Scene Planning;
- Approval Center exposes only navigational/read integration to that existing lifecycle.

## 18. Planned publishing entities

### `publication_targets`
- organization
- provider/channel
- integration connection
- external account/page/channel ID
- display label/status/metadata
- no raw provider secret fields

### `publication_attempts`
- organization
- content/artifact/revision
- target
- job_id
- idempotency key
- requested schedule/timezone
- status
- safe external publication identifier/URL
- normalized provider error
- timestamps

Phase: 10.

## 19. Planned analytics entities

### `metric_sync_runs`
Tracks channel/account sync windows, job/provider state, watermark and failure state.

### `content_metrics_daily`
Normalized daily grain:
- organization
- publication target/attempt/external post
- metric date
- nullable provider-supported metrics
- provider/source timestamp
- ingested_at

Phase: 12.

## 20. Planned specialized domain entities

Future phases may add:
- AI representative profile/generation records — Phase 13;
- podcast episode/audio workflow records — Phase 14;
- campus/location records — Phase 15;
- testimonial/consent/restricted-data records — Phase 16.

These entities must not be added speculatively before their PRD/workflow slice is designed.

## 21. Migration ownership summary

Implemented high-level migration groups:
- foundation: organizations, memberships, jobs, media, legacy scenes, content/artifacts;
- Knowledge integrity/provenance;
- Integration Vault + transactional audit + Supabase Vault migration;
- Scene Planning migrations `202609110001`–`202609110007`;
- Phase 7 video generation migrations `202609110008`–`202609110012`;
- Phase 8 Media Library/final-assembly migrations `202609120001`–`202609120008`;
- Phase 9 Approval Center migrations `202609120009`–`202609120014`, including table ACL hardening, pgcrypto schema qualification and approval-event organization indexing.

The repository migration chain and live Supabase migration history are the authoritative executable schema. This document describes the intended logical model and must be updated whenever a merged migration materially changes that model.