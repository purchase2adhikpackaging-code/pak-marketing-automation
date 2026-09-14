# PAK Knowledge Research — SDD Execution Handoff

**Date:** 2026-09-14
**Execution branch:** `feature/knowledge-research-zero-secret-exec`
**Latest synchronized execution head before this refresh:** `403df3d3ec8ee196263b08fbd492de74736af926`
**Latest verified foundation / PR #40 head:** `2f3b17702dc57bebfe760790d59aecfc3089ccc9`
**Status:** Execution preparation complete; implementation has not started.

## Governing design and plan

The approved design and implementation plan are present on this execution branch:

- `docs/superpowers/specs/2026-09-13-knowledge-research-zero-secret-design.md`
- `docs/superpowers/plans/2026-09-13-knowledge-research-zero-secret.md`

Treat the design spec as binding authority and the implementation plan as the execution argument.

The execution branch has been merged forward to PR #40 head `2f3b17702dc57bebfe760790d59aecfc3089ccc9` while preserving the approved spec, plan and this handoff. No documentation cherry-pick remains.

## Required execution method

Use `superpowers:subagent-driven-development` in a Codex runtime with repository/worktree access.

Before Task 1:

1. Re-check PR #40 head. If it advanced beyond `2f3b17702dc57bebfe760790d59aecfc3089ccc9`, integrate the newer foundation head first.
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

## Runtime blocker observed in this ChatGPT session

This ChatGPT harness has the GitHub connector and can read/write repository branches, commits, files, PRs and CI, but it does **not** expose a Codex fresh-subagent dispatch primitive. The local container has `git` but no checked-out repository and no `codex` executable. Therefore the mandated fresh implementer/reviewer SDD loop cannot be truthfully executed in this runtime.

Do not reinterpret this as permission to implement Task 1 through a single-agent GitHub-edit path.

## Exact next action

In a Codex session with repository/worktree access, checkout `feature/knowledge-research-zero-secret-exec`, initialize the SDD worktree/workspace/ledger, run the pre-flight scan, and dispatch the Task 1 implementer from:

`docs/superpowers/plans/2026-09-13-knowledge-research-zero-secret.md`
