# Polish Railway Academy (PAK)

# Academic Curriculum & Study Material Blueprint

**Product Requirements Document (PRD)**  
**Version:** 0.1.5  
**Status:** Living Master Blueprint  
**Baseline Date:** 10 September 2026  
**Language:** English  
**Scope:** New PAK academic portfolio, curricula, subject architecture, chapters and study-material production system  
**Change Rule:** Append and version this master PRD as curriculum development progresses

---

## 1. Purpose

This PRD establishes the governing academic architecture for a newly designed PAK railway education portfolio. It is the single source of truth for programme levels, programme codes, duration and semester structure, shared modules, subject architecture, chapter architecture, study-material deliverables, academic quality controls, and future curriculum revisions.

The curriculum and all future English-language study materials are to be created afresh. The system is intended to support consistent development from programme level down to individual learning topics and assessments.

---

## 2. Governing Hierarchy

**Programme Level → Programme → Academic Year → Semester → Subject/Module → Chapter → Topic → Learning Outcome → Assessment → Study Material**

Every future textbook, practical manual, instructor guide, workbook, assessment bank and slide deck must trace back to this hierarchy.

---

## 3. Qualification Architecture

| Level | Academic Purpose | Baseline Structure |
|---|---|---|
| Certificate | Short vocational / technical upskilling programmes | 3–6 months typical |
| Diploma | Career-oriented technical and operational programmes | 2 years / 4 semesters |
| Bachelor's-level | Undergraduate railway engineering / management curriculum architecture | 3 years / 6 semesters |
| Postgraduate Diploma | Advanced specialist programmes | 1 year / 2 semesters |
| Master's-level | Advanced engineering, systems and management curriculum architecture | 2 years / 4 semesters |

---

## 4. Master Programme Catalogue v0.1

### 4.1 Certificate Programmes

| Code | Programme | Duration |
|---|---|---|
| PAK-C01 | Certificate in Railway Fundamentals | 12 Weeks |
| PAK-C02 | Certificate in Railway Vehicle Maintenance | 6 Months |
| PAK-C03 | Certificate in Freight Wagon Maintenance | 6 Months |
| PAK-C04 | Certificate in Locomotive Maintenance | 6 Months |
| PAK-C05 | Certificate in Wheelset & Bogie Technology | 4 Months |
| PAK-C06 | Certificate in Railway Braking Systems | 4 Months |
| PAK-C07 | Certificate in Railway Welding & Fabrication | 6 Months |
| PAK-C08 | Certificate in Railway Electrical Systems | 6 Months |
| PAK-C09 | Certificate in Railway Inspection & NDT | 6 Months |
| PAK-C10 | Certificate in Railway Safety & Workshop Practices | 3 Months |
| PAK-C11 | Certificate in Railway Quality Control | 4 Months |
| PAK-C12 | Certificate in Railway Operations & Logistics | 6 Months |

### 4.2 Diploma Programmes

| Code | Programme | Duration |
|---|---|---|
| PAK-D01 | Diploma in Railway Rolling Stock Engineering & Maintenance | 2 Years / 4 Semesters |
| PAK-D02 | Diploma in Railway Mechanical Engineering | 2 Years / 4 Semesters |
| PAK-D03 | Diploma in Railway Electrical & Control Systems | 2 Years / 4 Semesters |
| PAK-D04 | Diploma in Railway Operations & Transport Management | 2 Years / 4 Semesters |
| PAK-D05 | Diploma in Railway Manufacturing, Welding & Quality | 2 Years / 4 Semesters |

### 4.3 Bachelor's-Level Programmes

| Code | Programme | Duration |
|---|---|---|
| PAK-B01 | B.Sc./B.Eng. in Railway Engineering | 3 Years / 6 Semesters |
| PAK-B02 | B.Sc./B.Eng. in Rolling Stock Engineering | 3 Years / 6 Semesters |
| PAK-B03 | B.Sc./B.Eng. in Railway Electrical, Signalling & Control Systems | 3 Years / 6 Semesters |
| PAK-B04 | B.Sc. in Railway Operations, Logistics & Transport Management | 3 Years / 6 Semesters |
| PAK-B05 | B.Sc./B.Eng. in Railway Manufacturing & Maintenance Engineering | 3 Years / 6 Semesters |

### 4.4 Postgraduate Diploma Programmes

| Code | Programme | Duration |
|---|---|---|
| PAK-PGD01 | PG Diploma in Advanced Rolling Stock Engineering | 1 Year / 2 Semesters |
| PAK-PGD02 | PG Diploma in Railway Maintenance & Asset Management | 1 Year / 2 Semesters |
| PAK-PGD03 | PG Diploma in Railway Safety, Quality & Compliance | 1 Year / 2 Semesters |
| PAK-PGD04 | PG Diploma in Railway Operations & Logistics Management | 1 Year / 2 Semesters |
| PAK-PGD05 | PG Diploma in Railway Project & Infrastructure Management | 1 Year / 2 Semesters |
| PAK-PGD06 | PG Diploma in Digital Railway Systems & Predictive Maintenance | 1 Year / 2 Semesters |

### 4.5 Master's-Level Programmes

| Code | Programme | Duration |
|---|---|---|
| PAK-M01 | M.Sc./M.Eng. in Railway Engineering | 2 Years / 4 Semesters |
| PAK-M02 | M.Sc./M.Eng. in Rolling Stock Engineering & Advanced Maintenance | 2 Years / 4 Semesters |
| PAK-M03 | M.Sc. in Railway Systems, Signalling & Digitalisation | 2 Years / 4 Semesters |
| PAK-M04 | M.Sc. in Railway Operations, Logistics & Transport Management | 2 Years / 4 Semesters |
| PAK-M05 | M.Sc. in Railway Safety, Reliability & Asset Management | 2 Years / 4 Semesters |
| PAK-M06 | MBA/Master's-Level Programme in Railway Business & Project Management | 2 Years / 4 Semesters |

---

## 5. Portfolio Baseline

Version 0.1 contains **34 proposed programmes**:

- 12 Certificate programmes
- 5 Diploma programmes
- 5 Bachelor's-level programmes
- 6 Postgraduate Diploma programmes
- 6 Master's-level programmes

---

## 6. Modular Curriculum Principle

PAK will use a modular academic architecture rather than independently rewriting identical subjects for every programme. Core railway modules may be reused across programmes while depth, prerequisites, practical requirements, learning outcomes and assessment difficulty are adjusted to the qualification level.

Illustrative reusable domains include Railway Fundamentals, Rolling Stock, Freight Wagons, Locomotives, Bogies, Wheelsets, Braking Systems, Electrical Systems, Signalling & Control, Maintenance, NDT, Welding & Fabrication, Railway Safety, Quality Management, Railway Operations, Logistics, Asset Management, Digital Railway, Project Management and Railway Business & Management.

The objective is to create authoritative master subject modules that can be mapped intelligently into multiple programmes rather than generating unnecessary duplicate textbooks.

---

## 7. Coding Convention

### 7.1 Programme Codes

