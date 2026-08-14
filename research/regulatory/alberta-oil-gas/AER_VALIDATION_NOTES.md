# AER directional-survey templates — validation notes

**REFERENCE / OPTIONAL EXPORT PROFILE — NOT ASSUMED TO APPLY TO MINING PROJECTS.**

Help index: https://www.aer.ca/applications-and-notices/onestop/onestop-help

## Locked / typical header values (from the template CSV)

- North Reference: `TRUE`
- UTM: `11N` or `12N`
- Survey Calculation Method: `Minimum Curvature` only
- Units: `Meters & Degrees`
- Magnetic model and date are optional but paired
- VS azimuth and declination optional
- `DLS Surface Hole Location` is a **legal location**, not dogleg severity

## Station columns

`MD, Inclination, Azimuth, True Vertical Depth (TVD), TVDSS, Vert Sect, N+/S-, E+/W-, Survey Tool, Annotations`

## Generic-useful checks (not Alberta-only)

- Numeric MD / INC / AZI
- First station at KB: MD = TVD = 0.00 in the template example
- Last MD matches TD to the template’s decimal convention
- Survey tool required
- Annotations optional
- Do not treat Excel as a final digital survey record (API RP 78 DSR draft). AER still uses spreadsheet templates — that tension is noted, not resolved.

AER-only rules (5° → Deviate DDE, 80° → Horizontal DDE, 150 m max spacing, filename `DS_…`) must not be hard-coded as DelvePath defaults.
