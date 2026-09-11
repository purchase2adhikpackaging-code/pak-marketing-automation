# PAK Canonical Knowledge & Reference Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the governed canonical railway-knowledge layer that supplies traceable, level-adapted, safety-controlled source material to every PAK textbook manuscript worker.

**Architecture:** Add a focused knowledge-pack subsystem under `src/modules/publishing-factory/` plus versioned pack data under `publishing/knowledge/`. Knowledge packs contain canonical terminology, source-backed level-neutral facts, equations/relationships, visual specifications, reference anchors, safety-sensitive claim flags, prohibited unsupported claims, and a source register. A deterministic validator rejects malformed packs, duplicate IDs, unsupported safety-critical numeric claims, missing authoritative source records, and level-adaptation gaps before any pack can be assembled into manuscript context.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest 3, Node.js 22, existing PAK publishing-factory core.

**Spec:** `docs/superpowers/specs/2026-09-11-pak-academic-publishing-factory-design.md`

## Global Constraints

- Work only on branch `feat/pak-publishing-knowledge-packs`.
- This branch starts from verified core head `b3b7f196115d95ea004879e42a3a9cd33a6b448f`.
- Do not weaken or replace academic governance in `docs/academic/**`.
- Knowledge packs are canonical source material, not finished textbook prose.
- Every factual claim marked safety-critical must either identify a governing authoritative source or remain qualitative/non-numeric.
- No pack may contain invented tolerances, torque values, test pressures, wheel limits, brake limits, electrical settings, weld acceptance criteria, NDT acceptance criteria, operational limits, or manufacturer-specific values without an explicit governing source record.
- External standards may be cited and summarized but not reproduced wholesale.
- Official/current EU and ERA source anchors are preferred for interoperability, railway safety, ECM, and TSI context.
- Generated-image text is never used as a knowledge source.
- Level adaptation must distinguish certificate, diploma, bachelors, postgraduate-diploma, and masters depth.
- All deterministic implementation uses TDD.
- No API keys or secrets are stored in packs.

---

## File Structure

Create:

```text
src/modules/publishing-factory/
  knowledge-domain.ts         # Zod schemas and types for packs/sources/claims
  knowledge-validation.ts     # deterministic pack and source validation
  knowledge-adaptation.ts     # qualification-level adaptation rules
  knowledge-registry.ts       # load/index/hash governed packs
  knowledge-context.ts        # assemble immutable manuscript grounding context
  knowledge-cli.ts            # validate/list/context smoke CLI

tests/vitest/publishing-factory/
  knowledge-domain.test.ts
  knowledge-validation.test.ts
  knowledge-adaptation.test.ts
  knowledge-registry.test.ts
  knowledge-context.test.ts
  knowledge-cli-process.test.ts

publishing/knowledge/
  registry.json
  sources/
    eu-era-core.json
  packs/
    railway-systems.json
    infrastructure-track.json
    rolling-stock.json
    freight-wagons.json
    bogies-suspension.json
    wheelsets-bearings.json
    braking-pneumatics.json
    traction-energy.json
    electrical-electronic.json
    signalling-control.json
    materials-metallurgy.json
    mechanical-fundamentals.json
    technical-drawing-documentation.json
    metrology-measurement.json
    welding-fabrication.json
    ndt-inspection.json
    maintenance-ecm.json
    reliability-rams.json
    safety-human-factors.json
    operations-logistics.json
    quality-compliance.json
    asset-management.json
    digital-railway-condition-monitoring.json
    railway-project-business-management.json
```

Modify:

```text
src/modules/publishing-factory/index.ts
src/modules/publishing-factory/cli.ts
package.json
.github/workflows/ci.yml
```

No generated book prose or PDFs are committed in this phase.

---

### Task 1: Define Canonical Knowledge Contracts

**Files:**
- Create: `src/modules/publishing-factory/knowledge-domain.ts`
- Create: `tests/vitest/publishing-factory/knowledge-domain.test.ts`

**Interfaces:**
- Produces: `KnowledgeSourceSchema`, `KnowledgeClaimSchema`, `KnowledgePackSchema`, `KnowledgePackRegistrySchema`, `KnowledgeSource`, `KnowledgeClaim`, `KnowledgePack`, `KnowledgePackRegistry`.
- Consumes: Zod and `QualificationLevelSchema` from `domain.ts`.

- [ ] Write a failing test that accepts a well-formed pack and rejects a pack with an empty ID, no terminology, or no source register.
- [ ] Run `npm run test:run -- tests/vitest/publishing-factory/knowledge-domain.test.ts` and verify RED because the module does not exist.
- [ ] Implement schemas with these required fields:

