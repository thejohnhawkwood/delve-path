# Golden data catalog

Printed rounded values are **not** infinite-precision truth. Test tolerance must be at least the source’s displayed precision.

Every structured fixture has a metadata record. Never create a golden CSV without provenance.

---

## Level 1 — Mathematical synthetic cases

Specifications only. No invented mining conversion. Implement as unit tests later.

| ID | Intent | Setup | Expected (qualitative) |
|---|---|---|---|
| `L1_vertical` | Vertical bore | INC = 0° oilfield; arbitrary AZI; several MD steps | N and E remain 0; ΔTVD = ΔMD |
| `L1_due_north` | Constant INC, AZI = 0° | Non-zero INC, AZI 0 | E ≈ 0; N and TVD increase consistently |
| `L1_due_east` | Constant INC, AZI = 90° | Non-zero INC, AZI 90 | N ≈ 0 |
| `L1_azimuth_wrap` | 359° → 1° | Two stations, small INC | Small directional change; **must not** treat as a 358° turn |
| `L1_near_zero_dogleg` | RF → 1 | Consecutive stations with nearly identical INC/AZI | Position increment ≈ balanced-tangent / straight; no NaN |
| `L1_cross_horizontal` | INC through 90° | e.g. 85 → 90 → 95 | TVD rate-of-change passes through 0 and then decreases if INC > 90 |
| `L1_vsp_independence` | Same surveys, two VSPs | Clone a fixture; change VSP only | N/E/TVD unchanged; VS changes |
| `L1_unit_equivalence` | ft & °/100 ft vs m & °/30 m | Equivalent trajectory | Positions agree after conversion |
| `L1_tie_in` | Non-zero start | Non-zero MD, TVD, N, E, INC, AZI | Subsequent stations accumulate from that origin |
| `L1_mining_import` | Mining-convention import | — | **NOT CREATED.** Conversion rules are unsourced. See `SURVEY_CONVENTIONS.md`. |

JSON stubs: `research/golden/metadata/level1_synthetic_specs.json`.

---

## Level 2 — Historical software goldens

### 2.1 Oregon WinSERVE — moderate (transcribed)

| Item | Value |
|---|---|
| Fixture | `winserve_oregon_24c_23_65` |
| PDF | `research/golden/source-pdfs/oregon_IW24C-23-65_boresurvey.pdf` |
| SHA-256 | `C50332AF6999695798528E146C7EE482C4C4D8028961F395D9D43C6A55A14D98` |
| Software / method | WinSERVE / Minimum Curvature |
| Units | ft |
| VSP | 165.30° referenced to wellhead |
| Character | Moderate build, max INC 36.90°; plug-back interpolated station at 1848 ft |
| CSVs | `research/golden/fixtures/winserve_oregon_24c-23-65_{input,expected}.csv` |
| Metadata | `research/golden/metadata/winserve_oregon_24c_23_65.metadata.json` |
| Status | Transcribed from scan via OCR + header visual check. Independent check: MD monotonic; TVD ≤ MD; first station vertical; DLS spikes during build then drops on hold. |

### 2.2 New Mexico WinSERVE — high-angle crossing 90° (transcribed)

| Item | Value |
|---|---|
| Fixture | `winserve_nm_3003929461_jicarilla452_08_31` |
| PDF | `research/golden/source-pdfs/nm_3003929461_13_WF.pdf` |
| SHA-256 | `99D325CA81311C45E6E1E5E02D6A5CD685EC490C8A6C3DA41AAF9C2B509BB687` |
| API | 30-039-29461 |
| Software / method | WinSERVE / Minimum Curvature |
| Units | ft |
| VSP | 86.10° referenced to wellhead |
| Character | Pilot tie-in INC 63.70°; INC crosses 90° (peak 98.70°); N-S changes sign; closure columns present |
| CSVs | `research/golden/fixtures/winserve_nm_3003929461_jicarilla452-08-31_{input,expected}.csv` |
| Metadata | `research/golden/metadata/winserve_nm_3003929461.metadata.json` |
| Status | Transcribed. One DLS cell (MD 4685) OCR-uncertain (`.66`). Last station is a projection to TD — exclude from measured-survey tests. |

