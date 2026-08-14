# ISCWSA / AER directional-survey research handoff

**Evidence-based. Do not invent. Terms are not interchangeable unless a cited source equates them.**

**AER material label:** REFERENCE / OPTIONAL EXPORT PROFILE — NOT ASSUMED TO APPLY TO MINING PROJECTS.

Fetched: 2026-08-13. Local copies under `research/standards/` and `research/regulatory/alberta-oil-gas/`.

---

## 1. Standards summary

### 1.1 Introduction to Wellbore Positioning (Jamieson / ISCWSA ebook)

| Item | Detail |
|---|---|
| URL | https://www.iscwsa.net/media/files/page/f1c1e97e/introduction-to-wellbore-positioning-ebook-v9-10-2017.pdf |
| Access | **PDF** — full text extracted. Version **V09.10.17** (cover also shows VERSION 10.4.12). Author: Prof. Angus Jamieson; compiled by ISCWSA / SPE WPTS. Copyright University of the Highlands & Islands. |
| Local | Intended path: `research/standards/iscwsa_introduction-to-wellbore-positioning-ebook-v9-10-2017.pdf` (see `scripts/research/download_sources.ps1`). |

**Coordinate systems / geodesy (Ch. 1–2).** Three fundamental location types: geocentric XYZ from an ellipsoid centre; geographical lat/long/height; projection easting/northing/elevation. Projection coordinates are usually eastings and northings; the ebook warns that ~50% of the world swaps x/y. Mapping parameters (false easting/northing, etc.) come from the EPSG database. Datum mismatch (example NAD 27 vs NAD 83) can shift a point by tens of metres — “frequently far bigger than the well target tolerance.”

**True / grid / magnetic north (Ch. 3–4).** True North is toward the Geographic North Pole (Earth’s axis of revolution), independent of map system, datum, or spheroid. Grid North (Map North) is the direction of the projection’s north lines; they are not the same except conceptually at the projection central meridian. The angle from True to Grid is the **convergence** angle. The ebook states: “The formal algorithm is Grid azimuth = True Azimuth – Convergence” but immediately warns that many applications do not observe the correct sign; a diagram-based sanity check is required. Magnetic North is a third reference. All three “can be in any order with several degrees of variation.” Grid is described as the preferred company reference in the ebook’s example, with quoted azimuths referenced to Grid.

**Declination (Ch. 4).** Defined as “the True Direction of Magnetic North.” The Earth-field vector is Field Strength, Declination, and Dip. Models named: BGGM, HDGM, WMM, IGRF. Declination changes with time (secular variation) and locally (crustal anomalies). IFR measures local Field Strength, Declination, and Dip.

**Azimuth, inclination, survey stations (Ch. 5, 7).** Magnetic tools initially measure direction from Magnetic North, then usually correct to grid or true. “Inclination is measured up from vertical.” Positions are computed from measured depth, inclination, and direction at discrete stations. Toolface: magnetic (azimuth) toolface vs high-side (gravity) toolface; most MWD systems switch to high-side above a preset inclination, typically 3–8°.

**Wellbore positioning / calculation methods (Ch. 7).** Methods described: Tangential (straight line; errors accumulate), Average Angle, Balanced Tangential, Radius of Curvature (cylinder), **Minimum Curvature** (sphere / single 3D radius) — “now effectively the industry standard.” Minimum curvature **assumes a constant arc** between stations; with mud motors this is “unlikely to be the case.”

**Survey quality / interval (Ch. 8).** Sparse stations under-sample slide/rotate geometry and can accumulate **TVD error**. Recommendation cited: when building faster than 3°/100 ft (or 30 m), survey every joint rather than every stand. When DLS exceeds 3°/100 ft, “most companies agree” to survey every joint. Industry systematic error models “have not traditionally modelled for the effect of survey interval.”

**Uncertainty (Ch. 16–19).** Distinguishes human/gross error from modelled measurement uncertainty. Error models start from physical error sources, apply weighting functions to MD/INC/AZI at each station, propagate (random / systematic / well-by-well / global), and combine via RSS into a covariance / ellipsoid. See §1.4 — **do not implement full PU in MVP.**

### 1.2 Borehole Position Calculation Methods (Aklestad, ISCWSA 43, 4 Mar 2016)

| Item | Detail |
|---|---|
| URL | https://www.iscwsa.net/media/files/files/f40a3625/07-iscwsa43-spe-wpts-daklestad-boreholecalculationmethods-4mar16.pdf |
| Access | **PDF** — slides; extractable text is outline-level (many slides are figures). |

Historical trajectory models referenced to **API Bulletin D20 (1985):** Tangential, Balanced Tangential, Average Angle, Radius of Curvature, Minimum Curvature, Mercury Method (Mercury, Nevada nuclear test site).

Hole-condition indicators (not interchangeable):

- **Dogleg / dogleg severity** — citations: Lubinski (pipe bending); Wilson (Tangential / Radius of Curvature); Mason and Taylor (Minimum Curvature).
- **Tortuosity** — “Cumulative Dogleg – can be normalized.”
- **Rugosity** — “Wellbore diameter irregularity.”

High-frequency / continuous gyro & MWD surveys: better indication of true shape; shows/corrects **Stockhausen Effect**; short intervals can magnify angular change as large DLS values.

