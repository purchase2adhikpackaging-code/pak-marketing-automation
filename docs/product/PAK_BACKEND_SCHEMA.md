# PAK Marketing Automation — Backend Schema & Data Architecture

**Document ID:** PAK-DB-001  
**Version:** 1.2  
**Status:** Current baseline through Organization Profile / Brand Kit / Knowledge ingestion foundation

## 1. Schema principles

- **DB-PRIN-001** Every tenant-owned root record is organization-scoped.
- **DB-PRIN-002** RLS is the final row-authorization boundary for browser/session clients.
- **DB-PRIN-003** Security-critical invariants use constraints/triggers/functions, not UI validation alone.
- **DB-PRIN-004** Immutable audit/provenance records never expose ordinary authenticated UPDATE/DELETE.
- **DB-PRIN-005** Privileged backend writes are narrowly scoped and occur only after user/session or trusted-worker authorization succeeds.
- **DB-PRIN-006** Shared applied migrations are corrected by forward migrations, never history rewriting.
- **DB-PRIN-007** Paid-provider execution input is reconstructed from approved persisted state rather than trusted from browser JSON.
- **DB-PRIN-008** Ephemeral provider/signed URLs are transport data, not durable PAK media or Brand identity.
- **DB-PRIN-009** Exposed tables use explicit least-privilege table ACLs in addition to RLS; inherited broad `anon`/`authenticated` grants are revoked when not required.
- **DB-PRIN-010** Organization generation provenance records the exact Profile revision, Brand Kit revision and Knowledge snapshots used for a successful generation.
- **DB-PRIN-011** Document/URL ingestion produces DRAFT Knowledge only; activation is a separate human action.

## 2. Current implemented domain map

```text
organizations
├─ organization_memberships
├─ organization_profiles
└─ organization_brand_kits
   └─ brand_kit_media_assets ──> media_assets

knowledge_documents ──> media_assets (FILE sources only)
└─ knowledge_records

content_items
├─ content_script_artifacts
├─ content_item_identity_provenance
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
├─ video_generation_attempts
│  └─ media_assets
└─ final video assembly domain / media output

legacy/foundation compatibility:
video_scenes
```

The authoritative generation identity model is Organization Profile + Brand Kit + ACTIVE Core Knowledge + selected ACTIVE Knowledge. The authoritative post-Phase 6 planning model is the normalized Scene Planning hierarchy; `video_scenes` remains compatibility state.

## 3. `organizations`

Purpose: tenant root.

Required/current logical fields:
- `id uuid PK`
- `name text`
- `slug text`
- timestamps

Identity bootstrap behavior:
- inserting a new organization initializes exactly one `organization_profiles` row and one `organization_brand_kits` row;
- existing organizations were backfilled by the identity foundation migration;
- bootstrap rows begin at revision 1 and are system-owned until a human edit.

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

## 5. `organization_profiles`

Purpose: one authoritative, revisioned institutional profile per organization.

Fields:
- `organization_id uuid PK/FK organizations`
- `official_name`
- optional `short_name`, `about`, `address`
- optional `primary_email`, `primary_phone`, `website`
- `social_links jsonb`
- `default_language`
- `timezone`
- `legal_identifiers jsonb`
- `revision >= 1`
- `created_by`, `updated_by`
- `created_at`, `updated_at`

Rules:
- one row per organization;
- organization and creation audit fields are immutable;
- each business update increments revision exactly once;
- trigger controls update actor/time;
- authenticated members may SELECT;
- table ACL permits authenticated SELECT/UPDATE only;
- RLS permits UPDATE only to OWNER/ADMIN;
- no `anon` table privileges.

## 6. `organization_brand_kits`

Purpose: one authoritative, revisioned institutional Brand Kit per organization.

Fields:
- `organization_id uuid PK/FK organizations`
- optional `primary_color`, `secondary_color`, `accent_color`
- optional `typography_rules`
- optional `brand_voice`
- optional `logo_usage_rules`
- optional `visual_constraints`
- `revision >= 1`
- audit/timestamps

