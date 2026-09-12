# Phase 8 — Final Video Assembly & Media Library Expansion Design

**Date:** 2026-09-12  
**Status:** Design for implementation  
**Branch:** `phase-8/final-assembly-media-library`  
**Base:** `main@2966a3b016980531813fcb2c84b68a820b5cad01`

## 1. Purpose

Phase 8 closes two gaps in the synchronized PAK baseline:

1. turn an APPROVED, source-current Scene Plan whose shots have successful PAK-owned generated media into one deterministic final PAK-owned video asset; and
2. replace the Media Library readiness placeholder with an operational, tenant-safe media catalogue, upload, preview, lineage, archive and delete workflow.

This design implements:

- `PRD-VID-005`
- `PRD-VID-019`
- `PRD-MEDIA-001..006`
- `TRD-VID-005..006`
- `TRD-MEDIA-001..005`
- `UX-SCENE-003`
- `UX-MEDIA-001..004`

It preserves all Phase 6/7 boundaries. It does not redesign Scene Planning, LTX generation, Integration Vault, generic Approval Center, publishing, calendar, analytics, AI Representative, podcast, campuses, testimonials, or manual authoring.

## 2. Current foundation

Phase 7 already provides:

- APPROVED immutable Scene Plan versions with source-integrity hashes;
- ordered `scene_plan_scenes` and `scene_plan_shots`;
- tenant-scoped durable `jobs`;
- `video_generation_attempts` linked to plan/scene/shot and imported media;
- private `generated-media` storage;
- PAK-owned `media_assets` records for successfully imported generated clips;
- browser-safe server actions and Edge workers;
- strict paid-provider creation/retry boundaries;
- unattended dispatch infrastructure.

The current `/media-library` route is only a readiness page. `media_assets` is the authoritative media identity and must remain so.

## 3. Architectural choice

### 3.1 Chosen approach — dedicated PAK render worker

Final composition runs in a dedicated containerized PAK render worker with FFmpeg/ffprobe.

Control plane:

`Next.js UI/server action → Supabase RPC/DB → Supabase Edge control boundary → PAK render worker → private Supabase Storage → media_assets`

The render worker:

- does not receive a Supabase service-role key;
- does not write PAK database rows directly;
- receives only short-lived signed input/output URLs and a bounded immutable render manifest;
- authenticates to the Edge control boundary using a high-entropy internal worker credential stored only in secure deployment configuration;
- has no LTX/provider credentials.

Why:

- 90–180 second FFmpeg composition is CPU/media work and must not depend on a browser or web-request lifetime;
- Supabase Edge is not the right native FFmpeg runtime;
- Vercel request execution is not the durable render authority and may be duration/quota constrained;
- browser FFmpeg/WASM would expose correctness to client lifecycle, memory pressure and tampering;
- a third-party render SaaS would add avoidable vendor lock-in and a new paid-provider surface.

### 3.2 Rejected approaches

- **Next/Vercel FFmpeg request** — render completion must not depend on request duration or hosting quota.
- **Supabase Edge FFmpeg** — native long-running composition does not belong in Edge runtime.
- **Browser FFmpeg/WASM** — final asset correctness and tenancy cannot depend on an open browser.
- **Third-party render API as authority** — unnecessary for a deterministic concatenation/normalization pipeline.

## 4. Final assembly domain model

### 4.1 `video_assemblies`

One organization-scoped record represents one immutable component snapshot and final output.

Logical fields:

- `id uuid PK`
- `organization_id uuid NOT NULL`
- `plan_version_id uuid NOT NULL`
- `job_id uuid NOT NULL`
- `state`: `QUEUED | PROCESSING | COMPLETED | FAILED | CANCELLED`
- `render_profile`: initially `PAK_MASTER_1080P_V1`
- `readiness_hash text NOT NULL`
- `source_integrity_hash text NOT NULL`
- `aspect_ratio`: `16:9 | 9:16`
- `component_count integer > 0`
- `expected_duration_seconds numeric > 0`
- `final_media_asset_id uuid nullable`
- normalized failure code/message/retryability metadata
- `created_by uuid`
- timestamps

Rules:

- plan and organization must match;
- lineage fields are immutable after creation;
- `COMPLETED` requires same-org `final_media_asset_id`;
- authenticated members may read same-org assemblies;
- browser roles may not directly fabricate/mutate execution state.

### 4.2 `video_assembly_components`

Immutable snapshot of every shot/media input used by an assembly.

