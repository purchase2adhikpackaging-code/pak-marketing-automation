# PAK Knowledge Base Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tenant-safe, provenance-aware Knowledge Base that supplies approved PAK knowledge to Content Studio through deterministic server-side grounding while preserving immutable generation-time source snapshots.

**Architecture:** Introduce organization-scoped `knowledge_records` plus immutable `content_item_knowledge_sources` snapshots. Content Studio accepts only selected knowledge IDs from the browser, resolves ACTIVE records server-side through a stable grounding service, composes deterministic provider context, and stores the exact source revision/text used after successful generation. Knowledge management uses explicit RBAC permissions, RLS, compare-and-set revision updates, and a focused management UI. Embeddings/vector search remain deferred behind the retrieval boundary.

**Tech Stack:** Next.js 15, TypeScript, Zod 4, Supabase Postgres/Auth/RLS, existing provider-neutral text generation layer, Vitest, Testing Library, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-09-knowledge-base-foundation-design.md`

## Global Constraints

- PAK remains completely separate from Aurexis, Lovable, and every Lovable-attached Supabase project.
- Knowledge lifecycle states are exactly `DRAFT`, `ACTIVE`, and `ARCHIVED`.
- Initial knowledge source types are exactly `MANUAL`, `DOCUMENT`, and `URL`.
- Only `ACTIVE` knowledge records may ground new content generation.
- Browser requests may submit knowledge record IDs, never trusted Knowledge Base text.
- Selected knowledge IDs must be unique UUIDs with a maximum of 20 records per generation request.
- `content_item_knowledge_sources` is immutable for ordinary authenticated users; no UPDATE policy is allowed.
- Every grounding-relevant knowledge update increments `revision` exactly once; lifecycle changes use the same revision increment rule.
- Stale knowledge edits must fail with compare-and-set conflict semantics rather than overwrite newer revisions.
- Historical snapshots must retain the exact title/content/source metadata/revision used for generation even if the source record changes or is later deleted.
- OWNER and ADMIN may delete knowledge records; EDITOR may manage but not delete; REVIEWER and ANALYST may read/select ACTIVE records only.
- RLS is the final tenant authorization boundary.
- Provider/API secrets remain server-only and may not enter browser payloads, logs, database metadata, or client errors.
- Existing free-form `knowledgeContext` remains temporarily supported and is appended as explicitly labeled additional user-provided context.
- CI uses the deterministic fake text provider and must not require or consume an OpenAI API key.
- No embeddings, vector search, document ingestion, OCR, crawling, scene planning, LTX/video generation, approval workflow, publishing, scheduling, or autonomous refresh in this slice.
- Live Supabase migration application must not be claimed unless separately executed and verified.

---

## File Structure

### New files

- `supabase/migrations/202609090008_knowledge_base.sql` — knowledge tables, revision/integrity constraints, indexes, triggers, and RLS.
- `src/modules/knowledge-base/types.ts` — domain types and repository contracts.
- `src/modules/knowledge-base/schema.ts` — request/input validation.
- `src/modules/knowledge-base/schema.test.ts` — lifecycle/source/request validation.
- `src/modules/knowledge-base/repository.ts` — tenant-scoped Supabase repository with compare-and-set updates.
- `src/modules/knowledge-base/repository.test.ts` — deterministic repository contract tests.
- `src/modules/knowledge-base/grounding-service.ts` — selected-record resolution and deterministic grounding composition.
- `src/modules/knowledge-base/grounding-service.test.ts` — ACTIVE/cross-org/order/error tests.
- `src/modules/knowledge-base/snapshot-repository.ts` — immutable content-item provenance persistence.
- `src/modules/knowledge-base/snapshot-repository.test.ts` — idempotent snapshot mapping tests.
- `src/app/(app)/knowledge-base/actions.ts` — authenticated management actions.
- `src/app/(app)/knowledge-base/actions.test.ts` — auth/role/error tests.
- `src/app/(app)/knowledge-base/knowledge-base-manager.tsx` — first functional management UI.
- `src/app/(app)/knowledge-base/knowledge-base-manager.test.tsx` — component behavior tests.
- `src/app/(app)/content-studio/knowledge-selector.tsx` — approved-knowledge selection UI.
- `src/app/(app)/content-studio/knowledge-selector.test.tsx` — selection/max/org-reset tests.

### Modified files

- `src/modules/auth/roles.ts` — add explicit Knowledge Base permissions.
- `src/modules/auth/authorization.test.ts` — verify new role-permission mapping.
- `src/modules/content-studio/schema.ts` — accept optional selected knowledge IDs.
- `src/modules/content-studio/schema.test.ts` — selection boundary validation.
- `src/modules/content-studio/service.ts` — accept already-resolved deterministic grounding context while retaining current provider abstraction.
- `src/modules/content-studio/service.test.ts` — grounded-generation regression coverage.
- `src/app/(app)/content-studio/actions.ts` — resolve knowledge before generation, persist provenance snapshots, keep safe action errors.
- `src/app/(app)/content-studio/actions.test.ts` — grounding/snapshot/auth regression tests.
- `src/app/(app)/content-studio/content-studio-form.tsx` — mount approved-knowledge selector and preserve ad hoc context separately.
- `src/app/(app)/content-studio/page.tsx` — load selectable ACTIVE records for eligible organization(s).
- `src/app/(app)/knowledge-base/page.tsx` — replace placeholder with real tenant-aware page.
- `tests/rls/foundation-rls.sql` — structural assertions for new RLS/integrity/immutability rules.
- `tests/e2e/content-studio.spec.ts` — approved-knowledge surface smoke coverage.
- `tests/e2e/knowledge-base.spec.ts` — Knowledge Base page smoke coverage.

---

### Task 1: Add Explicit Knowledge RBAC and Validation Contracts

**Files:**
- Modify: `src/modules/auth/roles.ts`
- Modify: `src/modules/auth/authorization.test.ts`
- Create: `src/modules/knowledge-base/types.ts`
- Create: `src/modules/knowledge-base/schema.ts`
- Create: `src/modules/knowledge-base/schema.test.ts`
- Modify: `src/modules/content-studio/schema.ts`
- Modify: `src/modules/content-studio/schema.test.ts`

**Interfaces:**

Produces these permissions:

```ts
"knowledge:view"
"knowledge:manage"
"knowledge:delete"
```

Role mapping:

```ts
OWNER: view + manage + delete
ADMIN: view + manage + delete
EDITOR: view + manage
REVIEWER: view
ANALYST: view
```

Domain types:

```ts
export type KnowledgeStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type KnowledgeSourceType = "MANUAL" | "DOCUMENT" | "URL";

