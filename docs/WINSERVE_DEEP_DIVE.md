# WinSERVE deep dive

**Vendor:** Performance Drilling Technology, Inc. (PDT)  
**Product:** WinSERVE / WinServe — borehole surveying and well planning  
**Successor (do not conflate):** HawkEye / HawkEye RT  
**Constraint:** no WinSERVE executable, DLL, or installer was downloaded or run.

**Primary manuals (local, user-supplied 2026-08-13):**

- WSdoc, 89 pages: `research/winserve/164952996-WSdoc.pdf`. Working notes: `research/winserve/WSDOC_NOTES.md`.
- *WinSERVE User Guide for Drilling Setup* (WS1-Lessons), 14 pages: `research/winserve/164945878-WS1-Lessons.pdf` and `research/winserve/WS1-Lessons_public_extract.md`.

WSdoc is descriptive (screens and workflow). It does **not** print min-curvature RF algebra, the VS equation, or the BHL two-station trend algebra. **Do not invent those.**

Filed reports used as B-authority oracles: Oregon DOGAMI 24c-23-65; NM OCD 30-039-29320, 30-045-32380, 30-039-29461. All print **WINSERVE SURVEY CALCULATIONS** and **Minimum Curvature Method**.

---

## A. Job / file model

**Evidenced (WS1-Lessons, S3 snippets, filed reports)**

