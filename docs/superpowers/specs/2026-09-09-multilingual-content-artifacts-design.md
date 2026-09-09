# PAK Multilingual Content Artifacts — Design Specification

Date: 2026-09-09
Status: Approved slice, pending written-spec review
Project: PAK Marketing Automation
Branch: `feat/multilingual-content-artifacts`

## 1. Purpose

This slice evolves Content Studio from a single generated script into a multilingual script-artifact workflow that can safely support later scene planning, approvals, publishing, and analytics.

The supported language set remains exactly:

- English (`EN`)
- Polish (`PL`)
- Hindi (`HI`)

The key architectural rule is that the canonical source script and each language variant are distinct, tenant-owned artifacts with independent generation state, provider metadata, failure state, and revision tracking.

This slice must remain completely separate from Aurexis, Lovable, and any Lovable-attached Supabase project.

## 2. Product Flow

The supported workflow becomes:

`Topic → Knowledge Context → Canonical Source Script → EN / PL / HI Script Artifacts → Review-ready Output`

A user may:

1. generate a canonical source script in one of EN, PL, or HI;
2. generate missing translations into either or both remaining languages;
3. regenerate one translation without modifying the other language artifacts;
4. regenerate the canonical source script;
5. see downstream translations become stale when the canonical source changes;
6. inspect each artifact's status and latest generated text independently.

Scene planning is explicitly downstream of a specific current language artifact and is not implemented in this slice.

## 3. Architectural Boundaries

The slice uses four bounded units.

### 3.1 Content Item

`content_items` remains the workflow parent for topic, knowledge context, organization ownership, and overall content identity.

The parent must not become the canonical storage location for multiple language scripts.

### 3.2 Script Artifact

A new `content_script_artifacts` domain stores one current script artifact per content item and supported language.

Each artifact owns:

- organization scope;
- parent content item;
- language;
- whether it is the canonical source artifact;
- generation/translation state;
- current script text;
- revision number;
- source revision used for translation, when applicable;
- provider/model metadata;
- normalized failure metadata;
- actor/timestamps.

### 3.3 Translation Service

A provider-neutral translation workflow consumes a canonical source artifact and produces a target-language artifact.

The service depends on the existing server-only text-generation provider contract rather than importing OpenAI directly.

### 3.4 Content Studio UI

The Content Studio screen presents the parent content item and separate EN/PL/HI language cards with independent states and actions.

The UI never decides authorization or tenant scope; server and RLS boundaries remain authoritative.

## 4. Data Model

Create `public.content_script_artifacts` with the following logical fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `content_item_id uuid not null`
- `language text not null`
- `is_source boolean not null default false`
- `status text not null`
- `script_text text`
- `revision integer not null default 1`
- `source_revision integer`
- `provider text`
- `provider_model text`
- `provider_metadata jsonb`
- `failure_metadata jsonb`
- `created_by uuid`
- `generated_at timestamptz`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Constraints:

- language is exactly `EN`, `PL`, or `HI`;
- status is exactly `PENDING`, `GENERATING`, `GENERATED`, `STALE`, or `FAILED`;
- one artifact row per `(content_item_id, language)`;
- exactly one source artifact per content item once a canonical source exists;
- `script_text` must be non-empty for `GENERATED` artifacts;
- `source_revision` is null for the source artifact and records the canonical revision used to create a translation;
- artifact `organization_id` must match the parent content item's organization.

The artifact row is the current language variant. Regeneration updates that row and increments `revision`. This slice deliberately avoids a second append-only revision table; future approval/audit work may introduce immutable snapshots if required by review retention rules.

## 5. Existing Content Migration

The currently deployed schema stores generated script information on `content_items`.

The migration must preserve existing content:

1. for every `content_items` row with a non-empty generated script, create a matching source artifact using the content item's existing language;
2. copy provider/model/provider metadata into the artifact;
3. map successful generated content to `GENERATED`;
4. retain the existing `content_items.generated_script` columns during this slice for backward compatibility;
5. after the migration, all new multilingual workflow reads/writes use `content_script_artifacts` as the canonical script store.

Do not destructively remove legacy columns in this slice. Cleanup can occur in a later migration after all consumers have moved.

## 6. Canonical Source Semantics

A content item may have only one canonical source language at a time.

The first successful source generation establishes the source artifact.

Regenerating the source artifact:

1. transitions the source to `GENERATING`;
2. generates replacement text;
3. increments the source `revision` on success;
4. transitions the source back to `GENERATED`;
5. marks every generated translation whose `source_revision` is older than the new source revision as `STALE`.

A failed source regeneration must not delete the previous script text. The artifact becomes `FAILED`, retains its last usable text for internal recovery/reference, and records normalized failure metadata. The UI must clearly distinguish failure state from current validity.

Translations may not be considered current while their status is `STALE`.

## 7. Translation Semantics

Translation is not modeled as free-form content generation.

A translation request includes:

- organization ID;
- content item ID;
- source artifact ID/revision;
- target language;
- stable idempotency key;
- translation-specific system instructions.

Rules:

- target language must differ from source language;
- source artifact must be `GENERATED`;
- source text must be non-empty;
- target language must be EN, PL, or HI;
- only the requested target artifact changes;
- a successful translation stores `source_revision = current source revision`;
- regenerating one translation increments only that artifact's revision;
- translating from a stale/non-current source is forbidden;
- translation provider errors are normalized before persistence/client return.

Translation instructions must preserve meaning, factual claims, names, figures, railway terminology, and PAK-specific terms. They must not add unsupported claims or guarantees.

## 8. Provider Architecture

Reuse the existing `TextGenerationProvider` abstraction and server-only provider factory.