Rules:
- one row per organization;
- same revision/audit invariants as Profile;
- authenticated members may SELECT;
- authenticated table ACL permits SELECT/UPDATE only; RLS limits UPDATE to OWNER/ADMIN;
- Brand Kit does **not** store signed URLs or raw storage object paths.

### `brand_kit_media_assets`

Purpose: semantic links from Brand Kit to official/approved Media Library images.

Fields:
- `id uuid PK`
- `organization_id uuid FK organization_brand_kits`
- `role`: `PRIMARY_LOGO|LIGHT_LOGO|DARK_LOGO|BRAND_MARK|FAVICON|APPROVED_IMAGERY`
- `media_asset_id uuid FK media_assets`
- `sort_order`
- `created_by`, `created_at`

Constraints/rules:
- same-org referenced media is mandatory;
- referenced media must be `ACTIVE`, `asset_type='IMAGE'` and image MIME;
- singleton roles are unique per organization except `APPROVED_IMAGERY`;
- active media assigned to the Brand Kit cannot be silently archived;
- authenticated table ACL permits SELECT/INSERT/UPDATE/DELETE, but RLS limits mutation to OWNER/ADMIN;
- insert audit actor uses initplan-safe `(select auth.uid())`.

## 7. `jobs`

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
- generic authenticated job policies exclude paid generation direct INSERT/UPDATE;
- provider generation job creation occurs only through validated enqueue boundaries.

## 8. `content_items`

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

## 9. `content_script_artifacts`

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

## 10. `knowledge_documents`

Purpose: immutable source identity and extraction lifecycle for uploaded/URL Knowledge sources.

Fields:
- `id uuid PK`
- `organization_id uuid FK organizations`
- `source_type`: FILE|URL
- `format`: PDF|DOCX|PPTX|TXT|URL
- `media_asset_id uuid nullable FK media_assets`
- `source_url text nullable`
- `source_label`
- `source_fingerprint`
- `extraction_status`: PENDING|PROCESSING|EXTRACTED|FAILED
- `extracted_text`
- `extraction_metadata jsonb`
- `error_summary`
- `revision >= 1`
- `created_by`, `updated_by`
- timestamps

Source-shape rules:
- FILE requires a media asset, no URL, and non-URL format;
- URL requires canonical URL, no media asset, and format URL;
- FILE asset must be same-org ACTIVE DOCUMENT media;
- source identity (`organization_id`, source type/format, media ID/URL) is immutable after creation;
- document revision increments exactly once on business update;
- authenticated ACL is SELECT/INSERT/UPDATE only;
- RLS permits OWNER/ADMIN/EDITOR management; reviewer/analyst do not manage extraction rows;
- insert policy requires revision 1, PENDING state and actor audit IDs matching initplan-safe `(select auth.uid())`.

## 11. `knowledge_records`

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
- `is_core boolean not null default false`
- `knowledge_document_id uuid nullable FK knowledge_documents`
- `knowledge_document_revision integer nullable`
- `created_by`, `updated_by`
- `created_at`, `updated_at`

Rules:
- organization immutable after insertion;
- creation audit fields immutable for business mutations;
- update actor/time system-controlled;
- each business update increments revision exactly once;
- FK-only auth-user nullification does not fabricate a business revision;
- document-linked Knowledge must remain DRAFT at ingestion-finalization time and source type must match document source;
- ACTIVE `is_core=true` is automatic grounding authority;
- only OWNER/ADMIN may insert a Core record or change `is_core`; the `core_knowledge_insert_guard` forward migration closes direct Data API insert bypass;
- ingestion finalization never activates Knowledge.

RLS matrix:
- SELECT ACTIVE: all same-org roles;
- SELECT DRAFT/ARCHIVED: OWNER/ADMIN/EDITOR;
- INSERT/UPDATE normal Knowledge: OWNER/ADMIN/EDITOR;
- Core INSERT/toggle: OWNER/ADMIN via database trigger guard;
- DELETE: OWNER/ADMIN.