### 2.3 New Mexico WinSERVE — long build-to-lateral (source downloaded; table OCR’d)

| Item | Value |
|---|---|
| Source | `research/golden/source-pdfs/nm_3003929320_5_WF.pdf` |
| SHA-256 | `A2A4CB0F6342F813CB5CF9020FC42389712CCD0A1D1DB5BC6E3CF5744A02DB86` |
| API | 30-039-29320 |
| VSP | 288.15° |
| Character | Assume-vertical/KOP at 3119 ft INC 1.90°; builds through 90°; last MWD 7181 ft; projection to 7249 ft |
| Columns | MD, INC, Drift, TVD, N-S, E-W, VS (**no DLS/closure on this template**) |
| Status | Full OCR draft in `research/golden/source-pdfs/_ocr/` (gitignored). Promote to a third fixture after a second visual pass of pages 3–5. |

### 2.4 New Mexico WinSERVE — S-profile, VSP 90° (source downloaded)

| Item | Value |
|---|---|
| Source | `research/golden/source-pdfs/nm_3004532380_7_WF.pdf` |
| SHA-256 | `B27F1AAFAE4C9AD38409342B9BCA59AA5E587A67AD665F35BD0FBF82191F365D` |
| API | 30-045-32380 |
| VSP | 90.00° |
| Character | Surface tie-in 0/0/0; build to ~53° then drop to 3.6°; good moderate S-well |
| Status | OCR draft exists. One row (MD 2355) dropped a column in OCR — do not promote until visually confirmed. |

### 2.5 WinSERVE manual planning exercises (verified against WSdoc pp. 68–71)

User-supplied WSdoc. These are **plan constructors**, not survey-reconstruction goldens. Do not implement in `delve-core`.

Target #1: TVD = 4500 ft, direction = 45°, displacement = 1000 ft. 2-D KOP assumes a zero-zero tie-in.

#### 2-D Slant Well

| Case | Knowns | Solve | WSdoc printed |
|---|---|---|---|
| A | KOP = 650 ft, DLS = 3°/100 ft | Hold angle | 15.57° |
| B | Hold = 25°, KOP = 650 ft | DLS | 0.7448°/100 ft |
| C | Hold = 25°, DLS = 3°/100 ft | KOP | 1932.1 ft |

#### 3-D Slant tie-in

Tie-in: MD 1500, INC 2°, AZ 300°, TVD 1499.7, N/S 13.09, **E/W −22.67** (east negative; the research prompt had the sign wrong). Fixing DLS=3 and Hold=25 is “mathematically impossible.” Solving Hold with that tie-in prints **20.98°**.

#### 2-D S-Well

KOP 1000, DLS1 2/100, DLS2 1.5/100, Entry 7° → Hold **20.431°**, tangent **1741.65** ft.

Further printed variants: KOP 2000 → BHL TVD 5097.06 and no tangent; Hold 24° → KOP 1234.7; equal DLS → 1.7987; tangent 1000 → KOP 1434.4 / Hold 26.0523.

Machine record: `research/golden/metadata/winserve_manual_planning_unverified.json` (filename kept; `verification_status` is now `verified_wsdoc_pp68_71`).

---

## Level 3 — Independent modern software

### 3.1 COMPASS 5000 planning reports (downloaded)

