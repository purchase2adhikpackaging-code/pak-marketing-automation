# PAK Marketing Automation — Backend Schema & Data Architecture

**Document ID:** PAK-DB-001  
**Version:** 1.0  
**Status:** Baseline for review

## 1. Schema principles

- **DB-PRIN-001** Every tenant-owned root record is organization-scoped.
- **DB-PRIN-002** RLS is the final authorization boundary for browser/session clients.
- **DB-PRIN-003** Security-critical invariants use constraints/triggers/functions, not UI validation alone.
- **DB-PRIN-004** Immutable audit/provenance records never expose ordinary authenticated UPDATE/DELETE.
- **DB-PRIN-005** Privileged backend writes are narrowly scoped and occur only after user-session authorization succeeds.
- **DB-PRIN-006** Shared applied migrations are corrected by forward migrations, not history rewriting.

## 2. Existing core entities

### `organizations`
Purpose: tenant root.

Required fields:
- `id uuid PK`
- `name text`
- timestamps

### `organization_memberships`
Purpose: user-to-organization authorization mapping.

Required fields:
- `id uuid PK`
- `organization_id uuid FK organizations`
- `user_id uuid FK auth.users`
- `role text CHECK OWNER|ADMIN|EDITOR|REVIEWER|ANALYST`
- timestamps
- unique `(organization_id, user_id)`

RLS: members read own accessible memberships; membership mutation restricted to management roles according to product governance.

## 3. `jobs`

Purpose: durable asynchronous work.

Required logical fields:
- `id`
- `organization_id`
- `type`
- `status`: QUEUED|PROCESSING|COMPLETED|FAILED|RETRYING|CANCELLED
- `payload jsonb` or payload reference
- `result jsonb` or result reference
- `idempotency_key`
- `attempt_count`
- lease/claim owner and expiry
- normalized failure code/message
- timestamps

Rules:
- unique idempotency semantics per intended operation scope.
- browser roles cannot claim worker jobs.

## 4. `content_items`

Purpose: parent workflow for generated/manual content.

Fields:
- `id`
- `organization_id`
- `topic`
- `knowledge_context` optional generated-time context
- `language` canonical requested language
- `status`: DRAFT|GENERATING|GENERATED|FAILED
- `generated_script` legacy/current compatibility field until fully superseded
- `provider`
- `provider_model`
- normalized failure metadata
- `created_by`
- timestamps

RLS:
- same-org read
- OWNER/ADMIN/EDITOR create/update
- destructive policy according to product permissions

## 5. `content_script_artifacts`

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
- unique `(content_item_id, language)`
- partial unique index: one `is_source = true` per content item
- GENERATED requires nonempty script
- source artifact has `source_revision IS NULL`
- non-source artifact has valid `source_revision`
- parent organization integrity trigger

## 6. `knowledge_records`

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
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Rules:
- organization immutable after insertion
- creation audit fields immutable for authenticated business mutations
- update actor/time system-controlled
- each business update revision = old + 1
- FK-only auth-user nullification does not create business revision

RLS matrix:
- SELECT ACTIVE: all same-org roles
- SELECT DRAFT/ARCHIVED: OWNER/ADMIN/EDITOR
- INSERT/UPDATE: OWNER/ADMIN/EDITOR
- DELETE: OWNER/ADMIN

## 7. `content_item_knowledge_sources`

Purpose: immutable generation-time provenance snapshot.

Fields:
- `id`
- `organization_id`
- `content_item_id`
- `knowledge_record_id nullable ON DELETE SET NULL`
- `knowledge_revision`
- `title_snapshot`
- `content_snapshot`
- `source_type_snapshot`
- `source_label_snapshot`
- `source_reference_snapshot`
- `created_at`

Constraints:
- unique `(content_item_id, knowledge_record_id)` while source exists
- snapshot organization must equal parent content organization
- referenced Knowledge organization must match snapshot organization

RLS:
- same-org SELECT
- no authenticated INSERT/UPDATE/DELETE
- insertion via trusted server/admin path only after user-session resolution

## 8. `media_assets`

Purpose: normalized media library.

Fields:
- `id`
- `organization_id`
- optional `content_item_id`
- optional `scene_id`
- `media_type`: IMAGE|VIDEO|AUDIO|DOCUMENT or extensible constrained set
- `storage_bucket`
- `storage_path`
- `origin`: UPLOAD|AI_GENERATED|IMPORT|OTHER
- provider/job metadata
- mime type, size, duration/dimensions as applicable
- processing/status metadata
- created_by/timestamps

Rules:
- storage path and DB organization ownership must agree.
- delete authorization must also control object-storage mutation.

## 9. `video_scenes`

Purpose: scene plan and per-scene generation state.

Fields:
- `id`
- `organization_id`
- `content_item_id`
- optional source artifact/revision linkage
- `sequence_number`
- `required boolean default true`
- narration/source text
- visual direction/prompt
- estimated duration seconds
- generation status
- provider/job reference
- timestamps

Constraints:
- unique `(content_item_id, sequence_number)`
- organization integrity with parent
- duration positive and bounded by product limits

## 10. New baseline entity — `integration_connections`

Purpose: non-secret provider configuration and health metadata.

Proposed fields:
- `id uuid PK`
- `organization_id uuid NOT NULL`
- `provider text NOT NULL` (OPENAI, META, LTX, etc.)
- `display_name text`
- `status text`: NOT_CONFIGURED|CONFIGURED|INVALID|DISABLED
- `config jsonb` containing only non-secret identifiers/settings
- `secret_version integer NOT NULL default 0`
- `masked_hint text nullable` (safe suffix/identifier only)
- `last_verified_at timestamptz nullable`
- `last_error_code text nullable`
- `created_by uuid`
- `updated_by uuid`
- timestamps