export type KnowledgeRecord = {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  status: KnowledgeStatus;
  sourceType: KnowledgeSourceType;
  sourceLabel?: string;
  sourceReference?: string;
  revision: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};
```

Request schemas:

```ts
export const createKnowledgeRecordSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(1).max(50000),
  sourceType: z.enum(["MANUAL", "DOCUMENT", "URL"]),
  sourceLabel: z.string().trim().max(300).optional(),
  sourceReference: z.string().trim().max(2000).optional(),
});

export const updateKnowledgeRecordSchema = createKnowledgeRecordSchema.extend({
  id: z.string().uuid(),
  expectedRevision: z.number().int().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
});
```

Extend `contentGenerationRequestSchema` with:

```ts
knowledgeRecordIds: z.array(z.string().uuid()).max(20).refine(
  (ids) => new Set(ids).size === ids.length,
  "Knowledge record IDs must be unique",
).optional(),
```

- [ ] **Step 1: Write failing RBAC and schema tests**

Cover exact role mappings, allowed lifecycle/source values, invalid source/status rejection, invalid UUIDs, duplicate selected IDs, and >20 selected IDs.

- [ ] **Step 2: Run RED tests**

Run:

```bash
npm run test:run -- src/modules/auth/authorization.test.ts src/modules/knowledge-base/schema.test.ts src/modules/content-studio/schema.test.ts
```

Expected: FAIL because Knowledge Base permissions/types/schemas do not yet exist and Content Studio does not accept selected IDs.

- [ ] **Step 3: Implement minimal RBAC/types/schemas**

Keep the existing role names unchanged. Do not add approval permissions or semantic-search fields.

- [ ] **Step 4: Run targeted tests, typecheck, lint**

```bash
npm run test:run -- src/modules/auth/authorization.test.ts src/modules/knowledge-base/schema.test.ts src/modules/content-studio/schema.test.ts
npm run typecheck
npm run lint
```

Expected: PASS with no new lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth/roles.ts src/modules/auth/authorization.test.ts src/modules/knowledge-base src/modules/content-studio/schema.ts src/modules/content-studio/schema.test.ts
git commit -m "feat: define Knowledge Base domain and permissions"
```

