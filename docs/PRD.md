# Product requirements — DelvePath

**Status:** engineering prototype / evaluation software. Not certified, not regulator-approved, not for collision avoidance or steering decisions.

## Problem

A field operator must answer, offline:

> Where is the borehole now, where is it pointed, and how does it relate spatially to the intended path or target?

Current work also includes **one vertical / parent wellbore and laterals from a kick-off**, each with its own survey list and targets.

## Users

Primary: directional field operators on Windows laptops (including 1366×768). Zero Internet is assumed.

## In scope (prototype)

- Local project / hole setup with explicit units, survey convention, azimuth reference, VSP
- Keyboard-first MD/INC/AZI entry, Add row / Add 5 (hold last INC/AZI, step MD), Excel/tab paste (append when pasted MDs continue)
- Minimum Curvature survey reconstruction (ISCWSA industry method; not claimed bit-identical to WinSERVE)
- Current position panel
- Plan, profile, 3-D views; HTML legend that wraps; live path updates when stations are added
- **Parent wellbore + sidetrack laterals:** branch from a selected measured station; each lateral is a separate hole tied on at the parent’s calculated N/E/TVD; charts overlay all holes
- **Targets:** junction (parent) and child lateral targets; numeric deltas; visible on plots
- Path colors (subtle swatch); combined color-coded survey table; plot click selects the matching row
- Straight Line continuation / bit projection (labelled; not WinSERVE BHL trend). Projections never written as measured.
- SQLite persistence (`*.delvepath`), autosave, reopen (schema migrations through v4)
- CSV import/export (one hole per file) and printable survey report
- Glossary mouseover tips that stay inside the window; Start Here walkthrough
- Oregon public golden demo; constructed dual-lateral demo
- Fully offline Windows install and run

## Out of scope

Cloud/sync, WITS, geodesy engine, magnetic models, ISCWSA uncertainty, anti-collision, well-plan solvers, geology, mining-convention conversion, WinSERVE binary, undocumented projection solvers, AI calculations, TAML junction hardware, DSR interpolated kick-off at an arbitrary MD (selected measured row only), WinSERVE copy/append of the parent curve into the lateral.

## Success

See `docs/MVP_ACCEPTANCE.md`. Prototype banner must be visible.

Status words in docs and UI notes: **WORKING** · **VALIDATED** · **NOT YET VALIDATED** · **SYNTHETIC / constructed**.
