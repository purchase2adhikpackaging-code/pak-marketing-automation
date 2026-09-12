# Organization Profile, Brand Kit & Knowledge Ingestion Design

**Status:** Approved for implementation
**Date:** 2026-09-12

## 1. Goal

Create one authoritative organization identity and grounding layer for PAK so every relevant generation workflow automatically receives the correct institutional identity, official brand rules/assets, and approved evergreen knowledge without requiring operators to re-enter or re-select them for every task.

This slice extends the existing organization, Media Library, Knowledge Base, Content Studio, Scene Planning and provenance architecture. It does not introduce a parallel asset store or a second knowledge system.

## 2. Locked Product Decisions

- Organization Profile + Brand Kit are automatically applied to every relevant generation.
- Uploaded knowledge documents never auto-activate. Extraction produces DRAFT knowledge that requires human review and explicit activation.
- ACTIVE records may be marked `Core Knowledge / Always Apply`; those records are injected automatically into generation.
- Normal ACTIVE Knowledge remains user-selectable.
- Brand Kit manages official brand assets in the UI, while Media Library/private Supabase Storage remains the binary source of truth.
- Initial document ingestion formats: PDF, DOCX, PPTX, TXT and URL.
- Spreadsheet ingestion and OCR are intentionally out of scope for this slice.

## 3. Architecture

### 3.1 Organization Profile

Add one organization-scoped profile row per organization containing authoritative institutional metadata:

- official name
- short name
- boilerplate/about text
- postal address
- primary email and phone
- website
- social links
- default language
- timezone
- legal/institution identifiers
- revision, audit actor and timestamps

OWNER/ADMIN may edit. Other organization roles may read.

### 3.2 Brand Kit

Add one active organization-scoped Brand Kit containing:

- primary, secondary and accent colors
- typography rules
- brand voice/tone
- logo treatment/usage rules
- additional visual constraints
- references to Media Library asset IDs for primary/light/dark logos, brand mark and favicon
- approved imagery references
- revision, audit actor and timestamps

Official brand asset assignments are OWNER/ADMIN only. EDITOR may continue uploading ordinary assets through Media Library but may not declare them authoritative brand assets.

All referenced media must belong to the same organization and must remain ACTIVE. Brand Kit stores only stable media IDs, never signed URLs or raw object paths.

### 3.3 Knowledge Base Extension

Extend `knowledge_records` with:

- `is_core boolean not null default false`
- optional `knowledge_document_id`

Only OWNER/ADMIN may toggle `is_core`. `ACTIVE + is_core=true` is automatically included in generation. DRAFT/ARCHIVED records never participate in new generation.

Existing revision, tenant isolation and immutable generation-time provenance semantics remain authoritative.

### 3.4 Knowledge Documents

Add `knowledge_documents` to represent uploaded or URL-backed source documents.

Fields include:

- organization_id
- source_type: FILE | URL
- source_format: PDF | DOCX | PPTX | TXT | URL
- display_name
- media_asset_id for uploaded files
- source_url for URL ingestion
- checksum/source fingerprint
- extraction_status: PENDING | PROCESSING | EXTRACTED | FAILED
- extracted_text
- extraction metadata/error summary
- revision
- created_by/updated_by/timestamps

Actual uploaded files are stored through existing Media Library/private storage boundaries. `knowledge_documents` never duplicates binary bytes.

### 3.5 Document Ingestion Lifecycle

File flow:

1. operator uploads a supported source through Knowledge Base;
2. upload uses the existing private Media Library upload boundary and creates a DOCUMENT media asset;
3. `knowledge_documents` records the authoritative source asset and extraction state;
4. server-side extraction validates MIME, size and source identity;
5. extraction produces sanitized plain text;
6. system creates or links a DRAFT `knowledge_record`;
7. operator reviews/edits;
8. explicit activation makes it eligible for grounding.

URL flow:

1. operator submits URL;
2. server fetches through an SSRF-safe ingestion boundary;
3. redirects, private/local network destinations and unsupported/oversized responses are rejected;
4. safe textual content is extracted/sanitized;
5. a DRAFT Knowledge record is created for review.

Re-ingesting a changed source advances source revision and creates a new DRAFT knowledge revision path. Historical generation provenance is never rewritten.

