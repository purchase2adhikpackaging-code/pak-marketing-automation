from pathlib import Path
import re

master_path = Path('docs/academic/PAK_ACADEMIC_CURRICULUM_STUDY_MATERIAL_BLUEPRINT_PRD.md')
index_path = Path('docs/academic/ACADEMIC_INDEX.md')
master = master_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')
original_master = master

assert '**Version:** 0.1.9  ' in master
assert '**Baseline Date:** 10 September 2026  ' in master
assert '# 30. Portfolio Architecture Checkpoint v0.1.9' in master
assert '# 31. Certificate Architecture Batch Synchronization v0.2.0' not in master
assert '**Current master version:** `0.1.9`' in index
assert '**Next Controlled Target: Certificate Batch Master-PRD Synchronization — PAK-C05–PAK-C12**' in index

preserved_from_17 = original_master[original_master.index('# 17. PAK-D01'):]
historical_checkpoint = original_master[original_master.index('# 30. Portfolio Architecture Checkpoint v0.1.9'):]

master = master.replace('**Version:** 0.1.9  ', '**Version:** 0.2.0  ', 1)
master = master.replace(
    '**Status:** Living Master Blueprint  \n**Baseline Date:** 10 September 2026  ',
    '**Status:** Living Master Blueprint  \n**Certificate Architecture Sync:** 11 September 2026 — PAK-C05–PAK-C12 synchronized  \n**Baseline Date:** 11 September 2026  ',
    1,
)

old_roadmap_019 = '| v0.1.9 | PAK-C04 6-month Locomotive Maintenance certificate module architecture | **CURRENT** |'
assert old_roadmap_019 in master
master = master.replace(old_roadmap_019, '| v0.1.9 | PAK-C04 6-month Locomotive Maintenance certificate module architecture | COMPLETE |', 1)
old_roadmap_02 = '| v0.2 | Complete programme/module and year/semester-wise subject architecture for all programmes | IN PROGRESS |'
assert old_roadmap_02 in master
master = master.replace(
    old_roadmap_02,
    '| v0.2.0 | Certificate architecture batch synchronized into master PRD; 12/12 Certificate programmes and 126 Certificate module placements consolidated | **CURRENT** |\n'
    "| v0.2.x | Complete programme/module and year/semester-wise subject architecture for remaining Bachelor's-level, PGD and Master's-level programmes | IN PROGRESS |",
    1,
)

old_section14 = '''## 14. Next Controlled Work Item

With PAK-D01 through PAK-D05 and PAK-C01 through PAK-C04 now mapped at subject/module level, the next controlled curriculum work item is:

### `PAK-C05 — Certificate in Wheelset & Bogie Technology`

The next revision must define the complete 4-month module/block architecture for PAK-C05, including wheelset construction, wheels/axles/bearings/axleboxes, bogie frames, suspension, running gear, measurement and inspection, common defects, maintenance practice, safety-critical boundaries, traceability and final applied assessment.

All future curriculum development and textbook production must comply with Section 26 — Global Print-Ready Academic Publishing & Book Production Standard.'''
assert old_section14 in master
new_section14 = '''## 14. Next Controlled Work Item

With PAK-D01 through PAK-D05 complete at subject-architecture level and the full PAK-C01 through PAK-C12 Certificate portfolio now synchronized into this master at module-architecture level, the next controlled curriculum work item is:

### `PAK-B01 — Bachelor's-Level Railway Engineering`

The next revision must define the complete 3-year / 6-semester subject architecture for PAK-B01 before any Bachelor's-level textbook prose is produced. The programme must preserve the qualification/awarding caveat in Section 11: curriculum architecture may be designed now, but formal degree-title use, marketing and award require the applicable Polish authorization/accreditation or an appropriately authorized higher-education awarding partner.

All future curriculum development and textbook production must continue to comply with Section 26 — Global Print-Ready Academic Publishing & Book Production Standard and the architecture-before-books gate.'''
master = master.replace(old_section14, new_section14, 1)