```ts
KnowledgeSource = {
  id: string;
  title: string;
  publisher: string;
  authority: "eu-law" | "era" | "national-authority" | "infrastructure-manager" | "manufacturer" | "academic" | "industry";
  url?: string;
  documentId?: string;
  editionOrVersion?: string;
  effectiveOrPublishedDate?: string;
  accessedDate: string;
  scopeNote: string;
}

KnowledgeClaim = {
  id: string;
  text: string;
  sourceIds: string[];
  safetyCritical: boolean;
  numeric: boolean;
  applicabilityNote?: string;
}

KnowledgePack = {
  id: string;
  domain: string;
  title: string;
  revision: string;
  status: "draft" | "approved" | "archived";
  canonicalTerminology: { term: string; definition: string; sourceIds: string[] }[];
  claims: KnowledgeClaim[];
  equations: { id: string; expression: string; variables: Record<string,string>; sourceIds: string[]; limitation: string }[];
  visualSpecs: { id: string; type: "block-diagram" | "schematic" | "cutaway" | "process-flow" | "table" | "chart"; purpose: string; labels: string[]; trainingOnly: boolean }[];
  prohibitedUnsupportedClaims: string[];
  levelGuidance: Record<QualificationLevel, { depth: string; maths: string; practical: string; assessment: string }>;
  sourceIds: string[];
}
```

- [ ] Run the focused test and verify GREEN.
- [ ] Commit `feat: define canonical railway knowledge contracts`.

### Task 2: Establish the Authoritative EU/ERA Source Register

**Files:**
- Create: `publishing/knowledge/sources/eu-era-core.json`
- Create: `tests/vitest/publishing-factory/knowledge-validation.test.ts`
- Create: `src/modules/publishing-factory/knowledge-validation.ts`

**Interfaces:**
- Produces: `validateKnowledgePack(pack, sources): KnowledgeValidationFinding[]`, `validateSourceRegistry(sources): KnowledgeValidationFinding[]`.

- [ ] Write failing tests that reject an unknown source ID, duplicate source IDs, a safety-critical numeric claim with no source, and a source missing `publisher`/`scopeNote`.
- [ ] Verify RED.
- [ ] Add the initial official source register with at least these verified anchors:
  - Directive (EU) 2016/797 — interoperability of the EU rail system; current EUR-Lex consolidated link.
  - Directive (EU) 2016/798 — railway safety.
  - Commission Implementing Regulation (EU) 2019/779 — ECM certification system.
  - ERA TSI portal / subsystem pages used as navigation anchors rather than reproducing standards text.
  - ERA ECM guidance anchor when used for educational interpretation.
- [ ] Implement validation rules: every referenced source must exist; `safetyCritical && numeric` requires at least one authoritative source (`eu-law`, `era`, `national-authority`, `infrastructure-manager`, or `manufacturer`); `academic`/`industry` alone is insufficient for an operational acceptance limit.
- [ ] Verify GREEN.
- [ ] Commit `feat: add governed EU ERA source register`.

### Task 3: Add Qualification-Level Adaptation Profiles

**Files:**
- Create: `src/modules/publishing-factory/knowledge-adaptation.ts`
- Create: `tests/vitest/publishing-factory/knowledge-adaptation.test.ts`

**Interfaces:**
- Produces: `getLevelProfile(level): LevelProfile`, `adaptKnowledgePack(pack, level): AdaptedKnowledgePack`.

- [ ] Write RED tests proving progression:
  - certificate = awareness/recognition, minimal mathematics, no authorization claims;
  - diploma = applied technician reasoning and supervised calculations;
  - bachelors = engineering analysis/design reasoning;
  - postgraduate-diploma = advanced applied/asset/management integration;
  - masters = advanced systems analysis, research/evaluation, uncertainty/optimization.
- [ ] Implement deterministic profiles; adaptation may filter or annotate claims but must never alter canonical factual text or source IDs.
- [ ] Add a test proving certificate adaptation cannot introduce a safety-critical procedure not present in the pack.
- [ ] Verify GREEN and commit `feat: add qualification level knowledge adaptation`.

### Task 4: Seed the Canonical Railway Domain Packs

**Files:**
- Create the 24 JSON files listed under `publishing/knowledge/packs/`.
- Create: `publishing/knowledge/registry.json`
- Extend: `tests/vitest/publishing-factory/knowledge-validation.test.ts`

**Interfaces:**
- Every pack conforms to `KnowledgePackSchema` and uses only IDs in the source register.

- [ ] Add a RED portfolio invariant test requiring exactly 24 unique seed pack IDs and validating all packs.
- [ ] Seed each pack with concise, level-neutral canonical facts and terminology only; do not pad packs with textbook prose.
- [ ] Ensure no pack contains unsourced safety-critical numeric acceptance values.
- [ ] Include visual specifications for domains where diagrams materially improve understanding.
- [ ] Run the validation test and verify all 24 packs pass.
- [ ] Commit `feat: seed canonical railway knowledge pack library`.

