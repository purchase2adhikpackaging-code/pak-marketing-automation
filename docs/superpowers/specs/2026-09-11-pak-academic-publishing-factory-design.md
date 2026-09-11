# PAK Academic Publishing Factory — Architecture Design

**Date:** 11 September 2026  
**Branch:** `feat/pak-academic-publishing-factory`  
**Status:** Approved direction — detailed design for review before implementation  
**Primary goal:** Produce the remaining PAK textbook library through a deterministic, massively parallel, self-auditing publishing pipeline while preserving PAK academic governance and print-ready publication standards.

## 1. Objective

Build a production system that can manufacture the PAK textbook library at portfolio scale rather than authoring books manually one by one.

The system must treat a textbook as a controlled publication artifact, not as a free-form AI response. Every released book must be traceable to the curriculum registry, pass academic/content checks, pass layout checks, pass visual checks, pass reference checks, and be reproducible from versioned source inputs.

The operational target is the full PAK library baseline previously counted as **642 textbook/module-book placements**, with one already produced as the pilot and the remainder entering factory production. The factory must not silently reduce the requested library by merging placements unless the user later explicitly changes the publication-count requirement.

The 48–72 hour goal is an execution target, not a waiver of quality gates. Throughput is achieved through parallelism and reuse of governed source knowledge, not by skipping QA.

## 2. Governing Sources

The factory must consume and obey, in priority order:

1. `docs/academic/PAK_ACADEMIC_CURRICULUM_STUDY_MATERIAL_BLUEPRINT_PRD.md`
2. `docs/academic/ACADEMIC_INDEX.md`
3. `docs/academic/governance/PRINT_READY_PUBLISHING_STANDARD.md`
4. `docs/academic/governance/CURRICULUM_CODING_AND_TRACEABILITY.md`
5. `docs/academic/governance/REGULATORY_AND_QA_RULES.md`
6. Modular programme/semester/module files under `docs/academic/**`
7. Approved PAK brand assets and publication metadata

If any lower-level source conflicts with a higher-level governance source, the higher-level source wins and the conflicting book must fail validation.

## 3. Non-Negotiable Release Principle

A successful PDF export is **not** a successful book.

A publication may enter the release set only when all mandatory gates pass:

- curriculum identity and subject/module mapping;
- chapter architecture completeness;
- learning-outcome coverage;
- manuscript completeness;
- technical terminology consistency;
- duplicate/filler detection;
- source/reference integrity;
- safety-critical claim control;
- diagram/visual integrity;
- internal component containment;
- page geometry and print safety;
- font embedding;
- image effective-resolution threshold;
- digital navigation/bookmarks;
- metadata and versioning;
- rendered-page visual inspection;
- no unresolved QA findings.

The release manifest must distinguish generated, failed, repaired, passed, and released books. It must never report a failed or unreviewed artifact as final.

## 4. Core Architecture

The factory is a staged pipeline with immutable hand-offs:

```text
Curriculum Registry
  -> Architecture Completion
  -> Book Blueprint
  -> Canonical Knowledge Assembly
  -> Manuscript Generation
  -> Technical Visual Plan
  -> Visual Generation / Diagram Rendering
  -> Typesetting
  -> PDF Build
  -> Structural QA
  -> Render QA
  -> Semantic/Visual QA
  -> Repair Loop
  -> Release Gate
  -> Release Manifest + Artifacts
```

Each stage produces a versioned artifact and machine-readable status. A later stage may not alter an earlier artifact silently; repairs generate a new revision.

## 5. Production Units

### 5.1 Programme Registry

Each programme record contains:

- programme code;
- programme title;
- qualification level;
- duration;
- academic structure;
- module/semester paths;
- curriculum status;
- chapter status;
- production status;
- release count.

### 5.2 Book Job

Each requested textbook/module book is represented by a `BookJob` with a stable ID.

Minimum fields:

