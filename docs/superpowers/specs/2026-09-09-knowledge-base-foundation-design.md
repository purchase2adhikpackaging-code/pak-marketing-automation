# PAK Knowledge Base Foundation — Design Specification

Date: 2026-09-09
Status: Proposed architecture checkpoint
Project: PAK Marketing Automation
Branch: `feat/knowledge-base-foundation`

## 1. Goal

Introduce a tenant-safe Knowledge Base that supplies approved, traceable PAK context to Content Studio before script generation.

The initial slice must improve factual grounding and provenance without introducing embeddings, vector databases, autonomous web ingestion, or provider-specific retrieval infrastructure.

The approved upstream pipeline becomes operational as:

`Topic → Selected Knowledge → Grounded Script → EN/PL/HI`

Scene planning and video generation remain downstream and out of scope.

## 2. Scope

This slice includes:

- organization-scoped knowledge records;
- explicit lifecycle states;
- provenance/source metadata;
- deterministic manual knowledge selection in Content Studio;
- server-side resolution of selected knowledge records;
- immutable generation-time knowledge snapshots linked to content items;
- Knowledge Base management UI;
- Content Studio grounding integration;
- RLS and role-aware mutation boundaries;
- deterministic tests and E2E behavior.

This slice explicitly excludes:

- embeddings;
- vector search;
- semantic ranking;
- RAG orchestration frameworks;
- automated crawling or scraping;
- Google Drive/SharePoint ingestion;
- document chunking pipelines;
- OCR;
- LTX/video generation;
- scene planning;
- approval workflow;
- publishing/scheduling;
- autonomous knowledge refresh.

## 3. Design Choice

Use structured knowledge records plus deterministic manual selection.

This is preferred over both immediate Scene Planning and full vector RAG because Content Studio already has a working multilingual generation pipeline, while its grounding still relies on manually pasted context. Establishing a stable, tenant-safe knowledge contract now avoids coupling future scripts, scene plans, or video workflows to ad hoc prompt text.

The retrieval boundary must remain provider-neutral so semantic/vector retrieval can be introduced later without changing Content Studio's generation contract.

## 4. Knowledge Record Model

Create `public.knowledge_records`.

Required fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `title text not null`
- `content text not null`
- `status text not null`
- `source_type text not null`
- `source_label text`
- `source_reference text`
- `revision integer not null default 1`
- `created_by uuid`
- `updated_by uuid`
- `created_at timestamptz`
- `updated_at timestamptz`

Initial lifecycle states are exactly:

- `DRAFT`
- `ACTIVE`
- `ARCHIVED`

Only `ACTIVE` records may be used to ground new content generation.

Initial source types are exactly:

- `MANUAL`
- `DOCUMENT`
- `URL`

`source_type` is provenance metadata only in this slice. The platform does not fetch a URL or parse a document automatically. A user stores the approved knowledge text and optionally records where it came from.

`source_reference` may contain a human-readable document identifier or URL string. It is metadata, not a fetch instruction.

## 5. Revision Semantics

A knowledge record has a monotonically increasing integer `revision`.

Changing any grounding-relevant field increments the revision:

- title;
- content;
- source type;
- source label;
- source reference.

Lifecycle-only transitions may also increment revision for consistency; the implementation must use one deterministic rule and tests must enforce it.

Knowledge records are not silently hard-deleted by ordinary editors. Archiving is the normal retirement mechanism.

OWNER and ADMIN may perform destructive delete if implemented, but deletion must not destroy the historical generation snapshot described below.

## 6. Generation-Time Provenance Snapshot

Create `public.content_item_knowledge_sources` as immutable generation-time provenance.

Each row records exactly what approved knowledge a content item used at generation time:

- `id uuid primary key`
- `organization_id uuid not null`
- `content_item_id uuid not null`
- `knowledge_record_id uuid null`
- `knowledge_revision integer not null`
- `title_snapshot text not null`
- `content_snapshot text not null`
- `source_type_snapshot text not null`
- `source_label_snapshot text`
- `source_reference_snapshot text`
- `created_at timestamptz not null`

The foreign key to `knowledge_record_id` uses `ON DELETE SET NULL` so provenance remains readable even if an OWNER/ADMIN later removes the source record.

Snapshot rows are created server-side only after selected records are revalidated as belonging to the same organization and currently `ACTIVE`.

A unique constraint must prevent duplicate snapshots of the same selected knowledge record for one content item.

The snapshot is the traceability record. Future edits to a knowledge record must not mutate old content provenance.

## 7. Tenant Integrity

Both tables carry `organization_id`.

Database integrity must enforce:

1. a knowledge snapshot's `organization_id` equals its parent content item's organization;
2. when `knowledge_record_id` is non-null, the referenced knowledge record belongs to that same organization;
3. application queries remain explicitly scoped by `organization_id` and resource identifiers;
4. RLS remains the final tenant boundary.

