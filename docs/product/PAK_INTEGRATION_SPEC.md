# PAK Marketing Automation — Integration Specification

**Document ID:** PAK-INT-001  
**Version:** 1.1  
**Status:** Current baseline after Phase 7

## 1. Integration principles

- **INT-GEN-001** Provider-specific SDKs/payloads stay behind adapter interfaces.
- **INT-GEN-002** Organization provider secrets are server/Edge-resolved and organization-scoped.
- **INT-GEN-003** Browser clients never receive stored raw secrets.
- **INT-GEN-004** Integrations expose normalized health/status metadata.
- **INT-GEN-005** External side effects use idempotency/reconciliation wherever provider semantics allow.
- **INT-GEN-006** Provider errors are normalized and secrets redacted before persistence/UI.
- **INT-GEN-007** CI uses deterministic fakes; live provider calls are controlled verification only.
- **INT-GEN-008** Paid provider execution may not trust browser-submitted provider prompt/model/configuration when authoritative approved domain state exists.
- **INT-GEN-009** Ephemeral provider result URLs are transport-only and are not durable PAK media identity.

## 2. Integration Vault contract

Current provider connection model:

`integration_connections` → `integration_secrets.vault_secret_id` → Supabase Vault

with immutable `integration_audit_events`.

Provider states:

`NOT_CONFIGURED | CONFIGURED | INVALID | DISABLED`

Current server/Edge credential responsibilities:
- resolve safe non-secret connection metadata;
- resolve raw secret only inside privileged runtime;
- save/replace/remove secret through narrowly scoped privileged RPCs;
- never return raw secret after save;
- record immutable audit metadata;
- invalidate/mark health on safe provider validation result.

Conceptual resolver contract:

```ts
export interface IntegrationCredentialResolver {
  getProviderConfig<TConfig>(organizationId: string, provider: string): Promise<TConfig>;
  getSecret(organizationId: string, provider: string, secretName: string): Promise<string>;
}
```

Concrete implementations are server/Edge only.

## 3. OpenAI — IMPLEMENTED

### Purpose
Canonical scripts, translations, Scene Planning assistance and other approved structured AI assistance.

### Required secret
- `API_KEY`

### Non-secret configuration
- default model
- future safe provider/account identifiers if required

### Rules
- **INT-OAI-001** Key is entered through PAK Settings and stored through Integration Vault.
- **INT-OAI-002** Key is never returned after save.
- **INT-OAI-003** Provider adapter consumes key at runtime from organization-scoped Vault resolution.
- **INT-OAI-004** Model name is configuration, not secret.
- **INT-OAI-005** Grounded generation uses bounded approved context.
- **INT-OAI-006** Test Connection performs minimal server-side validation and returns normalized health only.
- **INT-OAI-007** CI does not require a live OpenAI key.

## 4. LTX video generation — IMPLEMENTED

### Purpose
First production video-generation adapter behind the provider-neutral video contract.

### Current secret
- `API_KEY`

### Current production profile
- provider: `LTX`
- current adapter model/profile: `ltx-2-3-pro`
- generated audio is disabled in the current approved-shot path
- supported shot parameters are normalized before provider submission

### Provider-neutral contract

```ts
export interface VideoGenerationProvider {
  submit(input: VideoGenerationRequest): Promise<VideoGenerationSubmission>;
  getStatus(providerJobId: string): Promise<VideoGenerationStatus>;
}
```

The domain request carries provider-neutral shot intent/identity. LTX-specific payload mapping stays in the adapter/worker.

### Rules
- **INT-VID-001** Domain code does not depend on LTX-specific status strings/payload structure.
- **INT-VID-002** Per-shot generation is durable-job based and uses `video_generation_attempts` lineage.
- **INT-VID-003** Provider job IDs are persisted only as execution lineage; credentials and result download URLs are not persisted as domain media identity.
- **INT-VID-004** Generated video bytes are imported into private organization-scoped PAK storage and linked to `media_assets` before completion.
- **INT-VID-005** Rate limits/transient errors use bounded retry; current retry eligibility is 5/15/45 seconds with maximum four attempts.
- **INT-VID-006** `SUBMISSION_UNKNOWN` is not automatically retried because duplicate provider spend cannot be ruled out.
- **INT-VID-007** Browser generation actions submit identifiers only; trusted prompt/model/duration/aspect-ratio are reconstructed by the enqueue boundary from approved Scene Planning state.
- **INT-VID-008** Paid generation requires OWNER/ADMIN/EDITOR plus APPROVED, source-current, blocker-free plan/shot lineage.
- **INT-VID-009** Authenticated clients cannot directly INSERT provider attempts or `VIDEO_SHOT_GENERATION` jobs.
- **INT-VID-010** Unattended reconciliation uses a privileged dispatcher; normal browser roles cannot invoke its service-role claim path.
- **INT-VID-011** Internal dispatcher authentication uses a Vault-held secret and constant-time comparison in Edge workers whose gateway JWT verification is intentionally disabled for cron execution.
- **INT-VID-012** LTX credential testing performs a no-generation authenticated read-only provider lookup where supported, avoiding a paid render merely to test a key.

