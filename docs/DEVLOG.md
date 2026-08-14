# DEVLOG — research / handoff pass

**2026-08-13**

## Repo

- Connected to existing Git repo at `C:\Users\Papa\Desktop\delve-path` (`origin` = `https://github.com/thejohnhawkwood/delve-path.git`, `main`).
- Did not create a nested `delve-path/delve-path`.
- Added `.gitignore` (binaries/installers, temp extract/render/ocr, future app build dirs).
- Created `docs/`, `research/*`, `scripts/research/`.
- `research/brett/README.md` placeholder only — no invented Brett data.

## Downloads (no executables)

Succeeded: Oregon DOGAMI survey PDF; three NM OCD WinSERVE packets; two NM COMPASS packets; Idaho HawkEye/JMP EOW; ISCWSA ebook, Aklestad slides, Well Intercept ebook, files/601 (docx), files/842 (error model PDF); AER CSV/XLSX/validation/QRG; HawkEye FC user manual.

Failed / URL-only: Scribd WSdoc (client challenge / paywall) — no fabricated PDF. Scribd WS1-Lessons body extracted to markdown. Scribd WinServ-Setup direct fetch blocked.

SHA-256 values recorded in `docs/REFERENCE_MANIFEST.md` and `research/architecture/download_results.json`.

## WinSERVE

- Reverse-specified from WS1-Lessons public text + filed reports.
- Deep dive: `docs/WINSERVE_DEEP_DIVE.md`.
- Mining mode left as BLOCKER.

## Goldens

- Oregon and NM 30-039-29461 fully transcribed to CSV + metadata (OCR on rendered scans; header visual check; one DLS cell flagged).
- NM 29320 and 32380 downloaded; OCR drafts gitignored; not promoted (29320 awaiting second visual pass; 32380 has a dirty OCR row).
- COMPASS 5000.17 plan page 12 representative stations transcribed.
- HawkEye Fallon 1-10 page-4 excerpt transcribed.
- Level-1 synthetic specs written; mining-import case omitted.
- WSdoc planning numbers catalogued as **unverified**.

## Other research

- Competitor matrix (HawkEye, COMPASS, Well Seeker X, WellArchitect, NAVIGATOR, Micromine).
- ISCWSA / AER notes (including existing `research/standards/ISCWSA_AER_RESEARCH_HANDOFF.md`).
- Tauri v2 offline packaging notes.
- Glossary, conventions, opportunities, source gaps, handoff.

## Not done (by design) — research pass

- No Tauri/app scaffold in the research pass.
- No WinSERVE EXE/DLL/installer download or execution.
- No commit (not requested).
- No mining-convention converter.
- No projection-algorithm reconstruction.

---

# DEVLOG — planning + MVP implementation

**2026-08-13**

## Phase 0

Planning docs written: PRD, ARCHITECTURE, CALCULATION_SPEC, DATA_MODEL, UI_SPEC, OFFLINE_REQUIREMENTS, TEST_PLAN, MVP_ACCEPTANCE, ROADMAP, OPEN_QUESTIONS, IMPLEMENTATION_PLAN. Oilfield min-curvature MVP gated; mining remains blocked.

## Phases 1–3

- Cargo workspace: `delve-core`, `delve-storage`, `src-tauri`.
- `delve-core`: units, types, validation, Minimum Curvature, simple tangent projection, synthetic + golden tests.
- `delve-storage`: SQLite WAL, migrations, transactional station replace, reopen test.
- Tauri commands wrap core/storage only. Frontend never issues SQL.

## Phases 4–9

- Tauri 2 + React + Vite + local Plotly.
- Survey grid (MD/TAB/INC/TAB/AZI/ENTER), current-position panel, plan/profile/3-D from core results, point targets, PROJECTED simple-tangent overlay, CSV/report, 2 s autosave, 1366×768, prototype banner, README disclaimer.
- CSP documents Plotly `'unsafe-eval'` as local-only.
- Installer / air-gap: **NOT YET VALIDATED** until `link.exe` (MSVC) is available and a production bundle is built.