### Task 5: Build the Pack Registry, Hashing, and Immutable Loading

**Files:**
- Create: `src/modules/publishing-factory/knowledge-registry.ts`
- Create: `tests/vitest/publishing-factory/knowledge-registry.test.ts`

**Interfaces:**
- Produces: `loadKnowledgeRegistry(root): Promise<LoadedKnowledgeRegistry>`, `getKnowledgePack(registry,id)`, `hashKnowledgePack(pack): string`.

- [ ] Write RED tests for deterministic SHA-256 hashes, duplicate registry entries, missing pack files, and stable loading order.
- [ ] Implement immutable parsed objects (`Object.freeze` recursively or equivalent immutable contract) so manuscript workers cannot mutate canonical packs in memory.
- [ ] Registry records must carry `packId`, `path`, `revision`, `sha256`, `status`.
- [ ] Verify GREEN and commit `feat: load and hash governed knowledge packs`.

### Task 6: Assemble Manuscript Grounding Context

**Files:**
- Create: `src/modules/publishing-factory/knowledge-context.ts`
- Create: `tests/vitest/publishing-factory/knowledge-context.test.ts`

**Interfaces:**
- Produces: `assembleKnowledgeContext({packIds, level, registry}): ManuscriptKnowledgeContext`.

- [ ] Write RED tests proving context assembly preserves source provenance and qualification level, rejects unknown pack IDs, de-duplicates shared source references, and preserves prohibited-claim rules.
- [ ] Implement output with:
  - selected pack IDs + hashes;
  - level profile;
  - canonical terminology;
  - claims grouped by domain;
  - equations/limitations;
  - visual specs;
  - source register subset;
  - safety-control rules;
  - prohibited unsupported claims.
- [ ] Add a test proving two books using the same source pack receive the same canonical fact hash.
- [ ] Verify GREEN and commit `feat: assemble traceable manuscript knowledge context`.

### Task 7: Expose Knowledge Validation and Context CLI

**Files:**
- Create: `src/modules/publishing-factory/knowledge-cli.ts`
- Modify: `src/modules/publishing-factory/cli.ts`
- Modify: `src/modules/publishing-factory/index.ts`
- Modify: `package.json`
- Create: `tests/vitest/publishing-factory/knowledge-cli-process.test.ts`

**Interfaces:**
- Commands:
  - `knowledge-validate`
  - `knowledge-list`
  - `knowledge-context --level diploma --packs railway-systems,rolling-stock`

- [ ] Add RED process tests using the real `tsx` CLI, not only imported handlers.
- [ ] Implement commands with machine-readable JSON output and non-zero exit on validation failure.
- [ ] Add scripts:

```json
"publishing:knowledge-validate": "tsx src/modules/publishing-factory/cli.ts knowledge-validate",
"publishing:knowledge-list": "tsx src/modules/publishing-factory/cli.ts knowledge-list"
```

- [ ] Verify process tests GREEN.
- [ ] Commit `feat: expose canonical knowledge validation CLI`.

### Task 8: Add Knowledge Pack CI Gate

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Adds `npm run publishing:knowledge-validate` after registry validation and before manuscript/PDF fixture gates.

- [ ] Add the CI command only after its process test is green.
- [ ] Push and inspect workflow evidence: typecheck, lint, unit suite, registry, knowledge validation, deterministic QA fixture, build, E2E.
- [ ] Do not call Phase 2 complete until the complete CI run is green.
- [ ] Commit `ci: gate canonical railway knowledge packs`.

### Task 9: Verification and Stacked PR

**Files:**
- Verify the entire Phase 2 diff.

- [ ] Run/observe full CI on the exact branch head.
- [ ] Confirm no secrets, binary books, generated PDFs, or unrelated application behavior entered the diff.
- [ ] Confirm all 24 pack files validate and all source references resolve within the governed registry.
- [ ] Open a stacked PR with base `feat/pak-academic-publishing-factory` and head `feat/pak-publishing-knowledge-packs`.
- [ ] PR title: `feat: add PAK canonical railway knowledge packs`.
- [ ] Leave unmerged until review; subsequent curriculum/manuscript factory work should start on a successor branch so the review boundary stays stable.

---

## Acceptance Criteria

Phase 2 is accepted only when:

1. 24 unique canonical domain packs load and validate.
2. Every pack has canonical terminology, level guidance, source provenance and prohibited unsupported-claim controls.
3. No safety-critical numeric claim passes without an authoritative source.
4. Pack hashes are deterministic and included in assembled manuscript context.
5. Qualification-level adaptation is deterministic and never mutates canonical fact text.
6. The real CLI process validates all packs successfully.
7. Full CI is green on the exact Phase 2 head.
8. The Phase 2 PR remains independently reviewable from the core PR.