## 4. Automatic Context Resolver

Create one server-only organization generation-context resolver used by generation workflows.

Input:

```ts
{
  organizationId: string;
  selectedKnowledgeRecordIds?: string[];
  additionalContext?: string;
}
```

Output contains:

- Organization Profile snapshot + revision
- Brand Kit snapshot + revision and safe asset identities
- ACTIVE Core Knowledge records in deterministic order
- explicitly selected ACTIVE Knowledge records in requested order
- bounded additional context
- provenance descriptors suitable for immutable generation snapshots

The browser never supplies trusted profile, brand or knowledge text. It supplies organization ID, optional knowledge IDs and task context; the server resolves authoritative records.

Priority/order:

1. Organization Profile
2. Brand Kit
3. ACTIVE Core Knowledge
4. selected ACTIVE Knowledge
5. current task/project context

Duplicate knowledge IDs are deduplicated. Core records selected explicitly appear once. Cross-organization and non-ACTIVE records are rejected/ignored according to existing safe grounding conventions.

## 5. Generation Integration

### Content Studio

Replace its direct Knowledge-only grounding assembly with the shared organization context resolver. Existing selected Knowledge UI remains intact. Generated content provenance snapshots exact knowledge revisions plus profile/brand revisions used.

### Scene Planning

Scene Planning receives Brand Kit constraints and official brand asset identities automatically. Existing Visual Bible remains project/creative-direction authority; organization Brand Kit provides institutional defaults. Explicit project Visual Bible instructions may refine presentation but cannot silently replace official logo asset identity.

### Future image/video/final assembly/publishing

These modules consume the same resolver or persisted generation snapshot, avoiding repeated organization/brand prompting and allowing deterministic brand overlays later.

## 6. UI

### Settings → Organization Profile

Operational form for OWNER/ADMIN edit and read-only display for other roles.

### Settings → Brand Kit

Operational editor for colors, typography, voice and official asset assignments. Asset picker uses safe Media Library metadata and explicit assignment controls.

### Knowledge Base

Add:

- Core Knowledge indicator/toggle according to role
- Upload document action for PDF/DOCX/PPTX/TXT
- Add URL source action
- ingestion/extraction status
- DRAFT review affordance
- source/revision provenance

No document becomes ACTIVE automatically.

## 7. Security & Data Integrity

- All new tables use organization-scoped RLS.
- OWNER/ADMIN mutate Organization Profile and Brand Kit.
- Knowledge permissions preserve existing `knowledge:manage`; only OWNER/ADMIN can change `is_core`.
- Brand media references are verified same-org and ACTIVE server-side.
- Signed URLs are generated on demand and never persisted in profile/brand/knowledge rows.
- No service-role credential reaches browser or application code paths.
- URL ingestion blocks loopback, link-local, RFC1918/private ranges, cloud metadata endpoints and unsafe redirects.
- Extraction has strict file size/MIME limits and bounded text output.
- Raw parsing/extraction errors are never exposed to end users.

## 8. Versioning & Provenance

Profile and Brand Kit each carry monotonically increasing revision numbers. Material changes increment revision.

Generated artifacts store exact profile/brand revision identity used in generation in addition to the existing immutable knowledge source snapshots. Later profile/logo changes affect future generation only.

## 9. Non-Goals

- XLSX/CSV grounding
- OCR/image-to-text ingestion
- vector database/RAG search
- multiple named Brand Kits per organization
- automatic activation of extracted documents
- public brand asset bucket
- replacing Visual Bible with Brand Kit

## 10. Release Criteria

The slice is complete only when:

- Organization Profile and Brand Kit are operational and RLS-protected;
- official logo/assets are assignable from Media Library without path/signed-URL persistence;
- PDF/DOCX/PPTX/TXT and URL sources create reviewable DRAFT Knowledge;
- Core Knowledge automatically appears in server-side generation context;
- Content Studio uses the shared resolver and snapshots profile/brand/knowledge provenance;
- cross-org, role and unsafe-source tests pass;
- typecheck, lint, unit, production build and Playwright gates pass;
- live Supabase migrations and reversible security/data-flow probes pass;
- governing PRD/TRD/schema/UI/UX/roadmap/traceability docs are synchronized.