---

### Task 2: Add Knowledge and Provenance Database Schema with RLS

**Files:**
- Create: `supabase/migrations/202609090008_knowledge_base.sql`
- Modify: `tests/rls/foundation-rls.sql`

**Interfaces:**

Create `public.knowledge_records`:

```sql
create table if not exists public.knowledge_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  content text not null check (char_length(btrim(content)) between 1 and 50000),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','ARCHIVED')),
  source_type text not null check (source_type in ('MANUAL','DOCUMENT','URL')),
  source_label text,
  source_reference text,
  revision integer not null default 1 check (revision >= 1),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Create immutable `public.content_item_knowledge_sources`:

```sql
create table if not exists public.content_item_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  knowledge_record_id uuid references public.knowledge_records(id) on delete set null,
  knowledge_revision integer not null check (knowledge_revision >= 1),
  title_snapshot text not null,
  content_snapshot text not null,
  source_type_snapshot text not null check (source_type_snapshot in ('MANUAL','DOCUMENT','URL')),
  source_label_snapshot text,
  source_reference_snapshot text,
  created_at timestamptz not null default now(),
  unique (content_item_id, knowledge_record_id)
);
```

Required DB integrity:
- trigger enforces snapshot org == parent content item org;
- when `knowledge_record_id` is non-null, trigger enforces source record same organization;
- authenticated snapshot UPDATE policy does not exist;
- `knowledge_records` SELECT policy allows ACTIVE to same-org members, and allows DRAFT/ARCHIVED only when `has_org_role(... OWNER,ADMIN,EDITOR)`;
- INSERT/UPDATE knowledge: OWNER/ADMIN/EDITOR;
- DELETE knowledge: OWNER/ADMIN;
- snapshot SELECT: same-org members;
- snapshot INSERT: OWNER/ADMIN/EDITOR;
- no ordinary snapshot UPDATE policy;
- omit snapshot DELETE policy in this slice to preserve provenance.

- [ ] **Step 1: Extend the SQL structural harness first**

Add executable assertions for table existence, lifecycle/source CHECK constraints, knowledge policies, absence of snapshot UPDATE/DELETE policy, parent-org trigger, same-org source trigger behavior shape, and unique provenance constraint.

- [ ] **Step 2: Add migration**

Implement additive tables/indexes/functions/triggers/policies. Revoke trigger functions from `public` where appropriate. Do not alter or backfill `content_items.knowledge_context`.

- [ ] **Step 3: Review migration ordering**

Verify `202609090008_knowledge_base.sql` depends only on tables/functions created in earlier migrations (`organizations`, `content_items`, `is_org_member`, `has_org_role`).

- [ ] **Step 4: Run repository TypeScript verification**

```bash
npm run typecheck
npm run lint
npm run test:run
```

Expected: PASS. State explicitly that this does not execute the SQL migration against a live Supabase project.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609090008_knowledge_base.sql tests/rls/foundation-rls.sql
git commit -m "feat: add tenant-safe Knowledge Base persistence"
```

---

### Task 3: Implement Concurrency-Safe Knowledge Repository

**Files:**
- Create: `src/modules/knowledge-base/repository.ts`
- Create: `src/modules/knowledge-base/repository.test.ts`

**Interfaces:**