**Advanced Spline Curve (ASC), IADC/SPE-178796 (Abughaban):** current min-curvature “invalid assumption (constant curvature arc)” proven by high-resolution slide/rotate surveys; causes artificially low tortuosity, significant TVD error accumulation, underestimated torque and drag. ASC uses cubic piecewise polynomials, continuous to the third derivative. **Roadmap / not an MVP calculation method.**

### 1.3 API RP 78 via ISCWSA `files/601/`

| Item | Detail |
|---|---|
| URL | https://www.iscwsa.net/files/601/ |
| Access | **Not a landing page and not a PDF.** Direct download is a **Microsoft Word `.docx`** (ZIP/Office Open XML, 53 599 bytes). WebFetch returned HTTP 500; PowerShell download succeeded. Extracted text saved as `research/standards/iscwsa_files-601_api-rp78-dsr-extracted.txt`. Binary copy: `research/standards/iscwsa_files-601_api-rp78-dsr.docx`. |
| What it is | Draft section titled **“Directional Survey Records (DSR)”** for API RP 78. Opening line of body: “ETING” then “Scope” — likely a heading fragment. The document itself is the DSR recommended-practice text, not the full RP. |

**Publication status (separate from this file):** AADE-23-NTCE-073 (Lightfoot, Tank, Coco, 2023) describes RP 78 as a **First Edition Ballot Draft, 2023**, aimed at release by end of Q2 2023 if approved. A grep of the **API 2025 Exploration and Production catalog PDF** found **no “RP 78” / “Wellbore Surveying and Positioning” listing.** Treat the standard as **not confirmed published** from sources fetched here. See OPEN questions.

**Scope of DSR (from the Word extract).** Recommended practices to manage, document, and retain directional survey records through the well life cycle: individual trajectory surveys, reference information, composite surveys, headers, calibration records, job logs, correction values, conveyance/running information. Covers digital and hard copy. “Not intended to conflict with any local, state or federal regulations.”

**Survey-record conventions the DSR file actually defines:**

1. **Primary station data:** Measured Depth, Inclination, Azimuth. “There are two basic forms of well survey azimuth and the data shall include a distinct north reference to indicate true or grid.” Example column headers: `AZIM-T` or `AZIM-G`. Grid azimuth surveys should include CRS (EPSG code).
2. **Basic calculated columns:** TVD from ZMDE; `+N/-S` (Latitude or Local North/South Distance); `+E/-W` (Departure or Local East/West Distance); Vertical Section (based on a Vertical Section Azimuth); DLS; Survey Type (Gyro, Magnetic, Projection); Survey Tool Code; Comments.
3. **Advanced calculated columns:** Build Rate (+ Build / − Drop); Turn Rate (+ Right / − Left, parenthetically **Walk Rate**); TVDss from MSL or LAT; Course Length; Tortuosity; Closure Distance (“Total Displacement”); Closure Azimuth (“Origin to Closure Distance Point”); cumulative tortuosity/DLS; QC checks (Btotal, Dip Angle, Gtotal, etc.).
4. **Raw sensor data shall be included** in the operator’s final record: Bx, By, Bz, Ax, Ay, Az (or Hx/Hy/Hz and Gx/Gy/Gz); units and axial vs cross-axial axes must be identified.
5. **Tie-on points:** last **accepted** survey station, **not** the projection. Sidetrack: last station above kick-off; interpolated min-curvature station at kick-off as second station of sidetrack, labelled kick-off. Whipstock: kick-off may be top of window. Interpolation spacing: <300 ft (100 m) in tangent, 100 ft (30 m) in a curve.
6. **Parent vs sidetrack uncertainty:** zero relative uncertainty at sidetrack KOP; relative uncertainty accumulates from the parent for parent-collision assessment only. Other offsets / relief-well objectives use uncertainty from deepest constraint (e.g. wellhead).
7. **Projection to TD:** clearly identified; typically straight-line using last valid INC/AZI; if steered, may use steered-interval or known-tendency INC/AZI. Build-rate and walk-rate tendencies for projections: trend over several stations **or** last non-steered section.
8. **Tool codes:** each station MD/INC/AZI with associated error-model / OWSG tool code. Non-accepted surveys (check-shots, interpolations, projections) clearly identified. Note: the DSR cites `copsegrove.com` OWSG tool codes; ISCWSA Error Model Rev 5.13 later says OWSG models were handed to ISCWSA and Copsegrove references were removed from the error-model document.
9. **Composite Directional Survey (CDS):** “most recent best-known position,” aka definitive CDS. Combining surveys requires consistent CRS, datum, azimuth reference, ZMDE. Adjust new surveys back to original drilling ZMDE and azimuth reference.
10. **EOW header shall include:** UWI, names, CRS/EPSG, field, date, azimuth north reference, wellhead coordinates, ZMDE, elevation reference (DFE, RKB, GL, ML, etc.), depth of deepest constraint, tie-in-point, projection to TD, casing/hole sizes and depths, grid convergence, declination (model, elevation, calculation date), total correction, error-model codes and depth ranges.
11. **Digital exchange:** “should follow” IOGP **P7-17**; WITSML mnemonics per Energistics. Explicit: **“Excel should not be considered as a final digital survey record.”** LAS, ASCII/CSV table, PDF listed.
12. **Plan vs actual:** EOW summary should include “Plan vs. Actual Trajectory Graphs.”
13. **BHL:** “updated PLATs with final surface and bottom-hole location.”
14. **BHA survey offsets / instrument spacing** required in conveyance data (MWD: “All BHA survey offsets”).

