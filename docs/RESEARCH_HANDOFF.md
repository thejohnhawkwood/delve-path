# Research handoff — DelvePath

**Date:** 2026-08-13  
**Workspace:** `C:\Users\Papa\Desktop\delve-path` (repo root; GitHub `thejohnhawkwood/delve-path`, branch `main`)  
**Pass type:** research and evidence package only. **No application scaffold.**

The next agent should be able to implement an offline Windows field MVP without repeating this research.

## Read first

1. This file
2. `docs/SOURCE_GAPS.md` — blockers
3. `docs/SURVEY_CONVENTIONS.md` — do not invent mining conversion
4. `docs/WINSERVE_DEEP_DIVE.md`
5. `docs/GOLDEN_DATA_CATALOG.md`
6. `docs/PRODUCT_OPPORTUNITIES.md` — MVP cut
7. `research/architecture/TAURI_V2_OFFLINE_NOTES.md`

## What DelvePath is

Modern directional drilling / borehole survey, planning, and visualization software. Immediate MVP: **fully offline Windows field application**. Future commercial team features must not be required by the field app.

## Highest-value findings

**WinSERVE**

- Workflow, curve model (0–20 user, 21–29 projection slots), keypad ENTER-loop, workcurve-vs-proposal, informational declination, and report/plot contracts are evidenced from WS1-Lessons + WSdoc.
- **WSdoc is now local** (`research/winserve/164952996-WSdoc.pdf`). It is descriptive. It still does **not** print min-curvature RF, VS, or BHL-trend algebra. Do not reverse-engineer those.
- Straight Line to MD/TVD = hold current I/A (WSdoc p. 54) — that is the MVP projection. BHL “trend of last two” remains unsourced algebra.
- Filed reports prove Minimum Curvature + VSP + wellhead-referenced N/E/VS. Templates vary (DLS/closure optional).
- Mining/directional switch is **report-only transposition** (WSdoc p. 40), not a stored-convention converter.
- Planning examples on WSdoc pp. 68–71 are **verified**. They are plan constructors — not for `delve-core`.

**Competitors**

- Keep **survey reconstruction** and **planned-trajectory generation** separate (Innova 180° ADJ_MD failure).
- Field Mode vs Planning Mode (HawkEye) is the right product cut.
- Principal-plan UD/LR on the survey grid (Innova) is the V1 PvA move.
- Aziwell/Micromine: mining users need collar + survey + convention flag; do not become a geological modeller.
- Do not chase COMPASS/EDM/ISCWSA/AC in MVP.

**Architecture**

- Tauri v2: embed frontend; `offlineInstaller` or `fixedRuntime`; SQLite in AppConfig; deny-by-default FS; no remote capabilities.

## Golden fixtures ready for tests

| Fixture | Role |
|---|---|
| `winserve_oregon_24c-23-65_*` | Moderate WinSERVE min-curvature oracle |
| `winserve_nm_3003929461_*` | High-angle WinSERVE oracle (crosses 90°, non-zero tie-in) |
| `compass_nm_3001555969_*` | Modern COMPASS **plan** comparison |
| `hawkeye_idaho_fallon1-10_*` | Independent modern survey excerpt |
| `level1_synthetic_specs.json` | Unit-test specs (not computed) |
| `winserve_manual_planning_unverified.json` | WSdoc pp. 68–71 **verified** — future planner tests only; not `delve-core` |

Tolerance = printed precision. Exclude labelled projections from measured-survey tests.

## Implementation blockers

1. Brett convention / workflow unknown (`research/brett/` empty).
2. WinSERVE mining switch is report-only (WSdoc p. 40); Micromine-style signed-dip import still unsourced.
3. WSdoc obtained — still no RF / VS / BHL-trend algebra. Do not implement unnamed solvers.
4. Mining sign/dip conversion (import) unsourced.

## Do not

- Scaffold the production app in a research pass.
- Download or run WinSERVE/HawkEye executables.
- Auto-apply declination/grid.
- Use one min-curvature call as a well-plan constructor.
- Invent Brett data or mining conversions.
