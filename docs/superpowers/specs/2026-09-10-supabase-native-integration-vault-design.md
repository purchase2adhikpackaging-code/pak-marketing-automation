# Supabase-Native Integration Vault Design

**Status:** Approved for implementation  
**Date:** 2026-09-10  
**Scope:** PAK Marketing Automation Phase 5 only

## Goal

Complete Phase 5 by allowing PAK OWNER/ADMIN users to configure and use provider credentials from Settings without exposing provider secrets to the browser and without requiring Vercel-hosted `SUPABASE_SERVICE_ROLE_KEY` or `INTEGRATION_VAULT_ENCRYPTION_KEY` for normal credential operations.

## Current problem

The existing integration service encrypts secrets in the Next.js server runtime and persists them through an admin Supabase client. This creates two staging/runtime dependencies on Vercel: `SUPABASE_SERVICE_ROLE_KEY` and `INTEGRATION_VAULT_ENCRYPTION_KEY`. It also keeps decrypted provider secrets inside the Next.js runtime.

## Architecture

1. **Supabase Vault becomes the secret store.** Raw provider credentials are stored as Supabase Vault secrets. Application tables keep metadata only: provider, organization, status, masked hint, version, verification state, and audit history.
2. **Authenticated Supabase Edge Functions become the only secret-management boundary.** Browser requests carry the current user JWT. Edge Functions verify the JWT, resolve the user, and require OWNER/ADMIN membership before saving, replacing, testing, or removing a credential.
3. **The browser never receives a decrypted provider secret.** Edge Function responses contain only safe metadata and status.
4. **Real provider execution also happens behind a server boundary.** OpenAI generation resolves the organization-scoped Vault secret inside an authenticated Edge Function and calls OpenAI there. The Next.js application passes generation input plus the user JWT, not the provider key.
5. **RLS remains the tenant boundary for metadata.** `integration_connections` and `integration_audit_events` remain organization-scoped. Direct browser access to raw secret material remains impossible.
6. **Root navigation is normalized.** `/` redirects authenticated users into `/dashboard` and unauthenticated users to `/login`, removing the placeholder landing screen.

## Authorization model

- OWNER/ADMIN: list safe integration metadata, save/replace credential, test credential, remove credential, enable/disable connection.
- Other organization roles: no credential mutation; they may use provider-backed features only where the product workflow already authorizes them.
- Edge Functions derive `user_id` from the JWT. They never trust a caller-provided actor ID.
- Organization ID is validated against membership before every secret operation.

## Secret model

A Vault secret name is deterministic but contains no secret value:

`pak/<organization_id>/<provider>/<secret_name>`

The application stores only:
- Vault secret UUID/reference
- masked hint such as `••••abcd`
- monotonically increasing secret version
- connection status
- verification timestamp/error code

No decrypted secret is written to logs, audit metadata, browser HTML, client state, URL parameters, or application tables.

## Edge Functions

### `integration-vault`
Authenticated endpoint for:
- `save`
- `test`
- `remove`
- `set_disabled`

It validates role, reads/writes Supabase Vault through the server-side Supabase client available in the Edge Function environment, updates metadata, and appends audit events.

### `generate-content`
Authenticated endpoint for real OpenAI generation. It validates organization membership, loads the configured OpenAI connection and Vault secret, invokes OpenAI, and returns generated content only. Provider error details are normalized before returning to the client.

## Migration strategy

Add server-only SQL functions that operate on Vault and application metadata. Revoke execution from `anon`/`authenticated`; Edge Functions call them with the service role. Existing application-encrypted rows are not exposed. If legacy rows exist, they remain unread by browser roles and can be removed after successful replacement through the new Settings flow.

## Next.js changes

- Replace direct `createIntegrationVaultService()` secret mutation/read paths with an authenticated Edge Function client.
- Settings server actions keep CSRF-safe form semantics but forward the current session token to `integration-vault`.
- OpenAI provider path uses `generate-content` for production real-provider execution instead of resolving the provider key in Vercel.
- Remove normal runtime dependency on `SUPABASE_SERVICE_ROLE_KEY` and `INTEGRATION_VAULT_ENCRYPTION_KEY` from the server environment schema where no longer needed by reachable production code.
- `/` performs auth-aware redirect.

## Testing

- Unit tests: authorization payload handling, safe response mapping, error normalization, root redirect behavior, provider routing.
- Edge Function tests/helpers: role validation, no secret in response, invalid credential handling, replace/remove semantics.
- Database probes: authenticated users cannot read Vault secrets or `integration_secrets`; metadata RLS remains organization-scoped; audit writes remain server-only.
- CI: typecheck, lint, unit tests, build, Playwright smoke.
- Staging: save OpenAI key in Settings, test connection, generate content, remove/replace credential, inspect rendered HTML/logs for secret leakage.

## Acceptance criteria

1. OWNER/ADMIN can save, test, replace, and remove OpenAI credentials from hosted Settings.
2. No provider secret is returned to browser APIs or rendered client state.
3. Content Studio generates through the stored organization credential.
4. Vercel production does not require `SUPABASE_SERVICE_ROLE_KEY` or `INTEGRATION_VAULT_ENCRYPTION_KEY` for these workflows.
5. Tenant isolation and role enforcement pass live Supabase probes.
6. Root URL no longer shows the placeholder page.
7. CI is green on the exact PR head and staging smoke verification passes before merge/promotion.