Do not add a second OpenAI-specific translation client.

Add a translation-domain adapter/service that builds translation-specific provider input and delegates to the provider contract.

The existing deterministic fake provider remains the CI/test implementation so no test consumes OpenAI credits.

Provider secrets remain server-only and must not be stored in artifact metadata, logs, browser payloads, or database failure fields.

## 9. Authorization and Tenant Isolation

RLS remains the final authorization boundary.

Read access:

- authenticated organization members may read script artifacts for their organizations.

Create/update/generate access:

- `OWNER`
- `ADMIN`
- `EDITOR`

Delete access:

- `OWNER`
- `ADMIN`

Application-layer actions must re-authorize actor membership and role before invoking the workflow service.

Every repository update must scope by both artifact/resource identifier and `organization_id`.

Cross-organization reads or writes must fail by default.

## 10. Persistence and Concurrency

Translation/source state transitions must be explicit and observable.

Canonical transitions:

- `PENDING → GENERATING → GENERATED`
- `GENERATING → FAILED`
- `GENERATED → GENERATING → GENERATED` for regeneration
- `GENERATED → STALE` when its source revision changes
- `STALE → GENERATING → GENERATED` for refresh
- `FAILED → GENERATING → GENERATED|FAILED` for retry

The repository must reject or safely no-op invalid stale writes caused by concurrent operations.

At minimum, generation completion must verify the artifact revision/expected state it started from before committing a result, so a slow older request cannot overwrite a newer regeneration.

The workflow uses stable idempotency keys containing content item, language, source revision, and operation revision where applicable.

## 11. Server Actions

Add server-only actions for:

- generate canonical source script;
- generate/refresh one target translation.

Actions must:

1. validate input with canonical Zod schemas;
2. resolve the authenticated Supabase user;
3. verify organization membership and allowed role;
4. resolve the source/target artifact server-side;
5. invoke the domain service;
6. return only small serializable results and safe errors.

The browser must not submit arbitrary provider/model configuration.

## 12. Content Studio UI

The Content Studio UI evolves from one result panel into a multilingual artifact panel.

Required behavior:

- display selected content item's topic/context;
- display EN, PL, and HI artifact cards;
- visibly identify the canonical source language;
- show each artifact status;
- show current script text when available;
- show revision number;
- show a clear stale indicator when source changes invalidate a translation;
- allow generation of missing translations;
- allow retry/regeneration of a single target language;
- disable invalid actions while the corresponding artifact is generating;
- surface safe errors without provider internals.

No approval controls, scene controls, LTX controls, or publishing controls are added here.

## 13. Content Item Compatibility

`content_items` remains the content identity and topic/context parent.

Its existing status may continue representing the parent source-generation lifecycle for backward compatibility during this slice.

Language-specific truth comes from `content_script_artifacts`.

Any UI/service updated in this slice must prefer artifact data over legacy `generated_script` fields.

## 14. Error Handling

Use existing `AppError` conventions.

Stable client-facing categories include:

- validation failure;
- authentication required;
- insufficient organization permission;
- source artifact unavailable/not current;
- generation temporarily unavailable;
- persistence conflict / retry required.

Persist only normalized diagnostic metadata. Never persist API keys, authorization headers, unrestricted provider payloads, or stack traces.

## 15. Testing Strategy

Use TDD for domain/state-transition logic and authorization-sensitive behavior.

Required unit/domain tests:

- only EN/PL/HI accepted;
- target language cannot equal source language;
- translation requires a generated source artifact;
- successful translation writes provider/model/text/source revision;
- regenerating one translation leaves other artifacts unchanged;
- source regeneration increments source revision;
- source regeneration marks older translations stale;
- stale translation refresh returns to generated with the latest source revision;
- provider failure persists normalized failed state without leaking secrets;
- stale concurrent completion cannot overwrite a newer artifact revision.

Required RLS/integration harness coverage:

- same-organization members can read permitted artifacts;
- cross-organization access fails;
- OWNER/ADMIN/EDITOR may mutate;
- REVIEWER/ANALYST may not mutate;
- artifact organization must match parent organization.

Required E2E smoke behavior:

- Content Studio renders EN/PL/HI cards;
- fake provider path can create or refresh a target translation deterministically;
- CI uses no live OpenAI request or paid API credit.

CI remains responsible for typecheck, lint, unit tests, build, Playwright browser setup, and E2E.

## 16. Observability

Artifact workflow records provide the primary operational trace.

Provider metadata may include safe fields such as provider/model and non-sensitive request identifiers.

Logs should include organization/content/artifact identifiers and operation correlation IDs where useful, but never secrets or unrestricted source/provider payloads.

## 17. Explicit Non-Goals

This slice does not implement:

- scene planning;
- LTX/video generation;
- FFmpeg rendering;
- image generation;
- approval records;
- immutable revision history/audit snapshots;
- publishing or Meta integration;
- analytics;
- vector embeddings or RAG;
- Knowledge Base ingestion;
- autonomous scheduling.

These remain separate future slices.

## 18. Completion Criteria

This slice is complete when:

1. existing generated scripts are preserved through migration/backfill;
2. every content item can represent current EN/PL/HI artifacts independently;
3. one canonical source artifact is explicit;
4. target translations are generated through the existing provider abstraction;
5. source revision changes invalidate dependent translations deterministically;
6. one translation can be regenerated without modifying the others;
7. organization isolation and role restrictions are database-enforced;
8. concurrent stale writes cannot overwrite newer artifact state;
9. the Content Studio UI exposes the multilingual state clearly;
10. tests/build/E2E pass using the deterministic fake provider with zero live OpenAI usage;
11. no scene/LTX/publishing functionality is introduced prematurely.