old_rev = '| 0.1.9 | 10 Sep 2026 | Added complete 24-week / 12-module architecture for PAK-C04 Locomotive Maintenance with print-publication and technical-visual requirements | Active |'
assert old_rev in master
master = master.replace(
    old_rev,
    '| 0.1.9 | 10 Sep 2026 | Added complete 24-week / 12-module architecture for PAK-C04 Locomotive Maintenance with print-publication and technical-visual requirements | Superseded |\n'
    '| 0.2.0 | 11 Sep 2026 | Synchronized approved PAK-C05–PAK-C12 Certificate architectures into the consolidated master; Certificate portfolio complete at 12/12 programmes and 126 module placements | Active |',
    1,
)

sync = r'''

---

# 31. Certificate Architecture Batch Synchronization v0.2.0

## 31.0 Synchronization Control Note

This section consolidates the already approved modular architectures for **PAK-C05 through PAK-C12** into the master PRD. It does not redesign or replace their detailed modular working files. The modular files remain the day-to-day curriculum sources; this master remains the consolidated governance and audit authority.

Synchronization baseline:

- synchronized programmes: **PAK-C05–PAK-C12**;
- synchronized module placements in this batch: **78**;
- previously consolidated Certificate placements (PAK-C01–PAK-C04): **48**;
- total Certificate programme placements after synchronization: **126**;
- Certificate programmes complete at module-architecture level: **12 of 12**;
- detailed chapter architecture: **Pending**;
- full study-material writing: **Not Started**;
- print production: **Not Started**.

All eight synchronized programmes inherit Section 26 in full. Their detailed modular files also retain the programme-specific practical, visual, assessment, regulatory and publication requirements already approved. Where this consolidated section is shorter than a modular programme file, the modular programme file supplies the detailed implementation layer; no omission here removes an approved programme-level control.

---

## 31.1 PAK-C05 — Certificate in Wheelset & Bogie Technology

**Duration:** 4 Months / 16 Weeks  
**Architecture:** 8 sequential two-week modules  
**Detailed modular source:** `docs/academic/certificates/C05/PAK-C05.md`

| Weeks | Code | Module |
|---|---|---|
| 1–2 | C05-101 | Wheelset & Bogie Fundamentals, Safety & Technical Documentation |
| 3–4 | C05-102 | Bogie Frames, Structures, Suspension & Load Paths |
| 5–6 | C05-103 | Wheelsets, Wheels, Axles, Profiles, Geometry & Track Interface |
| 7–8 | C05-104 | Axleboxes, Bearings, Lubrication & Condition Indicators |
| 9–10 | C05-105 | Inspection, Metrology, Wear & Defect Recognition |
| 11–12 | C05-106 | NDT Awareness, Maintenance, Reprofiling, Repair & Overhaul Principles |
| 13–14 | C05-107 | Failure Analysis, Reliability, ECM, Traceability & EU Compliance Awareness |
| 15–16 | C05-108 | Integrated Wheelset & Bogie Practicum & Final Competency Assessment |

**Competence boundary:** completion does not authorize independent wheelset, axle, bearing or bogie release; reprofiling or machining acceptance; safety-critical repair approval; certified NDT sign-off; calibrated release-measurement approval; or return-to-service decisions. Exact wheel profiles, dimensions, press fits, torque values, repair limits and acceptance criteria must come from the current approved controlled source for the specific asset/process.

---

## 31.2 PAK-C06 — Certificate in Railway Braking Systems

**Duration:** 4 Months / 16 Weeks  
**Architecture:** 8 sequential two-week modules  
**Detailed modular source:** `docs/academic/certificates/C06/PAK-C06.md`

| Weeks | Code | Module |
|---|---|---|
| 1–2 | C06-101 | Railway Braking Fundamentals, Safety & Technical Documentation |
| 3–4 | C06-102 | Compressed Air, Pneumatic Brake Architecture & Air Supply |
| 5–6 | C06-103 | Brake Control, Distributors, Valves, Load Compensation & Emergency Functions |
| 7–8 | C06-104 | Mechanical Brake Gear, Friction Materials, Disc & Tread Braking |
| 9–10 | C06-105 | Electropneumatic Braking, Wheel-Slide Protection & Dynamic/Blended Braking Awareness |
| 11–12 | C06-106 | Brake Inspection, Testing, Maintenance & Fault Diagnosis |
| 13–14 | C06-107 | Braking Performance, Degraded Conditions, Reliability, ECM & EU Compliance Awareness |
| 15–16 | C06-108 | Integrated Railway Braking Practicum & Final Competency Assessment |

**Competence boundary:** completion does not authorize independent brake-system release, statutory brake testing, brake-performance certification, safety-critical component acceptance, brake-setting alteration, safety-related software/configuration changes, train brake-test sign-off or return-to-service decisions. Future books must revalidate the applicable LOC&PAS TSI, WAG TSI, ECM framework, EU railway safety/interoperability legislation, standards and asset-specific approved data before publication.

---

## 31.3 PAK-C07 — Certificate in Railway Welding & Fabrication

**Duration:** 6 Months / 24 Weeks  
**Architecture:** 12 sequential two-week modules  
**Detailed modular source:** `docs/academic/certificates/C07/PAK-C07.md`

| Weeks | Code | Module |
|---|---|---|
| 1–2 | C07-101 | Railway Welding & Fabrication Fundamentals, Safety & Technical Documentation |
| 3–4 | C07-102 | Engineering Materials, Metallurgy & Weldability |
| 5–6 | C07-103 | Welding Processes I — SMAW, GMAW/MAG, GTAW & FCAW Fundamentals |
| 7–8 | C07-104 | Joint Design, Preparation, Fit-Up, Symbols & Welding Drawings |
| 9–10 | C07-105 | Welding Metallurgy, Heat Input, HAZ, Distortion & Residual Stress |
| 11–12 | C07-106 | Welding Processes II — Parameters, Consumables, Equipment & Process Control |
| 13–14 | C07-107 | Railway Fabrication — Cutting, Forming, Jigs, Fixtures, Assembly & Dimensional Control |
| 15–16 | C07-108 | Weld Defects, Visual Inspection & NDT Awareness |
| 17–18 | C07-109 | WPS/WPQR, Welder Qualification & Welding Coordination Awareness |
| 19–20 | C07-110 | Railway Welding Quality — EN 15085, ISO 3834, Traceability & Documentation |
| 21–22 | C07-111 | Weld Repair, Rework, Failure Analysis & Production Quality |
| 23–24 | C07-112 | Integrated Railway Welding & Fabrication Practicum & Final Competency Assessment |

**Competence boundary:** the PAK certificate alone does not create certified-welder, welding-operator, welding-coordinator, welding-inspector, NDT-personnel, WPS/WPQR-approval or safety-critical weld acceptance/release authority. Current applicable EN 15085, ISO 3834, ISO 14731, ISO 9606-family and process/product requirements must be revalidated for detailed books and controlled practical work.

---

## 31.4 PAK-C08 — Certificate in Railway Electrical Systems

**Duration:** 6 Months / 24 Weeks  
**Architecture:** 12 sequential two-week modules  
**Detailed modular source:** `docs/academic/certificates/C08/PAK-C08.md`

| Weeks | Code | Module |
|---|---|---|
| 1–2 | C08-101 | Railway Electrical Fundamentals, Electrical Safety & Safe Working Principles |
| 3–4 | C08-102 | DC & AC Circuits, Electrical Quantities, Measurements & Instrument Use |
| 5–6 | C08-103 | Electrical Drawings, Schematics, Wiring, Cables, Terminals & Connectors |
| 7–8 | C08-104 | Batteries, Chargers, Low-Voltage Supplies & Energy Storage Fundamentals |
| 9–10 | C08-105 | Electrical Machines, Transformers & Electromechanical Devices |
| 11–12 | C08-106 | Rolling Stock Auxiliary Electrical Systems — Lighting, HVAC, Doors, Pumps, Fans & Cab Systems |
| 13–14 | C08-107 | Railway Electrification, Current Collection & Traction-Power Interface Awareness |
| 15–16 | C08-108 | Power Electronics, Converters, Inverters & Traction-Drive Awareness |
| 17–18 | C08-109 | Relays, Contactors, Sensors, Interlocks & Basic Electrical Control Circuits |
| 19–20 | C08-110 | Electrical Inspection, Continuity/Insulation Testing & Structured Fault Finding |
| 21–22 | C08-111 | Earthing, Bonding, EMC, Maintenance Quality, ECM Awareness & Traceability |
| 23–24 | C08-112 | Integrated Railway Electrical Systems Practicum & Final Competency Assessment |

**Competence boundary:** completion does not authorize live high-voltage work, traction-power switching, electrical isolation/earthing authority, pantograph/roof work, protection-setting changes, safety-related software/configuration changes, formal insulation acceptance, train-protection intervention, electrical release-to-service or independent return-to-service decisions. Vehicle-side electrical maintenance is the primary scope; fixed traction-energy infrastructure remains an awareness/interface domain unless separately authorized.

---

## 31.5 PAK-C09 — Certificate in Railway Inspection & NDT

**Duration:** 6 Months / 24 Weeks  
**Architecture:** 12 sequential two-week modules  
**Detailed modular source:** `docs/academic/certificates/C09/PAK-C09.md`

| Weeks | Code | Module |
|---|---|---|
| 1–2 | C09-101 | Railway Inspection Fundamentals, Safety, Quality & Technical Documentation |
| 3–4 | C09-102 | Materials, Discontinuities, Defects, Failure Modes & Inspection Planning |
| 5–6 | C09-103 | Visual Testing, Optical Aids & Surface Condition Assessment |
| 7–8 | C09-104 | Dimensional Inspection, Metrology & Measurement Systems |
| 9–10 | C09-105 | Penetrant Testing — Principles, Process Control & Interpretation |
| 11–12 | C09-106 | Magnetic Particle Testing — Principles, Techniques & Interpretation |
| 13–14 | C09-107 | Ultrasonic Testing — Fundamentals, Equipment, Calibration Concepts & Indications |
| 15–16 | C09-108 | Radiographic Testing — Film/Digital Principles & Radiation-Safety Awareness |
| 17–18 | C09-109 | Eddy Current & Advanced NDT Methods Awareness |
| 19–20 | C09-110 | Railway Component Inspection — Welds, Wheelsets, Axles, Bogies & Structures |
| 21–22 | C09-111 | NDT Procedures, Reporting, Evaluation, Certification, ECM & Traceability |
| 23–24 | C09-112 | Integrated Railway Inspection & NDT Practicum & Final Competency Assessment |

**Competence boundary:** PAK-C09 is vocational NDT education, not ISO 9712 personnel certification. Completion does not authorize independent NDT sign-off, uncontrolled radiographic exposure work, acceptance/rejection of safety-critical railway components, maintenance release or return-to-service decisions. Applicable NDT method standards, railway/customer requirements, radiation controls and certification rules must be revalidated before publication and delivery.

---

## 31.6 PAK-C10 — Certificate in Railway Safety & Workshop Practices

**Duration:** 3 Months / 12 Weeks  
**Architecture:** 6 sequential two-week modules  
**Detailed modular source:** `docs/academic/certificates/C10/PAK-C10.md`

| Weeks | Code | Module |
|---|---|---|
| 1–2 | C10-101 | Railway Safety Culture, Hazard Identification, Risk Assessment & Safe-System-of-Work Fundamentals |
| 3–4 | C10-102 | PPE, Workshop Housekeeping, Ergonomics, Manual Handling & Safe Workplace Organization |
| 5–6 | C10-103 | Hand/Power Tools, Machinery, Guards, Stored Energy & Isolation/LOTO Awareness |
| 7–8 | C10-104 | Lifting, Jacking, Supporting Railway Vehicles & Heavy-Component Handling |
| 9–10 | C10-105 | Fire, Hot Work, Chemicals, Batteries, Compressed Systems & Emergency Preparedness |
| 11–12 | C10-106 | Integrated Railway Workshop Safety Practicum, Incident Response & Final Competency Assessment |

**Competence boundary:** completion does not itself authorize electrical isolation or traction-power switching, separately qualified lifting-equipment operation, vehicle movement/shunting, hot-work permit approval, confined-space entry, work-at-height certification, first-aider or rescue roles, or safety-critical return-to-service decisions. Employer/site procedures, risk controls and legally required qualifications remain controlling.

---

## 31.7 PAK-C11 — Certificate in Railway Quality Control

**Duration:** 4 Months / 16 Weeks  
**Architecture:** 8 sequential two-week modules  
**Detailed modular source:** `docs/academic/certificates/C11/PAK-C11.md`

| Weeks | Code | Module |
|---|---|---|
| 1–2 | C11-101 | Railway Quality Fundamentals, QMS, Roles & Controlled Documentation |
| 3–4 | C11-102 | Engineering Drawings, Specifications, Inspection Plans & Quality Characteristics |
| 5–6 | C11-103 | Metrology, Measurement Systems, Calibration & Measurement Confidence |
| 7–8 | C11-104 | Incoming Inspection, Material Certification, Supplier Quality & Traceability |
| 9–10 | C11-105 | In-Process Quality Control, Sampling, SPC & Process Capability Fundamentals |
| 11–12 | C11-106 | Final Inspection, NCR, Deviation/Concession Awareness, Root Cause & CAPA |
| 13–14 | C11-107 | Railway QMS, Auditing, ECM Quality, Configuration/Change Control & Continuous Improvement |
| 15–16 | C11-108 | Integrated Railway Quality-Control Practicum & Final Competency Assessment |

**Competence boundary:** completion does not authorize product or maintenance release, safety-critical component acceptance, NCR disposition, engineering deviations/concessions, supplier approval, calibration certification, formal QMS certification or independent audit authority. Current applicable railway-QMS, ISO 9001, ISO 10012, ISO 19011, ISO 2859 and ECM requirements must be revalidated before detailed publication.

---

## 31.8 PAK-C12 — Certificate in Railway Operations & Logistics

**Duration:** 6 Months / 24 Weeks  
**Architecture:** 12 sequential two-week modules  
**Detailed modular source:** `docs/academic/certificates/C12/PAK-C12.md`

| Weeks | Code | Module |
|---|---|---|
| 1–2 | C12-101 | Railway Operations, Network Actors, Safety Culture & Operational Documentation |
| 3–4 | C12-102 | Rolling Stock, Infrastructure, Signalling & Traction Fundamentals for Operations |
| 5–6 | C12-103 | Train Planning, Timetables, Paths, Headways & Capacity Fundamentals |
| 7–8 | C12-104 | Train Operations, Traffic Management & Operational Communication |
| 9–10 | C12-105 | Stations, Yards, Terminals, Shunting Interfaces & Train Formation Awareness |
| 11–12 | C12-106 | Passenger Railway Operations, Service Delivery & Customer Information |
| 13–14 | C12-107 | Freight Rail Operations, Wagon Flow & Freight Documentation |
| 15–16 | C12-108 | Intermodal Logistics, Terminals, Supply Chains & Last-Mile Interfaces |
| 17–18 | C12-109 | Disruption, Delay, Incident & Degraded-Operation Management Awareness |
| 19–20 | C12-110 | Cross-Border Rail Freight, Interoperability & European Railway Corridors |
| 21–22 | C12-111 | Railway Performance, KPIs, Digital Operations & Logistics Optimization |
| 23–24 | C12-112 | Integrated Railway Operations & Logistics Simulation + Final Competency Assessment |

**Competence boundary:** completion does not authorize train driving, dispatching, signal operation, traffic-control decisions, shunting command, train-preparation sign-off, route competence, safety-critical communications, degraded-mode authority, dangerous-goods operational certification, real timetable/path-allocation decisions or other regulated operating roles. OPE TSI/ERA guidance, EU safety/interoperability legislation, freight-corridor/TEN-T framework, national rules and operator/infrastructure-manager procedures must be revalidated before detailed publication.

---

# 32. Portfolio Architecture Checkpoint v0.2.0

The approved Certificate architecture batch has now been synchronized into the consolidated master PRD.

| Portfolio Level | Programmes Completed | Curriculum Placements Defined |
|---|---:|---:|
| Certificate | **12 of 12** | **126 module placements** |
| Diploma | **5 of 5** | **120 semester subject placements** |
| Bachelor's-level | 0 of 5 | Pending |
| Postgraduate Diploma | 0 of 6 | Pending |
| Master's-level | 0 of 6 | Pending |

**Certificate synchronization audit:** PAK-C05 through PAK-C12 contribute **78** synchronized placements in Section 31. Together with the **48** PAK-C01 through PAK-C04 placements already consolidated in Sections 23, 24, 27 and 29, the Certificate portfolio total is **126** placements.

**Development status after v0.2.0:**

- Certificate module architecture: **Complete — 12/12 programmes**;
- Diploma subject architecture: **Complete — 5/5 programmes / 120 placements**;
- Certificate chapter architecture: **Not Started**;
- full study-material writing: **Not Started**;
- print production: **Not Started**;
- Section 26 Book Production Gate remains mandatory.

**Next controlled curriculum target:** `PAK-B01 — Bachelor's-Level Railway Engineering` (3 years / 6 semesters), subject to Section 11 qualification/awarding caveat.
'''