**Related RP 78 context (not the full text of files/601):** ISCWSA 47 (files/250, 2018) outline: §4.1 measurements & position calculation; **§4.2 Directional Survey Records**; database; software; surface location; survey program; PU models; QA/QC; collision avoidance; process; data transfer. Annex: Survey Mathematics. ISCWSA 57 (files/866, 2023): ~183 pages planned (88 main, 44 annex, 6 bibliography); Annex A survey mathematics, B depth process audit, C magnetic/depth/gyro QA/QC. Intended applicability stated in AADE-23-NTCE-073 includes oil and gas, geothermal, CCS, CBM, HDD, **mineral ventilation and extraction, scientific coring**.

### 1.4 ISCWSA Error Model — ROADMAP ONLY (do not implement full PU in MVP)

| Item | Detail |
|---|---|
| URL | https://www.iscwsa.net/files/842/ |
| Access | **PDF** (rendered as a long document). Title: *Definition of the ISCWSA Error Model*, **Revision 5.13, January 2023**. |
| Committee page | https://www.iscwsa.net/committees/error-model/ — landing page with model downloads, generic tool codes, minutes. |

**What it is.** Mathematical framework to quantify wellbore position uncertainty from identified physical error sources acting on MD, inclination, and azimuth at each station, then propagated along the well. Implemented in directional software as a **PUM** (Position Uncertainty Model; also IPM / tool code / error model). ISCWSA maintains the **algorithms**; tool providers should supply tool-specific magnitudes. Generic conservative MWD/OWSG-derived models exist; ISCWSA **does not certify, verify, or mandate** any PUM.

**Inputs / outputs (high level).** Station MD, INC, AZI; tool model (sources, magnitudes, propagation modes); wellsite magnetic/gravity/latitude as needed. Output: covariance / ellipsoid of uncertainty; used for anti-collision and target sizing.

**Assumptions and limitations (quote-level, Rev 5.13 §3.2):**

- Applies to surveys run under normal industry best-practice (calibration, short enough interval, field QC, NMDC spacing).
- Statistical; says nothing specific about any individual survey.
- **Does not cover gross blunders** (wrong gyro reference, defective tools, database entry errors).
- Does not currently model survey-data resolution.
- **Assumes a constant arc between stations** and that IF MD/INC/AZI were perfect, position would be exact. Rule of thumb survey interval: **100 ft**. No allowance for under-sampling the wellpath (same caveat as the ebook / Aklestad Stockhausen discussion).
- Azimuth: three norths. MWD weighting uses **magnetic azimuth**; gyro weighting uses **true azimuth**; NEV frame in the document is aligned with **true north**. Grid implementations rotate by convergence or use grid azimuth.

**Tie-on (Rev 5 §4.7.1).** Consecutive survey legs share error-source propagation. Surface tie-on (Rev 5): do not assume slot INC/AZI are perfect; dummy near-slot station or doubled first-station terms.

**MVP implication:** treat as **roadmap**. MVP can store north-reference, calculation method, and optional tool-code **metadata**; do not implement covariance propagation, IPM files, or anti-collision SF/MASD.

### 1.5 Well Intercept eBook (WISC v3, 2021)

| Item | Detail |
|---|---|
| Requested URL | https://www.iscwsa.net/media/files/committee/ce60f271/well-intercept-sub-committee-ebook-version-3-2021-.pdf |
| Access | Requested URL **timed out** on first fetch; a later fetch of the same URL and of https://www.iscwsa.net/media/files/box/b8d85297/well-intercept-sub-committee-ebook-version-3-2021.pdf both returned full PDF text (v3-2021). Alternate: UHI copy. |
| Intent (ISCWSA site / ebook) | Help decide ranging methods, surveying, and contingency for an intercept objective; ALARP; not a silver-bullet single technology. |

Relevant (not exhaustive): **3D least distance** illustrated as distance **normal to the target well**, contrasted with the **normal plane / travelling cylinder distance** perpendicular to the **subject** well (Fig. 32 caption text). Travelling cylinder used to plot ranging distance and direction at each ranging depth (Fig. 34). Centre-to-centre distance vs ranging distance vs MD (Fig. 35). **Bit to sensor distance** called out as a design con for some BHAs. **Sidetrack** used operationally (plugback and sidetrack; pass-by sidetracks). **Incidence angle** (approach/intercept geometry) is used extensively — **not named “entry angle”** in the extracted text. **Target well** = the well being ranged/intercepted, not a geological target. Organizational “branches” of a relief-well team are **not** wellbore laterals.

### 1.6 Supporting ISCWSA lexicon (used for glossary; not in the original URL list)

| Item | Detail |
|---|---|
| Collision Avoidance Lexicon (2017) | https://www.iscwsa.net/media/files/files/4cadb6d7/collision-avoidance-lexicon-2017-english.pdf — **PDF**, 9 pages. |
| Current Common Practice in Collision Avoidance Calculations (Oct 2017) | https://www.iscwsa.net/media/files/files/b6fb074d/current-common-practice-in-collision-avoidance-calculations-oct-2017.pdf — **PDF**. States terminology is in the Lexicon. |