```ts
export type CreateKnowledgeInput = {
  organizationId: string;
  title: string;
  content: string;
  sourceType: KnowledgeSourceType;
  sourceLabel?: string;
  sourceReference?: string;
  actorUserId: string;
};

export type UpdateKnowledgeInput = {
  id: string;
  organizationId: string;
  expectedRevision: number;
  title: string;
  content: string;
  status: KnowledgeStatus;
  sourceType: KnowledgeSourceType;
  sourceLabel?: string;
  sourceReference?: string;
  actorUserId: string;
};

export interface KnowledgeRepository {
  listSelectable(organizationId: string): Promise<KnowledgeRecord[]>;
  listManageable(organizationId: string): Promise<KnowledgeRecord[]>;
  getByIds(organizationId: string, ids: string[]): Promise<KnowledgeRecord[]>;
  create(input: CreateKnowledgeInput): Promise<KnowledgeRecord>;
  update(input: UpdateKnowledgeInput): Promise<KnowledgeRecord>;
  archive(id: string, organizationId: string, expectedRevision: number, actorUserId: string): Promise<KnowledgeRecord>;
  delete(id: string, organizationId: string): Promise<void>;
}
```

CAS update requirements:

```ts
.update({
  ...patch,
  revision: expectedRevision + 1,
  updated_by: actorUserId,
  updated_at: now,
})
.eq("id", id)
.eq("organization_id", organizationId)
.eq("revision", expectedRevision)
.select(...)
.maybeSingle();
```

No returned row => `AppError("CONFLICT", "Knowledge record changed before the update completed.")`.

- [ ] **Step 1: Write failing repository tests**

Cover selectable returns ACTIVE only, manageable returns all tenant records, getByIds preserves tenant scope, create starts revision 1/DRAFT, successful update increments once, stale update conflicts, archive increments once, delete is scoped by id + organization.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/modules/knowledge-base/repository.test.ts
```

Expected: FAIL because repository does not exist.

- [ ] **Step 3: Implement injected persistence adapter + Supabase adapter**

Follow the existing artifact repository pattern: deterministic fakeable persistence boundary and one explicit `unknown -> row` mapping boundary.

- [ ] **Step 4: Run targeted tests/typecheck/lint**

```bash
npm run test:run -- src/modules/knowledge-base/repository.test.ts
npm run typecheck
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/knowledge-base/repository.ts src/modules/knowledge-base/repository.test.ts
git commit -m "feat: add concurrency-safe Knowledge Base repository"
```

---

### Task 4: Implement Deterministic Grounding Resolution

**Files:**
- Create: `src/modules/knowledge-base/grounding-service.ts`
- Create: `src/modules/knowledge-base/grounding-service.test.ts`

**Interfaces:**

```ts
export type ResolvedKnowledgeSource = {
  record: KnowledgeRecord;
  snapshot: {
    knowledgeRecordId: string;
    knowledgeRevision: number;
    titleSnapshot: string;
    contentSnapshot: string;
    sourceTypeSnapshot: KnowledgeSourceType;
    sourceLabelSnapshot?: string;
    sourceReferenceSnapshot?: string;
  };
};

export type ResolvedGrounding = {
  knowledgeContext?: string;
  sources: ResolvedKnowledgeSource[];
};

export async function resolveKnowledgeGrounding(
  input: {
    organizationId: string;
    knowledgeRecordIds?: string[];
    additionalContext?: string;
  },
  repository: Pick<KnowledgeRepository, "getByIds">,
): Promise<ResolvedGrounding>;
```

Deterministic composition:

```text
[Knowledge Source 1: <title>]
<content>

[Knowledge Source 2: <title>]
<content>

[Additional user-provided context]
<free-form context>
```

Record order must follow the submitted ID order even if database response order differs.

- [ ] **Step 1: Write failing grounding tests**

Cover no selected knowledge, selected-order preservation, ACTIVE-only requirement, missing/cross-org represented by incomplete `getByIds` result, DRAFT/ARCHIVED rejection, deterministic separators, additional-context labeling, snapshot exact revision/content, and no raw repository/provider errors leaking.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/modules/knowledge-base/grounding-service.test.ts
```

- [ ] **Step 3: Implement minimal resolver**

Reject whenever resolved row count differs from unique requested IDs or any row is not ACTIVE. Do not silently drop invalid selections.

- [ ] **Step 4: Run tests/typecheck**

```bash
npm run test:run -- src/modules/knowledge-base/grounding-service.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/knowledge-base/grounding-service.ts src/modules/knowledge-base/grounding-service.test.ts
git commit -m "feat: resolve deterministic approved knowledge grounding"
```

---

### Task 5: Add Immutable Provenance Snapshot Repository

