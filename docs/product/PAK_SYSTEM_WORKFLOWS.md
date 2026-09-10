# PAK Marketing Automation — System Workflow & State Machine Specification

**Document ID:** PAK-WF-001  
**Version:** 1.0  
**Status:** Baseline for review

## 1. Knowledge lifecycle

`DRAFT → ACTIVE → ARCHIVED → ACTIVE`

Delete is OWNER/ADMIN only and is not a normal lifecycle transition.

Rules:
- DRAFT is editable but not eligible for grounding.
- ACTIVE is eligible for Content Studio selection.
- ARCHIVED is retained for history but excluded from new grounding.
- Every successful lifecycle transition increments revision exactly once.
- Stale revision writes fail rather than silently overwriting.

## 2. Grounded canonical generation

1. User opens Content Studio.
2. Server resolves eligible organizations.
3. User selects topic, canonical language, up to 20 ACTIVE Knowledge record IDs, optional Additional context.
4. Server validates input.
5. Server resolves authenticated actor and organization membership/role.
6. Server reloads selected Knowledge records under the authenticated tenant context.
7. Server rejects missing/cross-org/non-ACTIVE records.
8. Server composes deterministic grounding context and rejects >12,000 characters.
9. Content item enters generation workflow.
10. Text provider generates canonical script.
11. Content item stores generated result/provider metadata.
12. Trusted server path writes exact immutable Knowledge snapshots.
13. If snapshot persistence fails, item is transitioned to FAILED with provenance failure code; source artifact is not created.
14. If snapshots succeed, canonical source artifact is ensured.
15. UI returns canonical artifact and traceability metadata.

## 3. Canonical regeneration

`GENERATED source revision N → GENERATING → GENERATED revision N+1`

On successful source regeneration:
- same source artifact row is updated;
- revision increments;
- translations whose `source_revision < new source revision` become STALE;
- previous successful text should remain recoverable during failed attempts according to artifact persistence semantics.

## 4. Translation workflow

Preconditions:
- source artifact exists;
- source status is GENERATED;
- source script nonempty;
- target language differs from source;
- target is EN, PL or HI.

State:
`PENDING/STALE/FAILED → GENERATING → GENERATED`

On success:
- target artifact revision increments or initializes;
- `source_revision` equals canonical revision used;
- provider/model metadata recorded.

On provider failure:
- target becomes FAILED or preserves last good text with explicit failed-current-attempt semantics defined by repository contract;
- source artifact remains unchanged.

## 5. Manual content workflow

`DRAFT → EDITED → REVIEW ELIGIBLE`

Manual content bypasses AI provider calls but produces the same content/artifact entities required by Approval and Publishing.

## 6. Scene planning workflow

Precondition: eligible generated/manual script artifact.

1. User selects artifact/revision.
2. Scene planner derives ordered scene plan.
3. User may edit visual direction/duration.
4. Scene plan locks or records revision used when scene generation starts.
5. Each required scene independently enters generation state.

Scene state baseline:
`PLANNED → QUEUED → GENERATING → GENERATED | FAILED | CANCELLED`

A regenerated source script must mark dependent scene plans STALE or require explicit regeneration when their source revision no longer matches.

## 7. Video generation workflow

For each required scene:
1. create durable job with stable idempotency key;
2. worker claims job;
3. provider-neutral video adapter submits generation;
4. provider job/reference is stored;
5. polling/webhook reconciliation updates state;
6. media asset stored/linked on success;
7. transient failure → RETRYING according to policy;
8. terminal failure → FAILED.

Final assembly preconditions:
- at least one required scene exists;
- every required scene is GENERATED;
- required QA/readiness conditions pass.

Final render:
`QUEUED → PROCESSING → COMPLETED | RETRYING | FAILED | CANCELLED`

## 8. Approval workflow

Baseline review states:
`PENDING → APPROVED | CHANGES_REQUESTED | REJECTED`