Cross-organization record selection must fail server-side even if the browser submits a valid UUID from another tenant.

## 8. Authorization

All authenticated organization members may read `ACTIVE` knowledge records for selection.

For Knowledge Base management views, same-organization members may read records according to product visibility rules; the initial implementation may expose DRAFT/ARCHIVED records only to roles permitted to manage knowledge.

Mutation permissions:

- OWNER: create, update, activate, archive, delete;
- ADMIN: create, update, activate, archive, delete;
- EDITOR: create, update, activate, archive;
- REVIEWER: read/select ACTIVE only;
- ANALYST: read/select ACTIVE only.

The server action layer must authorize role and organization before mutations.

Database RLS must independently enforce equivalent tenant/role boundaries.

The RBAC module should gain explicit knowledge permissions rather than hiding Knowledge Base authorization behind an unrelated permission.

Recommended permissions:

- `knowledge:view`
- `knowledge:manage`
- `knowledge:delete`

Role mapping:

- OWNER: all three;
- ADMIN: all three;
- EDITOR: view + manage;
- REVIEWER: view;
- ANALYST: view.

## 9. Stable Repository Boundary

Introduce a provider-neutral knowledge repository/service contract.

Equivalent interface:

```ts
export interface KnowledgeRepository {
  listSelectable(organizationId: string): Promise<KnowledgeRecord[]>;
  listManageable(organizationId: string): Promise<KnowledgeRecord[]>;
  getByIds(organizationId: string, ids: string[]): Promise<KnowledgeRecord[]>;
  create(input: CreateKnowledgeInput): Promise<KnowledgeRecord>;
  update(input: UpdateKnowledgeInput): Promise<KnowledgeRecord>;
  archive(id: string, organizationId: string, actorUserId: string): Promise<KnowledgeRecord>;
  delete(id: string, organizationId: string): Promise<void>;
}
```

Content Studio must not query the Knowledge Base table directly from the client.

A `KnowledgeGroundingService` resolves selected IDs server-side and returns normalized grounding input plus snapshot-ready provenance records.

This contract must remain usable if manual selection is later supplemented by vector or semantic retrieval.

## 10. Grounding Resolution

Content Studio request input gains optional:

```ts
knowledgeRecordIds?: string[];
```

Constraints:

- UUIDs only;
- unique IDs;
- bounded count, initially maximum 20;
- the browser does not submit knowledge text for selected records;
- all selected records are reloaded server-side;
- every selected record must belong to the requested organization;
- every selected record must be `ACTIVE`;
- missing, archived, draft, or cross-org records cause a safe validation/domain error before provider generation.

The server builds grounding context deterministically in the selected order using clear source separators.

Example normalized structure:

```text
[Knowledge Source 1: Safety Training Standard]
<approved record content>

[Knowledge Source 2: PAK Workshop Capabilities]
<approved record content>
```

The user's existing free-form `knowledgeContext` field remains temporarily supported as optional ad hoc context for backward compatibility. It is appended after approved selected knowledge and is clearly labeled `Additional user-provided context` in the provider grounding payload.

Selected Knowledge Base records are authoritative traceable sources; ad hoc context is not represented as a Knowledge Base record unless the user explicitly saves it there.

## 11. Content Item Persistence

`content_items` remains the parent content workflow record.

The generation flow becomes:

1. validate request boundary;
2. authenticate actor;
3. verify organization membership/role;
4. resolve selected knowledge records server-side;
5. reject any invalid selection before AI call;
6. create/transition content item as today;
7. generate grounded canonical source script;
8. persist content result;
9. persist generation-time knowledge snapshots linked to the content item;
10. create/return canonical script artifact through the existing multilingual flow.

Snapshot persistence must be idempotent for a content item + knowledge source combination.

If snapshot persistence fails after provider generation, the action must return a safe failure and must not falsely report fully traceable generation success. The implementation plan should choose an explicit recovery strategy rather than silently dropping provenance.

## 12. Knowledge Base UI

Replace the current Knowledge Base placeholder with a functional first version.

The page includes:

- record list;
- title;
- lifecycle state;
- source type/label;
- revision;
- updated timestamp;
- create record;
- edit record;
- activate/archive controls according to role;
- delete control only for OWNER/ADMIN if destructive deletion is exposed.

The first version does not need rich-text editing. A plain textarea is sufficient and easier to audit.

Search/filtering may include simple client/server text filtering, but semantic search is out of scope.

## 13. Content Studio UI Integration

Content Studio adds an `Approved knowledge` selector sourced from server-authorized `ACTIVE` records for the chosen organization.

Recommended first UI:

- multi-select checklist/list;
- title + source label/type;
- selected count;
- maximum 20;
- optional existing additional-context textarea remains visible separately.

