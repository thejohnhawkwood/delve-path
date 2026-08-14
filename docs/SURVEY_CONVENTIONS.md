# Survey conventions

**Rule:** do not invent a conversion. Uncertainty is a BLOCKER / OPEN QUESTION.

DelvePath must store an **explicit convention flag** on every hole/job. Silent auto-conversion is forbidden.

---

## 1. Conventional oilfield inclination-from-vertical

**Canonical internal candidate for DelvePath survey math.**

| Quantity | Convention | Source |
|---|---|---|
| Inclination | Measured **up from vertical**. 0° = vertical down. 90° = horizontal. >90° = drilling up. | ISCWSA *Introduction to Wellbore Positioning* V09.10.17 Ch. 5/7: “Inclination is measured up from vertical.” Aziwell surveying article uses the same oilfield wording. |
| Azimuth | 0–360° clockwise from a **stated** north (true, grid, or magnetic). | ISCWSA ebook Ch. 3–4; API RP 78 DSR draft (`AZIM-T` / `AZIM-G`). |
| MD | Along-hole depth from a stated surface reference (RKB / KB / GL). | ISCWSA ebook; AER template; WinSERVE reports. |
| TVD | Derived vertical depth from the calculation method (WinSERVE goldens: Minimum Curvature). | Filed WinSERVE reports; ISCWSA ebook Ch. 7. |
| N/S, E/W | Local +N / −S and +E / −W from a stated origin (WinSERVE goldens: wellhead). | WinSERVE printed reports; DSR `+N/-S`, `+E/-W`. |
| Vertical section | Displacement in a user-stated **vertical section plane** (azimuth). Independent of N/E/TVD. | WinSERVE: “Vertical Section Plane” + “Referenced to Wellhead.” DSR: VS based on a VS azimuth. |
| DLS | Dogleg severity in ° per course-length unit (WinSERVE prints Deg/100). | WinSERVE reports; DSR °/100 ft. |

All transcribed WinSERVE goldens in this repository use this oilfield inclination convention (INC 0° near vertical; 90° horizontal; 9461 exceeds 90°).

---

## 2. WinSERVE mining reporting convention

**Sourced (WSdoc p. 40, Survey Report Designer):**

> Typically ‘directional’, but mining applications consider a vertical inclination to be “90” and horizontal to be “0” degrees. The data is transposed **for the purposes of the report**.

That is a **report-output switch**, not a described change to stored INC, plots, or the calculation method. The rest of WSdoc treats inclination as oilfield-from-vertical (0 = vertical, 90 = horizontal; Inc>90 = less TVD on the traveling-cylinder page).

**Still OPEN (do not invent):**

- Exact map when oilfield INC > 90°
- Whether azimuth is altered on the print
- Whether any plot or projection ever sees mining INC
- Micromine-style signed dip (−90 vertical down) — a different convention; not this switch

**Do not implement a mining import converter from this paragraph.** Need a mining-mode print paired with the same `.SVY`, or Brett’s convention, before any import profile. A future report-only “90 − I” column is a product decision, not MVP.

---

## 3. Directional-core-drilling / mining documentation

Sources agree there are **two poles**, and disagree on the word “dip.”

| Source | Hole-angle convention | Notes |
|---|---|---|
| Micromine geometry + collar file | Inclination **from horizontal**, **−90° vertical down**, 0° horizontal, **+90° vertical up** | Official webhelp. Vertical example: azi 0, inc **−90°**. Geological **dip** is a different field (unsigned 0–90° down). |
| Coring Magazine (Lyomov) | Distinguishes oilfield inclination-from-vertical from diamond-drilling logs that denote vertical as **−90°** and horizontal as **0°** | Literature, not a vendor spec. States dip + oilfield inclination = 90°. |
| Aziwell “What is borehole surveying” | Inclination = angle relative to the **vertical** axis; inclinometers “measure inclination **(dip)**” | Oilfield wording on a mining vendor page. Term collision. |
| Aziwell DCD process | Uses inclination, azimuth, DLS (°/30 m preferred over separate build/turn) | Field plan: target **or** required inc/azi, DCB depth, toolface, DLS. Motherhole → KOP → DCB → often resume conventional. |

Micromine desurvey is documented as linear interpolation of azi/inc on spherical arcs, then a display polyline. That is **not** stated as oilfield minimum curvature. **OPEN** whether internally equivalent.

**No complete, sourced conversion table exists** that maps every mining CSV into oilfield INC with a single sign rule.

---

## 4. DelvePath proposed canonical internal convention

**Proposal (not implemented in this pass):**

1. **Internal survey engine** uses oilfield inclination-from-vertical (ISCWSA), azimuth 0–360 from a stored north-reference enum (`true` / `grid` / `magnetic` / `unknown`), MD/TVD/N/E in explicit units.
2. **Every import** requires a convention flag. If absent, refuse the import.
3. **Mining-from-horizontal signed inclination** (Micromine-style) is an import/export profile only, and only after a sourced conversion is confirmed.
4. **WinSERVE mining report mode** is a report-output profile (WSdoc p. 40). Not an import converter. Not in MVP.
5. Declination and grid correction are stored as metadata. WinSERVE INFO fields are informational only; surveys are entered already corrected. Do not auto-apply corrections unless the user explicitly asks and the north-reference math is sourced (ISCWSA ebook warns that software signs for convergence disagree).

Until Brett’s convention is known, treat his data as **untyped**.

---

## 5. Vertical section

WinSERVE goldens print a **Vertical Section Plane** in degrees and “Referenced to Wellhead.”

Industry-common formula (N cos θ + E sin θ) is **not printed** on the reports and is **not proven** as WinSERVE’s formula. Level-1 synthetic “VSP independence” tests N/E/TVD invariance; VS change must be validated against a golden, not assumed.

Oregon VSP = 165.30°. NM 9461 VSP = 86.10°. NM 29320 VSP = 288.15°. NM 32380 VSP = 90.00°.