**Files:**
- Create: `src/modules/knowledge-base/snapshot-repository.ts`
- Create: `src/modules/knowledge-base/snapshot-repository.test.ts`

**Interfaces:**

```ts
export type KnowledgeSnapshotInput = {
  organizationId: string;
  contentItemId: string;
  knowledgeRecordId: string;
  knowledgeRevision: number;
  titleSnapshot: string;
  contentSnapshot: string;
  sourceTypeSnapshot: KnowledgeSourceType;
  sourceLabelSnapshot?: string;
  sourceReferenceSnapshot?: string;
};

export interface KnowledgeSnapshotRepository {
  insertMany(inputs: KnowledgeSnapshotInput[]): Promise<void>;
}
```

Use idempotent conflict handling on `(content_item_id, knowledge_record_id)` and never update existing snapshot rows.

- [ ] **Step 1: Write failing snapshot tests**

Cover exact snapshot mapping, zero-source no-op, insertion order independence, duplicate retry idempotency, and no update/overwrite path in the interface.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/modules/knowledge-base/snapshot-repository.test.ts
```

- [ ] **Step 3: Implement repository**

Supabase insert uses snapshot values from the already resolved grounding result, not freshly reloaded knowledge records.

- [ ] **Step 4: Run tests/typecheck**

```bash
npm run test:run -- src/modules/knowledge-base/snapshot-repository.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/knowledge-base/snapshot-repository.ts src/modules/knowledge-base/snapshot-repository.test.ts
git commit -m "feat: persist immutable knowledge provenance snapshots"
```

---

### Task 6: Integrate Grounding and Provenance into Content Generation

**Files:**
- Modify: `src/modules/content-studio/service.ts`
- Modify: `src/modules/content-studio/service.test.ts`
- Modify: `src/app/(app)/content-studio/actions.ts`
- Modify: `src/app/(app)/content-studio/actions.test.ts`

**Interfaces:**

Keep `generateContentScript()` provider-neutral. The action resolves grounding before invoking it and passes a request whose `knowledgeContext` is the deterministic resolved context.

Add action dependencies equivalent to:

```ts
export type GenerateContentActionDependencies = {
  getActor(): Promise<Actor | null>;
  getMembership(actorId: string, organizationId: string): Promise<Membership>;
  resolveGrounding(input: {
    organizationId: string;
    knowledgeRecordIds?: string[];
    additionalContext?: string;
  }): Promise<ResolvedGrounding>;
  generate(request: ContentGenerationRequest, actorUserId: string): Promise<ContentItem>;
  persistSnapshots(contentItemId: string, organizationId: string, grounding: ResolvedGrounding): Promise<void>;
  ensureSource(item: ContentItem, actorUserId: string): Promise<ScriptArtifact>;
};
```

Authoritative sequence:

1. validate request;
2. authenticate;
3. membership/role authorize;
4. resolve selected ACTIVE knowledge server-side;
5. call generation using resolved deterministic context;
6. persist immutable snapshots using the exact resolved source values;
7. create/return canonical script artifact;
8. return success only after snapshot + artifact persistence succeed.

Recovery rule: if snapshot persistence fails after provider generation, return a normalized action failure and do not return the generated item/artifact as successful. Keep the generated content row for operational recovery; do not make a second provider call automatically.

- [ ] **Step 1: Write failing action/service tests**

Cover selected IDs resolved before provider call, provider receives deterministic Knowledge Base context, invalid/stale selection prevents generation, no selected knowledge preserves existing free-form behavior, snapshot persistence receives exact resolved revisions/text, snapshot failure returns safe error and does not call `ensureSource`, provider secrets do not leak, existing role authorization remains intact.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/\(app\)/content-studio/actions.test.ts src/modules/content-studio/service.test.ts
```

- [ ] **Step 3: Implement minimal integration**

Do not let the browser supply selected record text. Do not re-resolve records after generation for snapshot values.

- [ ] **Step 4: Run focused and regression tests**

```bash
npm run test:run -- src/app/\(app\)/content-studio/actions.test.ts src/modules/content-studio/service.test.ts src/modules/content-studio/artifacts/source-service.test.ts src/modules/content-studio/artifacts/translation-service.test.ts
npm run typecheck
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/content-studio/service.ts src/modules/content-studio/service.test.ts src/app/\(app\)/content-studio/actions.ts src/app/\(app\)/content-studio/actions.test.ts
git commit -m "feat: ground Content Studio with approved knowledge"
```