These are the sources used below for travelling cylinder vs 3D/least/minimum distance. They **explicitly distinguish** those distances.

---

## 2. AER validation notes

**LABEL: REFERENCE / OPTIONAL EXPORT PROFILE — NOT ASSUMED TO APPLY TO MINING PROJECTS.**

Alberta OneStop directional-survey templates are a **local oil-and-gas submission format**. They are useful as a generic validation/export reference. They are **not** the regulatory regime for DelvePath mining / directional-core users unless independently confirmed.

### Source inventory

| URL | Type | Notes |
|---|---|---|
| https://www.aer.ca/applications-and-notices/onestop/onestop-help | **Landing page** | Accordion hub. Includes “Guides for Directional Survey Submissions” and template links; the fetch did **not** expand accordion contents. |
| https://www.aer.ca/documents/onestop/directional-survey-file-format.csv | **CSV** (worked example) | Full station listing. Local: `research/regulatory/alberta-oil-gas/aer_directional-survey-file-format.csv` |
| https://www.aer.ca/documents/onestop/directional-survey-file-format.xlsx | **XLSX** template | Sheet tab **must** be named `Directional Survey`. Local copy as above. |
| https://www.aer.ca/documents/onestop/directional-survey-template-validation-rules.xlsx | **XLSX** | Single sheet `Rules`. Parsed in full. |
| https://www.aer.ca/documents/onestop/QRG-submitting-directional-survey-data.pdf | **PDF** QRG | Submission workflow, naming, events >9, 30-day pending / overdue. |

Related (not in the original list, used only as corroboration):

- AER Product Catalogue “Directional Surveys”: a report lists MD, inclination from vertical, azimuth relative to north; calculated TVD etc.; plus licence, surface location, north reference, calculation method, convergence. Attributes also mention dogleg rate and vertical section. https://www1.aer.ca/ProductCatalogue/229.html
- Directive 059: directional survey data submitted via OneStop (Construct > Submission). https://www.aer.ca/regulations-and-compliance-enforcement/rules-and-regulations/directives/directive-059

### File naming (QRG + validation xlsx)

Format: `DS_x9999999x_xx-99-99-999-99w9-99.[xlsx/xls/csv]`

Examples: `DS_2000363_07-13-24-072-09W6-0.xlsx`, `DS_2000363_07-13-24-072-09W6-00.xlsx`

Rules: starts with `DS`; licence and UWI match UI (do not include leading 1 in UWI); Survey Name equals attached filename including extension. Acceptable: `.xlsx`, `.xls`, `.csv`.

### Header fields and OneStop-enforced values

| Header | Validation (from rules xlsx) |
|---|---|
| Survey Name | Required; equals filename+extension |
| Final Survey | `Yes` or `Y` |
| Well Licensee, Survey Company, Well Name | Required |
| Licence Number | Matches UI; leading zeros optional |
| Slanted Drilling | `Y` or `N`. **Not** the same as directional or horizontal: “inclination at kelly bushing is already >0°” |
| DLS Surface Hole Location | Required (Alberta DLS location, **not** dogleg severity) |
| NAD 83 Surface Lat / Long | Required |
| Ground Level Elevation, Kelly Bushing Elevation | Required |
| UWI (D59: at time of submission) | Matches UI |
| Final Survey Date | `YYYY-MM-DD`; ≥ final drill date from UI |
| **North Reference** | **Must be `TRUE`** (true north only in this profile) |
| **UTM Zone** | **`11N` or `12N` only** |
| **Survey Calculation Method** | **`Minimum Curvature` and no other value** |
| **Units** | **`Meters & Degrees` and no other value** |
| Convergence Angle | Required (value present) |
| Magnetic Model / Magnetic Model Date | Optional, but **paired**: if one is entered, the other is mandatory |
| Vertical Section Azimuth | Optional |
| Declination | Optional |

Header/column **names are case-sensitive** (“Survey Name” not “survey name”).

### Station columns (template)

`MD, Inclination, Azimuth, True Vertical Depth (TVD), TVDSS, Vert Sect, N+/S-, E+/W-, Survey Tool, Annotations`

Units row: MD/TVD/TVDSS/Vert Sect/N/E in **m**; INC/AZI in **° or deg**.

N+/S- may also be labelled `North`; E+/W- must validate as `E+/W-` (rules text: “Validate value is E+/W-”).

### Station validation useful for **generic** survey-data checks

These are the items most transferable outside Alberta oil-and-gas (still optional for mining):

1. **MD, INC, AZI numeric.**
2. **MD spacing:** a survey point at least every **150 m** from top to end depth, **except** between first station at KB and second at ground level, and except between second (GL) and third station.
3. **Last MD** equals Total Depth from drilling data **to one decimal place**.
4. **TVD, TVDSS, Vert Sect, N+/S-, E+/W-, Survey Tool** required (non-blank).
5. **KB station:** first station **MD = 0.00 m and TVD = 0.00 m** (manual rule: “Measurements taken at Kelly Bushing”).
6. **GL station:** Ground Level Elevation station present; **N+/S- and E+/W- offsets are 0.00 m** at that station (manual rule).
7. **Annotations optional** in automated rules; used in examples for KOP, casing, DDE, heel, last survey, extrapolation to TD.
8. **Sidetrack / DDE (manual, outside OneStop):** sidetrack point noted in annotations; “Common DDEs must be stated for subsequent drilling legs”; inclination hitting 5° → Deviate DDE; hitting 80° → Horizontal DDE. These thresholds are **AER event coding**, not ISCWSA geometry definitions.

