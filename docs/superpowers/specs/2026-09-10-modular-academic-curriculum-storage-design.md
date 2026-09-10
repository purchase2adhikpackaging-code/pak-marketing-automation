# Modular Academic Curriculum Storage Design

**Date:** 10 September 2026  
**Repository:** `purchase2adhikpackaging-code/pak-marketing-automation`  
**Status:** Approved design — implementation pending  

## 1. Objective

Restructure the PAK academic documentation so future curriculum development can continue reliably without repeatedly reading or replacing the entire monolithic academic PRD.

The existing master PRD remains the governed audit document. A modular academic working layer will be added for fast retrieval, safer updates, semester/block isolation, and easier continuation across future ChatGPT sessions.

## 2. Governing Principle

There will be two complementary layers:

1. **Master Governance Layer** — the existing `docs/academic/PAK_ACADEMIC_CURRICULUM_STUDY_MATERIAL_BLUEPRINT_PRD.md` remains the authoritative consolidated blueprint and historical audit record.
2. **Modular Working Layer** — smaller programme and academic-period Markdown files become the preferred day-to-day curriculum editing surface.

The modular files do not replace governance rules in the master PRD. Where a conflict exists, the latest explicitly approved governance rule in the master PRD takes precedence until the inconsistency is reconciled.

## 3. Directory Structure

Target structure:

```text
docs/academic/
├── ACADEMIC_INDEX.md
├── PAK_ACADEMIC_CURRICULUM_STUDY_MATERIAL_BLUEPRINT_PRD.md
├── governance/
│   ├── PRINT_READY_PUBLISHING_STANDARD.md
│   ├── CURRICULUM_CODING_AND_TRACEABILITY.md
│   └── REGULATORY_AND_QA_RULES.md
├── certificates/
│   ├── C01/
│   │   └── PAK-C01.md
│   ├── C02/
│   │   └── PAK-C02.md
│   ├── ...
│   └── C12/
│       └── PAK-C12.md
├── diplomas/
│   ├── D01/
│   │   ├── PAK-D01-OVERVIEW.md
│   │   ├── S1.md
│   │   ├── S2.md
│   │   ├── S3.md
│   │   └── S4.md
│   ├── ...
│   └── D05/
├── bachelors/
│   ├── B01/
│   │   ├── PAK-B01-OVERVIEW.md
│   │   ├── S1.md
│   │   ├── S2.md
│   │   ├── S3.md
│   │   ├── S4.md
│   │   ├── S5.md
│   │   └── S6.md
│   └── ...
├── postgraduate-diplomas/
│   ├── PGD01/
│   │   ├── PAK-PGD01-OVERVIEW.md
│   │   ├── S1.md
│   │   └── S2.md
│   └── ...
└── masters/
    ├── M01/
    │   ├── PAK-M01-OVERVIEW.md
    │   ├── S1.md
    │   ├── S2.md
    │   ├── S3.md
    │   └── S4.md
    └── ...
```

Certificate programmes use one programme file because their current structures are week/block based rather than semester based. If a certificate later becomes too large, it may be split into block files without changing the index contract.

## 4. Academic Index

`docs/academic/ACADEMIC_INDEX.md` will become the primary navigation/continuation file.

It will contain, for every programme:

- programme code;
- title;
- qualification level;
- duration;
- academic-period structure;
- current curriculum status;
- modular file path(s);
- master PRD section reference;
- current working version;
- chapter architecture status;
- study-material status;
- print/publication status;
- next controlled work item.

A future session should normally read `ACADEMIC_INDEX.md` first, then only the specific programme/semester/block file required for the next task.

## 5. File Responsibilities

### 5.1 Master PRD

The master PRD retains:

- portfolio catalogue;
- qualification architecture;
- global hierarchy;
- governance rules;
- global print-ready publishing standard;
- shared-module principles;
- portfolio checkpoints;
- revision history;
- major programme-level approved architecture.

It is updated at controlled milestones rather than rewritten for every small curriculum edit.

### 5.2 Programme Overview Files

Semester-based programme overview files contain:

- programme identity;
- purpose;
- graduate profile / competency boundary;
- curriculum design principles;
- semester map;
- dependency spine;
- shared-module strategy;
- regulatory/reference baseline;
- assessment framework summary;
- publication requirements;
- links to semester files.

### 5.3 Semester Files

Each semester file contains only the curriculum for that academic period:

- programme/year/semester identity;
- semester objective;
- subject table;
- subject codes and prerequisites;
- progression logic;
- subject-by-subject architecture;
- chapter architecture when later added;
- learning outcomes when later added;
- theory/practical/contact-hour mapping when later added;
- assessment mapping;
- visual/diagram requirements;
- publication deliverable matrix;
- regulatory/reference notes relevant to that semester.

Semester files are the preferred append/edit surface for Diploma, Bachelor's, PGD and Master's programmes.

### 5.4 Certificate Files

Certificate files contain:

- programme identity;
- week/block architecture;
- modules;
- progression logic;
- practical competency baseline;
- safety-critical boundaries;
- chapter architecture when later developed;
- assessment/publication mapping;
- print-ready requirements.

## 6. Print-Ready Publishing Standard

