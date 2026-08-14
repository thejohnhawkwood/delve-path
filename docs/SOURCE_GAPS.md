# Source gaps and open questions

Do not answer these from assumption. They block or shape implementation.

## Brett / field reality (highest priority)

`research/brett/` is empty except a README. No invented Brett data.

- What exact survey convention does Brett use?
- Oilfield directional drilling, mining directional core drilling, HDD, or a mixture?
- What does his spreadsheet calculate?
- What does he use WinSERVE for every day?
- Which projection tools matter in the field?
- Does he need planning solvers, or only survey reconstruction + simple projection?
- Typical survey interval?
- Feet, metres, or both?
- How is north referenced (true / grid / magnetic)?
- Does he use grid corrections?
- Does he enter corrected azimuths or raw magnetic values?
- Does he need bit-to-sensor projection?
- What report goes to the client?
- What Windows versions are used on field laptops?
- Does he need multiple holes visible simultaneously?
- Target geometry (circle/rect/rotated) or point targets only?
- What mining-specific inclination/dip convention is expected?

## WinSERVE documentation

- **WSdoc (89 pp) obtained** (user-supplied). Local `research/winserve/164952996-WSdoc.pdf`. Working notes: `research/winserve/WSDOC_NOTES.md`. Still **no** min-curvature RF algebra, VS equation, or BHL-trend algebra.
- Planning examples on WSdoc pp. 68–71 **match** the prompt-cited numbers. 3-D slant E/W is **−22.67**, not +22.67. Do not implement those planners in the survey engine.
- Mining/directional switch: **sourced as report-only transposition** (WSdoc p. 40). Not a stored-convention converter. See `SURVEY_CONVENTIONS.md`.
- GEOMAPPER **is** a WinSERVE tool (WSdoc pp. 12, 85): UTM/Lambert, declination/grid via a GEOMAG-class model. INFO fields remain informational. Do not auto-apply.
- `.SVY` / `.SAY` binary layout is still unknown.
- Cluster “true positional average,” interpolation method, BHL two-station trend, true-minimum / traveling-cylinder scan formulas: **named, not derived**.
- AutoCAD wall plots are in the WSdoc TOC (p. 88). Not specified for DelvePath.
- WinSERVE vs HawkEye feature split: PDT site comparison body was empty.

## Standards / regulatory

- API RP 78: ISCWSA `files/601` is a Word DSR **draft**, not a published PDF. Full RP 78 not confirmed in-force.
- Default north reference disagrees across sources (ISCWSA ebook example prefers grid; AER locks TRUE; error-model NEV is true).
- Closure and VS formulas are named, not derived, in fetched DSR/ebook text.
- AER OneStop is an **optional Alberta oil-and-gas export profile**, not assumed for mining.

## Mining conversion

- NAVIGATOR’s stored inclination convention is unpublished.
- No sourced complete sign/dip conversion table. **BLOCKER** for a mining-convention import fixture.

## Competitor docs

- COMPASS public pages are product descriptions, not how-to specs.
- WellArchitect: no public user manual.
- NAVIGATOR: no public user manual; offline vs cloud **OPEN**.
- HawkEye RT dataflow and SQL sync protocol **OPEN**.

## Architecture QA

- Confirm Tauri + WebView2 `offlineInstaller` / `fixedRuntime` install and run with networking disabled.
- Whether Fixed Version WebView2 phones home at runtime: **OPEN** (test item).