### QRG process facts (Alberta-specific; not generic validation)

- Pending: not submitted within 30 days of finished drill date but still compliant. Overdue: non-compliant.
- Well events 0 and 2–9 vs events >9 have different UI paths.
- Validate-and-fix; cannot complete with errors.
- Example annotation language in the CSV: `KOP = 2135.00 m KB`, `Extrapolation to TD = 4751 m`, `Last Survey = 4747.51 m`.

### What AER does **not** define (do not infer)

- No required DLS / build / turn columns (unlike API RP 78 DSR “advanced” columns).
- North reference locked to **TRUE**, not grid or magnetic.
- Calculation method locked to **minimum curvature**.
- No raw Bx/By/Bz sensor block.
- `DLS Surface Hole Location` is a **legal location string**, not dogleg severity.
- `Vert Sect` is present; **no definition** of how it is computed beyond the optional Vertical Section Azimuth header.

---

## 3. Glossary-ready definitions (with sources)

Convention: **quoted or closely paraphrased from a fetched source.** If a term was not defined in fetched sources, it is marked **NOT FOUND** — do not fill from memory. British “travelling” is the ISCWSA spelling.

### MD (Measured Depth)

Along-hole distance from an acknowledged surface reference along a described path. The ebook: the word “depth” refers to “the distance from an acknowledged reference point, usually assumed to be at surface (typ. MSL, GL, ORT, etc.), along a described path (e.g. along hole Measured Depth, MD, or True Vertical Depth TVD, from surface).” “MD is the basis for TVD.” MD may be indicated/raw/calibrated/corrected; “True Along Hole Depth” is the actual along-hole depth with an uncertainty estimate.  
Sources: ISCWSA ebook Ch. 15a (Jamieson V09.10.17); Error Model Rev 5.13 (“along-hole, measured depth”); AER station column `MD [m]`; API RP 78 DSR (“Survey Station Data (MD / INC / AZIM)”).

### TVD (True Vertical Depth)

Vertical depth derived from deviation surveys (azimuth and inclination along hole); “not usually measured directly.” API RP 78 DSR: “TVD [ft], True Vertical Depth from the ZMDE Reference” vs “TVDss … from MSL or LAT.” AER: `True Vertical Depth (TVD)` and separate `TVDSS`, both in metres; first KB station TVD = 0.00 m.  
Do not treat TVD and TVDSS as the same: TVDSS is from a sea-level/LAT datum in the DSR; AER TVDSS is a required column whose zero is not defined in the validation sheet (example values are ~KB elevation minus TVD).  
Sources: ebook Ch. 15a; API RP 78 DSR; AER template + rules.

### INC (Inclination)

“Inclination is measured up from vertical.” Error model: one of the three basic survey measurements at a station. AER: numeric `Inclination` in degrees.  
Sources: ebook Ch. 5; Error Model Rev 5.13; AER template.

### AZI (Azimuth)

Horizontal direction of the wellbore relative to a **stated north reference**. Three references exist (true, grid, magnetic) and “the azimuth can be expressed three different ways.” Magnetic tools measure from magnetic north then usually correct to grid or true. Error model: MWD weighting uses magnetic azimuth; gyro weighting uses true azimuth. API RP 78 DSR requires the column to indicate true vs grid (`AZIM-T` / `AZIM-G`). AER OneStop profile **requires North Reference = TRUE**.  
Do not treat magnetic, true, and grid azimuth as interchangeable.  
Sources: ebook Ch. 3–5; Error Model Rev 5.13 §4.3.1; API RP 78 DSR; AER rules.

### N/S (`N+/S-`, northing / local north)

API RP 78 DSR: “+N/-S [ft], Latitude or Local North/South Distance.” AER: required station column `N+/S-` (or `North`), metres; GL station offsets 0.00 m. Ebook: projection coordinates are eastings and northings. Sign convention is implied by the `+N/-S` label; the fetched sources do not give a formula.  
Sources: API RP 78 DSR; AER template/rules; ebook Ch. 1.

### E/W (`E+/W-`, easting / local east)

API RP 78 DSR: “+E/-W [ft], Departure or Local East/West Distance.” AER: required `E+/W-`, metres; GL offsets 0.00 m.  
Sources: API RP 78 DSR; AER template/rules; ebook Ch. 1.

### Closure distance

API RP 78 DSR advanced column: “Closure Distance [ft], Total Displacement.” No formula in the fetched DSR text. **Not** the same term as collision-avoidance “center to center clearance distance” (Lexicon).  
Source: API RP 78 DSR. Formula: **NOT FOUND** in fetched sources.

### Closure azimuth

API RP 78 DSR: “Closure Azimuth [°], Origin to Closure Distance Point.”  
Source: API RP 78 DSR. Formula: **NOT FOUND**.

