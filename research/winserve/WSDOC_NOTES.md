# WSdoc notes (user-supplied PDF)

**Source:** `164952996-WSdoc.pdf` (Scribd 164952996), 89 pages.  
**Local:** `research/winserve/164952996-WSdoc.pdf`  
**SHA-256:** `a24ade40fd7f4ed56d6378df017ca1a555a54f6abeff7b1dd57826c89eb97d29`  
**Also:** `164945878-WS1-Lessons.pdf` (14 pp), SHA-256 `bab4880d0f7a78543db95f5fac5d9a79565c35ad0813cd11bbb51776d37463e4`  
**Internal-reference-only.** Do not redistribute. These notes cite pages; they are not a substitute for the PDF.

WSdoc is descriptive (UI and workflow). It does **not** print the Minimum Curvature ratio-factor algebra, the VS equation, or the BHL “trend of last two” algebra.

---

## Mining / directional report switch (p. 40)

> Typically ‘directional’, but mining applications consider a vertical inclination to be “90” and horizontal to be “0” degrees. **The data is transposed for the purposes of the report.**

Sourced facts:

- The switch lives on the **Survey Report Designer**, next to interpolated-report and EW–NS reference options.
- Transposition is **report output**, not a described change to stored surveys, plots, or the calculation method.
- Stored / calculated INC in the rest of the manual is oilfield-from-vertical (0 = vertical, 90 = horizontal; traveling-cylinder text uses Inc>90 as less TVD).

Still not written:

- Exact map for INC > 90° (up-going).
- Whether azimuth is altered.
- Whether plots or projections ever see mining INC.
- Micromine-style signed dip (−90 down). That is a different convention.

**Do not implement a mining import converter from this paragraph.** A future report-only “show INC as 90−I” option would need an explicit product decision and a test against a mining-mode print.

---

## Straight line vs BHL (pp. 19, 32, 52–54)

| Tool | WSdoc wording | DelvePath MVP |
|---|---|---|
| Straight Line to MD | “Extend the curve at the **current inclination and azimuth**” to TOTAL MD or ADDED MD | Implemented (simple tangent) |
| Straight Line to TVD | Same hold to TOTAL / ADDED / target TVD | Implemented |
| Project to bit (BHL) | “trend of the last two surveys”; user arrows often override because it “will differ from the driller’s estimation” | **Not** implemented. MVP bit projection is Straight Line, labelled as such |

No formula is given for the two-station trend.

---

## Cluster surveys (pp. 31–32)

OPTIONS > ALLOW CLUSTER SURVEY. 2–8 shots at one depth. **Calculate Cluster** produces an “Average Projected Survey” described as a **true positional average, not merely a numerical average**. Algebra is not given. Do not implement.

---

## Units (p. 30)

PARMS: method of calculation, azimuth I/O preference, vertical-section reference, feet or meters. Conversion is a **true mathematical conversion, not a change of label** (100 entered as metres then converted to feet becomes 3280). Matches DelvePath unit policy.

The method-of-calculation **list** is not enumerated on that page.

---

## Planning examples now verified (pp. 68–71)

Target #1: 4500 ft TVD, 45° direction, 1000 ft displacement.

| Case | Knowns | Solve | Printed result |
|---|---|---|---|
| 2-D slant A | KOP 650, DLS1 3/100 | Hold | **15.57°** |
| 2-D slant B | KOP 650, Hold 25° | DLS1 | **0.7448** /100 |
| 2-D slant C | DLS1 3, Hold 25° | KOP | **1932.1** ft |
| 3-D slant | Tie-in MD 1500, INC 2, AZ 300, TVD 1499.7, N 13.09, **E −22.67** (east is negative) | Hold (DLS 3 was the failed triple-fixed case) | **20.98°** |
| 2-D S-well | KOP 1000, DLS1 2, DLS2 1.5, Entry 7° | Hold | **20.431°**, tangent **1741.65** |
| S-well variant | KOP 2000, same DLS/entry | Hold | BHL TVD **5097.06**, no tangent (hits VS displacement, not target TVD) |
| S-well variant | Hold 24° | KOP | **1234.7** |
| S-well variant | equal DLS | DLS1=DLS2 | **1.7987** |
| S-well variant | Tangent 1000 | KOP + Hold | KOP **1434.4**, Hold **26.0523** |

2-D KOP “always assumes a zero-zero tie in.” 3-D slant with turn keeps **constant DLS** while build/walk rates change; same routine as DLS Projection to Target from a non-KOP point.

**Do not put these solvers in `delve-core`.** They are well-plan constructors, not survey reconstruction.

---

## Other sourced items (not MVP)

- **GEOMAPPER** exists (pp. 12, 85): UTM/Lambert ↔ lat/long; declination and grid from a GEOMAG-class model + USGS PP 1395 map projections. INFO declination/grid on the main job remain informational. Packaged GEOMAGIX / CORPSCON mentioned.
- **Ellipse of uncertainty** exists on Least Distance (pp. 42–44): user picks a model and instrument type. No ISCWSA error-model equations in this manual. Do not implement as “WinSERVE EOU.”
- **True minimum** vs **TVD slice**; traveling cylinder; mosquito / normal-plane plot (pp. 19–20, 41–44). Conceptual only — no scan formula.
- **Formation lines** as curves (typically 6–7). Dip in target direction: `COS(max_dip_dir − target_dir) × max_dip` (pp. 60–61).
- **Interpolate** by MD or TVD; label; optional MAKE TIE IN; `.INT` batch file (p. 10). Algorithm not given.
- **AutoCAD wall plots** (TOC p. 88). DXF/export-to-CAD is evidenced as a feature name, not specified for DelvePath.
- Curve 21 sequential ADD; workcurve never receives projected stations (pp. 52–53). Already our architecture.

---

## Still absent from WSdoc

- Minimum Curvature RF / unit-tangent algebra
- Vertical section equation (VSP is a user/plan azimuth; no `N cos θ + E sin θ` print)
- BHL two-station trend algebra
- Cluster positional-average algebra
- `.SVY` / `.SAY` binary layout
