# PAK Marketing Automation — Product Baseline

This directory is the governing product/technical baseline for PAK Marketing Automation. New development must map to requirement IDs in these documents before implementation begins.

## Documents

1. `PAK_MASTER_PRD.md` — product vision, roles, modules, functional/non-functional requirements.
2. `PAK_MASTER_TRD.md` — architecture, security, tenancy, provider, deployment and testing requirements.
3. `PAK_UI_UX_SPEC.md` — information architecture, page-by-page UX and interaction states.
4. `PAK_BACKEND_SCHEMA.md` — database entities, ownership, RLS and planned data architecture.
5. `PAK_SYSTEM_WORKFLOWS.md` — lifecycle/state-machine definitions for content, knowledge, video, approval, publishing and integrations.
6. `PAK_INTEGRATION_SPEC.md` — OpenAI, Meta, LTX/video, webhook, credential and provider contracts.
7. `PAK_DEVELOPMENT_ROADMAP.md` — phased implementation sequence and release gates.
8. `PAK_TRACEABILITY_MATRIX.md` — requirement-to-UX/backend/test/phase mapping.
9. `PAK_EXISTING_IMPLEMENTATION_GAP_AUDIT.md` — reconciliation of current merged code against the master baseline.

## Change-control rules

- Every feature PR must list the PRD/TRD/UX/DB requirement IDs it implements or changes.
- New backend entities require an owning product workflow.
- New UI surfaces require defined backend/state/authorization behavior.
- Security-sensitive changes require negative tests and live Supabase verification where applicable.
- Applied migrations are corrected with forward migrations, not edited history alone.
- No PAK dependency may be introduced on Aurexis, Lovable or a Lovable-attached Supabase project.
- `main` remains the release source of truth; staging precedes production promotion.

## Immediate next approved sequence after baseline review

`Integration Vault → Settings/Integrations → real Next.js staging deployment → PAK Supabase/Auth wiring → OpenAI configure/test via Settings → real Chrome E2E verification → Scene Planning`.