### Vertical section (`Vert Sect`)

API RP 78 DSR: “Vertical Section [ft], Based on a Vertical Section Azimuth.” AER: optional header `Vertical Section Azimuth`; required station column `Vert Sect` [m]. Example CSV uses VS azimuth 273.95°. Computation formula **not stated** in AER rules or the DSR extract.  
Do not assume VS = closure distance (DSR lists both as separate columns).  
Sources: API RP 78 DSR; AER template/rules/example.

### VSP

**NOT FOUND** as an acronym in the fetched ISCWSA/AER texts. AER/DSR use “Vert Sect” / “Vertical Section” / “Vertical Section Azimuth.” Do not equate with vertical seismic profile, and do not invent “vertical section plane,” without a cited source.

### DLS (Dogleg Severity)

Ebook: “DLS means dogleg severity in degrees per unit length”; used with toolface to estimate fill-in surveys: inclination change ≈ `DLS × length × cos(Toolface)`; azimuth change ≈ `DLS × length × sin(Toolface) / sin(Inclination)`. Practice cited: survey every joint when DLS exceeds 3°/100 ft. Aklestad: dogleg as a hole-condition indicator; distinct from tortuosity (cumulative dogleg) and rugosity. API RP 78 DSR: “DLS [°/100ft], Dogleg Severity.” AER: **not** a station column; “DLS Surface Hole Location” is a legal location.  
Sources: ebook Ch. 7–8; Aklestad 2016; API RP 78 DSR; AER template (negative example).

### Build rate

API RP 78 DSR: “Build Rate [°/100ft], + Build / − Drop.” Also used for “Projection to TD” tendencies. Ebook discusses “building angle” / “build section” narratively without a standalone definition.  
Source: API RP 78 DSR. Do not treat as synonymous with DLS (DLS includes turn).

### Walk rate / turn rate

API RP 78 DSR: “Turn Rate [°/100ft], + Right / − Left **(Walk Rate)**.” This **one source** parenthetically equates walk rate with turn rate as labelled. Ebook/Aklestad do not define walk rate.  
Source: API RP 78 DSR. Still do not treat walk = DLS.

### Toolface

Rotation angle of the tool in the hole. Magnetic/azimuth toolface: from magnetic north (corrected to grid or true) via `tan⁻¹(Bx/By)`. High-side/gravity toolface: from the high side of the hole via `tan⁻¹(Gx/Gy)`. Most MWD systems switch magnetic → high-side above a preset inclination, typically 3–8°. Example: “136° right of high side.” Well Intercept eBook also uses magnetic, gravity, and gyro toolface in ranging contexts.  
Do not treat magnetic toolface and high-side toolface as the same quantity.  
Sources: ebook Ch. 5; Well Intercept eBook v3.

### KOP (kick-off / kick-off point)

No formal “KOP = …” sentence in the ebook. AER example annotation: `KOP = 2135.00 m KB`. API RP 78 DSR: sidetrack tie-on at last station above **kick-off depth**; interpolated station “labelled as the kick-off depth”; whipstock wells “can define the kick-off depth as the top of the window.” Ebook Ch. 16 discusses uncertainty at a “deep kick off point.”  
Sources: API RP 78 DSR; AER example CSV; ebook (usage, not a definition).

### BHL (bottom-hole location)

API RP 78 DSR: regulatory PLATs with “final surface and bottom-hole location.” Collision-avoidance practice paper: if there is no normal to the offset (reference deeper than offset), minimum distance is the line to “the bottom hole location on the offset.” AER catalogue describes directional surveys as indicating the approximate wellbore path; QRG mentions updating “subsurface bottomhole location” via a different well-licence QRG.  
No fetched source expands the acronym BHL or gives a coordinate formula.  
Sources: API RP 78 DSR; ISCWSA CA calculations 2017.

### Bit-to-sensor

Well Intercept eBook: “larger bit to sensor distance” as a BHA design drawback. API RP 78 DSR: report “instrument spacing details,” “All BHA survey offsets,” “Motor bend or bent sub-angle and distance to bend from the bottom of the tool.” Not a station column.  
Sources: WISC eBook v3; API RP 78 DSR.

### Tie-in / tie-on

**Not proven identical.** Error Model Rev 5: **“Tie-On Between Surveys”** — joining survey **legs** and propagating error sources; **“Surface Tie-On”** for the slot. API RP 78 DSR: **“Tie-On Points”** = last accepted station (not the projection); header field **“Tie-in-point”** in EOW data. Use the source’s spelling.  
Sources: Error Model Rev 5.13 §4.7.1; API RP 78 DSR.

### Hold section

Ebook narrative (survey-quality chapter): “the main problems here lie in the hold section where the directional driller has great trouble holding inclination.” Used as the interval where inclination is held; **no formal definition**.  
Source: ebook (usage).

### Tangent

API RP 78 DSR: interpolated points “˂300 ft (100 m) in a **tangent section** and 100 ft (30 m) in a curve.” Ebook: multi-station analysis “of little or no value” for “**tangent section** and/or constant toolface surveys.” Not defined as an equation.  
Sources: API RP 78 DSR; ebook Ch. 29-area QC text.

### Entry angle