## 12. `content_item_knowledge_sources`

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
- authenticated table ACL is SELECT only;
- same-org member RLS governs SELECT;
- no direct authenticated INSERT/UPDATE/DELETE;
- current generation path writes through `persist_content_generation_provenance(...)` atomically with identity provenance.

## 13. `content_item_identity_provenance`

Purpose: immutable generation-time Organization Profile and Brand Kit revision identity.

Fields:
- `content_item_id uuid PK/FK content_items`
- `organization_id uuid`
- `profile_revision integer >= 1`
- `brand_kit_revision integer >= 1`
- `created_at`

Rules:
- organization must equal parent content item organization;
- revisions must match the authoritative rows supplied to the persistence RPC at write time;
- update is blocked by immutable guard;
- authenticated table ACL is SELECT only and same-org member RLS governs visibility;
- `anon` has no table privileges.

### Atomic generation provenance RPC

`persist_content_generation_provenance(...)`:
- authenticated SECURITY DEFINER RPC with `public`/`anon` execution revoked;
- requires OWNER/ADMIN/EDITOR membership;
- content item must be GENERATED, same-org and created by the caller;
- Profile/Brand Kit revisions must equal current authoritative rows;
- each Knowledge snapshot must match an ACTIVE same-org record at the exact revision/title/content/source metadata supplied;
- writes identity provenance and `content_item_knowledge_sources` in one PostgreSQL transaction;
- any mismatch fails the whole operation.

## 14. Identity / ingestion mutation RPCs

### `save_organization_brand_kit(...)`

Authenticated guarded mutation for Brand Kit + asset relationships.
- OWNER/ADMIN only;
- compare-and-set expected revision;
- validates same-org ACTIVE IMAGE Media assets;
- updates Brand Kit and semantic asset links atomically.

### `finalize_knowledge_document_ingestion(...)`

Authenticated guarded ingestion finalizer.
- OWNER/ADMIN/EDITOR only;
- checks source document, organization and expected revision;
- persists extraction result/source fingerprint/metadata;
- creates linked Knowledge as `DRAFT` only;
- no automatic activation.

## 15. Integration Vault domain

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
- current storage mode uses `vault_secret_id` → Vault privileged access;
- save/read/remove functions are privilege-restricted;
- plaintext never enters client read models.

### `integration_audit_events`

Purpose: immutable record of credential/config changes and connection tests.

Fields:
- `id`
- `organization_id`
- `connection_id`
- `actor_user_id`
- event type
- non-secret `metadata jsonb`
- `created_at`

Rules:
- authorized same-org read as permitted;
- privileged insert;
- no authenticated update/delete.

## 16. Scene Planning domain

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

Purpose: versioned project creative/continuity language for a Video Project.

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

Brand interaction:
- Brand Kit is resolved separately as institutional authority/defaults;
- Visual Bible remains project-specific creative direction;
- official primary logo asset ID cannot be silently replaced by Visual Bible styling.

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
- `creative_brief_snapshot jsonb` — includes Brand Kit revision and institutional brand snapshot for current workflow
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

### `scene_plan_scenes`, `scene_plan_shots`, `scene_plan_qc_findings`

These retain the normalized ordered narration, creative direction, shot-generation requirements and deterministic QC model documented in the Scene Planning architecture. Parent organization integrity and approved-plan immutability remain database-enforced.

## 17. Video provider execution domain

### `video_generation_attempts`

Purpose: durable provider execution lineage for one video-generation job attempt.

Fields include:
- organization/job/plan/scene/shot lineage;
- optional imported `media_asset_id`;
- attempt number constrained to 1..4;
- provider/model/job ID;
- state: QUEUED|SUBMITTING|SUBMITTED|PROCESSING|IMPORT_PENDING|COMPLETED|FAILED|CANCELLED|SUBMISSION_UNKNOWN;
- requested/effective duration, resolution/fps, audio flag, prompt hash;
- normalized retry/error metadata and timestamps.

