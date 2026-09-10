# Modular Academic Curriculum Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current single-file PAK academic curriculum store into a governed modular working structure while preserving the master PRD as the consolidated audit source and preserving every already-developed curriculum detail.

**Architecture:** Keep `docs/academic/PAK_ACADEMIC_CURRICULUM_STUDY_MATERIAL_BLUEPRINT_PRD.md` as the master governance/audit document. Add `ACADEMIC_INDEX.md` as the primary continuation/navigation manifest, mirror global publishing rules under `governance/`, and extract completed programmes into small modular programme/semester files. All migration happens on a short-lived branch and is validated against the master PRD before merge.

**Tech Stack:** GitHub Markdown, repository branches, Git contents API, deterministic programme/subject codes, lightweight Python/shell validation.

**Spec:** `docs/superpowers/specs/2026-09-10-modular-academic-curriculum-storage-design.md`

## Global Constraints

- Existing master PRD remains authoritative for global governance and historical audit.
- Modular files become the preferred day-to-day curriculum editing surface.
- Migration must be lossless: no existing curriculum detail may be silently dropped.
- Programme codes and subject/module codes remain stable.
- Section 26 print-ready publishing rules remain mandatory everywhere.
- Completed baseline to preserve: D01–D05 = 120 semester subject placements; C01–C04 = 48 certificate module placements.
- Next controlled curriculum target remains `PAK-C05 — Certificate in Wheelset & Bogie Technology`.
- No unrelated application code may be changed in the migration branch.

---

## File Structure

### Create

- `docs/academic/ACADEMIC_INDEX.md` — single navigation/continuation manifest for all 34 programmes.
- `docs/academic/governance/PRINT_READY_PUBLISHING_STANDARD.md` — mirror of Section 26 for fast retrieval.
- `docs/academic/governance/CURRICULUM_CODING_AND_TRACEABILITY.md` — concise mirror of hierarchy, coding and traceability rules.
- `docs/academic/governance/REGULATORY_AND_QA_RULES.md` — concise mirror of current regulatory/source/QA control rules.
- `docs/academic/certificates/C01/PAK-C01.md`
- `docs/academic/certificates/C02/PAK-C02.md`
- `docs/academic/certificates/C03/PAK-C03.md`
- `docs/academic/certificates/C04/PAK-C04.md`
- `docs/academic/diplomas/D01/PAK-D01-OVERVIEW.md`
- `docs/academic/diplomas/D01/S1.md`
- `docs/academic/diplomas/D01/S2.md`
- `docs/academic/diplomas/D01/S3.md`
- `docs/academic/diplomas/D01/S4.md`
- Repeat the same five-file pattern for `D02`, `D03`, `D04`, and `D05`.

### Modify

- `docs/academic/PAK_ACADEMIC_CURRICULUM_STUDY_MATERIAL_BLUEPRINT_PRD.md` — add modular-source governance note and index link only after extraction validation passes; do not delete existing programme sections.

### Branch

- `docs/modular-academic-curriculum` — short-lived migration branch created from the then-current `main` commit.

---

### Task 1: Create Migration Branch and Navigation/Governance Layer

**Files:**
- Create: `docs/academic/ACADEMIC_INDEX.md`
- Create: `docs/academic/governance/PRINT_READY_PUBLISHING_STANDARD.md`
- Create: `docs/academic/governance/CURRICULUM_CODING_AND_TRACEABILITY.md`
- Create: `docs/academic/governance/REGULATORY_AND_QA_RULES.md`

**Interfaces:**
- Consumes: master PRD v0.1.9 and approved modular-storage spec.
- Produces: stable navigation contract used by every future curriculum turn.

- [ ] **Step 1: Create branch from current main**

Use GitHub branch creation with exact branch name:

```text
docs/modular-academic-curriculum
```

Expected: branch head equals current `main` commit before migration writes.

- [ ] **Step 2: Create `ACADEMIC_INDEX.md` with all 34 programmes**

The index must include these columns:

```markdown
| Code | Programme | Level | Duration | Academic Structure | Modular Path | Curriculum Status | Chapter Status | Study Material Status | Print Status | Master PRD Ref |
```

Required status values at migration time:

```text
PAK-C01..C04: Subject/Module Architecture Complete
PAK-C05..C12: Catalogue Only
PAK-D01..D05: Subject Architecture Complete
PAK-B01..B05: Catalogue Only
PAK-PGD01..PGD06: Catalogue Only
PAK-M01..M06: Catalogue Only
Chapter Status for all: Pending
Study Material Status for all: Not Started
Print Status for all: Not Started
Next Controlled Target: PAK-C05
```