## Tests this session

- `npx tsc --noEmit` — pass
- `npm run test-ui` — pass (CSV parse, mining-header refuse, export class column)
- VS 2022 Build Tools installed; `link.exe` available via `vcvars64.bat`
- `cargo test -p delve-core -p delve-storage` — **VALIDATED**
  - synthetic L1: 10 passed
  - units: 2 passed
  - storage reopen: 1 passed
  - goldens: Oregon body 25 stations max Δ 0.005 ft; Oregon MD 2591 post-plug-back ΔN 0.032 ft (documented); NM 9461 max Δ 0.009 ft; COMPASS N 0.23 usft explained as 276.1 printed hold increment; HawkEye N/E/TVD < 0.01 ft
- `cargo check -p delvepath` — pass
- Production installer / air-gap — **NOT YET VALIDATED**

## Numerical note

Min-curvature formula not changed after golden misses. Oregon overshoot is only the 743 ft interval after the plug-back interpolated point. COMPASS N drift is printed 1 dp hold arithmetic. See `docs/CALCULATION_SPEC.md`.

## Still blocked / not invented

- Mining conversion, WinSERVE-identical undocumented projections, ISCWSA PU, anti-collision, well-plan solvers, LLM calculations.

---

# DEVLOG — WSdoc / WS1-Lessons incorporation

**2026-08-13**

User supplied `c:\Users\Papa\Downloads\164952996-WSdoc.pdf` (89 pp) and `164945878-WS1-Lessons.pdf` (14 pp). Copied to `research/winserve/`. Notes: `research/winserve/WSDOC_NOTES.md`.

## Decisions (sourced, not invented)

- Mining 90°/0° is a **report designer transposition** (WSdoc p. 40). Stored INC stays oilfield. No mining import implemented.
- MVP projection matches WSdoc **Straight Line to MD/TVD** (hold current I/A). BHL two-station trend still has no algebra — not implemented.
- Planning numbers on pp. 68–71 **verified**. 3-D slant E/W is **−22.67**. Still not implemented in `delve-core`.
- GEOMAPPER exists; INFO declination/grid remain informational.
- Cluster = “true positional average”; formula still absent.

## Files touched

Docs: WINSERVE_DEEP_DIVE, SURVEY_CONVENTIONS, SOURCE_GAPS, OPEN_QUESTIONS, GOLDEN_DATA_CATALOG, REFERENCE_MANIFEST, RESEARCH_HANDOFF, CALCULATION_SPEC, OPERATOR_NOTES, DEVLOG. UI projection labels. Planning metadata JSON.

## Tests

No engine change. Goldens not re-run this increment.

---

# DEVLOG — multilateral / branch-point increment

**2026-08-13**

Parent wellbore + sidetrack as **separate holes**. Lateral first station = selected measured kick-off; tie-in = parent calculated N/E/TVD. Parent stations are not copied. Charts overlay every hole. Multiple targets per hole. Synthetic dual-lateral demo (constructed, not a golden).

## Storage

- `holes.parent_hole_id`, `holes.branch_md`. Schema v2 via `ALTER TABLE` on existing DBs (`CREATE TABLE IF NOT EXISTS` stays v1-shaped).
- `delete_target`, `delete_hole` (refuses if a sidetrack still points at the hole).

## Not added

- Arbitrary-MD interpolation at kick-off (DSR second station).
- Mining conversion, declination auto-apply, undocumented projections, anti-collision, TAML hardware, well-plan solvers.
- Dual-lateral does **not** replace Oregon auto-load.

## Public example

Named Bakken dual-lateral: Slawson Gobbler Federal 4-26-35MLH, NDIC 32276 — no station table invented (DMR session 401). Sidetrack excerpt: NM Klondike State Com #1H API 30-005-64295 (pilot + Wellbore #2), **NOT YET VALIDATED**, not a dual-lateral. Notes: `research/golden/metadata/multilateral_public_example.md`.

## Tests this increment

