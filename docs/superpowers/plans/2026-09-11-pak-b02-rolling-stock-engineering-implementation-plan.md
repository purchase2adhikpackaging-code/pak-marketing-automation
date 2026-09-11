# PAK-B02 Rolling Stock Engineering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved PAK-B02 Bachelor's-Level Rolling Stock Engineering architecture as seven modular curriculum files plus an academic-index update, preserving 36 approved subject placements and all governance boundaries.

**Architecture:** B02 is implemented as one programme overview plus six semester files under `docs/academic/bachelors/B02/`. Each semester owns exactly six subjects and its own progression/safety/publication notes. `ACADEMIC_INDEX.md` is the only existing academic file modified; the consolidated master PRD remains byte-for-byte unchanged at v0.2.0 until the Bachelor's batch synchronization milestone.

**Tech Stack:** Markdown curriculum documents, Git/GitHub branch + PR workflow, repository Node/TypeScript CI (typecheck, lint, unit tests, production build, Playwright E2E).

**Spec:** `docs/superpowers/specs/2026-09-11-pak-b02-rolling-stock-engineering-design.md`

## Global Constraints

- Programme code: `PAK-B02`.
- Programme level: Bachelor's-level curriculum architecture only.
- Duration: **3 Years / 6 Semesters**.
- Subject placement baseline: **36 subjects**, exactly **6 per semester**.
- Approved subject codes and titles from the design spec must be preserved exactly.
- B02 must remain specialist rolling-stock engineering; B01 remains broad systems engineering and B03–B05 retain their deeper specializations.
- B02 must sit above Diploma depth through engineering analysis, vehicle modelling, dynamics, design, subsystem interfaces, validation, RAMS, reliability, lifecycle reasoning, optimization, research and multidisciplinary systems integration.
- Completion does not itself confer safety-critical operational, maintenance-release, NDT, brake-release, high-voltage, software-approval, homologation or conformity-assessment authority.
- Formal degree naming/award claims remain subject to Polish authorization/accreditation and/or an authorized higher-education awarding partner.
- No chapter architecture, learning-outcome decomposition, contact-hour/credit mapping or textbook prose is introduced in this implementation.
- Master PRD must remain unchanged at v0.2.0; expected Git blob is `4a9e119ec37b4edab88dee18cb49bb5110bae8be`.
- Final academic diff must contain exactly eight files: seven new B02 modular files plus `docs/academic/ACADEMIC_INDEX.md`.
- After B02 completion, next controlled target is **PAK-B03 — Bachelor's-Level Railway Electrical, Signalling & Control Systems — 3 Years / 6 Semesters**.

---

## File Structure

### Create
- `docs/academic/bachelors/B02/PAK-B02-OVERVIEW.md`
- `docs/academic/bachelors/B02/S1.md`
- `docs/academic/bachelors/B02/S2.md`
- `docs/academic/bachelors/B02/S3.md`
- `docs/academic/bachelors/B02/S4.md`
- `docs/academic/bachelors/B02/S5.md`
- `docs/academic/bachelors/B02/S6.md`

### Modify
- `docs/academic/ACADEMIC_INDEX.md`

### Must Not Modify
- `docs/academic/PAK_ACADEMIC_CURRICULUM_STUDY_MATERIAL_BLUEPRINT_PRD.md`
- Certificate or Diploma programme files
- B01 programme files
- Governance mirror files unless separately approved

---

### Task 0: Verify Baseline and Governance

**Files:** verify current `main`, master PRD and B02 design/plan.

- [ ] Confirm branch `docs/curriculum-b02` is based on current `main`.
- [ ] Fetch `docs/academic/PAK_ACADEMIC_CURRICULUM_STUDY_MATERIAL_BLUEPRINT_PRD.md` and confirm blob `4a9e119ec37b4edab88dee18cb49bb5110bae8be`.
- [ ] Confirm `ACADEMIC_INDEX.md` currently identifies B02 as `Catalogue Only` and B02 as the immediate controlled target.
- [ ] Scan the B02 design and plan for unresolved `TBD`, `TODO`, `implement later`, or `fill in details` markers.

Expected: all baseline checks pass before curriculum files are created.

---

### Task 1: Create B02 Programme Overview

**Files:**
- Create: `docs/academic/bachelors/B02/PAK-B02-OVERVIEW.md`

**Interfaces:** Consumes the approved design; produces canonical programme identity, semester navigation, progression spines and governance boundaries.

- [ ] State exact identity: PAK-B02, Bachelor's-Level Rolling Stock Engineering, 3 Academic Years, 6 Semesters, English.
- [ ] Add degree-awarding caveat.
- [ ] Explain specialist vehicle-engineering purpose and distinction from B01, Diploma programmes and B03–B05.
- [ ] Add curriculum principles emphasizing vehicle dynamics, wheel–rail/running gear, braking, traction interfaces, carbody, RAMS, validation, digital rolling stock, reliability and lifecycle engineering.
- [ ] Link S1–S6.
- [ ] State **36 semester subject placements**, exactly six per semester.
- [ ] Add progression spines from the design spec.
- [ ] Add regulatory/safety baseline and architecture-before-books gate.