At the top include this continuation protocol:

```markdown
1. Read this index first.
2. Read only the target programme/semester file plus applicable governance files.
3. Write detailed curriculum changes to the modular file first.
4. Update this index in the same change.
5. Synchronize the master PRD at approved programme/milestone boundaries.
```

- [ ] **Step 3: Create print-ready governance mirror**

`PRINT_READY_PUBLISHING_STANDARD.md` must explicitly state:

```text
Source authority: Section 26 of the master PRD.
This mirror is retrieval convenience only; it must not independently redefine policy.
```

It must preserve the substantive Section 26 requirements covering subject/module PDFs, textbook front matter, chapter anatomy, back matter, workbook, practical manual, journal/logbook, instructor guide, diagrams/drawings/graphics, print resolution, A4/page setup, PDF export, covers, typography, accessibility, copyright/source control, safety-critical illustration rules, filenames, production gates, and deliverable matrix.

- [ ] **Step 4: Create coding/traceability governance mirror**

Required content:

```markdown
Programme Level → Programme → Academic Period → Subject/Module → Chapter → Topic → Learning Outcome → Assessment → Study Material
```

Include programme-code conventions, stable subject/module/chapter identifiers, shared-module rule, and traceability rule.

- [ ] **Step 5: Create regulatory/QA governance mirror**

Required controls:

```text
- Current official EU/Polish/ERA/TSI references must be revalidated at book-writing/publication time.
- Proprietary standards are referenced/explained, not reproduced.
- Manufacturer/ECM/keeper procedures may be used only when legitimately available and applicable.
- Educational examples must not be presented as universal safety-critical limits.
- Qualification/authorization boundaries must be explicit.
```

- [ ] **Step 6: Verify navigation layer**

Check that the index contains exactly 34 unique programme codes and exactly one `Next Controlled Target: PAK-C05` declaration.

Example validation logic:

```python
import re
from pathlib import Path
text = Path('docs/academic/ACADEMIC_INDEX.md').read_text()
codes = re.findall(r'PAK-(?:C\d{2}|D\d{2}|B\d{2}|PGD\d{2}|M\d{2})', text)
assert len(set(codes)) == 34
assert text.count('Next Controlled Target: PAK-C05') == 1
```

Expected: both assertions pass.

- [ ] **Step 7: Commit Task 1**

```bash
git add docs/academic/ACADEMIC_INDEX.md docs/academic/governance/
git commit -m "docs: add modular academic index and governance mirrors"
```

---

### Task 2: Extract Completed Certificate Programmes C01–C04

**Files:**
- Create: `docs/academic/certificates/C01/PAK-C01.md`
- Create: `docs/academic/certificates/C02/PAK-C02.md`
- Create: `docs/academic/certificates/C03/PAK-C03.md`
- Create: `docs/academic/certificates/C04/PAK-C04.md`
- Modify: `docs/academic/ACADEMIC_INDEX.md`

**Interfaces:**
- Consumes: master PRD Sections 23, 24, 27 and 29 plus Section 26 governance.
- Produces: one independently retrievable source file per completed certificate.

- [ ] **Step 1: Extract C01 losslessly**

Copy the complete C01 programme content into `certificates/C01/PAK-C01.md`, preserving:

```text
Programme identity
Purpose
Design principles
12-week / 12-module table
Weekly progression logic
Module inventory
Pathway/shared-module strategy
Competency boundary
Technical/regulatory baseline
Practical controls
Assessment placeholder
Chapter-decomposition readiness
```

Add only a short modular-file header with master PRD source reference and current version.

- [ ] **Step 2: Extract C02 losslessly**

Preserve the complete 24-week / 12-module architecture and all practical/safety/assessment/chapter-readiness sections from master Section 24.

- [ ] **Step 3: Extract C03 losslessly**

Preserve the complete Freight Wagon Maintenance content from master Section 27, including freight-wagon safety boundaries, ECM/WAG TSI awareness, and technical visual/publication readiness.

- [ ] **Step 4: Extract C04 losslessly**

Preserve the complete Locomotive Maintenance content from master Section 29, including all 12 modules and the mandatory C04 technical visual plan.

- [ ] **Step 5: Update index paths/status**

Set exact modular paths:

```text
docs/academic/certificates/C01/PAK-C01.md
docs/academic/certificates/C02/PAK-C02.md
docs/academic/certificates/C03/PAK-C03.md
docs/academic/certificates/C04/PAK-C04.md
```

