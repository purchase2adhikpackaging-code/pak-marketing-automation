# PAK Marketing Automation — Approved Design Specification

Date: 2026-09-09
Status: Approved architecture checkpoint
Project: PAK Marketing Automation
Repository: `purchase2adhikpackaging-code/pak-marketing-automation`
Branch: `feat/platform-foundation`

## 1. Project Boundary

PAK Marketing Automation is a completely separate system from Aurexis. It must not depend on, modify, consume credits from, or share runtime configuration with Aurexis, Lovable, or any Lovable-attached Supabase project.

PAK uses its own dedicated Supabase project and its own application, infrastructure, secrets, workers, storage, and deployment configuration.

## 2. Approved Technology Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Strict Row Level Security
- Role-Based Access Control
- Organization isolation
- Server-only secrets
- Persistent Postgres-backed job orchestration
- OpenAI for scripting and reasoning
- Self-hosted LTX as the primary video generation provider
- FFmpeg for composition and rendering
- External GPU workers for video generation workloads
- Provider abstraction for model/provider portability

## 3. Approved Product Modules

The platform consists of the following modules:

1. Dashboard
2. Content Studio
3. AI Representative
4. Campus / Locations
5. Podcast
6. Manual Generation
7. Student Testimonials
8. Media Library
9. Knowledge Base
10. Content Calendar
11. Approval Center
12. Publishing
13. Analytics
14. Settings

These modules share a common organization, user, media, job, approval, publishing, and analytics foundation.

## 4. Core Content Pipeline

The approved end-to-end pipeline is:

Scheduler → Topic → Knowledge → Script → EN/PL/HI → Scene Plan → LTX Generation → FFmpeg → QA → Approval → Schedule → Meta Publish → Analytics

Each stage must be persisted and independently observable. A later stage must not be treated as completed when an upstream dependency is incomplete or failed.

## 5. Job Orchestration

Canonical job states:

`QUEUED → PROCESSING → COMPLETED`

Exceptional / lifecycle states:

- `FAILED`
- `RETRYING`
- `CANCELLED`

Job orchestration must be persistent in Postgres rather than relying on ephemeral in-memory queues.

Each job record must support, at minimum:

- organization ownership
- job type
- entity/resource reference
- canonical state
- attempt count
- retry policy metadata
- worker lease / claim metadata
- input payload
- result payload
- failure metadata
- timestamps
- idempotency key where applicable
- parent/child relationship where applicable

Workers must claim work safely and avoid duplicate processing through transactional leasing or equivalent concurrency-safe semantics.

## 6. Video Architecture

Videos of approximately 90–180 seconds are decomposed into independent scenes.

Persisted scene data must include:

- scene order
- scene script
- visual prompt
- duration target
- aspect ratio / render target
- continuity metadata
- generation provider
- generation model/configuration
- generation state
- retry count
- provider output reference
- QA state
- failure metadata

Scene generation is independent and retryable. A failed scene must not force successful scenes to be regenerated unless continuity or upstream script changes explicitly invalidate them.

Final FFmpeg composition occurs only after all required scenes reach a valid successful state.

## 7. Continuity Model

Continuity must be explicit rather than inferred only from prompt history.

Continuity metadata can include:

- recurring character identity descriptors
- clothing / visual identity
- campus/location identity
- visual palette
- lighting
- camera language
- temporal setting
- object continuity
- preceding-scene context
- desired transition type

This metadata is stored and supplied to generation providers through a provider-neutral scene generation contract.

## 8. Provider Abstraction

Video generation must not be hard-coded directly into product modules.

Define a provider contract with operations equivalent to:

- validate configuration
- submit generation
- retrieve status
- retrieve result
- cancel if supported
- normalize provider errors

LTX is the primary provider but the architecture must permit future provider implementations without rewriting Content Studio, scheduler, jobs, or scene persistence.

Provider credentials and secrets must remain server-side only.

## 9. External GPU Worker Boundary

GPU workers are external execution nodes and are not trusted as unrestricted database clients.

Workers must receive narrowly scoped tasks and operate through controlled server interfaces or restricted database functions/credentials consistent with least privilege.

Workers must not receive browser-exposed service-role credentials or unrestricted tenant access.

## 10. Organization Isolation

All tenant-owned business records must carry an organization identifier or be unambiguously reachable through a tenant-owned parent.

Tenant isolation must be enforced in the database through RLS, not solely in the UI or application code.

Cross-organization access must fail by default.

Service operations that legitimately cross tenant boundaries must be narrowly defined and server-only.

## 11. Authentication and Authorization

Supabase Auth provides identity.

Application authorization uses explicit membership and role records.

Authorization decisions must distinguish:

- authenticated identity
- organization membership
- role
- resource ownership/scope
- workflow permission

RBAC must be enforced consistently in UI guards, server actions/routes, and database RLS/RPC boundaries.

The database remains the final enforcement boundary for tenant data access.

## 12. Approval Workflow

Generated content must not publish automatically unless its workflow configuration explicitly permits it.

The Approval Center tracks reviewable assets such as:

- scripts
- translations
- scenes
- rendered videos
- captions / publishing copy

Approval records must preserve reviewer identity, decision, comments/reason, and timestamps.

Material upstream edits after approval must invalidate affected downstream approvals when necessary.

## 13. Scheduling and Publishing

Publishing is a downstream workflow, not a side effect of generation.

Scheduling records must reference approved publishable content and track:

- target channel
- scheduled time
- publish state
- provider/platform identifier
- publish attempts
- normalized errors
- resulting external post identifier/URL when available

Meta publishing adapters must remain separated from the content-generation pipeline.

## 14. Analytics

Analytics must link platform outcomes back to internally generated content.

The model should support normalized metrics while preserving raw provider payloads where useful for traceability.

Analytics ingestion must be independently retryable and must not mutate historical publishing or generation records destructively.

## 15. Media Library

The Media Library is the canonical catalog for reusable and generated media assets.

Metadata should include:

- organization
- asset type
- storage reference
- source/origin
- MIME type
- dimensions/duration where relevant
- checksum or deduplication metadata where useful
- linkage to generating job/scene/content item
- status
- created/updated timestamps

Supabase Storage paths and policies must respect organization isolation.

## 16. Knowledge Base

The Knowledge Base supplies trusted PAK context to scripting/reasoning flows.

Knowledge records must support provenance and lifecycle metadata so AI-generated content can be traced to approved source material.

Retrieval logic must remain organization-aware and should expose a stable interface to content-generation services rather than coupling prompts directly to database schema.

## 17. Internationalization

The approved initial language workflow is:

- English
- Polish
- Hindi

The canonical source script and translations must be modeled as related but distinct artifacts. Translation state, review state, and regeneration must be independently trackable.

## 18. Observability

The system must expose enough structured telemetry to diagnose failures across scheduler, AI generation, scene generation, workers, FFmpeg rendering, publishing, and analytics.

At minimum, important workflow records should preserve correlation identifiers and structured error metadata.

Secrets and sensitive payloads must be redacted from logs.

## 19. Security Requirements

Mandatory controls include:

- strict RLS
- organization isolation
- least-privilege server operations
- server-only provider/API secrets
- input validation at trust boundaries
- safe file type/size validation
- protected storage policies
- idempotency for externally visible side effects
- explicit authorization for administrative operations
- auditability of approvals and high-impact actions

No architecture decision may rely on obscurity or frontend-only authorization.

## 20. Reliability and Retry Semantics

Retries must be deliberate and observable.

Retryable failures must transition through `RETRYING` and preserve attempt history or sufficient metadata to diagnose repeated failure.

Irrecoverable validation or policy failures should fail deterministically rather than repeatedly consuming GPU/API resources.

External side effects such as publishing require idempotency protection to prevent duplicate posts.

## 21. Application Structure Principles

The implementation should use clear bounded modules rather than a monolithic service layer.

Expected architectural boundaries include:

- web application / presentation
- auth and organization access
- domain services
- job orchestration
- AI scripting
- translation
- scene planning
- video provider abstraction
- rendering
- media
- approvals
- scheduling/publishing
- analytics
- shared validation/types

Module interfaces should be narrow enough that provider implementations, rendering implementation details, or UI components can evolve without forcing unrelated domain rewrites.

## 22. Database Migration Policy

Database schema changes must be committed as migrations.

Migrations must be reviewable, reproducible, and safe for a dedicated PAK Supabase environment.

RLS and policy changes are part of the migration and must not be treated as an afterthought.

## 23. Testing Strategy

Implementation must include layered verification:

- static type checking
- linting
- unit tests for domain rules and state transitions
- integration tests for persistence, RLS-sensitive operations, and job semantics where practical
- E2E verification for critical user workflows
- worker/provider contract tests with mocks/fakes where live GPU execution is not appropriate

Critical state transitions and tenant isolation require explicit tests.

## 24. Delivery Governance

The governed engineering workflow is:

Supervisor / Orchestrator → Architecture → Planning → Coding → Typecheck/Test → E2E Verification → Integration/Release

The Supervisor owns scope control and completion readiness.

No single-role implementation is considered sufficient for release readiness.

## 25. Git Governance

Branch-first development is mandatory.

- Never implement directly on `main`.
- Foundation work begins on `feat/platform-foundation`.
- Changes must be verified before merge.
- Implementation should be delivered through reviewed commits / pull request workflow.

## 26. Foundation Implementation Scope

The first implementation phase should establish the platform foundation rather than attempting all business modules at once.

Foundation scope includes:

- Next.js + TypeScript + Tailwind application scaffold
- environment validation
- Supabase browser/server client boundaries
- organization and membership domain
- RBAC primitives
- initial tenant-safe schema and RLS migrations
- persistent job model and state machine primitives
- provider contracts
- media/storage domain primitives
- structured logging/error conventions
- test harness
- CI baseline
- module shell/navigation sufficient to support subsequent vertical slices

Business modules will then be implemented as vertical slices on top of this foundation.

## 27. Explicit Non-Goals for Foundation

The foundation phase does not require production-complete implementation of every module or live GPU video generation.

It should not introduce unnecessary microservices, message brokers, or infrastructure that Postgres-backed orchestration and external workers do not yet require.

It must not share Aurexis infrastructure or credentials.

## 28. Completion Criteria for Foundation Design

The foundation architecture is considered correctly represented when:

1. tenant boundaries are explicit and database-enforced;
2. auth and RBAC boundaries are defined;
3. durable job semantics are represented;
4. video/scene/provider contracts support retries and continuity;
5. server-only secret boundaries are preserved;
6. module boundaries match the approved product scope;
7. testing and observability requirements are included;
8. Git and engineering governance are explicit;
9. the design remains independent from Aurexis/Lovable;
10. implementation can proceed through a concrete engineering plan without reopening architecture.
