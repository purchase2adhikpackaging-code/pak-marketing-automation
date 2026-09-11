# PAK-B01 Railway Engineering — Curriculum Architecture Design

**Date:** 11 September 2026  
**Programme:** PAK-B01 — Bachelor's-Level Railway Engineering  
**Duration:** 3 Years / 6 Semesters  
**Design Status:** Approved architecture awaiting repository implementation  
**Master PRD Baseline:** v0.2.0  
**Governance:** Architecture-before-books; degree-awarding caveat mandatory

## 1. Purpose

Define the six-semester subject architecture for PAK-B01 as the broad multidisciplinary engineering spine of the PAK Bachelor's-level portfolio. B01 must integrate railway infrastructure, rolling stock, traction/electrical systems, signalling/control, operations, safety/RAMS, digital railway, asset management and lifecycle engineering without duplicating the deeper specialization intended for B02–B05.

This design covers programme-level and semester-level subject architecture only. It does not define chapter structures, learning outcomes, credits/ECTS, contact hours, detailed assessments, or textbook prose.

## 2. Positioning in the Portfolio

PAK-B01 is the generalist railway engineering programme. It must sit above the applied Diploma layer and below future postgraduate/master's specialization.

### Distinction from Diploma programmes

Diploma programmes emphasize technician/junior-engineering competence, maintenance practice, inspection, workshop activity, controlled diagnostics and applied operations.

PAK-B01 adds:
- higher mathematics and engineering science;
- analytical modelling and numerical methods;
- engineering design decisions;
- subsystem/interface engineering;
- RAMS and safety engineering;
- lifecycle and asset-management reasoning;
- simulation and optimization;
- research methods;
- multidisciplinary design projects;
- final-year thesis/capstone.

### Distinction from B02–B05

- B02: deeper Rolling Stock Engineering.
- B03: deeper Electrical, Signalling & Control Systems.
- B04: deeper Operations, Logistics & Transport Management.
- B05: deeper Manufacturing & Maintenance Engineering.

B01 must remain broad and systems-oriented so that those programmes retain clear specialization value.

## 3. Programme Architecture

**Academic structure:** 6 semesters  
**Subject placement baseline:** 36 subjects  
**Subjects per semester:** 6

### Semester 1 — Engineering & Railway Foundations

| Code | Subject |
|---|---|
| B01-101 | Engineering Mathematics I |
| B01-102 | Engineering Physics, Statics & Dynamics |
| B01-103 | Engineering Drawing, CAD & Technical Documentation |
| B01-104 | Engineering Materials & Manufacturing Fundamentals |
| B01-105 | Electrical & Electronic Engineering Fundamentals |
| B01-106 | Railway Systems, Safety & Professional Technical Communication |

**Purpose:** establish the mathematical, scientific, drawing, materials, electrical and railway-system foundation required for multidisciplinary railway engineering.

### Semester 2 — Core Engineering Sciences

| Code | Subject |
|---|---|
| B01-201 | Engineering Mathematics II, Statistics & Numerical Methods |
| B01-202 | Strength of Materials & Structural Mechanics |
| B01-203 | Thermodynamics, Fluid Mechanics, Pneumatics & Hydraulics |
| B01-204 | Electrical Machines, Power Systems & Control Fundamentals |
| B01-205 | Surveying, Track Geometry & Railway Infrastructure Fundamentals |
| B01-206 | Programming, Data Analysis & Engineering Computation |

**Purpose:** develop the analytical engineering sciences and computational skills needed for subsystem engineering in Years 2 and 3.

### Semester 3 — Railway Subsystem Engineering I

| Code | Subject |
|---|---|
| B01-301 | Railway Track, Structures & Geotechnical Engineering |
| B01-302 | Rolling Stock Engineering & Vehicle Dynamics I |
| B01-303 | Railway Traction, Electrification & Energy Systems I |
| B01-304 | Signalling, Train Control & Railway Communication Systems I |
| B01-305 | Railway Braking, Pneumatic & Safety-Critical Vehicle Systems |
| B01-306 | Engineering Laboratory, Workshop & Systems Integration Practicum I |