- Certificate: `PAK-Cxx`
- Diploma: `PAK-Dxx`
- Bachelor's-level: `PAK-Bxx`
- Postgraduate Diploma: `PAK-PGDxx`
- Master's-level: `PAK-Mxx`

### 7.2 Subject and Module Codes

Subject/module and chapter codes will be assigned during curriculum decomposition. The target convention will preserve programme, academic level, semester and subject traceability while allowing shared modules to retain a stable master identifier.

### 7.3 Chapter Codes

Each chapter will receive a deterministic identifier linked to its master subject/module. Chapter codes must remain stable once a subject reaches curriculum-freeze status.

---

## 8. Required Study-Material Package

Each qualifying subject/module may require the following deliverables depending on programme level and practical requirements:

1. Student Textbook / Core Study Book
2. Practical & Workshop Manual
3. Student Workbook / Exercises
4. Instructor Guide
5. Presentation / Teaching Slides
6. Question Bank
7. Final Theory Examination
8. Practical Competency Assessment
9. Answer Key / Marking Guide
10. Glossary and Technical Terminology
11. References and Further Reading

---

## 9. Content Development Standards

All new material will be written in English and developed as original instructional content.

Technical content must distinguish fundamental engineering knowledge from jurisdiction-specific regulatory requirements. Safety-critical, compliance and standards-related material must be source-traceable and reviewed before instructional release.

Where European Union, Polish, European Union Agency for Railways (ERA), Technical Specifications for Interoperability (TSI), EN, ISO, IEC or other external standards are relevant, final material will cite, reference or explain them appropriately rather than reproducing copyrighted standards text.

Study material should progressively increase in technical and analytical depth according to qualification level.

---

## 10. Academic Traceability Requirement

Each chapter will ultimately map to:

**Programme → Year → Semester → Subject → Chapter → Learning Outcome → Technical/Regulatory Reference → Teaching Activity → Assessment Item**

This traceability matrix will become mandatory before the production blueprint reaches Version 1.0.

The purpose is to ensure that every taught concept has a curriculum reason, every learning outcome has instructional coverage, and every assessed competency can be traced to approved curriculum content.

---

## 11. Qualification & Awarding Caveat

Curriculum architecture can be designed for Bachelor's-level, Master's-level and postgraduate programmes; however, formal use, marketing or award of protected or recognized academic degree titles must be aligned with applicable Polish law, accreditation/authorization requirements and/or an appropriately authorized higher-education awarding partner.

This PRD defines curriculum architecture only. It does not itself confer degree-awarding authority or accreditation.

---

## 12. Development Roadmap

| Version | Scope | Status |
|---|---|---|
| v0.1 | Master programme catalogue, qualification architecture and governing rules | COMPLETE |
| v0.1.1 | PAK-D01 year/semester-wise subject architecture | COMPLETE |
| v0.1.2 | PAK-D02 year/semester-wise subject architecture | COMPLETE |
| v0.1.3 | PAK-D03 year/semester-wise subject architecture | COMPLETE |
| v0.1.4 | PAK-D04 year/semester-wise subject architecture | COMPLETE |
| v0.1.5 | PAK-D05 year/semester-wise subject architecture | **CURRENT** |
| v0.2 | Complete programme/module and year/semester-wise subject architecture for all programmes | IN PROGRESS |
| v0.3 | Complete subject-wise chapter architecture | PLANNED |
| v0.4 | Learning outcomes, contact hours/credits, theory/practical mapping and prerequisites | PLANNED |
| v0.5 | Assessment, examination, instructor and study-material production standards | PLANNED |
| v0.6 | Regulatory/reference framework and academic QA controls | PLANNED |
| v0.9 | Full curriculum traceability and production-readiness audit | PLANNED |
| v1.0 | Frozen master blueprint for systematic book production | TARGET |

---

## 13. Append-Only Working Protocol

This is a **living master document**.

As programme subjects, semesters and chapters are developed, they will be appended to this PRD rather than maintained only in conversation.

Major approved changes will increment the document version. Superseded structures will be explicitly marked or moved to a revision record so that curriculum decisions remain auditable.

The GitHub Markdown file is the canonical working copy for subsequent curriculum development.

---

## 14. Next Controlled Work Item

With the full Diploma portfolio PAK-D01 through PAK-D05 now mapped at subject level, the next controlled curriculum work item is:

### `PAK-C01 — Certificate in Railway Fundamentals`

Certificate programmes will use module/block sequencing rather than artificial semester structures where their duration does not justify semesters. The next revision must define the complete 12-week module architecture for PAK-C01, including module codes, sequence, practical/theory orientation and prerequisite logic.

After the certificate portfolio is mapped, Bachelor's-level, Postgraduate Diploma and Master's-level subject architectures will continue under the same controlled methodology.

---

## 15. Revision Log

| Version | Date | Change | Status |
|---|---|---|---|
| 0.1 | 10 Sep 2026 | Initial master programme catalogue and study-material governance baseline | Superseded |
| 0.1.1 | 10 Sep 2026 | Added complete four-semester subject architecture for PAK-D01 | Superseded |
| 0.1.2 | 10 Sep 2026 | Added complete four-semester subject architecture for PAK-D02 | Superseded |
| 0.1.3 | 10 Sep 2026 | Added complete four-semester subject architecture for PAK-D03 | Superseded |
| 0.1.4 | 10 Sep 2026 | Added complete four-semester subject architecture for PAK-D04 | Superseded |
| 0.1.5 | 10 Sep 2026 | Added complete four-semester subject architecture for PAK-D05 and completed Diploma-level subject mapping | Active |

---

## 16. Canonical Document Rule

**Canonical file:** `docs/academic/PAK_ACADEMIC_CURRICULUM_STUDY_MATERIAL_BLUEPRINT_PRD.md`

All future curriculum design in this workstream must update this file so that programme lists, semester structures, subject lists, chapter structures and subsequent blueprint decisions remain synchronized in one governed source of truth.

---

# 17. PAK-D01 — Diploma in Railway Rolling Stock Engineering & Maintenance

## 17.1 Programme Identity

**Programme Code:** `PAK-D01`  
**Programme Title:** Diploma in Railway Rolling Stock Engineering & Maintenance  
**Duration:** 2 Academic Years  
**Academic Structure:** 4 Semesters  
**Primary Language:** English  
**Orientation:** Applied engineering, workshop practice, inspection, maintenance and rolling-stock compliance  
**Curriculum Status:** Subject Architecture v1 — Chapter decomposition pending

### Programme Purpose

PAK-D01 develops technicians and junior engineering professionals capable of understanding, inspecting, maintaining, diagnosing and documenting railway rolling-stock systems, with particular strength in freight wagons, bogies, wheelsets, braking systems and maintenance workshop practice.

The programme progresses from engineering and railway fundamentals in Semester 1, through rolling-stock subsystem engineering in Semester 2, to maintenance diagnostics and repair in Semester 3, and finally to advanced maintenance, ECM/fleet management, compliance, digital diagnostics and industry application in Semester 4.

### Curriculum Design Principles