Rules:
- immutable tenant/job/plan/scene/shot lineage after creation;
- authenticated browser cannot directly INSERT/UPDATE attempts;
- provider job ID uniqueness when present;
- validated enqueue constructs trusted payload from approved persisted state.

## 18. `media_assets`

Purpose: normalized provider-agnostic Media Library authority.

Current logical fields include:
- `id uuid PK`
- `organization_id`
- `asset_type`: IMAGE|VIDEO|AUDIO|DOCUMENT
- `storage_bucket`
- `storage_path`
- `display_name`
- `source`: UPLOAD|GENERATED|IMPORT
- `mime_type`
- optional width/height/duration/size
- checksum
- optional job/scene lineage
- `metadata jsonb`
- `status`: ACTIVE|ARCHIVED|FAILED
- actor/archive timestamps
- unique organization/path semantics.

Private storage:
- `generated-media` for generated outputs;
- `media-library` for operator-uploaded private assets/documents.

Business consumers:
- Brand Kit persists `media_asset_id` references only;
- Knowledge FILE ingestion persists `media_asset_id` source lineage only;
- signed URLs are generated as short-lived transport and are not durable identity.

## 19. Legacy/foundation `video_scenes`

Purpose: early scene/media foundation retained for compatibility.

It is **not** the authoritative Phase 6+ Scene Planning model. New planning, approval and shot-generation features use the normalized Scene Planning hierarchy.

## 20. Internal dispatch/Vault infrastructure

Current infrastructure includes Vault-backed provider/internal credentials, scheduled dispatcher execution and privileged Edge worker boundaries. These are infrastructure capabilities, not browser-managed organization identity or Knowledge sources.

## 21. Planned entities

Future governed slices may add or extend publishing, analytics, AI representative, podcast, campus/location and testimonial entities. They must not be added speculatively before their PRD/workflow slice is designed.

## 22. Live ACL/RLS hardening record

Live rollout on 13 September 2026 discovered that project default table ACLs granted broad operations to new public tables. Forward migration `20260913174704_organization_identity_provenance_acl_hardening.sql` established the intended contract:
- no `anon` table privileges on new identity/provenance tables;
- Profile/Brand Kit: authenticated SELECT + UPDATE only, with OWNER/ADMIN update RLS;
- Brand asset links: authenticated CRUD table privilege, OWNER/ADMIN mutation RLS;
- identity and Knowledge provenance: authenticated SELECT only.

Forward migration `20260913175126_core_knowledge_insert_guard.sql` prevents non-OWNER/ADMIN actors from inserting `is_core=true`, closing a direct Data API bypass not covered by the original update-only trigger.

Forward migration `20260913180118_organization_identity_rls_initplan_hardening.sql` preserves the same RBAC/audit semantics while replacing per-row `auth.uid()` comparisons in the two new insert policies with initplan-safe `(select auth.uid())`. Supabase advisor count for `auth_rls_initplan` decreased from 11 to 9; the two feature-specific findings disappeared.

## 23. Migration ownership summary

Implemented high-level migration groups include:
- foundation: organizations, memberships, jobs, media, legacy scenes, content/artifacts;
- Knowledge integrity/provenance;
- Integration Vault + transactional audit + Supabase Vault migration;
- Scene Planning and video-generation/final-assembly foundations;
- Organization Profile / Brand Kit / Core Knowledge foundation:
  - repository source `20260912180000_organization_profile_brand_knowledge.sql`
  - `20260912180030_organization_identity_save_rpcs.sql`
  - `20260912180100_knowledge_documents.sql`
  - `20260912180130_knowledge_ingestion_finalize.sql`
  - `20260912180200_generation_identity_provenance.sql`
- live-discovered forward hardening:
  - `20260913174704_organization_identity_provenance_acl_hardening.sql`
  - `20260913175126_core_knowledge_insert_guard.sql`
  - `20260913180118_organization_identity_rls_initplan_hardening.sql`.

Live Supabase migration history was inspected before rollout and only missing migrations were applied. The repository migration chain and live Supabase migration history are the authoritative executable schema. This document describes the intended logical model and must be updated whenever a merged migration materially changes that model.