Constraints:
- unique `(organization_id, provider)` for single-connection providers in MVP; provider/account child table can be introduced when Meta requires multiple accounts.

RLS:
- same-org OWNER/ADMIN read/manage full metadata
- EDITOR may read provider availability/status if needed, but cannot mutate
- REVIEWER/ANALYST only minimal availability where required by UX

## 11. New baseline entity — `integration_secrets`

Purpose: encrypted provider secret envelope. Never returned raw to browser clients.

Proposed fields:
- `id uuid PK`
- `organization_id uuid NOT NULL`
- `connection_id uuid FK integration_connections ON DELETE CASCADE`
- `secret_name text` (e.g. API_KEY, APP_SECRET, ACCESS_TOKEN)
- `ciphertext bytea/text NOT NULL`
- `encryption_version integer NOT NULL`
- optional `key_version integer`
- `created_by uuid`
- `created_at timestamptz`
- `rotated_at timestamptz nullable`

Constraints:
- unique `(connection_id, secret_name)`

Security:
- enable RLS
- no ordinary authenticated SELECT/INSERT/UPDATE/DELETE policies on raw secret table
- all writes/reads via privileged server module/RPC after explicit role authorization
- encryption/decryption root key is deployment/server bootstrap secret and cannot be stored in this table
- plaintext cannot be logged

## 12. New baseline entity — `integration_audit_events`

Purpose: immutable record of credential/config changes and connection tests.

Fields:
- `id`
- `organization_id`
- `connection_id`
- `actor_user_id`
- `event_type`: CREATED|UPDATED|SECRET_REPLACED|SECRET_REMOVED|TEST_SUCCEEDED|TEST_FAILED|DISABLED|ENABLED
- non-secret metadata jsonb
- `created_at`

RLS:
- authorized same-org read
- backend-only insert
- no authenticated update/delete

## 13. Planned entity — `approval_requests`

Fields:
- `id`
- `organization_id`
- `content_item_id`
- target artifact/revision
- `status`: PENDING|CHANGES_REQUESTED|APPROVED|REJECTED|SUPERSEDED
- requested_by/timestamps

## 14. Planned entity — `approval_events`

Immutable event log:
- approval_request_id
- actor_user_id
- decision/event
- comment
- artifact revision
- created_at

No authenticated UPDATE/DELETE.

## 15. Planned entity — `publication_targets`

Purpose: configured non-secret social/channel destinations linked to integration connection.

Fields:
- organization
- provider/channel
- integration connection
- external account/page/channel ID
- display label
- status
- metadata

No provider secret fields.

## 16. Planned entity — `publication_attempts`

Fields:
- organization
- content/artifact/revision
- target
- job_id
- idempotency key
- requested schedule time/timezone
- status
- external publication ID/URL where safe
- normalized provider error
- timestamps

## 17. Planned analytics entities

### `metric_sync_runs`
Tracks channel/account sync windows, job/provider status, watermark and failure state.

### `content_metrics_daily`
Recommended normalized grain:
- organization
- publication target
- publication attempt/external post
- metric date
- impressions/reach/views/clicks/engagements/etc. nullable by provider support
- source timestamp
- ingested_at

Unique grain prevents duplicate ingestion.

## 18. Planned testimonial entities

### `testimonials`
- organization
- display/person metadata
- consent/publication eligibility status
- source text
- optional restricted PII payload/reference
- revision/audit fields

### `testimonial_media`
Links testimonials to media assets.

## 19. Planned campus entities

### `campus_locations`
- organization
- name
- address/contact/public metadata
- status
- approved fact fields
- revision/audit fields

Campus facts used by AI should also be representable as or linked into approved Knowledge records.

## 20. Planned podcast entities

### `podcast_episodes`
- organization
- title/objective/audience/language
- content item/script artifact link
- episode state
- audio media link
- review/publishing linkage

## 21. Referential-integrity rules

- Child `organization_id` must match parent `organization_id`; use trigger/constraint patterns where composite FKs are impractical.
- `ON DELETE SET NULL` on provenance source links preserves snapshot history.
- Deleting integration connection cascades encrypted secret envelopes but must not erase historical publication attempts/audit records; those should keep nullable connection references plus provider snapshots.
- Published/approved historical objects prefer soft lifecycle/supersede semantics over destructive deletion.

## 22. Indexing baseline

At minimum:
- every tenant list table: `(organization_id, updated_at desc)` or workflow-specific equivalent
- knowledge: `(organization_id, status, updated_at desc)`
- artifacts: `(organization_id, content_item_id)` plus uniqueness constraints
- jobs: indexes supporting status/type/lease claim scans and organization queries
- publications: `(organization_id, status, scheduled_at)`
- metrics: `(organization_id, metric_date)` and publication grain uniqueness
- integrations: unique `(organization_id, provider)`

Indexes must follow measured query patterns; do not add speculative wide indexes.

## 23. Database acceptance

Before a schema slice merges:
1. migration applies from current production/staging version;
2. full repository migration chain applies to fresh DB in order;
3. RLS enabled on new tenant tables;
4. positive and negative role/tenant probes pass;
5. destructive/immutable-history behavior is explicitly tested;
6. security-definer privilege surface is reviewed.