1. Foundation before specialization.
2. System understanding before maintenance intervention.
3. Progressive workshop integration.
4. Dedicated treatment of safety-critical systems.
5. European railway and interoperability context.
6. Maintenance documentation and traceability as professional competencies.
7. Digital and condition-monitoring readiness.

## 17.2 Year 1 — Semester 1: Engineering & Railway Foundations

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D01-101 | Railway Systems & Rolling Stock Fundamentals | Core | Theory + Demonstration | None |
| D01-102 | Applied Engineering Mathematics & Physics for Railways | Core | Theory + Problem Solving | None |
| D01-103 | Engineering Drawing, CAD & Technical Documentation | Core | Theory + Computer Lab | None |
| D01-104 | Engineering Materials, Manufacturing Processes & Corrosion Control | Core | Theory + Workshop Demonstration | None |
| D01-105 | Workshop Practice, Tools, Metrology & Fastening Systems | Practical Core | Workshop-Dominant | None |
| D01-106 | Railway Safety, Occupational Health & Safety and Technical Communication | Core | Theory + Practical Exercises | None |

## 17.3 Year 1 — Semester 2: Rolling Stock Systems & Components

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D01-201 | Rolling Stock Construction & Vehicle Dynamics I | Specialization Core | Theory + Laboratory | D01-101, D01-102 |
| D01-202 | Freight Wagon Engineering & Classification | Specialization Core | Theory + Practical Identification | D01-101 |
| D01-203 | Bogie, Suspension & Running Gear Technology | Specialization Core | Theory + Workshop | D01-101, D01-104, D01-105 |
| D01-204 | Wheelsets, Axles, Bearings & Axlebox Technology | Specialization Core | Theory + Workshop | D01-104, D01-105 |
| D01-205 | Railway Braking Systems I — Pneumatic & Mechanical Fundamentals | Specialization Core | Theory + Laboratory | D01-101, D01-102 |
| D01-206 | Rolling Stock Electrical & Pneumatic Fundamentals | Core / Specialization | Theory + Laboratory | D01-101, D01-102 |

## 17.4 Year 2 — Semester 3: Maintenance, Inspection, Diagnostics & Repair

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D01-301 | Locomotive & Traction Systems Fundamentals | Specialization | Theory + Laboratory | D01-201, D01-206 |
| D01-302 | Railway Braking Systems II — Control, Testing & Diagnostics | Specialization Core | Theory + Laboratory + Workshop | D01-205, D01-206 |
| D01-303 | Rolling Stock Maintenance Engineering, Reliability & Failure Analysis | Core / Specialization | Theory + Case Study + Practical | D01-201 to D01-205 |
| D01-304 | Inspection, Non-Destructive Testing & Condition Monitoring of Rolling Stock | Specialization Core | Laboratory + Workshop | D01-104, D01-105, D01-204 |
| D01-305 | Railway Welding, Structural Repair & Fabrication Practice | Practical Specialization | Workshop-Dominant | D01-104, D01-105 |
| D01-306 | Workshop Practicum I — Freight Wagon, Bogie & Wheelset Inspection | Practical Core | Workshop / Competency Practice | D01-202, D01-203, D01-204, D01-205; co-requisite D01-304 |

## 17.5 Year 2 — Semester 4: Advanced Maintenance, Compliance & Industry Application

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D01-401 | Advanced Rolling Stock Maintenance, Overhaul & Troubleshooting | Specialization Core | Theory + Workshop | D01-303, D01-306 |
| D01-402 | ECM, Fleet Maintenance & Railway Asset Management | Core / Specialization | Theory + Case Study | D01-303 |
| D01-403 | Railway Quality Assurance, Traceability & Maintenance Documentation | Core | Theory + Practical Documentation | D01-303, D01-304 |
| D01-404 | EU Railway Interoperability, Freight Wagon TSI & Rolling Stock Compliance | Core / Specialization | Theory + Compliance Case Study | D01-202, D01-303 |
| D01-405 | Digital Diagnostics, Sensors & Predictive Maintenance | Specialization | Laboratory + Project | D01-206, D01-303, D01-304 |
| D01-406 | Industry Practicum & Capstone Project | Practical / Capstone | Industry + Project + Competency Assessment | Completion of Semesters 1–3; co-requisite D01-401 to D01-405 |

## 17.6 PAK-D01 Subject Inventory & Dependency Spine

PAK-D01 contains **24 semester subjects/modules**, six per semester.

Principal progression: railway and engineering foundations → rolling-stock subsystems → inspection/diagnostics/repair → advanced maintenance/ECM/compliance → industry capstone.

## 17.7 Regulatory & Technical Reference Baseline

Future chapter development must verify current applicable EU interoperability and railway-safety legislation, freight-wagon TSI requirements, ECM requirements, ERA technical material, relevant EN/ISO standards, Polish requirements and authorized manufacturer instructions. Safety-critical acceptance criteria must come from the applicable approved source, not from generic teaching examples.

## 17.8 Chapter-Decomposition Readiness

Each of the 24 subjects will later receive subject purpose, chapter sequence, prerequisites, theory/practical classification, diagrams, workshop exercises, learning outcomes, assessment linkage and regulatory/technical reference families before textbook prose is produced.

---

# 18. PAK-D02 — Diploma in Railway Mechanical Engineering

## 18.1 Programme Identity

**Programme Code:** `PAK-D02`  
**Programme Title:** Diploma in Railway Mechanical Engineering  
**Duration:** 2 Academic Years  
**Academic Structure:** 4 Semesters  
**Primary Language:** English  
**Orientation:** Mechanical engineering fundamentals applied to railway vehicles, workshops, manufacturing, inspection, maintenance and overhaul  
**Curriculum Status:** Subject Architecture v1 — Chapter decomposition pending

### Programme Purpose

PAK-D02 develops railway-focused mechanical technicians and junior engineering professionals with a broader mechanical-engineering base than D01. It connects mechanics, materials, thermofluids, machine elements, manufacturing, measurement, inspection, failure analysis and maintenance to railway applications.

## 18.2 Year 1 — Semester 1: Mechanical Engineering & Railway Foundations

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D02-101 | Applied Engineering Mathematics & Engineering Mechanics I | Core | Theory + Problem Solving | None |
| D02-102 | Engineering Physics, Heat & Energy Fundamentals | Core | Theory + Laboratory | None |
| D02-103 | Engineering Drawing, CAD, Geometric Dimensioning & Technical Documentation | Core | Theory + CAD Lab | None |
| D02-104 | Materials Science, Metallurgy & Corrosion for Railway Engineering | Core | Theory + Laboratory / Demonstration | None |
| D02-105 | Workshop Technology, Metrology, Fitting & Machine Tools I | Practical Core | Workshop-Dominant | None |
| D02-106 | Railway Systems Fundamentals, Safety & Technical Communication | Core | Theory + Demonstration + Practical Exercises | None |