**NOT FOUND.** Closest sourced term is **incidence angle** / **intersection angle**, which are about **two wellbores**, not a hole-to-target “entry.”  
- WISC eBook: incidence angle between subject and target; high incidence reduces ranging.  
- CA Lexicon: “Intersection angle — The angle between the attitude of the reference well and the attitude of the offset well at their respective analysis positions.”  
Do not treat entry angle = incidence angle = intersection angle unless a later source equates them.

### Target

**Polysemous — do not collapse.** (1) Geological / directional objective (“hitting the geological target”) — ebook Ch. 16, 29. (2) **Target well** in intercept/ranging = the existing well being located — WISC eBook throughout. (3) Drillers’ target relative to parent penetration — API RP 78 DSR sidetrack paragraph.

### Collar

Fetched sources use **drill collar** / **non-magnetic drill collar (NMDC)** and **short-collar** (axial magnetic interference) correction — not a wellhead/casing “collar” coordinate.  
Sources: ebook Ch. 5; Error Model (axial / short-collar).

### Survey station

CA Lexicon: “Survey station — A point in the wellbore at which a directional measurement is made.” Error model: discrete MD, INC, AZI along the wellpath. Distinct from **survey leg** (“group of directional measurements taken with a single tool… operating conditions assumed constant”) and **survey program** (types/sequence of instruments).  
Sources: CA Lexicon 2017; Error Model Rev 5.13.

### Workcurve

**NOT FOUND** in fetched ISCWSA/AER sources.

### Proposal

Ebook uses “included in any new **proposals**” for well-planning paperwork, not a trajectory object type. API RP 78 DSR does not define a “proposal” survey. **No glossary-grade definition for a DelvePath proposal object.**

### Plan vs actual

API RP 78 DSR EOW: include “**Plan vs. Actual Trajectory Graphs**.” CA Lexicon: “Planned well — In this context, sometimes used to refer to the reference well before drilling commences”; travelling-cylinder diagram plots “the **as-drilled** reference well” against the **planned** reference well at the centre. Error model: uncertainty “associated with a point on the wellpath, either **planned or actual**.”  
Sources: API RP 78 DSR; CA Lexicon 2017; Error Model (position uncertainty definition).

### True north

“For any point on the Earth’s surface True North is towards the Geographic North Pole (The Earth’s axis of revolution). This fact is independent of any map system, datum or spheroid.”  
Source: ebook Ch. 3.

### Grid north

Direction of map/projection north lines (“Map North (Grid North)”); not the same as true north except in the special case of the projection geometry (central meridian conceptually). Grid lines are parallel on the projection; true meridians converge.  
Source: ebook Ch. 3.

### Magnetic north

Third north reference from the Earth magnetic field; “True Direction of Magnetic North” is declination. Magnetic tools measure azimuth from magnetic north initially.  
Sources: ebook Ch. 3–5.

### Declination

Ebook: “the Declination Angle defined as the True Direction of Magnetic North.” Error model: added to magnetic azimuth to obtain true (or grid) azimuth; DEC error term magnitude 0.36° in the standard MWD model (global propagation). AER: optional header. API RP 78 DSR: header must include declination with geomagnetic model, elevation, and calculation date.  
Sources: ebook Ch. 4; Error Model Rev 5.13; API RP 78 DSR; AER template.

### Convergence

“Because all True North lines converge to a single point, the angle from True to Grid North is referred to as the ‘Convergence’ Angle. Convergence is the True Direction of Map North.” UTM: about −3° to +3° within a zone. Formal: Grid azimuth = True Azimuth − Convergence, **with an explicit warning that software sign conventions disagree.** AER: required header `Convergence Angle` (example 0.33).  
Sources: ebook Ch. 1.3.4 and Ch. 3; AER template.

### Uncertainty (position uncertainty)

CA Lexicon: “An estimate of the uncertainty associated with a point on the wellpath, either planned or actual, based on the planned or actual survey method. The output of a survey tool error model is fully defined by a covariance matrix, but normally reported as an EOU.” Distinct from **gross error**. Ebook Ch. 16: human error vs measurement uncertainty.  
Sources: CA Lexicon 2017; Error Model Rev 5.13; ebook Ch. 16–19.

### Travelling cylinder (US: traveling)

CA Lexicon: “Travelling cylinder diagram — A graphical representation of the physical relationship of the offset wells to the reference well in which the **planned reference well is represented as the centre point of a polar diagram**. The position of the offset wells and the as-drilled reference well are plotted by their polar co-ordinates **on a plane normal to the planned reference well** at the measured depth of interest. The TC diagram is normally referenced to map north or highside.”  
**Travelling cylinder distance:** “The distance between the reference and offset well, **calculated on a plane normal to the reference well**.”  
CA calculations paper: TC plane = normal to the **reference** well; typically for plotting; using TC plane **in the rule calculation changes the result** and is “a key calculation variable and not merely a reporting option.”  
Sources: CA Lexicon 2017; CA calculations 2017; WISC eBook Fig. 34.

### Least distance / 3D least distance / minimum distance

These are **grouped by sources but not identical to travelling-cylinder distance.**