Keep chapter/material/print statuses unchanged.

- [ ] **Step 6: Validate certificate module counts**

Use deterministic code counts:

```python
from pathlib import Path
for code in ['C01','C02','C03','C04']:
    text = Path(f'docs/academic/certificates/{code}/PAK-{code}.md').read_text()
    count = sum(1 for i in range(101, 113) if f'{code}-{i}' in text)
    assert count == 12, (code, count)
```

Expected: each certificate contains all 12 module codes.

- [ ] **Step 7: Commit Task 2**

```bash
git add docs/academic/certificates docs/academic/ACADEMIC_INDEX.md
git commit -m "docs: extract completed certificate curricula into modular files"
```

---

### Task 3: Extract Diploma D01–D05 into Overview + Semester Files

**Files:**
- Create: `docs/academic/diplomas/D01/PAK-D01-OVERVIEW.md`
- Create: `docs/academic/diplomas/D01/S1.md` through `S4.md`
- Repeat exact five-file pattern for D02–D05.
- Modify: `docs/academic/ACADEMIC_INDEX.md`

**Interfaces:**
- Consumes: master PRD Sections 17–21.
- Produces: one programme overview and four independently editable semester files per diploma.

- [ ] **Step 1: Extract D01 overview**

Overview must preserve:

```text
Programme identity and purpose
Curriculum design principles
Subject inventory
Dependency spine
Regulatory/technical baseline
Chapter-decomposition readiness
```

Replace embedded semester detail in the overview with links to `S1.md` through `S4.md`; do not remove detail from the master PRD.

- [ ] **Step 2: Extract D01 semester files**

Each `Sx.md` must contain:

```text
Programme code/title
Academic year and semester
Semester objective
Six-subject table
Semester progression logic
Source reference to the master PRD
Section 26 publication rule link
```

Exact mapping:

```text
S1: D01-101..D01-106
S2: D01-201..D01-206
S3: D01-301..D01-306
S4: D01-401..D01-406
```

- [ ] **Step 3: Repeat extraction for D02**

Exact semester code sets:

```text
S1: D02-101..D02-106
S2: D02-201..D02-206
S3: D02-301..D02-306
S4: D02-401..D02-406
```

- [ ] **Step 4: Repeat extraction for D03**

Exact semester code sets:

```text
S1: D03-101..D03-106
S2: D03-201..D03-206
S3: D03-301..D03-306
S4: D03-401..D03-406
```

- [ ] **Step 5: Repeat extraction for D04**

Exact semester code sets:

```text
S1: D04-101..D04-106
S2: D04-201..D04-206
S3: D04-301..D04-306
S4: D04-401..D04-406
```

- [ ] **Step 6: Repeat extraction for D05**

Exact semester code sets:

```text
S1: D05-101..D05-106
S2: D05-201..D05-206
S3: D05-301..D05-306
S4: D05-401..D05-406
```

- [ ] **Step 7: Update diploma index paths**

For each diploma row, set the overview path and enumerate semester paths directly beneath the row or in a linked details table.

- [ ] **Step 8: Validate 120 diploma subject placements**

Validation logic:

```python
from pathlib import Path
found = []
for d in range(1, 6):
    code = f'D{d:02d}'
    for s in range(1, 5):
        text = Path(f'docs/academic/diplomas/{code}/S{s}.md').read_text()
        hundred = s * 100
        expected = [f'{code}-{hundred+i}' for i in range(1, 7)]
        for subject in expected:
            assert subject in text, (code, s, subject)
            found.append(subject)
assert len(found) == 120
assert len(set(found)) == 120
```

Expected: 120 unique subject placements.

- [ ] **Step 9: Commit Task 3**

```bash
git add docs/academic/diplomas docs/academic/ACADEMIC_INDEX.md
git commit -m "docs: split diploma curricula into programme and semester files"
```

---

### Task 4: Add Master PRD Modular-Source Note Without Deleting History

**Files:**
- Modify: `docs/academic/PAK_ACADEMIC_CURRICULUM_STUDY_MATERIAL_BLUEPRINT_PRD.md`
- Modify: `docs/academic/ACADEMIC_INDEX.md`

**Interfaces:**
- Consumes: validated modular files from Tasks 1–3.
- Produces: explicit governance relationship between master PRD and modular working layer.

- [ ] **Step 1: Add modular-source rule to master PRD**

Add a concise governance note near the canonical-document section stating:

```markdown
### Modular Working Source

`docs/academic/ACADEMIC_INDEX.md` is the primary navigation and continuation entry point.
Detailed day-to-day curriculum work is performed in the corresponding modular programme/semester/block files.
The master PRD remains the consolidated governance and audit authority.
Approved programme/milestone changes must be synchronized back into this master document.
```

Do not remove or shorten Sections 17–30.

- [ ] **Step 2: Add migration checkpoint to index**

Record:

```text
Migration status: Complete for C01–C04 and D01–D05
Preserved certificate placements: 48
Preserved diploma placements: 120
Next controlled target: PAK-C05
```

- [ ] **Step 3: Verify master historical content remains present**

Check these anchors exist after update:

```text
# 17. PAK-D01
# 18. PAK-D02
# 19. PAK-D03
# 20. PAK-D04
# 21. PAK-D05
# 23. PAK-C01
# 24. PAK-C02
# 26. Global Print-Ready Academic Publishing & Book Production Standard
# 27. PAK-C03
# 29. PAK-C04
```

Expected: all anchors remain.

- [ ] **Step 4: Commit Task 4**

```bash
git add docs/academic/PAK_ACADEMIC_CURRICULUM_STUDY_MATERIAL_BLUEPRINT_PRD.md docs/academic/ACADEMIC_INDEX.md
git commit -m "docs: link master academic PRD to modular working sources"
```

---

### Task 5: Full Migration Validation and Merge Readiness

**Files:**
- Read/validate: all files created in Tasks 1–4.
- No unrelated file modifications.

**Interfaces:**
- Consumes: complete modular migration branch.
- Produces: verified branch ready for integration into `main`.

- [ ] **Step 1: Validate programme catalogue coverage**

Assertions:

```python
assert certificate_programmes == 12
assert diploma_programmes == 5
assert bachelor_programmes == 5
assert pgd_programmes == 6
assert master_programmes == 6
assert total_programmes == 34
```

- [ ] **Step 2: Validate completed curriculum preservation**

Assertions:

```python
assert completed_certificate_files == 4
assert certificate_module_placements == 48
assert diploma_programme_overviews == 5
assert diploma_semester_files == 20
assert diploma_subject_placements == 120
```

- [ ] **Step 3: Validate publishing-governance discoverability**

Confirm that each completed modular programme contains an explicit pointer to:

```text
docs/academic/governance/PRINT_READY_PUBLISHING_STANDARD.md
```

and that the mirror declares Section 26 as its authority.

- [ ] **Step 4: Validate no unrelated branch changes**

Compare branch against its base and require all migration changes to remain within:

```text
docs/academic/
docs/superpowers/plans/
```

The already-approved spec under `docs/superpowers/specs/` predates the migration branch and is not a migration change.

- [ ] **Step 5: Verify continuation target**

Read only `ACADEMIC_INDEX.md` and confirm a new session can determine without opening the 200 KB master PRD that the next task is:

```text
PAK-C05 — Certificate in Wheelset & Bogie Technology — 4 Months
```

- [ ] **Step 6: Review branch diff**

Reject merge if:

```text
- any completed subject/module code is missing;
- the master PRD lost existing programme content;
- global publishing policy conflicts with Section 26;
- more than one file claims independent governance authority;
- next target is not PAK-C05;
- unrelated application code changed.
```

- [ ] **Step 7: Final migration commit if validation required metadata fixes**

```bash
git add docs/academic
git commit -m "docs: validate modular academic curriculum migration"
```

Skip this commit if validation produces no changes.

- [ ] **Step 8: Integrate branch into main**

Create a pull request from:

```text
docs/modular-academic-curriculum -> main
```

Review changed filenames and diff, then merge only after preservation checks pass. After merge, verify `ACADEMIC_INDEX.md`, one certificate file, one diploma semester file, and the master PRD directly from `main`.

---

## Post-Migration Continuation Rule

After this plan is complete, a normal `continue` / `append next` turn should no longer rewrite the full master PRD for every step. The default sequence becomes:

```text
ACADEMIC_INDEX.md
→ target programme modular file
→ relevant governance mirror(s)
→ append/update target curriculum
→ update ACADEMIC_INDEX.md
→ synchronize master PRD only at programme or major governance milestone
```

For the immediate next curriculum task, the retrieval set should be only:

```text
docs/academic/ACADEMIC_INDEX.md
docs/academic/governance/PRINT_READY_PUBLISHING_STANDARD.md
docs/academic/certificates/C05/PAK-C05.md (created when work begins)
```

with the master PRD consulted only when a global governance rule or historical programme baseline is needed.