## 18.3 Year 1 — Semester 2: Mechanical Systems, Manufacturing & Railway Applications

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D02-201 | Strength of Materials & Railway Structural Mechanics | Core / Specialization | Theory + Laboratory + Problem Solving | D02-101, D02-104 |
| D02-202 | Theory of Machines, Mechanisms & Machine Elements | Core / Specialization | Theory + Laboratory | D02-101, D02-103 |
| D02-203 | Fluid Mechanics, Pneumatics & Hydraulics | Core / Specialization | Theory + Laboratory | D02-101, D02-102 |
| D02-204 | Manufacturing Processes, Welding & Fabrication Technology | Core / Specialization | Theory + Workshop | D02-104, D02-105 |
| D02-205 | Railway Vehicle Mechanical Systems I — Structures, Couplers, Bogies & Running Gear | Specialization Core | Theory + Workshop / Component Study | D02-106, D02-201; co-requisite D02-202 |
| D02-206 | Mechanical Measurements, Instrumentation, Fits, Tolerances & Quality Control | Core | Theory + Metrology Lab | D02-103, D02-105 |

## 18.4 Year 2 — Semester 3: Machine Design, Maintenance, Inspection & Failure Analysis

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D02-301 | Thermal Engineering & Diesel/Traction Mechanical Fundamentals | Core / Specialization | Theory + Laboratory | D02-102, D02-203 |
| D02-302 | Railway Vehicle Mechanical Systems II — Wheelsets, Bearings, Suspension & Braking Mechanics | Specialization Core | Theory + Workshop | D02-202, D02-205, D02-206 |
| D02-303 | Maintenance Engineering, Tribology, Lubrication & Wear | Core / Specialization | Theory + Laboratory + Case Study | D02-202, D02-204, D02-206 |
| D02-304 | Machine Design, Fatigue, Fracture & Mechanical Failure Analysis | Core / Specialization | Theory + Design Exercises + Case Study | D02-201, D02-202, D02-104 |
| D02-305 | Mechanical Inspection, NDT, Vibration & Condition Monitoring | Specialization Core | Laboratory + Workshop | D02-104, D02-206, D02-303 |
| D02-306 | Mechanical Workshop Practicum I — Machining, Welding, Assembly & Component Inspection | Practical Core | Workshop / Competency Practice | D02-204, D02-206; co-requisite D02-303, D02-305 |

## 18.5 Year 2 — Semester 4: Advanced Mechanical Maintenance & Industry Application

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D02-401 | Advanced Railway Mechanical Maintenance, Overhaul & Troubleshooting | Specialization Core | Theory + Workshop | D02-302, D02-303, D02-305, D02-306 |
| D02-402 | Reliability, Maintainability & Railway Mechanical Asset Management | Core / Specialization | Theory + Case Study | D02-303, D02-304 |
| D02-403 | Railway Mechanical Quality, Tolerances, Repair Documentation & Traceability | Core / Specialization | Theory + Practical Documentation | D02-206, D02-305 |
| D02-404 | Applied CAD/CAM, Reverse Engineering & Digital Manufacturing | Specialization | CAD/CAM Lab + Project | D02-103, D02-202, D02-204 |
| D02-405 | Maintenance Planning, Industrial Safety & Sustainable Mechanical Engineering | Core | Theory + Planning Exercises + Case Study | D02-106, D02-303, D02-306 |
| D02-406 | Industry Practicum & Mechanical Engineering Capstone Project | Practical / Capstone | Industry + Project + Competency Assessment | Completion of Semesters 1–3; co-requisite D02-401 to D02-405 |

## 18.6 PAK-D02 Subject Inventory & Dependency Spine

PAK-D02 contains **24 semester subjects/modules**, six per semester. Progression moves from mechanics/materials/CAD/workshop foundations to structures, machines, thermofluids and manufacturing; then failure/inspection/maintenance; and finally overhaul, reliability, digital manufacturing and capstone application.

## 18.7 Shared-Module & Reference Controls

D02 may reuse D01 material only where learning outcomes and depth genuinely match. Mechanical design, strength, thermofluids, tribology, vibration, manufacturing and CAD/CAM require D02-specific depth. Railway acceptance criteria must come from applicable approved standards, specifications, drawings or maintenance instructions.

## 18.8 Chapter-Decomposition Readiness

Each subject will later receive chapter sequence, mathematical depth, railway applications, laboratory/workshop split, worked examples, drawings, exercises, inspection tasks, outcomes, assessments, reference families and safety-critical flags.

---

# 19. PAK-D03 — Diploma in Railway Electrical & Control Systems

## 19.1 Programme Identity

**Programme Code:** `PAK-D03`  
**Programme Title:** Diploma in Railway Electrical & Control Systems  
**Duration:** 2 Academic Years  
**Academic Structure:** 4 Semesters  
**Primary Language:** English  
**Orientation:** Railway electrical engineering, traction power, onboard electrical equipment, control systems, diagnostics and maintenance  
**Curriculum Status:** Subject Architecture v1 — Chapter decomposition pending

### Programme Purpose

PAK-D03 prepares railway electrical technicians and junior engineering professionals to understand, test, inspect, maintain and troubleshoot electrical and control systems used in railway vehicles and related technical environments.

## 19.2 Year 1 — Semester 1: Electrical, Electronic & Railway Foundations

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D03-101 | Applied Electrical Mathematics & Engineering Physics | Core | Theory + Problem Solving | None |
| D03-102 | DC & AC Circuit Fundamentals | Core | Theory + Electrical Laboratory | None |
| D03-103 | Analog & Digital Electronics Fundamentals | Core | Theory + Electronics Laboratory | None |
| D03-104 | Electrical Engineering Drawing, Schematics & Technical Documentation | Core | Theory + CAD / Schematic Lab | None |
| D03-105 | Electrical Measurements, Instruments & Safe Laboratory Practice | Practical Core | Laboratory-Dominant | None |
| D03-106 | Railway Systems, Electrical Safety & Technical Communication | Core | Theory + Demonstration + Practical Exercises | None |

## 19.3 Year 1 — Semester 2: Machines, Power, Control & Railway Electrical Systems

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D03-201 | Electrical Machines & Transformers | Core / Specialization | Theory + Machines Laboratory | D03-101, D03-102 |
| D03-202 | Power Systems, Protection, Earthing & Railway Electrification Fundamentals | Core / Specialization | Theory + Laboratory / Demonstration | D03-102, D03-105, D03-106 |
| D03-203 | Control Engineering, Sensors & Instrumentation I | Core / Specialization | Theory + Control Laboratory | D03-101, D03-102, D03-103 |
| D03-204 | PLC, Relays, Contactors & Industrial Control Circuits | Practical Specialization | Theory + PLC / Wiring Lab | D03-103, D03-104, D03-105 |
| D03-205 | Railway Traction Electrical Systems I — Motors, Supply & Drive Fundamentals | Specialization Core | Theory + Laboratory / Component Study | D03-201; co-requisite D03-202 |
| D03-206 | Rolling Stock Auxiliary Electrical Systems — Batteries, Charging, Lighting, HVAC & Doors | Specialization Core | Theory + Laboratory / Workshop | D03-102, D03-104, D03-105, D03-106 |