### Runtime components

- `video-generation` Edge Function — submit/reconcile/import
- `video-generation-retry` Edge Function — safe retry scheduling boundary
- `video-generation-dispatcher` Edge Function — unattended work dispatch
- `pg_cron` + `pg_net` — scheduled dispatcher trigger
- private `generated-media` Storage bucket

### Operational acceptance

Engineering/runtime boundaries are released. A real paid LTX render remains a controlled operational acceptance check when an organization supplies a valid LTX API key/credits. CI must not fabricate this acceptance.

## 5. Meta platform — PLANNED (Phase 10)

### Intended products
- Facebook Pages
- Instagram professional accounts
- WhatsApp Business/Cloud API only where product use case is explicitly defined and compliant

### Potential secret fields
- `APP_SECRET`
- `ACCESS_TOKEN`
- system-user/page/token variants required by actual Meta account topology
- webhook verification secret/token where confidential

### Non-secret identifiers
- App ID
- Business ID
- Page ID
- Instagram account ID
- WhatsApp Business Account ID
- Phone Number ID

### Rules
- **INT-META-001** App secret/access tokens are write-only in browser UX.
- **INT-META-002** Connection validation occurs server-side.
- **INT-META-003** Expired/revoked token transitions provider health to INVALID.
- **INT-META-004** Webhook requests are signature-validated before mutation.
- **INT-META-005** Publishing stores external publication identifiers/status, never access tokens.
- **INT-META-006** Multiple page/account targets are non-secret publication targets linked to provider connection(s).
- **INT-META-007** Token refresh/rotation is server-side and audited.

## 6. Email provider — NOT FROZEN

Architecture must permit a future provider such as Resend/SES/SendGrid without domain redesign.

Potential capabilities:
- transactional notifications where introduced;
- provider-neutral send result;
- server-side credential;
- delivery/error metadata.

No email provider is required for the current operational core.

## 7. Webhooks

- **INT-WH-001** Every webhook endpoint identifies provider and validates signature/authentication before business parsing.
- **INT-WH-002** Raw webhook retention, if needed, is bounded and scrubbed of unnecessary sensitive values.
- **INT-WH-003** Webhook handling is idempotent using provider event ID or deterministic dedupe key.
- **INT-WH-004** Slow work is queued; webhook acknowledges promptly after durable acceptance.
- **INT-WH-005** Cross-organization target resolution comes from trusted stored provider target IDs, never user-submitted organization claims alone.

## 8. Rate limiting and retries

Adapters normalize provider failure into stable categories such as:
- `AUTH_INVALID`
- `PERMISSION_DENIED`
- `RATE_LIMITED`
- `TRANSIENT_PROVIDER`
- `INVALID_REQUEST`
- `NOT_FOUND`
- `CONFLICT`
- `CONTENT_FILTERED`
- `SUBMISSION_UNKNOWN`
- `UNKNOWN_PROVIDER_ERROR`

Retry only categories proven safe by job/provider semantics. Credential-invalid or terminal validation/content errors do not enter uncontrolled retry loops.

For paid providers, ambiguous submit outcomes require reconciliation/manual handling rather than speculative resubmission.

## 9. Credential audit

Audit events record:
- provider;
- organization;
- actor;
- event type;
- timestamp;
- safe metadata such as secret name/version/masked hint/storage mode.

Audit events never record plaintext secrets.

## 10. Internal infrastructure credentials

The following remain platform/runtime secrets rather than user-managed organization integrations:
- Supabase service-role key;
- deployment/platform credentials;
- internal video-generation dispatcher credential;
- environment project URL used by scheduled internal dispatch.

The dispatcher credential and environment URL are held through Vault/environment infrastructure, not rendered in Settings.

## 11. Provider acceptance checklist

Before enabling a new provider or materially new provider capability:
1. typed provider-neutral adapter contract exists;
2. deterministic fake/test fixture exists;
3. Vault schema supports required secret/non-secret fields;
4. role authorization is defined;
5. paid-spend boundary is explicit where applicable;
6. connection validation path is safe and preferably non-billable;
7. rate-limit/error/retry mapping is defined;
8. logs are secret-redacted;
9. durable/idempotent/reconciliation behavior is defined for external side effects;
10. provider result durability strategy is defined;
11. runtime security probes pass;
12. controlled live smoke passes when credential/credits are available, or deferred acceptance is explicitly documented rather than fabricated.