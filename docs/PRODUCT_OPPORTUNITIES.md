# Product opportunities

Near-term goal (not “implement every COMPASS feature”):

> Build the fastest, clearest, most professional completely offline field workflow for turning directional survey measurements into trusted spatial understanding.

Long-term wedge to investigate (do not claim market superiority):

> Local-first industrial directional-drilling software with modern visualization and an optional connected team platform.

---

## DelvePath MVP

Must answer: **Where is the bore now, where is it headed, and how does it relate to the intended target/path?**

Candidate capabilities:

- Project/job setup (units, convention flag, north reference, VSP, origin)
- Explicit survey convention (see `SURVEY_CONVENTIONS.md`)
- Survey entry with keypad/ENTER-loop (WinSERVE field-speed principle)
- Spreadsheet paste and CSV import
- Minimum Curvature **survey reconstruction** (published industry math; not claimed bit-identical to WinSERVE)
- Current position: TVD / N / E / VS / DLS / closure
- Plan view and profile/vertical-section view
- Interactive 3-D of the current hole (no AC/geology)
- Point targets (circle later if cheap)
- One simple validated projection (hold attitude / straight to MD or TVD) labelled as generic, not “WinSERVE”
- Save/reopen local project
- Report/export (CSV + printable survey table)
- Completely offline Windows deployment (Tauri `offlineInstaller` or `fixedRuntime`)

WinSERVE advantages to target in MVP:

- Modern Windows support; no HASP key
- Clearer measured vs calculated vs projected data
- Fast keyboard entry
- Safer units/convention handling
- Synchronized 2-D/3-D
- Stronger import/export and project persistence
- Explicit data provenance
- No network requirement

## DelvePath V1

- Planned versus actual (principal-plan UD/LR or mining drift/lift)
- Well-plan creation (2-D/3-D slant, S-well) using **planning** methods, not unconstrained min-curvature ADJ_MD
- Selected WinSERVE-class projection tools **only after** algorithms are sourced or independently derived and labelled
- Target-centric view; rotated rectangle/circle targets
- Branch / sidetrack / motherhole workflows
- More capable reporting (templates, interpolated stations, BHL)
- Multi-hole project visualization
- Mining-specific import/export **after** convention is sourced
- Bit-to-sensor projection if Brett needs it

## DelvePath Platform (future only)

- Optional cloud sync
- Office web application
- Teams, roles, dashboards, client viewer
- Shared plans; field-to-office sync
- Object storage; audit history

The local MVP must not require this architecture.

## Explicitly out of MVP

ISCWSA/IPM/EOU; anti-collision / traveling cylinder / ladder / spider; WITS/WITSML; T&D / BHA / daily reporting; earth models / geosteering / assays; licensed geomagnetic models; Compass EDM / WinSERVE binary interchange; natural-deviation engines; undocumented WinSERVE solvers.