**Purpose:** introduce the main physical railway subsystems and their interfaces using engineering analysis rather than technician-only maintenance treatment.

### Semester 4 — Railway Subsystem Engineering II

| Code | Subject |
|---|---|
| B01-401 | Rolling Stock Engineering & Vehicle Dynamics II |
| B01-402 | Railway Infrastructure Design, Maintenance & Asset Condition |
| B01-403 | Traction Power, Power Electronics & Energy Management II |
| B01-404 | Signalling, Interlocking, Train Protection & Digital Control II |
| B01-405 | Maintenance Engineering, Reliability, NDT & Condition Monitoring |
| B01-406 | Railway Systems Engineering, RAMS, Human Factors & Safety Engineering |

**Purpose:** deepen subsystem analysis and introduce formal systems/RAMS/safety thinking, reliability and condition-monitoring disciplines.

### Semester 5 — Network & Lifecycle Integration

| Code | Subject |
|---|---|
| B01-501 | Railway Operations, Timetabling, Capacity & Logistics for Engineers |
| B01-502 | Railway Systems Modelling, Simulation & Optimization |
| B01-503 | Interoperability, TSIs, ECM, Quality & Railway Compliance |
| B01-504 | Digital Railway, IoT, Data Analytics, Predictive Maintenance & Cybersecurity |
| B01-505 | Railway Project Engineering, Economics, Sustainability & Lifecycle Cost |
| B01-506 | Integrated Railway Systems Design Project & Practicum II |

**Purpose:** move from subsystem knowledge to network, lifecycle, regulatory, digital and project-level engineering integration.

### Semester 6 — Professional Engineering & Capstone

| Code | Subject |
|---|---|
| B01-601 | Advanced Railway Systems Integration & Interface Engineering |
| B01-602 | Railway Asset Management, Reliability & Lifecycle Engineering |
| B01-603 | Safety Assurance, Risk, Verification & Engineering Governance |
| B01-604 | Research Methods, Engineering Innovation, Ethics & Technical Writing |
| B01-605 | Railway Industry Internship / Professional Engineering Practice |
| B01-606 | Final-Year Railway Engineering Capstone / Thesis |

**Purpose:** demonstrate professional-level integration, engineering governance, research capability, industry application and independent capstone work.

## 4. Progression Logic

### Mathematics and modelling spine
B01-101 → B01-201 → B01-206 → B01-502 → B01-606

### Mechanical / rolling-stock spine
B01-102 + B01-104 → B01-202 → B01-302/B01-305 → B01-401/B01-405 → B01-601/B01-602 → B01-606

### Infrastructure spine
B01-102 + B01-103 → B01-205 → B01-301 → B01-402 → B01-501/B01-502/B01-505 → B01-601/B01-606

### Electrical / traction spine
B01-105 → B01-204 → B01-303 → B01-403 → B01-504 → B01-601/B01-606

### Signalling / control spine
B01-105 + B01-204 + B01-206 → B01-304 → B01-404 → B01-504 → B01-601/B01-603

### Safety / RAMS / governance spine
B01-106 → B01-305 → B01-406 → B01-503 → B01-603 → B01-606

## 5. Academic Depth Rules

B01 is not a collection of Diploma modules with new codes. Each B01 subject must add at least one of the following beyond Diploma depth:
- mathematical derivation or quantitative analysis;
- engineering design or sizing reasoning;
- simulation/modelling;
- subsystem interface analysis;
- lifecycle/reliability trade-off;
- verification/validation reasoning;
- optimization;
- research-based analysis;
- multidisciplinary systems integration.

Applied practical work remains required, but it must support engineering reasoning rather than dominate the programme as workshop craft training.

## 6. Safety and Authorization Boundaries

The programme is academic engineering education. Completion alone does not authorize:
- train driving, dispatching, signalling operation or shunting command;
- safety-critical signalling design approval, testing authority or commissioning sign-off;
- traction-power switching or high-voltage operational authority;
- independent maintenance release/return-to-service decisions;
- independent NDT certification/sign-off;
- formal ECM, conformity-assessment, safety-assessment or certification authority;
- statutory infrastructure inspection/sign-off;
- any employer/jurisdiction-specific licensed or authorized railway duty.