## 19.4 Year 2 — Semester 3: Power Electronics, Train Control, Protection & Diagnostics

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D03-301 | Power Electronics, Converters, Inverters & Traction Drives | Specialization Core | Theory + Power-Electronics Lab | D03-103, D03-201, D03-205 |
| D03-302 | Railway Traction Electrical Systems II — Drive Control, Regeneration & Auxiliaries Integration | Specialization Core | Theory + Laboratory / Simulation | D03-203, D03-205, D03-301 |
| D03-303 | Train Control, Signalling Interfaces & Train Protection Fundamentals | Specialization | Theory + Simulation / Demonstration | D03-203, D03-204, D03-106 |
| D03-304 | Railway Communication Networks, Data Buses & Embedded Control Fundamentals | Specialization Core | Theory + Network / Embedded Lab | D03-103, D03-203, D03-204 |
| D03-305 | Electrical Protection, Fault Finding, Insulation Testing & Diagnostic Methods | Specialization Core | Laboratory + Workshop | D03-202, D03-205, D03-206 |
| D03-306 | Electrical & Control Systems Practicum I — Wiring, Testing, Commissioning & Troubleshooting | Practical Core | Laboratory / Workshop Competency Practice | D03-204, D03-205, D03-206; co-requisite D03-305 |

## 19.5 Year 2 — Semester 4: Advanced Control, Maintenance, Compliance & Industry Application

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D03-401 | Advanced Traction Drives, Energy Management & Electrical Braking | Specialization Core | Theory + Simulation / Laboratory | D03-301, D03-302 |
| D03-402 | Train Control & Management Systems (TCMS), Vehicle Networks & Remote Diagnostics | Specialization Core | Theory + Network / Diagnostic Lab | D03-304, D03-305 |
| D03-403 | Railway Electrical Maintenance, Reliability & Condition-Based Maintenance | Core / Specialization | Theory + Laboratory + Case Study | D03-305, D03-306 |
| D03-404 | Electrical Safety, EMC, Quality, Documentation & Railway Compliance | Core / Specialization | Theory + Compliance / Documentation Exercises | D03-202, D03-305 |
| D03-405 | Advanced Automation, Data Acquisition & Predictive Diagnostics | Specialization | PLC / DAQ Lab + Project | D03-203, D03-204, D03-304, D03-305 |
| D03-406 | Industry Practicum & Electrical/Control Systems Capstone Project | Practical / Capstone | Industry + Project + Competency Assessment | Completion of Semesters 1–3; co-requisite D03-401 to D03-405 |

## 19.6 PAK-D03 Subject Inventory & Dependency Spine

PAK-D03 contains **24 semester subjects/modules**, six per semester. Progression moves from circuit/electronics/measurement foundations to machines, power, PLC and traction; then power electronics, control networks and diagnostics; and finally TCMS, maintenance, compliance, advanced automation and capstone.

## 19.7 Safety & Reference Controls

Practical work must distinguish de-energized work, supervised low-voltage laboratory work, high-voltage/traction-power awareness and safety-critical signalling/control content. Safety-critical limits, settings and acceptance criteria must be sourced from applicable approved specifications, standards or maintenance instructions.

## 19.8 Chapter-Decomposition Readiness

Each subject will later receive chapter sequence, circuit/system diagrams, worked calculations, safe lab procedures, equipment requirements, outcomes, assessments, reference families, electrical-safety classification and safety-critical flags.

---

# 20. PAK-D04 — Diploma in Railway Operations & Transport Management

## 20.1 Programme Identity

**Programme Code:** `PAK-D04`  
**Programme Title:** Diploma in Railway Operations & Transport Management  
**Duration:** 2 Academic Years  
**Academic Structure:** 4 Semesters  
**Primary Language:** English  
**Orientation:** Railway operations, traffic and capacity planning, passenger and freight transport, terminals, safety, disruption management, commercial management and data-driven transport performance  
**Curriculum Status:** Subject Architecture v1 — Chapter decomposition pending

### Programme Purpose

PAK-D04 prepares operations coordinators, transport-planning assistants, terminal and yard personnel, junior traffic-management professionals, freight and passenger operations staff and future railway managers with structured understanding of how railway services are planned, controlled, measured and improved.

The programme does **not** itself confer competence, licensing or employer authorization for safety-critical operational functions.

## 20.2 Year 1 — Semester 1: Railway, Transport & Management Foundations

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D04-101 | Railway Systems & Transport Industry Fundamentals | Core | Theory + System Demonstration | None |
| D04-102 | Applied Mathematics, Statistics & Data Literacy for Transport | Core | Theory + Problem Solving + Spreadsheet Lab | None |
| D04-103 | Principles of Transport Economics, Business & Management | Core | Theory + Case Study | None |
| D04-104 | Railway Operations Safety, Human Factors & Technical Communication | Core | Theory + Case Study + Communication Exercises | None |
| D04-105 | Digital Tools, Operational Documentation & Transport Information Systems | Practical Core | Computer Lab + Documentation Practice | None |
| D04-106 | Rolling Stock, Infrastructure & Signalling Fundamentals for Operations | Core / Technical Foundation | Theory + Demonstration | D04-101 recommended |

## 20.3 Year 1 — Semester 2: Train Operations, Timetabling, Passenger & Freight Services

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D04-201 | Train Operations, Operating Rules & Traffic Management Fundamentals | Specialization Core | Theory + Scenario Exercises | D04-101, D04-104, D04-106 |
| D04-202 | Timetable Planning, Headways & Railway Capacity Fundamentals | Specialization Core | Theory + Planning Exercises + Simulation | D04-102, D04-106; co-requisite D04-201 |
| D04-203 | Passenger Railway Operations & Service Management | Specialization Core | Theory + Case Study | D04-101, D04-103 |
| D04-204 | Freight Rail Operations, Wagon Flow & Intermodal Logistics | Specialization Core | Theory + Flow-Planning Exercises | D04-101, D04-103, D04-106 |
| D04-205 | Stations, Yards, Terminals & Shunting Operations Fundamentals | Specialization Core | Theory + Layout / Simulation Exercises | D04-106, D04-201 |
| D04-206 | Transport Costing, Commercial Processes & Contract Fundamentals | Core / Management | Theory + Numerical Exercises + Case Study | D04-102, D04-103 |

## 20.4 Year 2 — Semester 3: Traffic Control, Disruption, Safety & Service Optimization

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D04-301 | Railway Control Centre Operations & Traffic Regulation | Specialization Core | Theory + Traffic Simulation | D04-201, D04-202 |
| D04-302 | Disruption, Incident & Emergency Operations Management | Specialization Core | Theory + Scenario Simulation + Case Study | D04-104, D04-201, D04-301 |
| D04-303 | Railway Safety Management Systems, Operational Risk & Human Performance | Core / Specialization | Theory + Risk Exercises + Case Study | D04-104, D04-201 |
| D04-304 | Freight Logistics, Supply Chain & Terminal Planning | Specialization | Theory + Planning / Optimization Exercises | D04-204, D04-205, D04-206 |
| D04-305 | Passenger Demand, Revenue, Ticketing & Customer Experience | Specialization | Theory + Data Analysis + Case Study | D04-102, D04-203, D04-206 |
| D04-306 | Operations Practicum I — Timetable, Yard, Dispatch & Disruption Simulation | Practical Core | Integrated Simulation / Competency Practice | D04-201 to D04-205; co-requisite D04-301, D04-302 |

