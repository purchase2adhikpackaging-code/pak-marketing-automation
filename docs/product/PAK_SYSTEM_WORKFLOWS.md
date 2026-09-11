# PAK Marketing Automation — System Workflow & State Machine Specification

**Document ID:** PAK-WF-001  
**Version:** 1.1  
**Status:** Current baseline after Phase 7

## 1. Knowledge lifecycle

`DRAFT → ACTIVE → ARCHIVED → ACTIVE`

Delete is OWNER/ADMIN only and is not a normal lifecycle transition.

Rules:
- DRAFT is editable but not eligible for grounding.
- ACTIVE is eligible for Content Studio selection.
- ARCHIVED is retained for history but excluded from new grounding.
- Every successful business lifecycle/content update increments revision exactly once.
- Stale revision writes fail rather than silently overwrite.

## 2. Grounded canonical generation

1. User opens Content Studio.
2. Server resolves eligible organizations.
3. User selects topic, canonical language, up to 20 ACTIVE Knowledge record IDs and optional Additional context.
4. Server validates input.
5. Server resolves authenticated actor and organization membership/role.
6. Server reloads selected Knowledge records under tenant authorization.
7. Server rejects missing/cross-org/non-ACTIVE records.
8. Server composes deterministic grounding context and rejects over-limit context.
9. Content item enters generation workflow.
10. Text provider generates canonical script.
11. Content item stores safe generated/provider metadata.
12. Trusted backend path writes immutable Knowledge snapshots.
13. If snapshot persistence fails, item transitions to FAILED with a provenance failure code and does not remain success-looking.
14. If snapshots succeed, canonical source artifact is ensured.
15. UI returns canonical artifact and traceability metadata.

## 3. Canonical regeneration

`GENERATED source revision N → GENERATING → GENERATED revision N+1`

On successful regeneration:
- same source artifact row is updated;
- revision increments;
- translations whose `source_revision < new revision` become STALE;
- previous successful text is not silently destroyed by a failed regeneration attempt.

## 4. Translation workflow

Preconditions:
- canonical source exists and is GENERATED;
- source script is nonempty;
- target differs from canonical language;
- target is EN, PL or HI.

State:

`PENDING | STALE | FAILED → GENERATING → GENERATED`

On success:
- target revision increments/initializes;
- `source_revision` equals canonical revision used;
- provider/model metadata is recorded.

On failure:
- target exposes explicit failure semantics;
- canonical source remains unchanged.

## 5. Integration credential workflow

### Configure / replace
1. OWNER/ADMIN opens Settings → Integrations.
2. User enters provider secret in a write-only field.
3. Browser sends the secret once over TLS to authenticated server/Edge action.
4. Server validates actor, organization and management role.
5. Privileged Vault RPC creates/updates the Supabase Vault secret.
6. `integration_secrets` stores Vault reference/metadata, not browser-readable plaintext.
7. `integration_connections` status/version/masked hint is updated.
8. Immutable audit event is recorded.
9. Raw secret is never returned to browser state.

### Remove
- explicit confirmation;
- Vault value/reference is deleted;
- connection status returns to NOT_CONFIGURED or equivalent;
- audit event is recorded.

### Test connection
- secret is resolved only inside privileged runtime;
- provider receives a minimal validation request;
- normalized test result/verified timestamp is persisted;
- secret is never echoed.

LTX test specifically uses an authenticated read-only nonexistent-job lookup and does not submit a paid render.

## 6. OpenAI runtime workflow

1. Content/Scene Planning server path resolves organization.
2. Integration service resolves active OpenAI connection.
3. Vault secret is read inside privileged runtime.
4. Provider-neutral text adapter receives bounded trusted input.
5. Provider response is normalized.
6. Safe provider/model metadata is persisted where required.
7. API key never enters domain records, logs or client output.

## 7. Content Studio → Scene Planning handoff

Precondition: source/translation script artifact is GENERATED and eligible for planning.

1. User chooses `Create Scene Plan` from artifact workspace.
2. Browser submits artifact identity, not trusted script body.
3. Server reloads artifact/content under organization authorization.
4. Server computes source-integrity hash from artifact identity/revision/script.
5. `video_project` is created with source linkage and production brief defaults.
6. User enters Scene Planning workspace for the persisted project.