| File | SHA-256 | Notes |
|---|---|---|
| `compass_30015559690000_20250812.pdf` (31 pp) | `70CAE91F6B339D38AB34B085481E4F13B378E3A981A3D0935B80D3442ACF04FE` | NM OCD 30-015-55969 Water Buffalo 131H / Permian Resources. Page 1 is Form C-103 (2025-07-21). Scanned; no text layer on first pages. COMPASS 5000 trajectory pages are later in the packet. |
| `compass_30039313630000_20251003.pdf` (21 pp) | `129D21B5BCBFEE883B854BC80B74910876A51E3D0B6A2FA23AAD6278D9810646` | NM OCD 30-039-31363 Rosa Unit 830H. Packet starts with BLM/C-102 sundry pages. |

**Purpose:** modern output fields, reporting conventions, plan-section structure, coordinate metadata, a second Minimum Curvature implementation. **Not** to duplicate COMPASS.

Representative plan stations from page 12 (vertical + 2°/100 ft build + hold) are in `research/golden/fixtures/compass_nm_3001555969_waterbuffalo131h_plan_page12.csv` with metadata. This is a **plan**, not an as-drilled survey. Header: Compass_17, COMPASS 5000.17 Build 03, KB @ 3233.0 usft, NAD83 NM Eastern Zone, VS direction 80.79°, grid convergence 0.03°.

### 3.2 HawkEye / JMP filed report (downloaded + excerpt transcribed)

| File | SHA-256 | Notes |
|---|---|---|
| `hawkeye_idaho_Fallon1-10_DIR_20180218.pdf` (39 pp) | `349F15D15548D6CAAFDCFE91C614D140849BECBCC87A8FAC478B979C611C0D7D` | Idaho OGCC Fallon 1-10, API 11-075-20032. Cover: John M. Phillips Directional Drilling Services. HawkEye geodetics on page 3 (IGRF2015.MIF, Idaho West 1103, NAD27). |

Excerpt CSV: `research/golden/fixtures/hawkeye_idaho_fallon1-10_survey_page4.csv` (11 stations, drop section). Fields: MD, INC, AZM, TVD, NS, EW, VS, closure dir, DLS, map N/E. Cylinder targets on the same page. Official product: https://hawkeyertmanager.azurewebsites.net/ ; manual: `research/competitors/hawkeye_FC_UserManual.pdf`.

---

## Level 1b — Constructed dual-lateral (not a golden)

| Item | Value |
|---|---|
| Fixture | `synthetic_dual_lateral` |
| Status | **SYNTHETIC / constructed.** Not a golden as-drilled match. Do not add to `delve-core` golden tests. |
| Geometry | Parent: vertical to 6500 ft, build east (AZI 90) to land at 8000, hold to 11000. Lateral B: kick-off at parent MD 6500 (I/A 0/0), build west (AZI 270), hold to 11000. |
| Computed BHL (min-curvature RF, same as delve-core) | East BHL N 0, E 3954.93, TVD 7454.93. West BHL N 0, E −3954.93, TVD 7454.93. Junction N 0, E 0, TVD 6500. |
| CSVs | `research/golden/fixtures/synthetic_dual_lateral_{parent,lateral_b,expected_positions}.csv` |
| Metadata | `research/golden/metadata/synthetic_dual_lateral.metadata.json` |

---

## Public multilateral / sidetrack notes

See `research/golden/metadata/multilateral_public_example.md`.

- **Named dual-lateral (no stations invented):** Slawson Gobbler Federal 4-26-35MLH, NDIC File 32276, Big Bend. Secondary write-up cites well-file TDs; official DMR file needs a session. **NOT YET VALIDATED.**
- **Public sidetrack excerpt (not a dual-lateral):** Mack Energy Klondike State Com #1H, API 30-005-64295, COMPASS 5000.1, [NM OCD PDF](https://ocdimage.emnrd.nm.gov/imaging/filestore/Artesia/WF/311794/30005642950000_11_WF.pdf). Short excerpt CSV. **NOT YET VALIDATED** vs engine.

---

## Level 4 — Brett validation

Placeholder. `research/brett/` is empty. This should become the most important field-acceptance dataset. Do not invent Brett data.