Validation: overview must contain `PAK-B02`, `3 Academic Years`, `6 Semesters`, `36 semester subject placements`, `Degree-awarding caveat`, `S1.md` through `S6.md`, `B01`, `B03`, `B04`, `B05`, and `Architecture-before-books`.

---

### Task 2: Create Semester 1 — Engineering & Rolling Stock Foundations

**Files:** `docs/academic/bachelors/B02/S1.md`

Create exact subject table:

| Code | Subject |
|---|---|
| B02-101 | Engineering Mathematics I |
| B02-102 | Engineering Physics, Statics & Dynamics |
| B02-103 | Engineering Drawing, CAD & Technical Documentation |
| B02-104 | Engineering Materials, Metallurgy & Manufacturing Fundamentals |
| B02-105 | Electrical & Electronic Engineering Fundamentals for Rolling Stock |
| B02-106 | Railway Systems, Rolling Stock Introduction, Safety & Technical Communication |

Add classifications/orientations, progression logic, controlled CAD/material/electrical/vehicle demonstrations, safety boundaries, future visual/publication requirements and architecture-before-books gate.

Validation: exact codes `B02-101` through `B02-106`, once each.

---

### Task 3: Create Semester 2 — Core Vehicle Engineering Sciences

**Files:** `docs/academic/bachelors/B02/S2.md`

Create exact subject table:

| Code | Subject |
|---|---|
| B02-201 | Engineering Mathematics II, Statistics & Numerical Methods |
| B02-202 | Strength of Materials & Structural Mechanics |
| B02-203 | Thermodynamics, Fluid Mechanics, Pneumatics & Hydraulics |
| B02-204 | Electrical Machines, Power Electronics & Control Fundamentals |
| B02-205 | Manufacturing Processes, Metrology & Quality Fundamentals |
| B02-206 | Programming, Data Analysis & Engineering Computation |

Add prerequisites, lab/safety notes and progression toward vehicle subsystem engineering.

Validation: exact codes `B02-201` through `B02-206`, once each.

---

### Task 4: Create Semester 3 — Rolling Stock Subsystem Engineering I

**Files:** `docs/academic/bachelors/B02/S3.md`

Create exact subject table:

| Code | Subject |
|---|---|
| B02-301 | Rolling Stock Architecture, Vehicle Systems & Requirements Engineering |
| B02-302 | Wheelsets, Axleboxes, Bearings & Bogie Engineering I |
| B02-303 | Vehicle Dynamics, Suspension & Ride Engineering I |
| B02-304 | Railway Braking, Pneumatic & Door Systems Engineering I |
| B02-305 | Traction Equipment, Drives & Onboard Electrical Systems I |
| B02-306 | Rolling Stock Laboratory, Workshop & Systems Integration Practicum I |

Add subsystem-integration logic; exclude operational/brake-release/high-voltage/maintenance-release authority; require future vehicle architecture, bogie, wheelset, suspension, brake, traction and interface visuals.

Validation: exact codes `B02-301` through `B02-306`, once each.

---

### Task 5: Create Semester 4 — Rolling Stock Subsystem Engineering II

**Files:** `docs/academic/bachelors/B02/S4.md`

Create exact subject table:

| Code | Subject |
|---|---|
| B02-401 | Bogie, Wheel–Rail Interface & Running Gear Engineering II |
| B02-402 | Vehicle Dynamics, Ride, Stability & Simulation II |
| B02-403 | Braking, Pneumatic & Safety-Critical Vehicle Systems II |
| B02-404 | Traction Drives, Auxiliary Power & Onboard Electrical Systems II |
| B02-405 | Carbody Structures, Crashworthiness, Interiors, HVAC & Fire Safety |
| B02-406 | Maintenance Engineering, Reliability, NDT & Condition Monitoring for Rolling Stock |

Add modelling/reliability/safety logic, educational NDT boundary, controlled electrical and brake-system work, and future simulation/reliability/structural/fire-safety publication requirements.

Validation: exact codes `B02-401` through `B02-406`, once each.

---

### Task 6: Create Semester 5 — Vehicle Integration, Validation & Lifecycle Engineering

**Files:** `docs/academic/bachelors/B02/S5.md`

Create exact subject table:

| Code | Subject |
|---|---|
| B02-501 | Rolling Stock Design, Systems Engineering & Configuration Management |
| B02-502 | Digital Rolling Stock, TCMS, Sensors, Data Analytics & Cybersecurity |
| B02-503 | Vehicle Testing, Validation, Homologation, TSIs & Compliance |
| B02-504 | Rolling Stock Manufacturing, Welding, Quality Assurance & Industrialization |
| B02-505 | RAMS, Safety Assurance, Human Factors & Lifecycle Engineering |
| B02-506 | Integrated Rolling Stock Design Project & Practicum II |

Add configuration/change-control, defensive cybersecurity, validation/homologation non-authority boundary, manufacturing/quality interface and integrated design-project logic.

