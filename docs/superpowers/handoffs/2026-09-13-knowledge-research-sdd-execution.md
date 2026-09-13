# PAK Knowledge Research — SDD Execution Handoff

**Date:** 2026-09-13
**Execution branch:** `feature/knowledge-research-zero-secret-exec`
**Execution base:** PR #40 head `7dca58923b79e8e61a069922285e3b2dec65274e`
**Status:** Execution workspace prepared; implementation has not started.

## Governing design and plan

The approved design and implementation plan currently live on `feature/knowledge-research-zero-secret` and must be carried into this execution branch before Task 1.

Cherry-pick this contiguous documentation range:

```bash
git cherry-pick ca29cfcd143ac588ef3f942814a3262688657ff6^..ca3cdb706ee68a587045ba9785f6a409955f1055
```

This brings in:

- `docs/superpowers/specs/2026-09-13-knowledge-research-zero-secret-design.md`
- `docs/superpowers/plans/2026-09-13-knowledge-research-zero-secret.md`

After cherry-pick, treat the spec as binding authority and the plan as the execution argument.

## Required execution method

Use `superpowers:subagent-driven-development` in Codex.

Before Task 1:

1. Read the complete design spec and implementation plan.
2. Verify this branch still descends from the latest `foundation/org-profile-brand-knowledge` / PR #40 head. If PR #40 advanced, integrate the newer foundation head before implementation.
3. Use `superpowers:using-git-worktrees` and create/verify the isolated worktree.
4. Create the SDD workspace/ledger for this exact plan and perform the required pre-flight plan conflict scan.
5. Resume at Task 1 only; no implementation task has been completed yet.

For each task: fresh implementer -> tests/commit/self-review -> task reviewer -> fix loop if required -> ledger completion. Do not skip per-task review. After all tasks, perform the broad whole-branch review and `verification-before-completion` before any completion claim.

## Non-negotiable product/security constraints

- Never touch Lovable.
- Add **no new API key, access key, secret key, OAuth credential, cookie, external login or browser session**.
- Do not ask the user for any Exa key. If Exa no-key MCP stops working, return `CREDENTIAL_REQUIRED` and leave Research disabled.
- Do not install full Agent-Reach, OpenCLI, `mcporter`, or login-backed social tooling.
- Research v1 is Knowledge Base -> Research, review-first.
- Only OWNER/ADMIN/EDITOR / existing `knowledge:manage` actors may use Research in v1.
- Search provider path is the fixed no-key Exa MCP endpoint defined by the approved plan.
- Reuse the existing PAK URL-safety / DNS-pinned fetch / URL Knowledge ingestion boundary for source reading and conversion.
- Research candidates are untrusted metadata and never enter generation prompts directly.
- Candidate -> Knowledge conversion is explicit, idempotent and DRAFT-only; never auto-activate and never set Core Knowledge automatically.
- Preserve existing RLS/RBAC, Knowledge revision/CAS, provenance, Core Knowledge and Media Library behavior.
- TDD RED -> GREEN for every slice.
- No single-agent unchecked coding path.

## Current repository facts to preserve

PR #40 currently contains Core Knowledge, document/URL Knowledge ingestion and the safe URL fetch/extraction boundary. The research feature must extend those facilities rather than duplicating them.

No research implementation code has been written yet. The next action is **Task 1 from the implementation plan** after the documentation cherry-pick and SDD pre-flight setup.