```text
book_id
programme_code
programme_title
level
academic_period
subject_or_module_code
subject_or_module_title
publication_type
edition
revision
curriculum_source_paths
chapter_blueprint_path
knowledge_pack_ids
visual_plan_path
manuscript_path
layout_source_path
pdf_path
qa_report_path
status
failure_reasons
created_at
updated_at
```

### 5.3 Job States

```text
PLANNED
ARCHITECTURE_REQUIRED
BLUEPRINT_READY
KNOWLEDGE_READY
MANUSCRIPT_READY
VISUALS_READY
TYPESET_READY
PDF_BUILT
QA_RUNNING
QA_FAILED
REPAIRING
QA_PASSED
RELEASED
BLOCKED
```

Transitions are explicit and validated. `RELEASED` is unreachable from `PDF_BUILT` without `QA_PASSED`.

## 6. Curriculum Architecture Completion

The current repository contains mature Certificate and Diploma architecture and completed Bachelor's architecture for B01–B02, while later programme families still contain catalogue-only areas.

The factory therefore needs an architecture-completion lane that runs ahead of book generation.

For every subject/module before prose generation, the lane must define:

- unique code/title;
- purpose and scope;
- prerequisites/co-requisites;
- chapter sequence;
- chapter-level learning outcomes;
- theory/practical orientation;
- worked-example requirements;
- technical-visual requirements;
- laboratory/workshop/simulation requirements;
- assessment linkage;
- standards/reference families;
- safety-critical flags;
- publication deliverable classification.

Architecture completion is validated independently before the book job enters manuscript generation.

## 7. Canonical Railway Knowledge Layer

The system must avoid independently inventing the same railway fundamentals hundreds of times.

Create governed canonical knowledge packs for recurring domains such as:

- railway systems fundamentals;
- infrastructure and track;
- rolling stock architecture;
- freight wagons;
- bogies and suspension;
- wheelsets/axles/wheels;
- braking and pneumatics;
- traction and energy;
- electrical/electronic systems;
- signalling/control/communications;
- materials/metallurgy;
- mechanical engineering;
- drawing/CAD/documentation;
- metrology;
- welding/fabrication;
- NDT/inspection;
- maintenance/ECM;
- reliability/RAMS;
- safety/human factors;
- operations/logistics;
- quality/compliance;
- asset management;
- digital railway/condition monitoring;
- project/business/management domains.

Each knowledge pack contains:

- canonical terminology;
- level-neutral technical facts;
- equations/relationships where appropriate;
- approved explanatory diagrams or diagram specifications;
- regulatory/reference anchors;
- safety-sensitive flags;
- prohibited unsupported claims;
- source register.

Books do **not** copy a master pack verbatim. The book compiler adapts depth, mathematics, examples, exercises, assumptions, and pedagogical treatment to Certificate, Diploma, Bachelor's, PG Diploma, or Master's level.

## 8. Manuscript Generation

Manuscripts are generated from approved blueprints and knowledge packs into structured source, not directly into PDF.

Canonical source format: Markdown with validated YAML-compatible front-matter metadata plus a JSON sidecar for machine-only build/QA data.

Mandatory textbook sections follow the PAK print-ready standard, including controlled front matter, chapter content, back matter, glossary/reference material, and revision metadata.

### 8.1 Chapter Generation Contract

Each chapter must contain, when applicable:

- chapter number/title;
- purpose;
- learning outcomes;
- prerequisite knowledge;
- key terms;
- substantive teaching content;
- technical visual(s);
- formulae/worked examples;
- railway application example;
- safety/regulatory context;
- practical/workshop/lab link;
- case/failure/operational scenario;
- knowledge checkpoints;
- summary/key takeaways;
- review/assessment items;
- references/source notes.

No generated chapter may satisfy length targets through repeated prose, generic filler, duplicated callouts, or inflated summaries.

## 9. Visual System

Technical visuals are treated as typed assets, not decoration.