Safety-critical parameters, limits, procedures and acceptance criteria must come from approved current controlled sources.

## 7. Regulatory and Technical Reference Families

Future chapter development must verify current editions of, as applicable:
- Directive (EU) 2016/797 — railway interoperability;
- Directive (EU) 2016/798 — railway safety;
- applicable TSIs: INF, ENE, LOC&PAS, WAG, CCS, OPE and telematics-related instruments;
- Regulation (EU) 2019/779 — ECM;
- ERA Common Safety Methods and guidance;
- applicable EN/IEC/ISO railway, RAMS, electrical, structural, signalling, cybersecurity, quality, NDT and asset-management standards;
- relevant Polish railway law and national rules;
- approved infrastructure-manager, railway-undertaking, manufacturer and maintenance-organization controlled documents where legitimately available.

No standards text should be reproduced beyond permitted quotation/use. Publication-time revalidation is mandatory.

## 8. Modular Repository Structure

Implementation should create:

- `docs/academic/bachelors/B01/PAK-B01-OVERVIEW.md`
- `docs/academic/bachelors/B01/S1.md`
- `docs/academic/bachelors/B01/S2.md`
- `docs/academic/bachelors/B01/S3.md`
- `docs/academic/bachelors/B01/S4.md`
- `docs/academic/bachelors/B01/S5.md`
- `docs/academic/bachelors/B01/S6.md`
- update `docs/academic/ACADEMIC_INDEX.md`

The master PRD should remain at v0.2.0 during individual B01–B05 architecture development. Bachelor's architectures should be synchronized to the master at a controlled batch milestone.

## 9. File Content Requirements

### Programme overview file
Must contain:
- programme identity and degree-awarding caveat;
- programme purpose;
- curriculum design principles;
- semester map;
- 36-subject inventory statement;
- progression/dependency spines;
- distinction from B02–B05;
- regulatory/safety baseline;
- chapter-decomposition readiness;
- architecture-before-books gate.

### Semester files
Each semester file must contain:
- semester title and objective;
- six-subject table;
- classification/orientation;
- prerequisites/co-requisites where appropriate;
- progression logic;
- practical/lab/simulation expectations;
- safety/authorization notes where applicable;
- future chapter-decomposition requirements;
- print-ready publication implications.

## 10. Publishing and Study-Material Gate

No B01 textbook prose should begin during this phase.

Before any B01 subject book enters production, that subject must have:
- approved chapter architecture;
- learning outcomes;
- theory/practical mapping;
- worked-example plan;
- technical-visual plan;
- laboratory/workshop/simulation plan;
- assessment linkage;
- regulatory/reference register;
- safety-critical flags;
- publication deliverable classification;
- print-ready requirements.

## 11. Degree-Awarding Caveat

PAK-B01 is currently a Bachelor's-level curriculum architecture only. It must not be marketed or awarded as a recognized Polish Bachelor's degree unless PAK has the required legal authorization/accreditation and/or an appropriately authorized higher-education awarding partner.

The programme title may be retained in curriculum planning, but all external claims must comply with the master PRD qualification-and-awarding caveat.

## 12. Verification Criteria for Implementation

Implementation is acceptable only if all of the following are true:
1. exactly seven B01 modular files are created: one overview + six semester files;
2. exactly 36 subject placements exist, six per semester;
3. subject codes B01-101 through B01-606 follow semester-based numbering with no duplicates;
4. all approved subject titles from this design are preserved;
5. B01 status in the academic index changes from Catalogue Only to Subject Architecture Complete;
6. next controlled target becomes PAK-B02;
7. master PRD remains unchanged at v0.2.0;
8. no chapter architecture or textbook prose is introduced;
9. degree-awarding and safety authorization boundaries are explicit;
10. repository diff contains only the seven B01 files plus the academic index unless an explicitly approved governance correction is required.

## 13. Next Controlled Target After B01

After B01 architecture is implemented and verified, the next controlled programme is:

**PAK-B02 — Bachelor's-Level Rolling Stock Engineering — 3 Years / 6 Semesters.**

Bachelor's batch master synchronization should occur only after B01–B05 architectures are complete.