---

### Task 7: Add Authenticated Knowledge Management Actions

**Files:**
- Create: `src/app/(app)/knowledge-base/actions.ts`
- Create: `src/app/(app)/knowledge-base/actions.test.ts`

**Interfaces:**

Action results:

```ts
export type KnowledgeActionResult =
  | { ok: true; record: KnowledgeRecord }
  | { ok: false; error: string };
```

Actions:

```ts
export async function createKnowledgeAction(input: unknown): Promise<KnowledgeActionResult>;
export async function updateKnowledgeAction(input: unknown): Promise<KnowledgeActionResult>;
export async function archiveKnowledgeAction(input: unknown): Promise<KnowledgeActionResult>;
export async function deleteKnowledgeAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }>;
```

Use `can(role, "knowledge:manage")` / `can(role, "knowledge:delete")` after same-org membership resolution. Do not duplicate raw role arrays in action logic.

- [ ] **Step 1: Write failing action tests**

Cover unauthenticated, invalid input, cross-org/no-membership, OWNER/ADMIN/EDITOR manage success, REVIEWER/ANALYST mutation rejection, OWNER/ADMIN delete success, EDITOR delete rejection, CAS conflict safe message, raw Supabase error sanitization.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/\(app\)/knowledge-base/actions.test.ts
```

- [ ] **Step 3: Implement actions using repository**

Keep all secrets/server clients in server-only modules. Return small serializable result objects only.

- [ ] **Step 4: Run tests/typecheck/lint**

```bash
npm run test:run -- src/app/\(app\)/knowledge-base/actions.test.ts
npm run typecheck
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/knowledge-base/actions.ts src/app/\(app\)/knowledge-base/actions.test.ts
git commit -m "feat: add authenticated Knowledge Base actions"
```

---

### Task 8: Build Knowledge Base Management UI

**Files:**
- Modify: `src/app/(app)/knowledge-base/page.tsx`
- Create: `src/app/(app)/knowledge-base/knowledge-base-manager.tsx`
- Create: `src/app/(app)/knowledge-base/knowledge-base-manager.test.tsx`

**Interfaces:**

Server page resolves authenticated user's manageable organization memberships and loads records through `KnowledgeRepository.listManageable()` only for OWNER/ADMIN/EDITOR. REVIEWER/ANALYST receive a read-only ACTIVE list or selection-oriented informational view; they do not receive DRAFT/ARCHIVED management data.

Manager UI includes:
- organization selection when multiple eligible orgs exist;
- record list;
- title/content/source type/source label/source reference;
- status/revision/updated timestamp;
- create/edit;
- activate/archive via update action;
- delete only when `knowledge:delete` is granted;
- visible safe error state;
- plain textarea, no rich-text editor.

- [ ] **Step 1: Write failing component tests**

Cover render records/status/revision, create form, editor may manage but no delete, owner/admin delete control, reviewer/analyst read-only ACTIVE view, edit carries `expectedRevision`, action errors display safely.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/\(app\)/knowledge-base/knowledge-base-manager.test.tsx
```

- [ ] **Step 3: Implement page + manager**

Follow current Content Studio styling conventions; no provider/model controls and no semantic search UI.

- [ ] **Step 4: Run component/type/lint checks**

```bash
npm run test:run -- src/app/\(app\)/knowledge-base/knowledge-base-manager.test.tsx
npm run typecheck
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/knowledge-base/page.tsx src/app/\(app\)/knowledge-base/knowledge-base-manager.tsx src/app/\(app\)/knowledge-base/knowledge-base-manager.test.tsx
git commit -m "feat: add Knowledge Base management workspace"
```

---

### Task 9: Add Approved-Knowledge Selection to Content Studio UI

**Files:**
- Create: `src/app/(app)/content-studio/knowledge-selector.tsx`
- Create: `src/app/(app)/content-studio/knowledge-selector.test.tsx`
- Modify: `src/app/(app)/content-studio/content-studio-form.tsx`
- Modify: `src/app/(app)/content-studio/page.tsx`