master = master.rstrip() + sync + '\n'

new_from_17 = master[master.index('# 17. PAK-D01'):]
assert new_from_17.startswith(preserved_from_17)
assert historical_checkpoint in master
for n in range(17, 31):
    assert f'# {n}.' in master, f'missing historical top-level section {n}'
assert '# 31. Certificate Architecture Batch Synchronization v0.2.0' in master
assert '# 32. Portfolio Architecture Checkpoint v0.2.0' in master
assert '**Version:** 0.2.0  ' in master

expected = {5:8, 6:8, 7:12, 8:12, 9:12, 10:6, 11:8, 12:12}
sync_only = master[master.index('# 31. Certificate Architecture Batch Synchronization v0.2.0'):]
total = 0
for programme, count in expected.items():
    found = re.findall(rf'\| C{programme:02d}-\d{{3}} \|', sync_only)
    assert len(found) == count, (programme, len(found), count)
    total += len(found)
assert total == 78
assert '| Certificate | **12 of 12** | **126 module placements** |' in master

index = index.replace('**Current master version:** `0.1.9`', '**Current master version:** `0.2.0`', 1)
index = index.replace(
    '**Next Controlled Target: Certificate Batch Master-PRD Synchronization — PAK-C05–PAK-C12**',
    "**Next Controlled Target: PAK-B01 — Bachelor's-Level Railway Engineering**",
    1,
)
refs = {'PAK-C05':'§31.1','PAK-C06':'§31.2','PAK-C07':'§31.3','PAK-C08':'§31.4','PAK-C09':'§31.5','PAK-C10':'§31.6','PAK-C11':'§31.7','PAK-C12':'§31.8'}
lines = index.splitlines()
for i, line in enumerate(lines):
    for code, ref in refs.items():
        if line.startswith(f'| {code} |'):
            assert line.endswith('| Pending master sync |'), (code, line)
            lines[i] = line[:-len('| Pending master sync |')] + f'| {ref} |'