### 9.1 Visual Types

- deterministic vector block diagrams;
- SVG/CAD-style technical schematics;
- exploded/sectional teaching illustrations;
- process flows;
- tables/matrices;
- charts;
- annotated photographs;
- subject-specific cover/back-cover artwork.

### 9.2 Text Safety Rule

Critical technical labels must be typeset by the publishing renderer whenever possible. Long technical text must not be entrusted to an image generator.

Generated imagery should normally be text-free and unbranded. Exact labels, captions, programme data, and PAK identity are overlaid deterministically.

### 9.3 Visual Provider Boundary

Image generation is accessed through a provider adapter. The provider may change without changing curriculum or book schemas. Provider output is always considered an untrusted visual input until it passes the visual QA gates below.

### 9.4 Visual QA

Every visual asset must pass:

- expected dimensions;
- effective print resolution;
- no watermark/pseudo-branding;
- no malformed letters/numbers;
- no duplicated text layers;
- no clipped labels;
- no label outside its assigned container;
- caption/figure numbering consistency;
- grayscale legibility;
- safety illustration disclaimer where required.

## 10. Typesetting and PDF Production

The canonical renderer is **HTML/CSS rendered through Playwright-controlled Chromium**, with print CSS and deterministic page templates. This choice uses the repository's existing Playwright stack and provides DOM-level geometry inspection before final PDF export.

Required capabilities:

- A4 portrait baseline;
- binding-aware margins;
- optional controlled landscape pages;
- full-bleed cover/back cover support;
- repeatable heading hierarchy;
- dynamic-height callout boxes;
- table auto-wrapping and row expansion;
- equation handling;
- figure/table numbering;
- bookmarks;
- clickable TOC;
- searchable/selectable text;
- embedded fonts;
- metadata;
- digital and print-master outputs from the same approved source.

A post-processing step may add or validate PDF metadata/bookmarks only where Chromium output does not provide the required controlled feature. Post-processing may not modify substantive page content.

## 11. QA Architecture

QA is multi-layered. No single detector is trusted as proof of correctness.

### 11.1 Schema QA

Validate metadata, codes, chapter counts, required sections, source links, and job state using Zod schemas.

### 11.2 Content QA

Detect or reject:

- missing mandatory sections;
- duplicate paragraphs;
- near-duplicate filler;
- contradictory terminology;
- missing acronym expansion;
- broken chapter/figure/table numbering;
- unsupported safety-critical values;
- uncited regulatory claims where citation is mandatory;
- unresolved placeholder markers;
- accidental instructor-only content in student books;
- inconsistent programme/subject identity.

### 11.3 Layout QA

Before PDF export and after rendering, detect:

- text outside page bounds;
- text outside cards/tables/diagram boxes;
- clipped cells;
- overlapping DOM boxes;
- orphaned headings;
- bad page breaks;
- images below effective resolution threshold;
- cover/back-cover safe-area violations;
- QR/barcode clipping if present.

### 11.4 PDF QA

Check:

- A4 page size;
- expected page count range;
- fonts embedded;
- searchable text;
- bookmarks present;
- internal links present;
- metadata correct;
- no corrupted objects;
- no blank accidental pages;
- no external debug marks.

### 11.5 Render/Vision QA

Render every page to images.

Use automated image analysis/vision review on every page, with escalated full-size inspection for:

- covers;
- chapter openers;
- diagrams;
- dense tables;
- formula pages;
- practical/workshop forms;
- glossaries;
- references;
- back covers.

The reviewer must look for defects that page-boundary checks cannot detect: duplicate text, semantic collisions, visual clutter, diagram-label mistakes, unreadable hierarchy, garbled imagery, and content drawn under content.

### 11.6 Cross-Book QA

Portfolio-level checks ensure:

- no duplicate book IDs;
- no missing planned book;
- consistent PAK terminology;
- consistent programme naming;
- correct level progression;
- canonical facts remain consistent;
- higher-level books add depth instead of repeating lower-level books verbatim.

## 12. Automatic Repair Loop

Every QA finding is structured as a repair ticket:

```text
book_id
page
component_id
failure_class
severity
detector
evidence
repair_action
attempt
status
```

Repair routing:

- prose defect -> manuscript stage;
- diagram defect -> visual stage;
- table/box overflow -> typesetting stage;
- citation defect -> reference stage;
- cover defect -> cover compositor;
- PDF metadata/font/navigation defect -> export stage.

A repaired artifact receives a new revision hash and reruns all downstream checks, not only the failed detector.

The automatic repair budget is **three attempts per unique finding**. If the same finding remains after the third repair attempt, the book transitions to `BLOCKED`; it cannot be released until a new source revision or explicit corrective intervention resolves the finding.

## 13. Parallel Execution Model

Throughput comes from independent queues rather than one giant agent.

Worker pools:

- curriculum architecture workers;
- blueprint workers;
- canonical knowledge workers;
- manuscript workers;
- technical visual workers;
- cover-art workers;
- typesetting workers;
- structural QA workers;
- rendered-page QA workers;
- repair workers;
- release/manifest worker.

Workers consume immutable job payloads and write stage outputs. Queue concurrency is runtime-configurable so execution can scale to available compute/API limits without changing academic logic.

Initial production order prioritizes D01 because it is the validated pilot programme, while architecture workers simultaneously unlock other families.

## 14. Batch/Wave Strategy

Production runs in overlapping waves:

1. **Wave A:** D01 remaining textbook placements
2. **Wave B:** D02–D05
3. **Wave C:** C01–C12 module books
4. **Wave D:** B01–B05
5. **Wave E:** PGD01–PGD06
6. **Wave F:** M01–M06

This order establishes reliable applied-technical foundations before advanced programmes, but queues overlap whenever dependencies are satisfied.

A failure in one book does not stop unrelated books; only dependency or governance failures block downstream jobs.

## 15. Storage Layout

Recommended repository/artifact structure:

```text
publishing/
  schemas/
  registry/
  knowledge/
  blueprints/
  manuscripts/
  visuals/
  templates/
  qa/
  manifests/
  scripts/

artifacts/  # generated in CI/build storage, not committed wholesale to git
  textbooks/
    certificate/
    diploma/
    bachelors/
    postgraduate-diploma/
    masters/
```

Large generated PDFs/images should be CI artifacts or object-storage releases rather than bloating Git history. Git stores source, manifests, QA reports, and reproducible configuration.

## 16. Release Manifest

Every factory run must produce a machine-readable and human-readable manifest with at least:

```text
planned
generated
qa_passed
qa_failed
blocked
released
unresolved
```

Per book:

- book ID;
- title;
- source revision;
- build revision;
- PDF checksum;
- page count;
- QA status;
- QA report;
- release path.

The release summary must never claim completeness unless `released == planned` and `unresolved == 0`.

## 17. Observability

Every stage records:

- start/end time;
- input hashes;
- output hashes;
- worker type;
- model/tool configuration where applicable;
- token/API cost if available;
- error category;
- retries;
- QA findings.

This allows throughput measurement, failure-rate tracking, and deterministic reproduction of a defective page or book.

## 18. Security and Credentials

No service-role/API secret is committed to GitHub.

Secrets are injected through runtime environment/CI secret stores. Generated prompts and logs must avoid exposing secrets. External model/provider calls are isolated behind provider adapters so providers can be changed without rewriting curriculum logic.

## 19. Testing Strategy

Implementation follows TDD for deterministic code.

Minimum test families:

### Unit tests

- curriculum parsing;
- book-job enumeration;
- stable IDs;
- state machine transitions;
- schema validation;
- duplicate detection;
- figure/table numbering;
- source/reference validation;
- layout-measurement helpers;
- release-manifest arithmetic.