## 20.5 Year 2 — Semester 4: Network Performance, Interoperability & Transport Leadership

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D04-401 | Advanced Network Capacity, Timetable & Operations Planning | Specialization Core | Theory + Optimization / Simulation | D04-202, D04-301, D04-306 |
| D04-402 | Railway Performance Management, KPIs, Delay Analysis & Operations Analytics | Core / Specialization | Data Analysis + Case Study + Dashboard Exercises | D04-102, D04-105, D04-301 |
| D04-403 | International Rail Operations, Interoperability & Cross-Border Freight | Specialization Core | Theory + Case Study + Documentation Exercises | D04-204, D04-301, D04-304 |
| D04-404 | Railway Commercial Management, Procurement & Service Contracts | Management Core | Theory + Commercial Case Study | D04-103, D04-206 |
| D04-405 | Sustainable Transport, Energy Efficiency & Digital Railway Operations | Core / Specialization | Theory + Data / Planning Project | D04-105, D04-301, D04-402 |
| D04-406 | Industry Practicum & Railway Operations/Transport Management Capstone | Practical / Capstone | Industry + Project + Presentation + Competency Assessment | Completion of Semesters 1–3; co-requisite D04-401 to D04-405 |

## 20.6 PAK-D04 Subject Inventory & Dependency Spine

PAK-D04 contains **24 semester subjects/modules**, six per semester. Progression moves from railway/economic/data foundations to train operations, timetable/capacity, passenger/freight and terminals; then control-centre/disruption/safety/logistics; and finally network performance, interoperability, commercial management and capstone.

## 20.7 Safety-Critical Operations & Reference Controls

Operational material must distinguish general education, simulation-only safety-critical scenarios, rulebook-dependent procedures and authorization-dependent competence. Real operating rules, movement authorities, degraded-mode procedures and safety-critical communication must be tied to the applicable authorized source.

## 20.8 Chapter-Decomposition Readiness

Each subject will later receive chapter sequence, quantitative depth, process maps, case studies/simulation split, timetable/capacity/logistics exercises, datasets, outcomes, assessments, regulatory families, rulebook-dependency flags and safety-critical classification.

---

# 21. PAK-D05 — Diploma in Railway Manufacturing, Welding & Quality

## 21.1 Programme Identity

**Programme Code:** `PAK-D05`  
**Programme Title:** Diploma in Railway Manufacturing, Welding & Quality  
**Duration:** 2 Academic Years  
**Academic Structure:** 4 Semesters  
**Primary Language:** English  
**Orientation:** Railway manufacturing, welding and fabrication, metallurgy, metrology, inspection, NDT, production quality, process control and traceability  
**Curriculum Status:** Subject Architecture v1 — Chapter decomposition pending

### Programme Purpose

PAK-D05 is designed to prepare manufacturing technicians, welding/fabrication technicians, production-quality personnel, inspectors and junior manufacturing professionals for railway workshops and supply-chain environments. The programme combines materials science, manufacturing technology, welding metallurgy, fabrication, dimensional metrology, NDT, quality assurance, process control, production planning, traceability and railway-specific manufacturing awareness.

Students progress from materials, drawing, metrology and safe workshop fundamentals in Semester 1; through machining, forming, welding, fabrication, quality and NDT fundamentals in Semester 2; into railway welding, advanced process control, weld inspection, railway-component manufacturing and formal QA/QC systems in Semester 3; and finally into advanced fabrication/repair, production engineering, audits, digital quality and industry application in Semester 4.

This diploma provides academic and practical preparation but does **not** itself replace any personnel qualification, certification, welding coordination authorization, NDT certification, production certification, manufacturer approval or railway-vehicle/component conformity requirement that may be mandated by applicable standards, law, customer specifications or an employer's certified quality system.

### Curriculum Design Principles

1. **Metallurgy before welding judgement:** Students understand material structure, heat effects, weldability and failure mechanisms before evaluating welding outcomes.
2. **Drawing-to-product traceability:** Engineering drawings, GD&T, material certificates, process plans, weld documentation, inspection records and final acceptance records are treated as a continuous information chain.
3. **Process discipline over craft alone:** Welding and fabrication training includes preparation, parameters, consumables, equipment condition, environmental controls, identification, inspection and documentation.
4. **Quality built into production:** QA/QC is introduced alongside manufacturing rather than treated only as final inspection.
5. **NDT competency boundaries:** Students learn method principles, applications, limitations and supervised practice without falsely equating course completion with regulated NDT personnel certification.
6. **Railway-specific quality awareness:** Later modules introduce railway-vehicle welding and manufacturing quality frameworks, including the current applicable EN 15085 family and related quality-management concepts.
7. **Safety-critical segregation:** Educational defect examples and acceptance exercises must not become universal acceptance criteria for safety-critical railway components.
8. **Digital manufacturing readiness:** CAD/CAM interfaces, automated/robotic welding awareness, digital metrology, statistical process control and data-driven quality are included before graduation.
9. **Repair is controlled engineering:** Rework and repair require approved instructions, traceability and post-repair verification, especially for safety-relevant railway components.

---

## 21.2 Year 1 — Semester 1: Materials, Drawing, Metrology & Workshop Foundations

**Semester Objective:** Establish the engineering, metallurgical, drawing, measurement and workshop-safety foundations required for manufacturing, welding and quality specialization.

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D05-101 | Applied Engineering Mathematics & Manufacturing Science Fundamentals | Core | Theory + Problem Solving | None |
| D05-102 | Engineering Materials, Metallurgy & Heat Treatment | Core / Specialization | Theory + Materials Laboratory | None |
| D05-103 | Engineering Drawing, CAD, GD&T & Manufacturing Documentation | Core | Theory + CAD / Drawing Lab | None |
| D05-104 | Workshop Processes, Tools, Metrology & Dimensional Inspection I | Practical Core | Workshop + Metrology Lab | None |
| D05-105 | Manufacturing Safety, Occupational Health, Fire Prevention & Environmental Practice | Core | Theory + Practical Safety Exercises | None |
| D05-106 | Railway Systems, Rolling Stock Components & Manufacturing Fundamentals | Core / Railway Foundation | Theory + Component Demonstration | None |

### Semester 1 Progression Logic

- `D05-101` establishes calculation skills for dimensions, tolerances, process parameters and production measurements.
- `D05-102` develops understanding of steels, alloys, microstructures, mechanical properties, heat treatment and material behaviour under manufacturing and welding thermal cycles.
- `D05-103` creates the drawing, GD&T and technical-documentation foundation required for controlled manufacture and inspection.
- `D05-104` develops safe tool use, dimensional measurement and basic inspection discipline.
- `D05-105` embeds workshop safety, fire risk, fumes, gases, electrical hazards, hot work controls, manual handling and environmental responsibility before welding-intensive practical work.
- `D05-106` connects manufacturing fundamentals to railway structures, bogies, underframes, running gear, wheelsets, brackets, tanks, enclosures and other component families without teaching unapproved production procedures.