- One job file, DOS 8.3 name, extension **`.SVY` auto-appended**. Example: `MYTEST` → `C:\Winserve\MYTEST.SVY`.
- Filed reports print the `.SVY` path (Oregon `C:\COMPANYS\NWNAT\24C\24C.SVY`; NM jobs under `N:\` / `Z:\` 8.3 paths).
- Last saved file reloads on open; else OPEN or FILE>>NEW.
- **One `.SVY` holds all curves.** “Up to 20 curves.” **Curves 21–29 are reserved placeholders for projections.**
- **Curve 0** = default **work curve** (as-drilled). Projections start from the work curve and **do not alter it**.
- **Curve 1** = common **proposal / plan**. Any unused 0–20 curve may hold alternate plans, sidetracks, offsets.
- Display: WORK # / PLAN # / CURVE #.
- Curve Type is a **tag** (SURVEY). S3: `0=survey`, `1=proposal`.
- Per-curve: name, N/E offsets (S/W as negatives), **VS Direction**, **RKB / Subsea offset = KB**.
- Tie-in via TIE-IN form or first spreadsheet row (black highlight).
- Comments: tie-in comment; target comments on the proposal comment column; commented rows highlighted.
- Autosave: OPTIONS>>AUTOSAVE every five minutes; SAVE button; FILE>>SAVE.
- PARMS: feet or meters, **calculation method**, input/output preferences. Example: feet, **minimum curvature**, **decimal input/output**.
- INFO: job number and header fields. **Declination and grid correction are informational only**; enter surveys already corrected.
- Import: FILE>>IMPORT>>WinSERVE SURVEY (`.SAY`); FILE>>IMPORT>>OTHER TEXT (numeric columns; optional READ TIE-IN FROM FILE).
- Export: FILE>>EXPORT>>WinSERVE SURVEY → `.SAY`; ASCII from report screen.
- EDIT>>CURVE EDITOR: copy / move / delete / append (sidetrack definitive lists).
- HASP key required to run (license).

**OPEN:** binary `.SVY`/`.SAY` layout; exact 0–20 vs “20 curves”; full Curve Type enum; full PARMS method list; whether 21–29 persist in the file; VS stored vs derived.

---

## B. Survey entry

**Evidenced**

- Entered: **MD, INC, AZM**. Tie-in also takes **TVD, N/S, E/W**.
- ADD SURVEY: cursor on last MD; TAB for one station; **ENTER loops to MD** for keypad burst entry. **This field-speed principle should survive in DelvePath.**
- Cluster surveys (WSdoc pp. 31–32): OPTIONS > ALLOW CLUSTER SURVEY; 2–8 shots at one depth; **Calculate Cluster** = “true positional average, not merely a numerical average.” Algebra not given.
- Bit-to-sensor: LOCATION **SENSOR vs BHL**. BHL uses BIT TO SENSOR; projected bit from **“trend of the last two surveys”** (WSdoc pp. 19, 32, 52); arrow adjust because the calculated point often differs from the driller’s estimate. Other projections may start from this BHL.
- TOOLS>>INTERPOLATE by MD or TVD (WSdoc p. 10); optional MAKE TIE IN; `.INT` batch. Algorithm not given.
- Quadrant or azimuth input (WSdoc p. 32): either form; the other is shown in a gray box.

**OPEN:** cluster positional-average algebra; BHL two-station trend algebra; interpolation algorithm.

WS1 worked example (workflow only, not a math golden):

- Tie-in: MD 1000, INC 1.3, AZM 45.7, TVD 999, N/S 21.8, E/W −15.9
- Then: 1100/2.3/43; 1200/4.0/40.2; 1300/5.8/37.8; 1400/7.8/35; 1500/10.0/33.7
- Bit-to-sensor 60 ft; later MD 1600 INC 12 AZ 60

---

## C. Calculated outputs

Named on WS1-Lessons and/or filed reports. **Definitions are not given in public WinSERVE text.**

| Field | Where seen | Notes |
|---|---|---|
| TVD | All goldens | Printed 2 dp ft |
| N-S / E-W | All goldens | +N/−S, +E/−W; wellhead origin on goldens |
| Vertical Section | All goldens | Requires VSP; wellhead-referenced |
| CLOSURE Distance / Direction | NM 9461, NM 32380 | Not on Oregon or NM 29320 printed columns |
| Dogleg Severity | Oregon, NM 9461, NM 32380 | Deg/100; not on NM 29320 printed columns |
| Subsea depth | WS1 if RKB ≠ 0 | Oregon prints RKB 16' |
| Toolface (TFO) | WS1 Ouija | Not on filed survey tables |
| Projected BHL | WS1 LOCATION | “Trend of last two surveys” — undocumented |
| Polar direction/distance | WS1 targets | Example 60° × 1500 ft → 750 N, 1299.04 E |

**Safe to reproduce from published industry math (not as bit-identical WinSERVE):** station-to-station minimum curvature when PARMS says so. Confirm RF, interval, and azimuth wrap against goldens. Tolerance = printed precision.

**Do not implement from names alone:** closure formula, build, walk, BHL trend, interpolation, any target-hitting projection.

**Straight Line to MD / TVD (WSdoc p. 54):** “Extend the curve at the current inclination and azimuth.” That is hold-attitude / simple tangent — the MVP projection. It is **not** the BHL trend.

S3 RKB change (preview snippets): add ΔRKB to each target TVD and to first TVD of curve 1; survey TVDs do not change; check `TVD − RKB = SUBSEA TVD`.

---

## D. Targets

**Evidenced (WS1-Lessons, S3, NEWSCO blurb)**

- Spreadsheet of multiple targets (examples #1–#4; **max count OPEN**).
- Shapes: CIRCLE, square, rectangular. Circle dimension is **diameter, not radius**.
- Location: rectangular N/E **or** polar direction + distance; program fills the other.
- Rectangle: X = side perpendicular to wellpath; Y = other; rotation from wellpath axis allowed.
- SURFACE OFFSETS shift all targets; X/Y offsets move the defining point off-center.
- After first target, INC and AZ appear in red columns for subsequent targets (**meaning OPEN**).
- **KOP is not a target** (S3).
- Tag a survey as a point target: highlight row, press **T**.
- Graphic/dynamic target via left-click.

WS1 examples: circle 100 ft dia, TVD 5000, polar 60°/1500 ft → 750 N, 1299.04 E; rectangle 100×200, TVD 6000, N 1000 E 2300; sidetrack square 100 ft, TVD 5500, polar 50°/3000 ft.

---

## E. Reports

**Evidenced (WS1-Lessons + filed PDFs)**

- REPORTS → SURVEY REPORT OPTIONS. Field picker: AVAILABLE FIELDS → FIELDS IN REPORT. SAVE TEMPLATE. FROM DEPTH. ASCII TEXT (NO = no headings). **No print preview.**
- **Directional / Mining Mode Switch** (WSdoc p. 40): mining print treats vertical as 90° and horizontal as 0°; “transposed for the purposes of the report.” See `SURVEY_CONVENTIONS.md`.
- Filed title: **WINSERVE SURVEY CALCULATIONS**. Always names Minimum Curvature, VSP, wellhead references, `.SVY` path, curve name, date/time.
- Field sets vary by template: Oregon includes DLS, no closure; NM 29320 omits DLS and closure; NM 9461/32380 include closure + DLS.
- REPORTS >> LEAST DISTANCE (see J).

**OPEN:** full field catalog; grouping. WSdoc also names critical-points print, target-projection report (protractor / min-DLS / slant), BHL report, pipe tally, interpolated reports (MD or TVD interval), EW–NS wellhead vs slot. Ellipse of uncertainty is a Least Distance option (model + instrument type) — no equations in WSdoc.

---

## F. Plotting

**Evidenced (WS1-Lessons; Oregon PDF plots)**

- PLOT: 8×11; COMPOSITE; PLOT TYPE **TVD or HORZ**.
- Oregon filing shows **VERTICAL SECTION** (scale 1"=400', plane 165.30) and **PLAN VIEW** (scale 1"=200').
- # TICKS, SPACING, SET ORIGINS (min VS / max TVD), GRID CONTROL, HEADER, LABELS, CURVES.
- Zoom; string & protractor (distance and direction).
- TRACKING: interpolated tracking point + crosshairs.
- LEAST DISTANCES on plot with optional RADIUS gate.

**OPEN:** AutoCAD wall-plot procedure (WSdoc TOC p. 88 names the feature). Not specified for DelvePath.

---

## G. Projection system

**Architecture (WS1-Lessons) — evidenced**

- Start from work curve or projected BHL. Work curve never receives projected stations.
- Curves 21–29 are overwrite placeholders. Save by copying to 0–20.
- Curve 21: form-style sequential tools; ADD moves projection to new TIE-IN POINT.
- Curve 23: graphical COPY MODE stores in 23 and 21.
- Curve 28: “a Minimum Curvature projection can always be found in Curve 28.”
- Curve 29: DLS projection; auto-updates as surveys are entered.
- Graphical PROJECT (binoculars); WSdoc is cited for individual methods.

| Tool | Inputs (public) | Outputs (public) | Problem | Algorithm documented? | Safe from published math? | Horizon |
|---|---|---|---|---|---|---|
| Project to bit / BHL | Bit-to-sensor; last two surveys; arrows | BHL station | Extrapolate sensor to bit | Named only (“trend of last two”) | No | Research-only |
| Straight to MD | TOTAL MD or ADDED MD | Curve 21 | Hold current I/A | Yes — “current inclination and azimuth” (p. 54) | Yes, labelled | **MVP** (simple tangent) |
| Straight to TVD | TOTAL / ADDED / target TVD | Curve 21 | Hold current I/A to a TVD | Yes (p. 54) | Yes, labelled | **MVP** (simple tangent) |
| Build and walk | Graphical to target TVD | Projection curve | Independent build & walk | No | No | Research-only |
| Inc/az at TVD or plane | Not named in WS1 | — | — | OPEN | — | Research-only |
| Ouija Board | Solve MD or DLS; TFO / final INC/AZ | Curve 21 after ADD | Classic DD Ouija | UI only | Generic Ouija only if labelled | MVP as generic only |
| DLS to target | DLS or solve-for-DLS + target + final INC | C29 or C21 | Hit target at DLS | No | No | Research-only |
| Vector to target | Target, DLS1, DLS2, POST HOLD, target INC/AZ | C21 | S-type / double-curve | No | No | Research-only |
| 3-D to formation line | Menu item (WSdoc p. 9); formation-line curves | Projection to a dip line/plane | Hit a formation line | UI + dip-in-target-dir equation (p. 61) | No full solver | Research-only |
| Vectored curve | Named on Curve 21 menu (WSdoc p. 9) | — | — | UI only | No | Research-only |
| Graphical / binocular | DLS, min curvature, straight, build & walk, protractor, S-well vector | C21/C23/C28/C29 | Visual what-if | No | No | Post-MVP UI; solvers research-only |
| Sequential Curve 21 | ADD then next tool | Accumulated C21 | Multi-leg / field sidetrack | Workflow yes; math no | Only published-math legs | MVP workflow + research solvers |

**Do not reconstruct undocumented algorithms from UI behavior.**

---

## H. Well planning

WSdoc pp. 61–71: Well Proposal Planning Screen with PROFILE TYPES (slant, S-well, horizontal; 2-D or 3-D) and a Solve area (KOP, DLS1/DLS2, hold, tangent, post hold, entry angle). 2-D KOP assumes a zero-zero tie-in. Field use can still build a proposal by stringing Curve 21 projections and copying to curve 1.

**Planning examples on pp. 68–71 are now verified** (see `GOLDEN_DATA_CATALOG.md` §2.5 and `WSDOC_NOTES.md`). They are **plan constructors**, not survey reconstruction. **Do not implement them in `delve-core`.**

---

## I. Formation lines

WS1: interpolate a station at a TVD and comment it (example `BIG SAND`) “to identify formation tops.”

WSdoc pp. 59–61: **Formation Line Maker**; lines stored as curves (docs typically use 6 and 7). Three methods. Method 1: dip angle, dip direction (maximum down-dip, positive), Zero VS TVD, length, optional thickness. Dip in the target direction:

`Target Direction Dip = COS(Maximum Dip Angle Direction − Target Direction) × Maximum Dip`

Method 2: line between two targets. Method 3: up to 20 TVD/VS points. Treat the line/plane as a target for projections. **Not MVP.**

---

## J. Least-distance / collision-oriented tools

**Evidenced (WS1-Lessons)**

1. Plot tracking + LEAST DISTANCES + optional RADIUS.
2. Main-screen quicklook: workcurve vs one comparison curve; distance and direction from BHL + comparison TVD.
3. REPORTS >> LEAST DISTANCE: default **TRUE MINIMUM DISTANCE** (manual: “TRUE MIMIMUM DISTANCE”) and HIGH SIDE REFERENCE.
4. TRAVELING CYLINDER check for view/print.
5. INCREMENT + two rows + **C** key expands the scan.

WSdoc pp. 41–44: **True Minimum** vs **TVD Slice**; increment/ZOOM (`C` key, 1/10 previous increment, max 500 points); traveling cylinder (start/end TVD, radius, Comp Well vs All Wells); **Use Uncertainty** picks a model and instrument type. No scan or ellipse equations. Do not implement ISCWSA EOU as “WinSERVE.” Not MVP.

---

## K. GEOMAPPER / geodetics

WinSERVE (WS1 + WSdoc p. 30 INFO): declination and grid correction are **informational**. Surveys must already be in the desired north. RKB vs MSL for subsea. N/E offsets. VS Direction user-entered.

WSdoc pp. 12, 85: **GEOMAPPER** converts UTM/Lambert ↔ lat/long and displays magnetic declination and grid correction. Claims GEOMAG-class methods and USGS PP 1395 map projections. Also mentions packaged GEOMAGIX and CORPSCON. This does **not** change the INFO-field rule: do not auto-apply corrections to surveys.

Filed reports: Oregon prints Declination 18.528 E, Grid blank. NM 32380 prints Declination 10.5 (certification 10.45).

HawkEye has advanced geodetics / ISCWSA — do not treat as WinSERVE.

**MVP:** store declination/grid as metadata; do not auto-apply.

---

## L. Mining mode — report-only (sourced)

WSdoc p. 40: Directional / Mining Mode Switch on the report designer. Mining print: vertical = 90°, horizontal = 0°; “transposed for the purposes of the report.” See `docs/SURVEY_CONVENTIONS.md`. Do not implement a stored-convention converter or mining CSV import from this sentence.

---

## Implementation guidance

**MVP (evidence-backed behavior + published math only where named):**

1. Conceptual job: curves 0–20 user, 21–29 projection slots, work/plan designation, tie-in, VS direction, RKB metadata, declination/grid display-only.
2. Survey grid: MD/INC/AZI, ENTER-loop, comments.
3. Min-curvature station calculation — industry equations, **not** claimed bit-identical; test against Oregon + NM goldens with printed-precision tolerance.
4. Targets: circle/square/rect, polar↔rect fill, diameter ≠ radius.
5. Report field picker + ASCII/CSV; plan + section plots.
6. Curve 21 sequential **workflow**; C28/C29 as named slots.
7. Least-distance **UI later**; no invented scan.

**Research-only / blocked:** target-hitting and S-well/vector/build-walk/BHL-trend solvers; well-plan constructors (even though WSdoc examples are now verified); GEOMAPPER apply-to-survey; EOU; mining import; AutoCAD/DXF; cluster math; `.SVY` binary.