## 8. Scene Planning workflow

Canonical hierarchy:

`Video Project → Visual Bible → Scene Plan Version → Scenes → Shots`

### 8.1 Draft generation

1. Authorized OWNER/ADMIN/EDITOR edits Production Brief / Visual Bible.
2. Server reloads current source artifact and integrity hash.
3. Structured planner produces provider-neutral scene/shot JSON.
4. Strict schema validates generation output.
5. Canonical narration remains authoritative and is mapped by exact spans.
6. Draft graph is persisted atomically as a version.
7. Plan enters QC_REQUIRED before review.

### 8.2 Manual editing/reordering

Editable lifecycle:

`DRAFT | QC_REQUIRED | REVIEW_REQUIRED` according to action-specific rules.

- scene edits are limited to permitted creative/timing fields;
- shot edits cannot rewrite canonical narration;
- manual shot edits set `human_modified = true`;
- reorder submits complete ordered ID list;
- mutation clears stale QC findings and returns plan to QC_REQUIRED.

### 8.3 Granular replan

1. User requests Scene or Shot replan.
2. Server authenticates/authorizes before AI spend.
3. Server reloads full persisted current plan and source/Visual Bible.
4. Source-integrity mismatch rejects the request.
5. Planner receives replan scope/context.
6. Postcondition checker rejects mutation outside requested scope.
7. Human-modified shots are protected by default.
8. Successful replan creates a new version/copy-on-write result and reruns QC.

### 8.4 QC

Deterministic QC checks include:
- source freshness;
- contiguous ordering;
- scene/shot timing consistency;
- prompt/reference requirements;
- camera/idea warnings;
- exact narration coverage with no gap/overlap/rewrite;
- generation requirements.

State behavior:
- blockers prevent review/approval;
- warnings may require reviewer acknowledgement;
- zero blockers can promote to REVIEW_REQUIRED after QC.

### 8.5 Review / approval

- review/approval role is enforced server/database-side;
- approved version is immutable;
- source change marks dependent approved plan stale;
- later edits create a new draft/version rather than mutating approved content.

## 9. Approved-shot video generation workflow

Preconditions:
- authenticated actor is OWNER/ADMIN/EDITOR;
- Scene Plan version is APPROVED;
- source integrity is still current;
- no BLOCKER findings;
- shot belongs to approved plan/organization;
- supported duration/aspect ratio/profile.

### 9.1 Enqueue

1. Browser submits organization ID, plan version ID, shot ID and approved profile identifier only.
2. `enqueue_video_shot_generation` revalidates actor/tenant/approval/source/QC/shot lineage.
3. RPC derives trusted prompt, camera intent, duration, aspect ratio, provider/model from persisted shot/domain state.
4. Deterministic idempotency key is computed.
5. If an existing job exists, latest attempt is returned; duplicate spend is not created.
6. Otherwise RPC atomically creates `VIDEO_SHOT_GENERATION` job and attempt 1.

Normal browser roles cannot directly INSERT/UPDATE paid generation jobs or provider attempts.

### 9.2 Provider submit

Attempt:

`QUEUED → SUBMITTING → SUBMITTED`

1. Edge worker authenticates either user path or internal dispatcher token.
2. Job/attempt/tenant lineage is reloaded.
3. LTX connection health and Vault API key are resolved.
4. Provider-neutral request is mapped to LTX payload.
5. Transport failure after possible submit becomes `SUBMISSION_UNKNOWN` and is terminal for automatic retry.
6. Safe provider job ID is stored after confirmed submission.

### 9.3 Reconciliation

`SUBMITTED ↔ PROCESSING → IMPORT_PENDING`

1. Worker polls provider status by persisted provider job ID.
2. Pending/processing updates polling timestamp/state.
3. Provider terminal failure becomes FAILED with normalized code/retryability.
4. Provider completion yields an ephemeral video URL in memory only.
5. Attempt moves to IMPORT_PENDING before durable media import.

### 9.4 Media import

1. Worker downloads provider result bytes.
2. Validate nonempty supported `video/*` MIME and size cap.
3. Compute SHA-256 checksum.
4. Upload to private deterministic path:
   `<org>/generated-video/<plan>-<shot>-<attempt>.mp4`