---

## 21.3 Year 1 — Semester 2: Manufacturing, Welding, Fabrication & Quality Fundamentals

**Semester Objective:** Develop practical and theoretical competence in primary manufacturing processes, welding, fabrication, dimensional quality and fundamental NDT methods.

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D05-201 | Manufacturing Processes I — Machining, Forming, Cutting, Casting & Surface Preparation | Core / Specialization | Theory + Workshop | D05-102, D05-104 |
| D05-202 | Welding Technology I — Processes, Equipment, Consumables & Joint Preparation | Specialization Core | Theory + Welding Workshop | D05-102, D05-105 |
| D05-203 | Welding Metallurgy, Weldability, Distortion & Heat Treatment | Specialization Core | Theory + Laboratory / Case Study | D05-102; co-requisite D05-202 |
| D05-204 | Fabrication Technology, Jigs, Fixtures, Fit-Up & Assembly | Specialization Core | Theory + Fabrication Workshop | D05-103, D05-104, D05-201; co-requisite D05-202 |
| D05-205 | Quality Engineering, Metrology, Tolerances & Statistical Process Control I | Core / Quality | Theory + Metrology / Data Lab | D05-101, D05-103, D05-104 |
| D05-206 | Non-Destructive Testing I — Visual, PT, MT, UT & Radiographic Method Fundamentals | Specialization / Quality | Theory + Controlled Demonstration / Laboratory | D05-102, D05-105 |

### Semester 2 Progression Logic

Semester 2 converts materials and drawing knowledge into production capability. `D05-201` introduces major manufacturing processes; `D05-202` and `D05-203` connect welding technique with metallurgical consequences; and `D05-204` integrates fit-up, fixtures and assembly control.

`D05-205` establishes dimensional quality, measurement-system discipline, tolerance interpretation and basic statistical process control. `D05-206` introduces NDT method principles and limitations so students understand how manufacturing defects can be detected without assuming that academic training grants independent NDT certification or authority.

---

## 21.4 Year 2 — Semester 3: Railway Welding, Inspection, Process Control & QA/QC

**Semester Objective:** Apply manufacturing and welding fundamentals to railway-quality environments with controlled procedures, advanced inspection, traceability and production-quality systems.

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D05-301 | Railway Welding Engineering & EN 15085 Framework Fundamentals | Specialization Core | Theory + Documentation / Case Study | D05-202, D05-203, D05-106 |
| D05-302 | Welding Technology II — Procedure Control, Qualification Concepts & Advanced Process Practice | Specialization Core | Theory + Welding Lab / Workshop | D05-202, D05-203, D05-204 |
| D05-303 | Non-Destructive Testing II — Weld Inspection, Defect Characterization & Examination Planning | Specialization Core | Laboratory + Case Study + Controlled Practical | D05-206, D05-203 |
| D05-304 | Railway Component Manufacturing — Structures, Bogies, Running Gear & Production Interfaces | Specialization Core | Theory + Workshop / Process Study | D05-106, D05-201, D05-204 |
| D05-305 | Railway QA/QC, Traceability, Material Certification, NCR & CAPA | Core / Quality | Theory + Documentation + Case Study | D05-205, D05-206 |
| D05-306 | Manufacturing & Welding Practicum I — Fabrication, Inspection & Quality Records | Practical Core | Workshop / Competency Practice | D05-202, D05-204, D05-205; co-requisite D05-302, D05-303, D05-305 |

### Semester 3 Progression Logic

Semester 3 shifts students from generic manufacturing toward controlled railway production. `D05-301` introduces the structure and purpose of railway welding quality requirements and the roles of certified organizations, welding coordination, procedure qualification, welder/operator qualification and production controls without claiming that PAK course completion substitutes for those formal requirements.

`D05-302` develops understanding of procedure-based welding, parameter control, process variation, preheat/interpass/post-weld controls and qualification concepts. Any WPS/WPQR exercise used in training is educational unless performed and approved under the applicable certified system.

`D05-303` develops method selection, defect characterization and inspection-planning reasoning while preserving NDT personnel-certification boundaries. `D05-305` formalizes traceability from material receipt through production, inspection, nonconformance and corrective action. `D05-306` integrates the production and quality chain in supervised practical work.

---

## 21.5 Year 2 — Semester 4: Advanced Production Quality, Repair, Auditing & Industry Application

**Semester Objective:** Integrate advanced fabrication and repair control with production engineering, supplier quality, auditing, digital inspection and real-world railway manufacturing projects.

| Code | Subject | Classification | Orientation | Prerequisite |
|---|---|---|---|---|
| D05-401 | Advanced Railway Fabrication, Weld Repair, Rework & Production Troubleshooting | Specialization Core | Theory + Workshop / Case Study | D05-301, D05-302, D05-303, D05-306 |
| D05-402 | Production Planning, Lean Manufacturing, Industrial Engineering & Supply Quality | Core / Specialization | Theory + Planning / Optimization Exercises | D05-201, D05-205, D05-305 |
| D05-403 | Quality Management Systems, Auditing & Railway Supplier Quality | Core / Quality | Theory + Audit Simulation + Case Study | D05-305, D05-306 |
| D05-404 | Advanced Metrology, Measurement Systems, Process Capability & Digital Quality | Specialization / Quality | Metrology Lab + Data Analysis | D05-205, D05-303 |
| D05-405 | Manufacturing Automation, Robotic Welding, Sustainable Production & Emerging Processes | Specialization | Theory + Automation Demonstration / Project | D05-201, D05-202, D05-205 |
| D05-406 | Industry Practicum & Railway Manufacturing/Welding/Quality Capstone | Practical / Capstone | Industry + Project + Competency Assessment | Completion of Semesters 1–3; co-requisite D05-401 to D05-405 |

### Semester 4 Progression Logic

The final semester treats manufacturing quality as a complete controlled system rather than a final inspection step. `D05-401` covers troubleshooting, rework and repair governance; `D05-402` connects shop-floor production with flow, capacity, waste reduction and supplier performance; `D05-403` introduces internal audit and supplier-quality thinking; and `D05-404` deepens measurement-system analysis and process capability.

`D05-405` prepares students for modern production through automation, robotic welding awareness, sensor-supported inspection, digital quality records and sustainable manufacturing practices. Any safety-critical automated process still requires applicable procedure validation, qualification, production control and conformity evidence.

`D05-406` is the programme integration point. A capstone should require a controlled manufacturing or quality problem, drawing/process interpretation, material/process reasoning, inspection planning, risk and safety controls, traceability evidence, nonconformance handling where relevant, and a defensible technical presentation.

---

## 21.6 PAK-D05 Subject Inventory

PAK-D05 contains **24 semester subjects/modules**:

- Semester 1: 6 subjects
- Semester 2: 6 subjects
- Semester 3: 6 subjects
- Semester 4: 6 subjects