index = '\n'.join(lines) + ('\n' if index.endswith('\n') else '')
old_sync_line = '- Master PRD consolidated synchronization: **next controlled milestone — PAK-C05 through PAK-C12**'
assert old_sync_line in index
index = index.replace(old_sync_line, '- Certificate batch master synchronization: **Complete — v0.2.0 (§31–§32)**', 1)
old_target = '''## Immediate Working Target

**Certificate Batch Master-PRD Synchronization — PAK-C05 through PAK-C12**

The Certificate programme architecture is now complete. Before beginning PAK-B01 or any Certificate textbook prose, synchronize the approved PAK-C05–C12 modular architectures back into the consolidated master PRD through a controlled, verified batch update. After that synchronization, the next portfolio-development target is **PAK-B01 — Bachelor's-Level Railway Engineering**.'''
assert old_target in index
index = index.replace(old_target, '''## Immediate Working Target

**PAK-B01 — Bachelor's-Level Railway Engineering — 3 Years / 6 Semesters**

The Certificate programme architecture is complete and synchronized into the consolidated master PRD v0.2.0. The next portfolio-development task is to design and approve the complete six-semester subject architecture for PAK-B01 before any Bachelor's-level textbook prose begins. Formal degree-title use, marketing and award remain subject to the qualification/awarding caveat in the master PRD.''', 1)
assert '**Current master version:** `0.2.0`' in index
assert "**Next Controlled Target: PAK-B01 — Bachelor's-Level Railway Engineering**" in index
assert index.count('Pending master sync') == 0
for code, ref in refs.items():
    row = next(line for line in index.splitlines() if line.startswith(f'| {code} |'))
    assert row.endswith(f'| {ref} |'), row

master_path.write_text(master, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
print('master_chars', len(master))
print('master_lines', len(master.splitlines()))
print('sync_module_placements', total)
print('index_lines', len(index.splitlines()))
