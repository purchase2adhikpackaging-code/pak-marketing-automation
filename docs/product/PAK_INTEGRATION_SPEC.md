# PAK Marketing Automation — Integration Specification

**Document ID:** PAK-INT-001  
**Version:** 1.0  
**Status:** Baseline for review

## 1. Integration principles

- **INT-GEN-001** Provider-specific SDKs/payloads stay behind adapter interfaces.
- **INT-GEN-002** Secrets are organization-scoped and server-resolved.
- **INT-GEN-003** Browser clients never receive stored raw secrets.
- **INT-GEN-004** Every integration exposes normalized health/status metadata.
- **INT-GEN-005** External side effects use idempotency/reconciliation wherever provider semantics allow.
- **INT-GEN-006** Provider errors are normalized and secrets redacted before persistence/UI.
- **INT-GEN-007** CI uses fakes; live provider calls are controlled verification only.

## 2. Integration Vault contract

A provider connection contains:
- organization
- provider type
- non-secret configuration
- encrypted secret envelopes
- secret version
- configuration/health state
- verification timestamps
- audit history

Provider states:
`NOT_CONFIGURED | CONFIGURED | INVALID | DISABLED`

Server interface target:

```ts
export interface IntegrationCredentialResolver {
  getProviderConfig<TConfig>(organizationId: string, provider: string): Promise<TConfig>;
  getSecret(organizationId: string, provider: string, secretName: string): Promise<string>;
}
```

The concrete implementation must be `server-only`.

## 3. OpenAI

### Purpose
Canonical scripts, translations and later structured AI assistance.

### Required secret
- `API_KEY`

### Non-secret configuration
- default model
- optional organization/project/provider configuration if OpenAI account topology requires it

### Rules
- **INT-OAI-001** Key is entered in PAK Settings and stored encrypted/server-side.
- **INT-OAI-002** Key is never returned after save.
- **INT-OAI-003** Provider adapter consumes key at runtime from Integration Vault.
- **INT-OAI-004** Model name is configuration, not secret.
- **INT-OAI-005** Generation requests include bounded approved grounding context.
- **INT-OAI-006** Test Connection performs a minimal server-side API validation appropriate to current OpenAI API capabilities without generating unnecessary billable content where avoidable.
- **INT-OAI-007** CI must not require `OPENAI_API_KEY`.

## 4. Meta platform

### Intended products
- Facebook Pages
- Instagram professional accounts
- WhatsApp Business/Cloud API where configured

### Potential secret fields
- `APP_SECRET`
- `ACCESS_TOKEN`
- system-user/page/token variants as required by actual Meta account setup
- webhook verification secret/token if treated as confidential

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
- **INT-META-004** Webhook requests must be signature-validated before state mutation.
- **INT-META-005** Publishing stores external post/message IDs and normalized status, never access tokens.
- **INT-META-006** Multiple page/account targets are modeled as non-secret publication targets linked to one or more provider connections.
- **INT-META-007** Token refresh/rotation is server-side and audited.

## 5. LTX / video provider

### Purpose
Primary planned cinematic/video generation provider behind a generic interface.

### Secret/config
Provider API credentials and account/project identifiers as required by the selected API plan.

### Contract target

```ts
export interface VideoGenerationProvider {
  submit(input: VideoGenerationInput): Promise<VideoGenerationSubmission>;
  getStatus(providerJobId: string): Promise<VideoGenerationStatus>;
  getResult(providerJobId: string): Promise<VideoGenerationResult>;
}
```

Rules:
- **INT-VID-001** Domain code cannot depend on LTX-specific status strings.
- **INT-VID-002** Scene generation is durable-job based.
- **INT-VID-003** Provider job IDs are persisted.
- **INT-VID-004** Generated media is imported into organization-scoped media storage.
- **INT-VID-005** Rate limits/transient errors use bounded retry.

## 6. Email provider

Provider not frozen yet; architecture must permit SendGrid/Resend/SES or equivalent without domain redesign.

Required capabilities:
- send transactional notifications where introduced
- provider-neutral send result
- server-side key
- delivery/error metadata

No email provider is required for current Content Studio MVP.

## 7. Webhooks

- **INT-WH-001** Every webhook endpoint identifies provider and validates signature/authentication before parsing business payload.
- **INT-WH-002** Raw webhook payload retention, if needed for debugging, must be bounded and scrubbed of unnecessary sensitive values.
- **INT-WH-003** Webhook handling is idempotent using provider event ID or deterministic dedupe key.
- **INT-WH-004** Slow work is queued; webhook acknowledges promptly after durable acceptance.
- **INT-WH-005** Cross-organization target resolution occurs from trusted stored provider target IDs, never user-submitted organization claims alone.

## 8. Rate limiting and retries

Each adapter classifies errors into:
- `AUTH_INVALID`
- `PERMISSION_DENIED`
- `RATE_LIMITED`
- `TRANSIENT_PROVIDER`
- `INVALID_REQUEST`
- `NOT_FOUND`
- `CONFLICT`
- `UNKNOWN_PROVIDER_ERROR`

Retry only transient/rate-limited categories according to job policy. Credential invalidation should update connection health and stop repeated wasteful attempts.

## 9. Credential audit

Audit events record:
- provider
- organization
- actor
- event type
- timestamp
- safe metadata such as secret name/version/last-4 hint

Audit events never record plaintext secrets.

## 10. Deployment/bootstrap secrets

The following remain host-level secrets because they grant platform-level authority and must not be organization-managed:
- Supabase service-role key
- Integration Vault encryption root/key material
- worker shared secrets
- deployment/platform credentials

OpenAI/Meta/LTX organization credentials should move into PAK Settings/Integration Vault.

## 11. Provider acceptance checklist

Before enabling any real provider:
1. typed adapter contract exists;
2. fake provider/test fixture exists;
3. Integration Vault schema supports required secret/non-secret fields;
4. role authorization is defined;
5. connection validation path is safe;
6. rate-limit/error mapping is defined;
7. logs are secret-redacted;
8. durable/idempotent behavior is defined for side effects;
9. runtime smoke test passes using PAK staging only.