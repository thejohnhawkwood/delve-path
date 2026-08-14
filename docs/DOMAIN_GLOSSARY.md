# Domain glossary

Terms are **not interchangeable** unless a cited source equates them. WinSERVE-only names are marked.

| Term | Meaning | Source | Do not collapse with |
|---|---|---|---|
| **MD** | Measured depth. Along-hole depth from a stated surface reference. | ISCWSA ebook; AER; WinSERVE reports | TVD |
| **TVD** | True vertical depth. Derived from INC/AZI and a calculation method. DSR: from ZMDE. | ISCWSA ebook Ch. 7; DSR; WinSERVE | TVDSS / subsea |
| **INC** | Inclination. ISCWSA/oilfield: measured **up from vertical**. | ISCWSA ebook; Aziwell surveying | Micromine “inclination” (from horizontal); geologic dip |
| **AZI** / **Drift Direction** | Direction vs a **stated** north. WinSERVE reports label the column Drift Direction. | ISCWSA ebook; WinSERVE goldens | True ≠ grid ≠ magnetic |
| **N/S** | Local north(+) / south(−) displacement from a stated origin. | DSR `+N/-S`; WinSERVE | Map northing without stating origin |
| **E/W** | Local east(+) / west(−) displacement. | DSR `+E/-W`; WinSERVE | Map easting without stating origin |
| **Closure distance** | DSR: “total displacement” / origin to closure-distance point. Printed on some WinSERVE reports. | DSR; NM 9461 / 32380 reports | Vertical section |
| **Closure azimuth** | DSR: “origin to closure distance point.” WinSERVE: CLOSURE Direction. | DSR; WinSERVE | VS plane |
| **Vertical section (VS)** | Displacement along a stated vertical-section azimuth/plane. | DSR; WinSERVE “Vertical Section Plane” | Closure |
| **VSP** | Vertical section plane (azimuth, degrees). Term used on WinSERVE reports and in this repo. | WinSERVE printed reports | Not found as “VSP” in ISCWSA ebook extract |
| **DLS** | Dogleg severity. Curvature in ° per unit course length. WinSERVE: Deg/100. | ISCWSA/Aklestad; DSR; WinSERVE | Build rate; AER “DLS” legal location |
| **Build rate** | Change of inclination with depth. DSR: +build / −drop °/100 ft. | DSR | DLS |
| **Walk / turn rate** | Change of azimuth with depth. DSR: +right / −left, parenthetically **Walk Rate**. | DSR (only that parenthesis equates them) | DLS |
| **Toolface (TFO)** | Magnetic (azimuth) toolface vs high-side (gravity) toolface. Most MWD switch ~3–8° INC. WinSERVE Ouija uses TFO. | ISCWSA ebook; WS1-Lessons | Two different angles |
| **KOP** | Kick-off point / depth where directional work begins. S3: “KOP is not a target.” This increment uses the **selected measured station** as kick-off; it does not interpolate a new station at an arbitrary MD. | WS1-Lessons / S3; DSR/AER usage | Target |
| **BHL** | Bottom-hole location. WinSERVE: LOCATION SENSOR vs BHL; projected bit station. | WS1-Lessons; plats | Last sensor survey |
| **Bit-to-sensor** | Along-hole offset from bit to survey sensor. WinSERVE uses it to project BHL. | WS1-Lessons; Well Intercept ebook | Course length |
| **Tie-in / tie-on** | Starting station of a curve (MD/INC/AZI plus TVD/N/E). DSR: last **accepted** station, not a projection. Related but **not proven identical** to header “tie-in-point.” | WS1-Lessons; DSR | Projection |
| **Hold section** | Interval of approximately constant inclination (and often azimuth). | Industry usage; Innova “Hold to CL/MD/TVD/VS” | Tangent (often used similarly; not formally equated here) |
| **Tangent** | Typically a hold between curves. No equation in fetched standards. | WS1-Lessons / planning usage | Hold (not proven identical) |
| **Entry angle** | **NOT FOUND** as a defined term in fetched ISCWSA/AER/DSR text. | — | Incidence / intersection angle |
| **Target** | Geometric objective (WinSERVE: circle/square/rect, polar or rectangular). Also “target well” in intercept literature. Polysemous. | WS1-Lessons; Well Intercept ebook | KOP; geologic dip target |
| **Collar** | Mining: hole origin (East/North/Z, Hole ID, total depth). Oilfield “drill collar” is a BHA component — different word. | Micromine collar file | Drill collar / NMDC |
| **Survey station** | Point of a directional measurement (MD/INC/AZI). | ISCWSA ebook; DSR | Leg; survey program |
| **Workcurve** | WinSERVE: designated as-drilled curve; projections start from it and do not alter it. Default curve 0. | WS1-Lessons | Proposal |
| **Proposal / plan** | WinSERVE: designated well-plan curve, commonly curve 1. Curve type tag `1=proposal` in S3. | WS1-Lessons; S3 | Actual / workcurve |
| **Plan vs actual** | Planned trajectory compared with as-drilled surveys. | DSR EOW graphs; HawkEye/Innova PvA | — |
| **True north** | Toward the Geographic North Pole; independent of datum. | ISCWSA ebook Ch. 3 | Grid; magnetic |
| **Grid north** | Projection / map north. | ISCWSA ebook Ch. 3 | True; magnetic |
| **Magnetic north** | Direction of the magnetic field horizontal component. | ISCWSA ebook Ch. 4 | True; grid |
| **Declination** | Ebook: “the True Direction of Magnetic North.” Time- and location-dependent. WinSERVE INFO: informational only. | ISCWSA ebook; WS1-Lessons | Convergence |
| **Convergence** | Angle from True to Grid. Ebook: `Grid azimuth = True − Convergence`, with a warning that software signs disagree. | ISCWSA ebook | Declination |
| **Uncertainty** | Modelled measurement uncertainty (EOU/covariance). Not gross blunders. | ISCWSA ebook Ch. 16–19; Error Model Rev 5 | Gross error |
| **Traveling cylinder** | Polar plot of offset position in a plane **normal to the reference/subject** well. | Well Intercept ebook; WS1-Lessons report flag; HawkEye Quick Plot TC | 3D least distance |
| **Least distance** | WinSERVE: TRUE MINIMUM DISTANCE (manual spelling “MIMIMUM”) between curves. Intercept ebook: 3D least distance is normal to the **target**, distinct from TC distance. | WS1-Lessons; Well Intercept ebook | TC distance |
| **Parent wellbore** | DSR: the wellbore a sidetrack originates from. DelvePath: a hole with `parent_hole_id` unset. | API RP 78 DSR | Mining “mother hole” (related, not proven identical) |
| **Sidetrack** | New borehole from a parent. DSR: last accepted station above kick-off as tie-on; interpolated min-curvature station at kick-off labelled kick-off. WinSERVE: interpolate + MAKE TIE-IN POINT + copy/append curves. This increment: selected measured station as KOP; no new interpolation solver. | WS1-Lessons; DSR | WISC organizational “branch” |
| **Lateral** | Informal for a sidetrack hole that holds near horizontal after a landing. Stored as a separate hole from the parent wellbore. | Industry / ND DMR “leg 1” filing | DSR “sidetrack” (related; DSR is the sourced legal term) |
| **Mother hole / branch** | Mining DCD: conventional motherhole, then kick-off / branch. Micromine: wedges are **separate holes**. Do not use these as if they were DSR language. | Aziwell DCD; Micromine | DSR “parent wellbore” (related, not proven identical) |
| **Curve 21–29** | WinSERVE reserved projection placeholders. 21 = sequential form projections; 23 = graphical copy; 28 = min-curvature projection; 29 = DLS projection. Overwritten. | WS1-Lessons | User curves 0–20 |
| **Ouija Board** | WinSERVE projection tool: solve MD (added MD, DLS, TFO) or solve DLS (DLS, final INC, final AZ). | WS1-Lessons | Generic industry Ouija (not proven identical) |
| **.SVY** | WinSERVE job file (DOS 8.3 name). Holds all curves. | WS1-Lessons | .SAY |
| **.SAY** | WinSERVE single-curve export/import. | WS1-Lessons | .SVY |