- `npx tsc --noEmit`
- `cargo test -p delve-storage` (reopen + branch columns + v1 migrate)

---

# DEVLOG — 3-D split + junction/child targets

**2026-08-13**

## 3-D viewer

Plotly split (dark empty left + beige scene right) after laterals: `Plotly.react` kept Plan/Profile cartesian `xaxis`/`yaxis` when switching to 3-D. Overlay traces themselves were already `scatter3d`; leftover 2-D layout created a second subplot. Fix: purge when crossing 2-D ↔ 3-D, `newPlot` on enter 3-D, filter `scatter3d` only, single `scene.domain [0,1]×[0,1]`, manual aspect from data extents (pad thin axes), chart CSS fills the pane. Status: **WORKING** (layout/trace). Camera/orbit comfort **NOT YET VALIDATED** in the Tauri shell.

## Junction / lateral targets

`targets.parent_target_id` (schema v3). One junction per parent hole. Lateral targets are children; hole dropdown assigns East BHL vs West BHL. Delete junction **nulls** children (standalone), does not cascade-delete. Dual-lateral example links East/West BHL to Junction. Status: **WORKING** (UI + storage test). Existing `*.delvepath` files migrate on open — **NOT YET VALIDATED** against a filed project.

---

# DEVLOG — plot legend, combined survey table, hole colors

**2026-08-13**

User feedback from dual-lateral 3-D: Plotly’s in-plot horizontal legend overlapped on resize / Plan–Profile–3-D; the grid showed only the active hole.

## Legend

HTML legend in the viz pane (`flex-wrap`, swatch + short label). Plotly `showlegend: false` on Plan / Profile / 3-D. Status: **WORKING**. Wrap at very narrow pane widths **NOT YET VALIDATED** in the Tauri shell.

## Combined table + click-to-select

Grid lists parent then laterals, 4px color bar + group header. Active hole editable; other rows read-only (click switches hole + station, same path as the Hole dropdown). Plot traces carry `{ holeId, stationIndex }`; kick-off → first station; target clicks ignored. CSV export remains the current hole only (one survey list per bore). Status: **WORKING**. Plot-click → row scroll in the desktop shell **NOT YET VALIDATED**.

## Hole color

Optional `holes.color` (`#rrggbb`). Schema v4. Null → parent `#e8eaed`, then cyan / amber / green / blue / rust for laterals. Tiny swatch next to Hole; 6-preset popover + native color input. Persists on existing hole upsert. Status: **WORKING** (storage test). Existing `*.delvepath` migrate on open — **NOT YET VALIDATED** against a filed project.

---

# DEVLOG — add row / paste appears on plot

**2026-08-13**

Add row / Add 5 / Enter on last AZI now create measured stations (next MD, hold last INC/AZI) so Minimum Curvature can place them immediately. Charts always draw the live active-hole trajectory over stale overlays. Paste/import **appends** when the first pasted MD is deeper than the last existing MD; otherwise replaces. Calc errors no longer clear the last good plot. Status: **WORKING**. Desktop click-through **NOT YET VALIDATED**.

---

# DEVLOG — viewport-safe tips + first main land

**2026-08-13**

## Mouseover explainers

Glossary tips used `::after` above the label, so toolbar / header / edge hovers clipped off-screen. Tips are now a `position: fixed` portal bubble: flip below if there is no room above, clamp left/right, stay within the window. Plotly point hovers get `hovermode: closest` plus a post-hover clamp. Status: **WORKING**.

## PRD

`docs/PRD.md` updated from the original MVP list to the current prototype: parent/sidetrack laterals, junction/child targets, combined color-coded grid, Add row, viewport-safe tips, Oregon + synthetic dual-lateral demos. Out of scope unchanged (AC, TAML, interpolated KOP, mining conversion, AI calc).

## First commit of the working tree

Repo had only the GitHub `Initial commit`. This land adds the Tauri/React/Rust prototype, `delve-core` / `delve-storage`, research goldens and source PDFs, and planning docs. Build artifacts (`target/`, `node_modules/`, installers) stay gitignored.