Fields:

- `id uuid PK`
- `organization_id uuid NOT NULL`
- `assembly_id uuid NOT NULL`
- `ordinal integer >= 0`
- `scene_id uuid NOT NULL`
- `shot_id uuid NOT NULL`
- `media_asset_id uuid NOT NULL`
- `media_checksum text NOT NULL`
- `duration_seconds numeric > 0`
- `storage_bucket text NOT NULL`
- `storage_path text NOT NULL`
- timestamps

Constraints:

- unique `(assembly_id, ordinal)`;
- unique `(assembly_id, shot_id)`;
- organization must match assembly, scene, shot and media;
- component rows are immutable after enqueue.

### 4.3 Required-shot rule

The current Scene Plan schema has no explicit optional-shot flag. Phase 8 therefore treats **every persisted shot in an APPROVED plan as required**. It must not infer optionality from free-form `generation_requirements` JSON.

Optional-shot semantics require a future explicit schema/requirement change.

## 5. Final-render readiness

Readiness is computed server-side from authoritative persisted state. Browser state cannot declare a plan ready.

A plan is READY only when:

1. caller belongs to the organization;
2. plan exists in the organization;
3. plan status is `APPROVED`;
4. plan source-integrity hash still matches its current canonical script artifact;
5. no BLOCKER QC finding exists;
6. plan contains at least one scene and shot;
7. every shot has a COMPLETED Phase 7 generation attempt with `media_asset_id`;
8. selected media belongs to the same org, is `VIDEO`, `ACTIVE`, private, checksummed and present in Storage;
9. aspect ratio is `16:9` or `9:16`;
10. no component references archived/failed/missing media.

Normalized reasons include:

- `PLAN_NOT_APPROVED`
- `SOURCE_STALE`
- `QC_BLOCKER_PRESENT`
- `NO_SHOTS`
- `SHOT_MEDIA_MISSING`
- `MEDIA_NOT_ACTIVE`
- `MEDIA_OBJECT_MISSING`
- `UNSUPPORTED_ASPECT_RATIO`
- `ASSEMBLY_ALREADY_RUNNING`

UI must show actionable reasons and no enabled render CTA while blocked.

## 6. Readiness hash and idempotency

Compute a deterministic SHA-256 over canonical serialization of:

- assembly schema/render-profile version;
- organization ID;
- plan version ID;
- source-integrity hash;
- plan aspect ratio;
- ordered component tuples: scene ID, shot ID, media asset ID, media checksum, duration.

Job idempotency key:

`final-video:{planVersionId}:{readinessHash}:{renderProfile}`

Behavior:

- same plan + exact media set + profile reuses existing assembly/job;
- COMPLETED returns existing final media;
- QUEUED/PROCESSING does not create a duplicate;
- component/media/plan/profile change yields new readiness hash;
- failed retry uses the same assembly/job under bounded job retry policy.

## 7. Enqueue boundary

Browser submits only:

- `organizationId`
- `planVersionId`
- allowlisted fixed render profile

OWNER/ADMIN/EDITOR may enqueue. REVIEWER/ANALYST are read-only.

Authenticated enqueue RPC/server boundary:

1. verifies actor/role;
2. re-reads plan/source/QC;
3. computes readiness;
4. selects authoritative completed active media for every shot;
5. computes readiness hash;
6. returns existing idempotent assembly if present;
7. inserts `FINAL_VIDEO_ASSEMBLY` durable job;
8. inserts `video_assemblies`;
9. inserts ordered immutable component snapshot;
10. returns IDs only.

Generic authenticated `jobs` policies must exclude direct INSERT/UPDATE of `FINAL_VIDEO_ASSEMBLY`, mirroring Phase 7 generation hardening.

## 8. Render worker protocol

### 8.1 Pull model

Worker uses a dedicated Edge endpoint with internal credential.

1. worker asks for one due render;
2. Edge/service-role boundary claims job using lease + `SKIP LOCKED` semantics;
3. Edge revalidates job/assembly/org/components;
4. Edge issues short-lived signed GET URLs for private inputs;
5. Edge issues short-lived signed upload URL for deterministic output path;
6. Edge returns immutable manifest;
7. worker downloads/verifies inputs, renders and uploads output;
8. worker reports success/failure using assembly/job IDs only;
9. Edge finalizes media/assembly/job state and releases lease.

The worker never receives provider URLs, LTX credentials, browser tokens or database admin credentials.