Validation: exact codes `B02-501` through `B02-506`, once each.

---

### Task 7: Create Semester 6 — Advanced Rolling Stock Engineering & Professional Capstone

**Files:** `docs/academic/bachelors/B02/S6.md`

Create exact subject table:

| Code | Subject |
|---|---|
| B02-601 | Advanced Vehicle Dynamics, Wheel–Rail Contact & Performance Engineering |
| B02-602 | Fleet Asset Management, Maintenance Optimization & Depot Engineering |
| B02-603 | Diagnostics, Predictive Maintenance & Reliability Analytics |
| B02-604 | Research Methods, Engineering Innovation, Ethics & Technical Writing |
| B02-605 | Rolling Stock Industry Internship / Professional Engineering Practice |
| B02-606 | Final-Year Rolling Stock Engineering Capstone / Thesis |

Add industry-practice controls, research/data provenance, advanced vehicle-performance analysis, maintenance optimization, capstone requirements and architecture-before-books gate.

Validation: exact codes `B02-601` through `B02-606`, once each.

---

### Task 8: Update Academic Index

**Files:** Modify `docs/academic/ACADEMIC_INDEX.md` only.

- [ ] Change B02 registry status from `Catalogue Only` to `Subject Architecture Complete`.
- [ ] Preserve B01 as `Subject Architecture Complete`.
- [ ] Change completed Bachelor's-level programmes from **1 of 5** to **2 of 5**.
- [ ] Change cumulative Bachelor's-level semester subject placements from **36** to **72**.
- [ ] Record B02 modular files created: **7** and B02 placements: **36**.
- [ ] Keep Bachelor's batch master synchronization deferred until B01–B05 complete.
- [ ] Advance next controlled target to **PAK-B03 — Bachelor's-Level Railway Electrical, Signalling & Control Systems — 3 Years / 6 Semesters**.
- [ ] Keep Certificate `126`, Diploma `120`, chapter `Pending`, study materials `Not Started`, print `Not Started` and master version `0.2.0` unchanged.

---

### Task 9: Deterministic Curriculum Integrity Verification

Verify before opening PR:

1. B02 directory contains exactly seven Markdown files: overview + S1–S6.
2. Semester files contain exactly 36 unique codes, six per semester.
3. Codes are exactly `B02-101..106`, `201..206`, `301..306`, `401..406`, `501..506`, `601..606`.
4. All 36 approved titles match the design spec exactly.
5. Degree-awarding caveat, safety/authorization boundary, chapter-decomposition-pending state and architecture-before-books gate are present.
6. No `## Chapter 1` or equivalent premature chapter architecture is introduced.
7. Master PRD blob is still `4a9e119ec37b4edab88dee18cb49bb5110bae8be`.
8. Academic diff is exactly:
   - `docs/academic/ACADEMIC_INDEX.md`
   - `docs/academic/bachelors/B02/PAK-B02-OVERVIEW.md`
   - `docs/academic/bachelors/B02/S1.md`
   - `docs/academic/bachelors/B02/S2.md`
   - `docs/academic/bachelors/B02/S3.md`
   - `docs/academic/bachelors/B02/S4.md`
   - `docs/academic/bachelors/B02/S5.md`
   - `docs/academic/bachelors/B02/S6.md`

If any check fails, stop and correct before PR creation.

---

### Task 10: Repository Verification and Pull Request

- [ ] Open PR titled `docs: add PAK-B02 bachelor's-level rolling stock engineering architecture`.
- [ ] PR body states: B02 overview + six semester files; 36 placements; rolling-stock specialization; safety/degree boundaries; master PRD unchanged; next target B03; chapter/study-material work gated.
- [ ] Verify PR changed-file scope: the eight academic files plus only the approved B02 design and implementation-plan governance files.
- [ ] Wait for repository CI and inspect all established stages: dependency install, typecheck, lint, unit tests, production build, Playwright setup and E2E smoke.
- [ ] Distinguish Vercel status from repository CI.
- [ ] Merge only when PR is mergeable, CI is green and head SHA has not moved since verification.

---

### Task 11: Post-Merge Verification

Against fresh `main`:

- [ ] Verify all seven B02 files exist.
- [ ] Reconfirm 36 unique B02 subject placements and exact titles.
- [ ] Confirm index shows B02 `Subject Architecture Complete`, **2 of 5**, **72** cumulative placements, and B03 as next controlled target.
- [ ] Reconfirm Master PRD remains v0.2.0 with blob `4a9e119ec37b4edab88dee18cb49bb5110bae8be`.
- [ ] Record merge commit and CI run/job identifiers.

## Self-Review Results

- Spec coverage: all programme identity, specialization, six-semester/36-subject architecture, governance, safety, regulatory, publication-gate and B03-continuation requirements map to Tasks 1–11.
- Placeholder scan: no unresolved placeholders are permitted.
- Interface consistency: canonical interfaces are file paths, exact subject codes/titles, index counts/status and immutable master blob.