Contact hours, credits/ECTS-equivalent workload, detailed learning outcomes, workshop-hour allocation and assessment weightings remain intentionally unassigned until the dedicated workload and credit-mapping phase.

With D05 completed, the **entire Diploma portfolio (D01–D05) now has subject-level architecture: 120 semester subjects/modules in total before cross-programme deduplication into master reusable modules.**

---

## 21.7 Shared-Module Strategy

D05 can reuse selected foundational content from D01 and D02 where outcomes and academic depth match, particularly:

- materials science and corrosion fundamentals;
- engineering drawing and technical documentation;
- workshop safety;
- basic metrology;
- generic manufacturing-process awareness;
- NDT fundamentals;
- quality and traceability fundamentals.

D05 requires independent or substantially expanded treatment for:

- welding metallurgy and weldability;
- welding process control;
- railway welding quality frameworks;
- fabrication planning and fixtures;
- advanced weld inspection;
- SPC and process capability;
- production traceability, NCR and CAPA;
- quality-system auditing and supplier quality;
- robotic welding and digital manufacturing quality.

**Control rule:** module reuse must never reduce welding, inspection or quality competencies merely to avoid producing a separate specialist book.

---

## 21.8 Subject Dependency Spine

Materials and production progression:

`D05-102 Materials & Metallurgy`
+ `D05-103 Drawing/GD&T`
+ `D05-104 Workshop & Metrology`
→ `D05-201 Manufacturing Processes`
+ `D05-204 Fabrication Technology`
+ `D05-205 Quality & SPC`
→ `D05-304 Railway Component Manufacturing`
+ `D05-305 Railway QA/QC & Traceability`
→ `D05-402 Production Planning & Lean`
+ `D05-404 Advanced Metrology & Digital Quality`
→ `D05-406 Capstone`.

Welding progression:

`D05-102 Materials & Metallurgy`
→ `D05-202 Welding Technology I`
+ `D05-203 Welding Metallurgy`
→ `D05-301 Railway Welding Framework`
+ `D05-302 Welding Technology II`
→ `D05-401 Advanced Fabrication, Repair & Rework`
→ `D05-406 Capstone`.

Inspection and quality progression:

`D05-104 Metrology`
+ `D05-205 Quality Engineering`
+ `D05-206 NDT I`
→ `D05-303 NDT II`
+ `D05-305 QA/QC, NCR & CAPA`
→ `D05-403 Quality Systems & Auditing`
+ `D05-404 Advanced Metrology`
→ `D05-406 Capstone`.

---

## 21.9 Technical & Standards Reference Baseline for Future Chapter Development

Chapter development for PAK-D05 must verify the current applicable editions and requirements from authoritative sources appropriate to each process and component. Reference families may include:

- the current applicable **EN 15085 series** for welding of railway vehicles and components;
- the current applicable **ISO 3834 series** for quality requirements for fusion welding of metallic materials;
- applicable standards concerning welding coordination, welding-procedure specification and qualification, welder/welding-operator qualification and weld-imperfection quality levels, according to process and product scope;
- applicable **ISO 9712** requirements for qualification/certification of NDT personnel where relevant, while distinguishing academic instruction from personnel certification;
- applicable standards for visual, penetrant, magnetic-particle, ultrasonic and radiographic testing and their railway/customer-specific acceptance requirements;
- applicable ISO/EN standards for engineering drawings, GD&T, dimensional metrology, calibration, measurement-system control and material inspection certificates;
- applicable ISO 9001-based quality-management principles and railway-sector quality/supplier requirements where contractually or organizationally relevant;
- applicable EU railway interoperability/safety legislation and rolling-stock TSIs when a manufacturing or repair chapter interfaces with regulated vehicle requirements;
- ERA guidance, relevant Polish requirements, customer specifications, approved drawings, manufacturer requirements, certified organization procedures and controlled work instructions.

**Control rule:** standards establish different scopes, qualification routes, product classes, weld-performance requirements and acceptance criteria. Future textbooks must cite the applicable requirement rather than inventing a single generic railway-welding acceptance table.

---

## 21.10 Welding, NDT & Safety-Critical Competence Controls

Future D05 study material and practical manuals must explicitly distinguish:

1. **Academic knowledge** — theory, terminology, process selection, metallurgy, defect mechanisms, quality concepts and documentation principles.
2. **Supervised training practice** — controlled weld coupons, fit-up, measurement and inspection exercises performed under instructor-defined parameters.
3. **Personnel qualification/certification** — welder/operator, welding coordination or NDT qualifications that require formal assessment/certification under the applicable standard or certification scheme.
4. **Organization/process certification** — approvals or certifications held by a manufacturing/maintenance organization, not automatically by an individual graduate.
5. **Product acceptance and release** — acceptance of actual railway components under approved drawings, WPSs, inspection plans, customer requirements and authorized quality systems.

Radiographic testing practical work must account for ionizing-radiation controls and legal authorization; where these cannot be provided, teaching should rely on theory, approved sample images, simulation and interpretation exercises rather than uncontrolled radiation exposure.

Safety-critical railway welds, wheelset-related work, bogie structures, load-bearing repairs and other critical components must not be released for service based solely on educational exercises or PAK academic assessment.

---

## 21.11 PAK-D05 Chapter-Decomposition Readiness

PAK-D05 is ready for subject-wise chapter design after portfolio-level subject architecture is completed, or earlier if selected as a pilot programme.

For each of the 24 modules, the chapter stage must define:

- subject purpose and scope;
- chapter titles and sequence;
- material/process prerequisite depth;
- process diagrams and manufacturing flowcharts;
- welding symbols and drawing examples where applicable;
- theory/laboratory/workshop split;
- weld coupon and fabrication exercises;
- metrology and inspection exercises;
- NDT method demonstrations or controlled practicals;
- quality-record and traceability exercises;
- NCR/CAPA and audit case studies where applicable;
- learning-outcome placeholders;
- assessment linkage placeholders;
- standards/reference families;
- certification-boundary flags;
- safety-critical content flags.

No full textbook prose should be generated before that subject's chapter architecture has been approved or frozen.

---

## 22. Diploma Portfolio Completion Checkpoint

Subject-level architecture is now complete for all five Diploma programmes:

| Programme | Semesters | Subjects/Modules |
|---|---:|---:|
| PAK-D01 — Railway Rolling Stock Engineering & Maintenance | 4 | 24 |
| PAK-D02 — Railway Mechanical Engineering | 4 | 24 |
| PAK-D03 — Railway Electrical & Control Systems | 4 | 24 |
| PAK-D04 — Railway Operations & Transport Management | 4 | 24 |
| PAK-D05 — Railway Manufacturing, Welding & Quality | 4 | 24 |
| **Total before cross-programme module deduplication** | **20 semester blocks** | **120 subject placements** |

The figure of 120 represents curriculum placements, not necessarily 120 separate textbooks. The master-module deduplication phase will identify subjects that can legitimately share one authoritative core textbook or module while preserving programme-specific learning outcomes and assessments.

**Next controlled curriculum target: `PAK-C01 — Certificate in Railway Fundamentals`.**