### 8.2 Worker credential

Use a high-entropy `PAK_RENDER_WORKER_TOKEN` provisioned separately in:

- Supabase Edge secure secret configuration; and
- render-worker deployment secret configuration.

Never commit this secret. Browser/server actions cannot read it. Edge uses constant-time comparison for worker requests.

### 8.3 Manifest

Bounded non-secret fields only:

- schema version;
- assembly/job/org IDs;
- aspect ratio/render profile;
- ordered components with signed GET URL, expected checksum and expected duration;
- signed output upload URL;
- deterministic output object path;
- expiry timestamp.

Worker rejects malformed/expired manifests and enforces component-count/file-size limits.

### 8.4 Output path

Reuse private `generated-media` bucket:

`{organizationId}/final-video/{planVersionId}-{readinessHashPrefix}.mp4`

`media_assets` is the only durable media identity.

## 9. Deterministic render profile

`PAK_MASTER_1080P_V1`:

- 16:9 → 1920×1080
- 9:16 → 1080×1920
- 24 fps
- H.264 / `libx264`
- `yuv420p`
- MP4 `+faststart`
- deterministic scene/shot order
- hard cuts only
- source clip audio stripped

Hard cuts/audio stripping are intentional:

- Scene Plan transition text is creative intent, not a typed render-transition contract;
- inventing mappings would silently change timing/meaning;
- Phase 7 deliberately requests `generate_audio: false`;
- current baseline has no approved TTS/music contract.

Phase 8 produces the **final visual master**. It does not silently invent narration/music/TTS. A later audio contract can extend the manifest without changing assembly/media identity.

### 9.1 Input QA

For every component:

- download only from signed URL;
- enforce max bytes;
- compute SHA-256 and match PAK checksum;
- ffprobe valid video stream;
- reject empty/corrupt input;
- normalize frame rate/dimensions with scale+pad, never uncontrolled stretching.

### 9.2 Output QA

Before success:

- non-empty output;
- ffprobe valid video stream;
- exact target dimensions;
- valid frame rate;
- positive duration within bounded tolerance of rendered component sum;
- SHA-256 computed;
- signed upload succeeded.

## 10. Finalization and retry

Success boundary:

1. verify job lease/assembly identity;
2. verify deterministic bucket/path;
3. create/upsert final `media_assets` row with VIDEO/GENERATED, bucket/path, MIME, duration, dimensions, checksum, generating job and safe assembly lineage metadata;
4. set `video_assemblies.final_media_asset_id`;
5. mark assembly COMPLETED;
6. mark job COMPLETED with safe result metadata.

Retry:

- max three attempts for transient infrastructure/worker failures;
- checksum/corrupt-input/validation errors are terminal until component media changes;
- lease expiry permits reclaim;
- deterministic path/idempotency makes repeat completion safe;
- before rerender after ambiguous worker outcome, Edge checks deterministic output object existence and reconciles if possible.

## 11. Media Library schema expansion

`media_assets` remains authoritative.

Add/backfill:

- `storage_bucket text NOT NULL DEFAULT 'generated-media'` so existing and future Phase 7 inserts remain compatible;
- `display_name text NOT NULL` with existing rows backfilled from object basename;
- `size_bytes bigint nullable CHECK >= 0`;
- `metadata jsonb NOT NULL DEFAULT '{}'` for safe non-secret technical/lineage metadata;
- `created_by uuid nullable`;
- `archived_at timestamptz nullable`;
- `archived_by uuid nullable`.

Storage identity becomes `(organization_id, storage_bucket, storage_path)`. Replace the older `(organization_id, storage_path)` uniqueness so objects with identical paths in different private buckets cannot collide logically.

Indexes support:

- org + created cursor pagination;
- org + status;
- org + asset_type;
- org + source;
- generating-job lookup.

Direct authenticated `media_assets` INSERT/UPDATE/DELETE policies are hardened; authoritative mutation happens through validated server/RPC/Edge boundaries.

## 12. Controlled upload design

### 12.1 Private upload bucket

Create private `media-library` bucket. Existing generated/final assets remain in `generated-media`.

Initial allowlist:

- IMAGE: JPEG/PNG/WebP, max 25 MiB
- VIDEO: MP4/WebM/QuickTime, max 512 MiB
- AUDIO: MPEG/WAV/M4A/AAC-compatible MIME, max 100 MiB
- DOCUMENT: PDF/DOCX, max 25 MiB