Rules:
- Approval references exact content/artifact revision.
- Request Changes and Reject require comment.
- Approval events are immutable.
- Substantive content revision after approval marks the previous approval SUPERSEDED/invalid for publishing.
- Publishing policy checks current approval eligibility.

## 9. Publishing workflow

Preconditions:
- content/artifact revision eligible for target channel;
- required approval satisfied;
- integration connection CONFIGURED and valid enough to attempt;
- publication target active.

Flow:
1. User chooses target and publish-now/schedule.
2. Server validates membership and publishing permission.
3. Server resolves integration credentials from vault.
4. Durable publish job is created with idempotency key.
5. Worker/provider adapter publishes.
6. External publication ID/reference is persisted.
7. Success marks attempt completed.
8. Transient failure may retry safely without duplicate external post.
9. Terminal failure records normalized error and exposes retry/manual remediation.

## 10. Content Calendar workflow

Calendar is a projection of authoritative scheduled publication state.

- Create schedule → publication attempt/plan receives future time + timezone.
- Reschedule → authoritative schedule is updated with audit metadata.
- Cancel → scheduled publication becomes cancelled, not silently deleted if audit history matters.

## 11. Integration credential workflow

### Configure
1. OWNER/ADMIN opens Settings → Integrations.
2. User enters provider-specific secret(s) and non-secret identifiers.
3. Browser sends secret once over TLS to server action/API.
4. Server validates actor/role/org.
5. Server encrypts secret or stores via approved vault primitive.
6. Raw secret is not returned.
7. Metadata status becomes CONFIGURED.
8. Audit event CREATED/SECRET_REPLACED stored.
9. Optional connection test runs server-side.

### Replace
- write new encrypted secret version;
- update masked hint only if safe;
- invalidate provider client cache;
- record immutable audit event.

### Remove
- explicit confirmation;
- encrypted secret removed/rendered unusable;
- connection status becomes NOT_CONFIGURED/DISABLED;
- affected jobs fail safely before provider invocation;
- audit event recorded.

### Test connection
- decrypt/resolve secret server-side;
- call minimal provider validation endpoint;
- persist only normalized result/verified timestamp;
- never echo provider token/key.

## 12. OpenAI runtime workflow

1. Content Studio resolves organization.
2. Integration service requests active OPENAI connection.
3. Server decrypts API key in server-only memory.
4. OpenAI provider client is instantiated/cached by organization + secret version where safe.
5. Generation request is sent.
6. Response is normalized into provider-neutral result.
7. Key is never persisted into content records/logs/client output.

## 13. Meta publishing/integration workflow

1. OWNER/ADMIN configures Meta credentials/identifiers.
2. Server validates/token-tests where feasible.
3. Page/IG/WhatsApp targets are stored as non-secret target metadata.
4. Publish job resolves target + credential at execution time.
5. Provider response ID/status is normalized.
6. Webhooks validate signatures and reconcile delivery/status/metrics.
7. Token expiry/revocation marks connection INVALID and blocks new attempts until remediated.

## 14. Analytics synchronization

1. Scheduler/manual sync creates metric sync job.
2. Job resolves active provider connection.
3. Pulls metrics for bounded time window/watermark.
4. Normalizes provider metrics.
5. Upserts unique metric grain.
6. Advances watermark only after successful durable persistence.
7. UI exposes last sync/freshness/error state.

## 15. Durable job retry model

- Validation/auth/permission failures: no retry.
- Provider 4xx credential/permission failure: terminal + integration health may become INVALID.
- Provider 429/rate limit: RETRYING with bounded backoff.
- Transient 5xx/network timeout: RETRYING with bounded attempts.
- Idempotency conflict/known completed external reference: reconcile rather than duplicate.
- Maximum attempts are job-type configuration, not uncontrolled infinite retry.

## 16. Global failure rule

No workflow may report a successful terminal state if a mandatory downstream integrity step failed. Where side effects already occurred, the system must persist a recoverable failure/reconciliation state rather than lying about success.