Changing organization clears selected IDs that do not belong to the new organization.

The UI must never expose hidden cross-org records and must not treat client filtering as authorization.

## 14. Error Handling

Expected safe errors include:

- unauthenticated;
- unauthorized role;
- knowledge record unavailable;
- record no longer ACTIVE;
- organization mismatch;
- invalid request;
- persistence failure;
- provider generation failure.

Raw Supabase errors, provider errors, URLs containing credentials, API keys, and database internals must not be returned to the browser.

Provider/API secrets remain server-only.

## 15. Concurrency

Knowledge updates use compare-and-set semantics based on `revision` where practical.

An update submitted against an older revision must return a normalized conflict rather than overwrite a newer edit.

Content generation uses the knowledge revision loaded by the server and stores that exact revision in the snapshot.

If a record changes after resolution but before snapshot persistence, the snapshot still reflects the resolved content/revision that was actually supplied to the generation request.

## 16. RLS Policies

`knowledge_records`:

- SELECT: same-organization members; product query layer restricts selection to ACTIVE records;
- INSERT: OWNER/ADMIN/EDITOR;
- UPDATE: OWNER/ADMIN/EDITOR;
- DELETE: OWNER/ADMIN.

`content_item_knowledge_sources`:

- SELECT: same-organization members;
- INSERT: OWNER/ADMIN/EDITOR, with same-organization parent integrity;
- UPDATE: no ordinary mutation path; snapshots are immutable;
- DELETE: OWNER/ADMIN only if lifecycle cleanup requires it, otherwise no client delete policy.

Snapshot immutability should be enforced by withholding UPDATE policy from authenticated users.

## 17. Migration and Backward Compatibility

No destructive migration is allowed.

Existing `content_items.knowledge_context` remains intact.

Existing content items require no backfill because historical ad hoc context was not sourced from Knowledge Base records and must not be falsely represented as approved provenance.

The new tables are additive.

The Knowledge Base starts empty unless PAK-specific approved records are explicitly entered later.

## 18. Testing Strategy

### Unit/domain tests

Cover:

- lifecycle/status validation;
- supported source types;
- unique/bounded selected IDs;
- role permission mapping;
- same-org record resolution;
- rejection of DRAFT/ARCHIVED records;
- cross-org/missing record rejection;
- deterministic grounding composition;
- revision conflict behavior;
- immutable snapshot mapping;
- normalized error handling;
- no secret leakage.

### Repository tests

Use injected persistence fakes for deterministic behavior and compare-and-set tests.

### Server-action tests

Cover authentication, role authorization, request validation, tenant scoping, and safe errors.

### Component tests

Cover Knowledge Base management states and Content Studio knowledge selection behavior.

### E2E

CI continues using the fake text provider and harmless public Supabase placeholders.

E2E must not require a real OpenAI key or external knowledge provider.

A deterministic smoke path should prove the Knowledge Base page renders and Content Studio exposes the approved-knowledge selection surface without introducing a live external dependency.

### RLS harness

Extend SQL assertions for table presence, policy roles, snapshot immutability, organization-integrity triggers/constraints, and critical unique constraints.

As with the previous slice, CI structural checks do not constitute proof that migrations were applied to a live Supabase project.

## 19. Security Requirements

- PAK remains isolated from Aurexis, Lovable, and any Lovable-attached Supabase project.
- No service-role key enters browser code.
- No OpenAI key enters browser code, logs, metadata, or errors.
- Knowledge record contents remain tenant-scoped.
- Client-supplied knowledge IDs are untrusted until server resolution.
- The database is the final tenant boundary.
- Snapshot provenance must not be rewritten when the source record changes later.

## 20. Future Extension Boundary

Future semantic retrieval can implement a retrieval strategy behind the grounding service without changing Content Studio's downstream generation contract.

Possible later additions include:

- immutable knowledge versions;
- document ingestion;
- chunking;
- embeddings;
- vector search;
- retrieval ranking;
- citation generation;
- automated source refresh;
- Knowledge Base approval/review lifecycle.

None are required for this foundation slice.

## 21. Acceptance Criteria

The slice is complete when:

1. PAK users can create and manage organization-scoped knowledge records according to role;
2. only ACTIVE records are selectable for new script grounding;
3. Content Studio resolves selected knowledge server-side;
4. script generation uses deterministic approved knowledge context;
5. the exact selected knowledge text/revision/provenance is snapshotted per content item;
6. later knowledge edits do not rewrite historical generation provenance;
7. cross-org record use is rejected at application and database boundaries;
8. stale knowledge edits cannot silently overwrite newer revisions;
9. existing multilingual Content Studio behavior remains functional;
10. fake-provider CI uses zero OpenAI credits;
11. full typecheck, lint, unit tests, build, and E2E pass;
12. live Supabase migration application is not claimed unless separately executed and verified.