Server-side constants are authoritative; client prevalidation is UX only.

### 12.2 `media_upload_sessions`

Two-step direct upload requires a small auditable session table:

- id;
- organization;
- actor;
- expected bucket/path;
- original/display filename;
- expected MIME/type/size;
- state `ISSUED | FINALIZED | EXPIRED | FAILED`;
- media asset ID nullable;
- expiry/timestamps.

### 12.3 Upload flow

OWNER/ADMIN/EDITOR:

1. browser submits filename/MIME/size/type;
2. Edge validates role + allowlist;
3. backend derives path such as `{organizationId}/uploads/{yyyy}/{uuid}/{sanitizedName}`;
4. backend creates upload session + short-lived signed upload URL;
5. browser uploads directly to Storage;
6. browser finalizes using upload-session ID only;
7. backend verifies object exists and matches issued bucket/path/MIME/size;
8. backend creates `media_assets` row with `source = UPLOAD`;
9. session becomes FINALIZED and is idempotent.

Browser cannot choose arbitrary authoritative path and cannot directly insert media lineage.

## 13. Media read, preview and download

List/detail are org-scoped and paginated.

Filters:

- asset type;
- source;
- status;
- optional display-name search;
- cursor `(created_at, id)`.

Detail route shows:

- display name;
- type/MIME/dimensions/duration/size;
- source/status/created time;
- generating job;
- generation/assembly lineage;
- safe technical metadata.

Preview/download uses short-lived signed GET URL only after same-org authorization. Raw storage/admin credentials never enter browser state.

Preferred route: `/media-library/[assetId]` for addressable operator workflows and future Approval/Publishing linkage.

## 14. Archive and permanent delete

Roles:

- upload: OWNER/ADMIN/EDITOR;
- archive: OWNER/ADMIN/EDITOR where lineage permits;
- permanent delete: OWNER/ADMIN only;
- REVIEWER/ANALYST: read-only.

Rules:

- archive marks media `ARCHIVED` and hides it from default active lists;
- media referenced by active Phase 7 generation lineage or any final assembly/component lineage cannot be permanently deleted;
- permanent delete is backend/Edge-only and derives bucket/path from DB row;
- storage delete is idempotent: already-missing object is treated as removed, then DB cleanup may continue;
- browser never supplies a trusted storage path for deletion.

## 15. Scene Planning UI

Add **Final Video** card for approved/current plan.

States:

- `Blocked` — normalized readiness reasons;
- `Ready` — OWNER/ADMIN/EDITOR sees `Generate Final Video`;
- `Queued` / `Rendering` — durable state, no duplicate CTA;
- `Failed` — normalized error + retry only when backend marks safe;
- `Complete` — PAK media identity + `Open in Media Library`.

Per-shot completion must never be displayed as a completed final film.

## 16. Media Library UI

Replace readiness page with real operator route.

Desktop:

- header + Upload;
- filters;
- paginated list/table;
- type/preview thumbnail when safe;
- name/type/source/status;
- lineage/job context;
- created time/actions.

Mobile:

- stacked cards preserving all critical operations.

Upload UX:

- file select;
- fast client prevalidation;
- signed direct-upload progress;
- finalize state;
- normalized failure with no storage internals.

Asset detail supports preview/download and role-authorized archive/delete.

## 17. Authorization matrix

| Capability | OWNER | ADMIN | EDITOR | REVIEWER | ANALYST |
|---|---:|---:|---:|---:|---:|
| List/view media | ✓ | ✓ | ✓ | ✓ | ✓ |
| Signed preview/download | ✓ | ✓ | ✓ | ✓ | ✓ |
| Upload media | ✓ | ✓ | ✓ | — | — |
| Archive media | ✓ | ✓ | ✓ | — | — |
| Permanent delete | ✓ | ✓ | — | — | — |
| Enqueue final assembly | ✓ | ✓ | ✓ | — | — |
| Read assembly/final media | ✓ | ✓ | ✓ | ✓ | ✓ |

RLS remains final read boundary. Privileged mutations use narrowly scoped server/Edge/RPC checks.

## 18. Failure handling

Readiness:

- not approved/current;
- QC blocker;
- missing shot media;
- archived/failed/missing object;
- unsupported aspect ratio.

Upload:

- unsupported MIME/type;
- too large;
- signed URL expired;
- object mismatch;
- finalize conflict.

Render:

- input download failure;
- checksum mismatch;
- corrupt video;
- FFmpeg failure;
- worker unavailable;
- output QA failure;
- output upload failure;
- finalization failure.

Raw FFmpeg stderr, signed URLs, internal worker token, storage internals and admin credentials never reach browser UI.

## 19. Testing strategy

### Domain/unit

- readiness reasons;
- deterministic ordering;
- readiness hash/idempotency;
- render profile;
- safe error mapping;
- media query/filter schemas;
- authorization.

### SQL/schema

- media metadata backfill/uniqueness/indexes;
- new assembly/component/session tables;
- RLS/parentage/immutability;
- direct browser mutation denial;
- enqueue-only assembly creation;
- completed assembly requires same-org final media;
- referenced media delete denial.

### Worker

- manifest validation;
- expiry/credential boundary;
- checksum verification;
- FFmpeg command construction;
- transient/terminal classification;
- deterministic output path;
- integration test with short generated fixture clips + ffprobe output verification.

CI never requires real LTX because Phase 8 consumes PAK-owned fixture media.

### UI/E2E

- blocked final-render reasons;
- ready/enqueue;
- queued/rendering/completed fake-worker flow;
- Media Library list/filter/detail;
- upload/finalize test abstraction;
- role-based mutation visibility;
- mobile critical workflows.

### Live release gates

- migrations applied in repository order;
- RLS/function privilege probes;
- private bucket checks;
- advisor review;
- assembly/media Edge boundaries deployed;
- unauthorized worker request denied;
- render worker deployed to an approved container runtime;
- deterministic non-LTX fixture smoke produces a valid final PAK `media_assets` record;
- exact-head typecheck, lint, unit, build and Playwright green.

Phase 8 is **not production-complete** if the render worker is only coded but not deployed/verified. Lack of an available container host is an operational blocker, not completion.

## 20. Forward migration order

Dependencies require media bucket identity before assembly enqueue snapshots it.

Expected forward migrations, before first application:

1. `media_library_metadata` — add/backfill `storage_bucket`, display metadata, replace storage uniqueness, indexes, media policy hardening, private upload bucket;
2. `video_final_assemblies` — assembly/components tables, guards, RLS;
3. `video_final_assembly_enqueue` — readiness/idempotent enqueue RPC + `FINAL_VIDEO_ASSEMBLY` job-policy hardening;
4. `media_upload_sessions` — controlled upload-session table/RLS/functions;
5. `video_final_assembly_completion` — idempotent final-media/assembly/job completion and referenced-media delete guards;
6. `video_final_assembly_dispatch` — worker claim/lease/reconciliation boundary and any internal-secret support required by the deployed worker model;
7. advisor-discovered performance/security hardening as new forward migrations only.

Phase 7 `complete_generated_video_import` remains compatible because `media_assets.storage_bucket` defaults to `generated-media`.

## 21. Expected code areas

- `src/modules/video/assembly/*`
- `src/modules/media/*`
- `src/app/(app)/scene-planning/*` final-video read/actions/UI
- `src/app/(app)/media-library/*`
- `supabase/functions/video-assembly/*`
- `supabase/functions/media-library/*`
- `workers/video-render/*` containerized FFmpeg worker
- migrations/tests/E2E/docs/traceability.

## 22. Non-goals

Phase 8 does not add:

- TTS/narration synthesis;
- music generation/licensing;
- creative transition inference;
- subtitles/captions;
- generic Approval Center;
- publishing/calendar/analytics;
- a second media identity table;
- another video-generation provider;
- direct browser access to private buckets/worker secrets.

## 23. Exit criteria

Phase 8 is complete only when:

1. approved/current/blocker-free plan with complete shot media resolves READY;
2. blocked plan exposes deterministic reasons and cannot enqueue;
3. enqueue is tenant/role validated and idempotent;
4. deployed worker consumes immutable manifest and produces verified MP4;
5. final output is one organization-scoped PAK `media_assets` record with component lineage;
6. retries/clicks cannot create duplicate final output identity for same readiness hash;
7. Media Library lists Phase 7 generated, Phase 8 final and uploaded assets;
8. upload, signed preview/download, archive and authorized delete work with private storage;
9. REVIEWER/ANALYST cannot mutate media or enqueue renders;
10. live RLS/storage/security negative probes pass;
11. exact-head CI including production build and Playwright is green;
12. real deployed-worker fixture assembly smoke produces a playable PAK-owned final video asset.