**Interfaces:**

```ts
export type SelectableKnowledgeRecord = {
  id: string;
  title: string;
  sourceType: KnowledgeSourceType;
  sourceLabel?: string;
  revision: number;
};
```

`KnowledgeSelector` props:

```ts
{
  records: SelectableKnowledgeRecord[];
  selectedIds: string[];
  onChange(ids: string[]): void;
  disabled?: boolean;
}
```

UI requirements:
- shows ACTIVE records only;
- maximum 20 selected;
- selected count visible;
- organization change clears selection before new-org options are used;
- existing `knowledgeContext` textarea relabeled as `Additional context` and remains optional;
- request submits only selected IDs + additional context, never selected record contents.

- [ ] **Step 1: Write failing selector/form tests**

Cover selection toggle, max-20 enforcement, selected count, org change clearing, no record text in submitted action payload, additional-context coexistence, empty selectable state.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- src/app/\(app\)/content-studio/knowledge-selector.test.tsx
```

- [ ] **Step 3: Implement selector and wire form/page**

Page loads selectable ACTIVE records server-side through repository. Keep `export const dynamic = "force-dynamic"` on Content Studio.

- [ ] **Step 4: Run component + Content Studio regressions**

```bash
npm run test:run -- src/app/\(app\)/content-studio/knowledge-selector.test.tsx src/app/\(app\)/content-studio/multilingual-content-panel.test.tsx src/app/\(app\)/content-studio/actions.test.ts
npm run typecheck
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/content-studio/knowledge-selector.tsx src/app/\(app\)/content-studio/knowledge-selector.test.tsx src/app/\(app\)/content-studio/content-studio-form.tsx src/app/\(app\)/content-studio/page.tsx
git commit -m "feat: select approved knowledge in Content Studio"
```

---

### Task 10: Deterministic E2E and Final Integration Review

**Files:**
- Modify: `tests/e2e/content-studio.spec.ts`
- Create: `tests/e2e/knowledge-base.spec.ts`
- Review: all files changed from `main`
- Modify `.github/workflows/ci.yml` only if current fake-provider environment needs no-secret test variables; do not add real secrets.

**E2E boundaries:**
- Knowledge Base route renders the management/read surface without live external providers.
- Content Studio renders `Approved knowledge` selection surface and separate `Additional context` field.
- Pre-generation multilingual behavior remains intact.
- CI continues `AI_TEXT_PROVIDER=fake` and does not add `OPENAI_API_KEY`.
- Do not bypass auth/RLS merely to make E2E convenient.

- [ ] **Step 1: Add/adjust E2E tests**

Use current deterministic smoke conventions. Do not attempt a live Supabase knowledge mutation unless CI is explicitly provisioned with a dedicated test database in a future slice.

- [ ] **Step 2: Run full verification**

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npx playwright install chromium
npm run test:e2e
```

Expected: all commands exit 0 on the exact feature head.

- [ ] **Step 3: Security/tenancy review**

Verify line-by-line:
- client submits IDs, not trusted knowledge text;
- server reloads selected records by organization;
- only ACTIVE records ground generation;
- snapshots use exact resolved values;
- snapshot UPDATE/DELETE policies are absent;
- management actions use explicit knowledge permissions;
- CAS revision filters include `id + organization_id + revision`;
- no service-role/OpenAI secret appears in client code or CI;
- no Aurexis/Lovable references/configuration introduced.

- [ ] **Step 4: Migration review**

Verify additive migration, trigger/policy names, ordering, unique constraints, and that historical `knowledge_context` is untouched. Record explicitly in PR body that live Supabase migration execution remains unverified unless actually performed.

- [ ] **Step 5: Open draft PR**

Title:

```text
feat: add Knowledge Base grounding foundation
```

PR body must summarize:
- tenant-safe structured knowledge;
- deterministic Content Studio grounding;
- immutable generation provenance;
- CAS revision safety;
- explicit RBAC/RLS;
- fake-provider verification;
- live migration caveat;
- embeddings/RAG explicitly deferred.

- [ ] **Step 6: Verify PR-triggered CI**

Do not mark ready/merge until the PR-triggered workflow is green on the unchanged head and no unresolved blocking review threads remain.