### Golden tests

Maintain a small set of intentionally difficult pages:

- long table cells;
- multi-line diagram labels;
- glossary entries;
- dense formulas;
- workshop forms;
- cover/back cover.

Golden tests must reproduce the defect classes already observed in the D01 pilot, including text outside rectangles and duplicate text rendered under other text.

### Integration tests

- one complete sample book through all stages;
- one intentional QA failure and automatic repair;
- multi-book parallel queue;
- blocked safety-critical claim;
- failed reference resolution;
- release manifest excludes failures.

### End-to-end tests

Build a small representative batch spanning Certificate, Diploma, Bachelor's, PGD, and Master's levels and verify reproducible release artifacts.

## 20. Quality Acceptance Criteria

A book is release-eligible only if:

1. all required curriculum/blueprint fields are present;
2. manuscript has no unresolved structural/content findings;
3. all visuals pass asset QA;
4. no detected text/container overflow exists;
5. no detected overlapping/duplicate text exists;
6. all raster print assets meet required effective resolution or have an explicitly recorded approved exception;
7. all fonts are embedded;
8. bookmarks/TOC navigation pass;
9. metadata and filename match the registry;
10. rendered-page QA passes every page;
11. all high-risk pages pass escalated review;
12. reference/safety checks pass;
13. final checksum and QA report are recorded;
14. status is `QA_PASSED` before transition to `RELEASED`.

## 21. Portfolio Acceptance Criteria

The full library run is complete only when:

- planned inventory is reconciled against the curriculum registry;
- every planned book has exactly one current released edition;
- zero books remain `QA_FAILED`, `REPAIRING`, `BLOCKED`, or unresolved;
- the manifest count reconciles exactly;
- duplicate-ID and missing-ID scans pass;
- cross-book terminology consistency checks pass;
- all release artifacts have checksums and QA reports;
- the complete library index can be generated from the manifest.

## 22. Time-Critical Execution Policy

The 48–72 hour objective changes execution topology, not release standards.

Rules:

- maximize concurrency after dependencies are satisfied;
- prioritize deterministic reusable assets;
- reuse canonical knowledge, not finished prose;
- generate technical diagrams programmatically wherever practical;
- generate artwork without embedded critical text;
- fail fast on missing architecture;
- repair locally rather than rebuilding unrelated books;
- preserve all QA gates even under deadline pressure.

If runtime/provider capacity is insufficient to meet the time target, the factory must report the actual remaining queue; it must not mark incomplete books as released.

## 23. Explicit Non-Goals

This project does not:

- grant PAK degree-awarding authority;
- grant safety-critical maintenance/operational authority;
- reproduce copyrighted standards or proprietary manuals without permission;
- fabricate approvals, SME sign-offs, ISBNs, certifications, or controlled maintenance data;
- silently merge requested book placements to reduce production count;
- treat AI-generated output as authoritative without the defined QA gates.

## 24. Implementation Boundary

The first implementation milestone is the factory core, not all 641 outputs in a single code commit.

The implementation must first establish:

1. registry ingestion and book-job enumeration;
2. schemas/state machine;
3. blueprint/manuscript/visual interfaces;
4. deterministic HTML/CSS/Chromium renderer;
5. structural QA;
6. page rendering and visual-QA interface;
7. repair loop;
8. release manifest;
9. D01 pilot batch execution.

After the D01 batch passes, the same pipeline is scaled across the remaining programme inventory without changing release criteria.

## 25. Success Definition

Success is not "the model generated hundreds of PDFs."

Success is a reproducible PAK publishing system capable of reporting:

```text
PLANNED:    N
GENERATED:  N
QA PASSED:  N
RELEASED:   N
FAILED:     0
BLOCKED:    0
UNRESOLVED: 0
```

with every released book linked to its curriculum source, manuscript source, visual assets, build metadata, checksum, and QA evidence.