- CA Lexicon: “**3D distance** — The shortest distance between the reference well, at a particular measured depth, and an offset well. The vector always intersects the offset well at right angles.” “**3D least distance** — 3D distance.” “**Closest approach** — … intersecting the offset well at right angles.” “**Minimum distance** — In some software, the closest approach.”
- CA calculations 2017: “**Minimum Distance** (also referred to as **3D or closest approach**) — the normal to the **offset**.”
- WISC eBook: acoustic distance is “closer to the **3D Least Distance**, the distance which is **normal to the target well** rather than normal plane, which is perpendicular to the subject well or **travelling cylinder distance**.”

**Do not treat least distance = travelling cylinder distance.** One is normal to the offset/target; the other is in the plane normal to the reference/subject.  
Sources: CA Lexicon 2017; CA calculations 2017; WISC eBook v3 §5.3.

### Sidetrack

API RP 78 DSR: a borehole originating from a **parent wellbore**; special tie-on and relative-uncertainty rules at kick-off. AER manual validation: “Sidetrack point is marked” in annotations. WISC eBook: operational sidetrack / pass-by sidetracks.  
Sources: API RP 78 DSR; AER rules; WISC eBook.

### Mother hole / branch

**“Mother hole” NOT FOUND.** Closest sourced term: API RP 78 DSR **“parent wellbore.”**  
**“Branch”** in WISC eBook refers to **organizational** relief-well team branches, not laterals. Do not treat mother hole = parent = main well, or branch = sidetrack, without another source.

---

## 4. Access limitations

| Resource | Result |
|---|---|
| Ebook PDF | Accessible; full text extract ~426 KB. |
| Aklestad PDF | Accessible; **slide deck** — equations mostly in figures, not in extractable text. |
| `iscwsa.net/files/601/` | WebFetch **HTTP 500**; PowerShell GET **200**. File is **DOCX**, not PDF/HTML. Content is DSR section draft, **not** the full RP 78. |
| Full API RP 78 | **Not retrieved.** AADE paper cites ballot draft 2023. API 2025 E&P catalog extract: **no RP 78 listing.** Paywalled if published. |
| `iscwsa.net/files/842/` | Accessible PDF (Error Model Rev 5.13). Committee page is a **landing page** of further PDFs/XLS. |
| WISC eBook requested URL | First fetch **timeout**; subsequent fetches of that URL and the `/box/` variant succeeded. |
| AER OneStop Help | **Landing page**; accordion bodies not in the fetch. |
| AER CSV / XLSX / QRG | Accessible. Validation XLSX parsed. |
| CA Lexicon / CA calculations | Accessible PDFs (supporting, not in original URL list). |
| Manula HTML ebook | TOC pages exist; several topic URLs returned **feedback-widget chrome only**, not chapter body. |
| Copsegrove OWSG URL inside DSR | Cited in files/601; Error Model Rev 5.13 says Copsegrove references were **removed**. Live status **not verified**. |

No source was used as a substitute for missing text. Secondary commercial glossaries (e.g. Chinook) were **not** used for definitions.

---

## 5. OPEN questions

1. **Is API RP 78 published?** Ballot-draft status in 2023 vs absence from the 2025 API E&P catalog extract. Need a purchase-page or API composite-list confirmation before treating DSR conventions as an in-force standard.
2. **Does `files/601` match the balloted/published §4.2 text?** It reads as a working DSR section (heading fragment “ETING”; Copsegrove URL). Date of the Word file was not in the extract.
3. **Grid vs true as default north.** Ebook example prefers **grid** for company azimuths; AER OneStop **requires TRUE**; Error Model NEV frame is **true north**. DelvePath default is undecided.
4. **Minimum curvature vs ASC / high-frequency surveys.** MVP can follow AER/DSR/ebook industry-standard min curvature, but Aklestad/Abughaban document TVD/tortuosity bias. When (if ever) to offer an alternate interpolator is open.
5. **Closure distance / closure azimuth / vertical section formulas** are named in RP 78 DSR but **not derived** in fetched text. Need ebook figures, RP 78 Annex A, or another primary formula source before coding.
6. **VSP, workcurve, proposal (as objects), mother hole, entry angle** — no glossary-grade definition in fetched sources. Confirm DelvePath/WinSERVE/Brett usage from operator materials (`research/brett/` is still a placeholder).
7. **Tie-in vs tie-on vs surface slot** — related but not proven identical; UI labels should follow one chosen source.
8. **Walk rate = turn rate** only via DSR parenthesis. Confirm whether mining/WinSERVE uses a different walk-rate definition.
9. **AER 150 m station spacing, 5°/80° DDE, KB=0, GL N/E=0** — useful generic checks vs Alberta-only. Mining core surveys may use different datums (no KB) and different spacing.
10. **P7-17 / WITSML** recommended by DSR as the digital record; Excel explicitly **not** a final record. Conflict with AER’s xlsx/csv submission path and with typical mining spreadsheet workflows.
11. **Error-model interval assumption (100 ft) vs AER 150 m (~492 ft) maximum spacing** — they are not the same requirement; 150 m can violate the error-model “adequate geometry” caveat.
12. **Sidetrack relative uncertainty = 0 at KOP** is an RP 78 DSR / CA practice, not something to implement in MVP PU (PU is out of MVP anyway).
13. **Local copies of the large ISCWSA PDFs** may still need a successful run of `scripts/research/download_sources.ps1` in this workspace; AER files and the DSR docx **were** saved under `research/`.