The existing Section 26 rules remain mandatory across all modular files.

A dedicated `governance/PRINT_READY_PUBLISHING_STANDARD.md` will mirror the approved publishing rules for easier retrieval. It will include requirements for:

- semester-/module-wise subject PDFs;
- textbook front matter;
- introduction and subject scope;
- table of contents/index;
- lists of figures/tables/drawings;
- abbreviations/acronyms;
- symbols and units;
- chapter anatomy;
- summaries/key takeaways;
- glossary/references/bibliography;
- workbook design;
- practical manuals;
- journals/logbooks;
- instructor guides;
- question banks/exams/answer keys;
- diagrams, drawings, schematics, cutaways, charts, annotated photographs and other technical graphics;
- figure/table numbering and captions;
- print resolution/vector requirements;
- A4/binding/margin/bleed rules;
- PDF production/versioning rules.

This mirrored file is a navigation convenience, not a separate independent policy source. The master PRD remains the governance authority.

## 7. Synchronization Rules

1. New detailed curriculum work is written first in the relevant modular file.
2. `ACADEMIC_INDEX.md` is updated in the same change to reflect status/version/next target.
3. The master PRD is updated when a programme or major curriculum milestone is approved/frozen.
4. No existing curriculum detail may be silently dropped during migration.
5. Every migrated section must remain traceable to its prior master PRD section.
6. Programme codes and subject/module codes remain stable.
7. A modular file must not redefine a global governance rule differently from the master PRD.
8. If a global rule changes, update the master PRD first, then synchronize the governance mirror and affected modular files.

## 8. Migration Strategy

Migration will be incremental and lossless.

### Phase A — Infrastructure

Create:

- `ACADEMIC_INDEX.md`;
- governance directory and print-ready mirror;
- directory skeleton for all qualification levels.

### Phase B — Existing Curriculum Extraction

Extract already-developed material from the master PRD into modular files for:

- PAK-D01 to PAK-D05;
- PAK-C01 to PAK-C04.

No curriculum rewriting is required during migration except formatting normalization and cross-links.

### Phase C — Validation

Verify:

- all 5 Diploma programmes are represented;
- all 4 completed Certificate programmes are represented;
- 120 Diploma semester subject placements remain accounted for;
- 48 completed Certificate module placements remain accounted for;
- Section 26 publishing requirements remain represented;
- next controlled target remains PAK-C05.

### Phase D — Future Workflow

Continue new curriculum directly in modular files. At milestone points, synchronize the consolidated master PRD.

## 9. Branch Strategy

Implementation should use a **short-lived branch** created from the current `main`, for example:

`docs/modular-academic-curriculum`

The branch should contain only academic-documentation restructuring and migration changes. It should not include unrelated application code.

After validation, changes can be merged into `main`. The modular academic source itself lives on `main`; no permanent shadow/memory branch is required.

This avoids drift between a separate curriculum branch and the production repository while retaining safe isolation during migration.

## 10. Continuation Protocol for Future Sessions

When the user says `continue` or `append next`, the working sequence becomes:

1. Read `docs/academic/ACADEMIC_INDEX.md`.
2. Resolve the next controlled programme/semester/block.
3. Read only the relevant modular file(s) plus any necessary governance file.
4. Develop the next approved curriculum layer.
5. Update the modular file.
6. Update `ACADEMIC_INDEX.md`.
7. Update the master PRD only when required by the synchronization rule.
8. Verify the resulting files and commit.

This reduces context load and minimizes the risk of monolithic-file truncation or concurrent overwrite.

## 11. Versioning

Three version dimensions are allowed:

- **Master PRD version** — portfolio-wide governance/milestone version.
- **Programme version** — programme-level architecture version.
- **Publication version** — later textbook/workbook/manual PDF version.

A small semester edit does not necessarily require a new master PRD version unless it changes an approved portfolio-level milestone.

## 12. Acceptance Criteria

Implementation is complete when:

1. `ACADEMIC_INDEX.md` exists and accurately indexes all 34 programmes.
2. Existing completed curriculum for D01–D05 and C01–C04 is available in modular files without substantive loss.
3. Diploma programmes are split into overview + S1–S4 files.
4. Certificate C01–C04 files are created and linked.
5. Print-ready publishing requirements are available through the governance mirror and remain anchored to the master PRD.
6. The next target `PAK-C05` is explicit in the index.
7. No unrelated product/application code is modified.
8. The master PRD remains present and unchanged except for any necessary navigation/reference note approved during implementation.
9. File links resolve and programme/subject/module counts reconcile with the current master PRD.
10. Migration is committed through a short-lived branch ready for merge to `main`.

## 13. Out of Scope

This restructuring does not:

- create textbook prose;
- define chapter architecture not yet approved;
- assign ECTS/credits/contact hours;
- change qualification recognition claims;
- alter the current programme catalogue;
- change application code, database schema, deployment configuration or marketing-platform functionality.

## 14. Recommended Implementation Decision

Proceed with the short-lived-branch modularization approach described above. Keep the master PRD as the consolidated governance/audit source, use modular files as the operational curriculum source, and use `ACADEMIC_INDEX.md` as the first-read manifest for all future continuation work.
