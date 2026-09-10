# PAK Curriculum Coding and Traceability Rules

**Status:** Governance mirror for fast retrieval  
**Source authority:** Sections 2, 6, 7 and 10 of the master PRD  
**Rule:** This mirror supports navigation and implementation. It must not independently redefine the master PRD.

## Governing Academic Hierarchy

**Programme Level → Programme → Academic Period → Subject/Module → Chapter → Topic → Learning Outcome → Assessment → Study Material**

For semester programmes, Academic Period means Year/Semester. For short certificates it may mean Block/Week.

## Programme Codes

- Certificate: `PAK-Cxx`
- Diploma: `PAK-Dxx`
- Bachelor's-level: `PAK-Bxx`
- Postgraduate Diploma: `PAK-PGDxx`
- Master's-level: `PAK-Mxx`

## Subject and Module Codes

Subject/module codes must preserve programme and academic-period traceability. Existing codes are stable and may not be renumbered casually.

Examples:

- `D01-101` = D01, Semester 1, Subject 01
- `D01-401` = D01, Semester 4, Subject 01
- `C04-108` = C04, Module 08

## Chapter Codes

Each chapter will receive a deterministic identifier linked to its master subject/module. Once a subject reaches curriculum-freeze status, chapter identifiers should remain stable across normal content revisions.

## Shared-Module Rule

PAK uses modular curriculum architecture. Shared master content may be reused across programmes only when learning outcomes, prerequisite depth, practical competencies and assessment expectations are materially equivalent.

A shared title must never hide a meaningful difference in safety-critical competence, academic depth or programme-specific application.

## Mandatory Traceability

Each chapter will ultimately map to:

**Programme → Academic Period → Subject/Module → Chapter → Learning Outcome → Technical/Regulatory Reference → Teaching Activity → Assessment Item**

The traceability system must make it possible to answer:

- Why is this topic taught?
- Which learning outcome does it support?
- What source governs technical/regulatory claims?
- How is the outcome taught and assessed?
- Which study material contains the approved instruction?

## Modular-File Rule

Detailed day-to-day curriculum work is performed in the relevant modular programme/semester/block file. `ACADEMIC_INDEX.md` must be updated in the same change. Approved programme or major governance milestones are synchronized back into the master PRD.

## Stability Rule

Do not rename programme codes, subject/module codes or frozen chapter codes without an explicit governed migration and revision record.