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

## Units

Changing Units converts stored lengths (MD, tie-in, targets, origin offsets). It does not relabel the same numbers as the other unit.

## Review

Stations migrate as **unreviewed**. Flight Deck anchors and forecast scoring require an explicitly **accepted** station. Use Accept unreviewed or the Review column — do not treat ACCEPTED SURVEY as certified or uncertainty-free.

## Projections and Flight Deck

Hold last INC/AZI (WSdoc name: Straight Line to MD / TVD). Rows and the current-position panel say **PROJECTED**. This is not WinSERVE BHL “trend of last two surveys.”

Flight Deck adds gravity-TF, build/turn, recent-trend least-squares, and slide/rotate scenarios. Gravity TF 0/90/180/270 = build / right / drop / left. Sensor MD and bit MD are never the same point. Centerline is screening only.

WinSERVE’s mining report switch (vertical printed as 90°, horizontal as 0°) is report-only. This build does not offer that print mode and does not import mining dip.

## Files

Projects are local `*.delvepath` SQLite files. Autosave is about 2 seconds after edits, and on window blur. Calculated TVD/N/E are recomputed on load, not treated as source data.

## When Brett data arrives

Do not guess collar convention or units. Record them on the hole. If the file is mining inclination-from-horizontal, do not import it into this build.


## Try the crossing-lateral correction case

1. Open **Anti-collision**. The constructed case is separate from your measured survey rows.
2. Compare the amber uncorrected route with the violet crossing and lower offset laterals. Use **Show entire path** to see the current interval and target.
3. Select **Generate drill path**. The engine checks 65 candidates against all supplied offsets and the entered dogleg, uncertainty, radius and margin constraints.
4. Compare the cyan correction, switch Plan/Profile/3-D, and toggle each layer. Ellipsoids are actual 3-D covariance regions; Plan/Profile show their orthographic outlines.
5. Open **Inspect calculation & report** to see before/after encounters and all candidate rejection reasons.
6. Expand **Save, export & replay**. Export the complete audit or planned candidate CSV; save an immutable run to an open project. Import an audit to verify its hashes and recompute it.

Changes invalidate earlier candidates. If no candidate meets the configured constraints, the app says so. This is a geometric evaluation, not a steering recommendation. To use different data, import a complete case or edit the JSON, including actual frame metadata and explicit whole-path covariance provenance. Never relabel units without converting values.
