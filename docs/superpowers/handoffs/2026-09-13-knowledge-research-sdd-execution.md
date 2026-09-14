# PAK Knowledge Research — SDD Execution Handoff

**Date:** 2026-09-13
**Execution branch:** `feature/knowledge-research-zero-secret-exec`
**Current execution head before this handoff refresh:** `7830f14620671abd0e6ba1d5b72425c2539e1742`
**Latest verified foundation / PR #40 head:** `ea7d53d4259c48b2c709870d2e1fdb542e5c647c`
**Status:** Execution preparation complete; implementation has not started.

## Governing design and plan

The approved design and implementation plan are already present on this execution branch:

- `docs/superpowers/specs/2026-09-13-knowledge-research-zero-secret-design.md`
- `docs/superpowers/plans/2026-09-13-knowledge-research-zero-secret.md`

No documentation cherry-pick remains. The execution branch was merged forward to the latest PR #40 foundation head and carries the exact approved spec/plan blobs.

Treat the design spec as binding authority and the implementation plan as the execution argument.

## Foundation verification

PR #40 remained open and draft when last checked. Its head was:

`ea7d53d4259c48b2c709870d2e1fdb542e5c647c` — `fix: guard Core Knowledge inserts by role`

GitHub Actions CI for that exact foundation head completed successfully (`CI` run 34772863241, conclusion `success`).

GitHub combined status also reported two Vercel failures, both pointing to the Vercel build-rate-limit page:

- `Vercel – pak-marketing-automation`
- `Vercel – pak-staging-schema-probe`

Treat those as external platform/quota status unless later evidence shows an application failure. Do not waive any application CI gate.

## Required execution method

Use `superpowers:subagent-driven-development` in Codex.

Before Task 1:

1. Re-check PR #40 head. If it advanced beyond `ea7d53d4259c48b2c709870d2e1fdb542e5c647c`, integrate the newer foundation head first.
2. Use `superpowers:using-git-worktrees` and create/verify the isolated worktree.
3. Run the SDD workspace helper for this exact plan and create/check the plan-scoped ledger.
4. Read the complete design spec and implementation plan once.
5. Perform the required pre-flight conflict scan and record its table/rulings in the ledger.
6. Start **Task 1 only**. No implementation task has been completed yet.

For every task: fresh implementer -> tests/commit/self-review -> task reviewer -> fix loop if required -> ledger completion. Do not skip per-task review. After all tasks, perform the broad whole-branch review and `verification-before-completion` before any completion claim.

## Non-negotiable product/security constraints

- Never touch Lovable.
- Add **no new API key, access key, secret key, OAuth credential, cookie, external login or browser session**.
- Do not ask for any Exa key. If Exa no-key MCP stops working, return `CREDENTIAL_REQUIRED` and leave Research disabled.
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

## Runtime note

This ChatGPT harness does not expose a Codex fresh-subagent dispatch primitive. A local shell is available, but it cannot resolve `github.com`, so it cannot clone the repository to construct the required local worktree/SDD ledger either. GitHub connector operations were sufficient to reconcile the execution branch and preserve the exact docs, but they are not a substitute for the mandated fresh-implementer/reviewer SDD loop.

Therefore no implementation code was started here. Do **not** reinterpret this as permission to implement Task 1 in a single-agent path.

## Exact next action

In a Codex session with repository/worktree access, open `feature/knowledge-research-zero-secret-exec`, verify PR #40 has not advanced, initialize the SDD worktree/workspace/ledger, run the pre-flight scan, and dispatch the Task 1 implementer from:

`docs/superpowers/plans/2026-09-13-knowledge-research-zero-secret.md`
