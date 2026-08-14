# Operator notes — DelvePath prototype

**Engineering prototype / evaluation software — not certified.**  
Do not use for collision avoidance, well control, or steering. Do not treat results as regulator-approved.

## Conventions in this build

- Inclination is **oilfield from vertical**: 0° = vertical down, 90° = horizontal.
- Internal engine uses metres and radians. The grid shows feet or metres as selected. DLS is **°/100 ft** or **°/30 m**, not a relabel of the same number.
- Azimuth is clockwise from the **stored** north reference (true / grid / magnetic / unknown). Declination and grid notes are informational. They are not applied automatically.
- Vertical section: `VS = N·cos(θ) + E·sin(θ)` with θ = VSP. Validate against your goldens if you change VSP.

## Entry

MD → Tab → INC → Tab → AZI → Enter (new row). Paste a tab or CSV block onto the grid. Mining-style **dip** headers are refused.

## Projections

Hold last INC/AZI (WSdoc name: Straight Line to MD / TVD). Rows and the current-position panel say **PROJECTED**. This is not WinSERVE BHL “trend of last two surveys.”

WinSERVE’s mining report switch (vertical printed as 90°, horizontal as 0°) is report-only. This build does not offer that print mode and does not import mining dip.

## Files

Projects are local `*.delvepath` SQLite files. Autosave is about 2 seconds after edits, and on window blur. Calculated TVD/N/E are recomputed on load, not treated as source data.

## When Brett data arrives

Do not guess collar convention or units. Record them on the hole. If the file is mining inclination-from-horizontal, do not import it into this build.