5. `complete_generated_video_import` idempotently creates/updates `media_assets`.
6. Attempt links `media_asset_id` and becomes COMPLETED.
7. Job becomes COMPLETED only after durable PAK storage succeeds.

Provider result URL is not persisted as durable media identity.

## 10. Video retry workflow

Retryable failure:

`FAILED → new QUEUED attempt → ...`

Rules:
- failed attempt is never overwritten;
- service-role retry scheduler creates attempt N+1;
- maximum four attempts;
- retry eligibility after attempt failures: 5s, 15s, 45s;
- `SUBMISSION_UNKNOWN` is not automatically retried;
- non-retryable auth/validation/content errors remain terminal.

## 11. Unattended dispatcher workflow

1. Supabase `pg_cron` triggers every 10 seconds where installed.
2. `pg_net` POSTs to `video-generation-dispatcher` using Vault-held internal token.
3. Dispatcher validates token using constant-time comparison.
4. Service-role claim RPC leases a bounded batch using `FOR UPDATE ... SKIP LOCKED`.
5. Each claim is classified SUBMIT / RECONCILE / RETRY.
6. Dispatcher invokes the appropriate Edge worker with internal token.
7. Retry creates a new attempt before submit.
8. Lease is released after work attempt.
9. Normal browser roles cannot call claim/retry/import privileged RPCs.

## 12. Final video assembly workflow — PHASE 8

Not yet implemented.

Required future preconditions:
- approved/current plan;
- at least one required scene/shot;
- every required component media successful and PAK-owned;
- QA/readiness passes.

Future final render state:

`QUEUED → PROCESSING → COMPLETED | RETRYING | FAILED | CANCELLED`

Final assembly is a separate job from per-shot provider generation.

## 13. Generic Approval workflow — PHASE 9

Baseline target:

`PENDING → APPROVED | CHANGES_REQUESTED | REJECTED | SUPERSEDED`

Rules:
- exact artifact/revision/media target;
- Request Changes / Reject require comment;
- approval events immutable;
- substantive revision supersedes prior approval;
- publishing checks current eligibility.

Scene Planning's implemented plan-level approval is domain-specific and remains authoritative for plan approval.

## 14. Publishing workflow — PHASE 10

Preconditions:
- eligible content/revision;
- required generic/domain approval satisfied;
- configured provider connection;
- active publication target.

Future flow:
1. user selects target + publish-now/schedule;
2. server validates membership/publish permission;
3. durable idempotent publish job created;
4. worker resolves Vault credentials;
5. adapter publishes;
6. external safe reference persisted;
7. transient failures reconcile/retry without duplicates;
8. terminal failure shows normalized remediation state.

## 15. Content Calendar workflow — PHASE 11

Calendar is a projection of authoritative scheduled publication state.

- schedule creates/updates authoritative publication timing + timezone;
- reschedule mutates schedule with audit metadata;
- cancel preserves audit state rather than silently deleting history.

## 16. Analytics synchronization — PHASE 12

1. scheduler/manual sync creates metric job;
2. worker resolves provider connection;
3. bounded time window/watermark pull;
4. normalize provider metrics;
5. upsert unique metric grain;
6. advance watermark only after durable persistence;
7. UI exposes last sync/freshness/error.

## 17. Manual content workflow — PHASE 17 completion

Target:

`DRAFT → EDITED → REVIEW ELIGIBLE`

Manual content bypasses AI provider calls but uses the same organization/artifact/revision/approval/publishing model.

## 18. Global retry model

- validation/auth/permission failures: no retry;
- credential/permission provider failure: terminal and integration health may become INVALID;
- rate limit/transient 5xx/network failure: bounded retry where duplicate side effect is safe;
- ambiguous external submit: reconcile/manual handling, never blind duplicate;
- known completed/idempotent reference: reconcile rather than repeat side effect;
- max attempts are job-type policy, never infinite retry.

## 19. Global failure rule

No failed step may leave a success-looking authoritative state.

Examples:
- failed provenance persistence cannot leave canonical generation marked successful;
- manual Scene Plan edit invalidates prior QC;
- stale source blocks approved-shot provider spend;
- provider completion is not job completion until PAK media import succeeds;
- missing/invalid provider credential blocks invocation before paid generation;
- future publishing/assembly must follow the same durable/state-safe rule.