# Competitor matrix

Official vendor documentation where possible. No marketing adjectives. DelvePath MVP = fully offline Windows field app: where is the bore, where is it headed, relation to target/path.

| Topic | HawkEye (PDT) | Halliburton COMPASS | Innova Well Seeker X | DGI WellArchitect | Aziwell NAVIGATOR | Micromine DH |
|---|---|---|---|---|---|---|
| **Sources** | Site + May 2022 FC user manual | Halliburton product / EDM pages | Official Innova docs | Product pages only | Aziwell articles; no public manual | Official webhelp |
| **Target users** | DD companies, field DDs, well planners | Operators + DD contractors; EDM asset teams | Operators, well-engineering, DD contractors | Office + wellsite (with Baker Hughes) | Mineral exploration, geotech, civil | Mine geologists / surveyors inside a geology suite |
| **Survey entry / management** | Survey list/editor; CSV, SAY, Compass transfer; 5 min autosave; interpolate MD/TVD | “Survey data management”; EDM single entry; Survey Sharing | Tree to Planned/Actual; paste Excel/txt; Actual listing uneditable; IPM per interval | Actual Wellpath Editor; **OPEN** formats | “Manage survey data”; **OPEN** editor/formats | Collar + Survey + Interval + Event; survey overrides collar |
| **Planning** | Template 2D S/slant/KOP/horizontal; Field Mode last projection only editable | Trajectory optimization (cost/T&D/AC); infill sidetrack recommend | Dogleg-TF, build-and-turn, optimum align, one-click S/slant; thread targets | Basic/advanced planning; return-to-plan; flexible course lengths | Design/optimize; natural deviation; DCD to specified inc/azi | Vizex patterns (spacing, azi, inc, depth) |
| **Projections** | Field Mode: Bit/Compound, MD, TVD, Nudge, Multi-Nudge, Horizontal, Slant, Aligned, BOT | “Projecting ahead” for AC; **OPEN** named types | Projection to bit; advisory; principal-plan live offsets | Multi-segment look-ahead; mini project-ahead | **OPEN** in software; DCD plan states DLS + TF | Tracker pierce; **OPEN** oilfield-style projectors |
| **Plan vs actual** | Letter/A4 PvA; V/H/VH/TC | Look-ahead from RT surveys; Survey Sharing | Principal-plan UD/LR / distance-to-plan; wall-plot PDF needs internet + license | 2D/3D interactive vs plan | Implied by progress reports; **OPEN** UI | Drillhole Tracker (drift/lift/over-distance) |
| **Targets** | Cylinder/cube/polygon/circle/ellipse/square/ellipsoid/point; target planes; lease lines | Steer to pay; official page thin | 2D circle/ellipse/rect; 3D polygon; drillers target from error model | Geologic vs eroded driller’s targets | Multiple targets / master hole / tunnel / freeze curtain | Pattern-to-polygon; wireframe pierce |
| **2-D / 3-D** | 3D, VS, top, proximity, ladder | Spider, ladder, 3D proximity, TC | Plan, section, 3D, spider, WPC | 3D + Graphic Editor wall maps | 3D viz; **OPEN** 2D products | Vizex traces |
| **Reports** | Survey, critical points, least distance, interpolate, criticality, AC, magnetics | Hard-copy + AC plots | Survey, geographic, AC, EOU; separate daily package | Wellpath / clearance | Drill reports; QA/QC **OPEN** contents | Validation + Tracker reports |
| **Geodetics** | Groups/systems/zones/datums; “None”=local; IGRF/WMM; BGGM licensed | Case study true→grid; EDM units; **OPEN** CRS UI | CRS at Field; user-addable; WMM/IGRF; BGGM licensed | **OPEN** | Magnetic vs gyro described; **OPEN** CRS | East/North/Z; mag↔grid azi correction |
| **Positional uncertainty** | `.IPM`; ISCWSA templates; 3D ellipsoids | IPMs; EOU | ISCWSA MWD/gyro; custom IPM; claim <0.1% vs standard paths | ISCWSA rev 5; target erosion | **OPEN** | Not in DH pages (data-quality validation only) |
| **Anti-collision** | C2C, SF, EOU, proximity, ladder, **travelling cylinder** Quick Plot TC | Custom scans; email alerts; spider/ladder/3D/TC | WPTS SF, MASD, TC, ladder, RT AC | ACR/MASD tubes; 3D scans; TC | Collision mentioned as a reason to survey; **OPEN** engine | **OPEN** / not in fetched DH pages |
| **Multi-well / branch** | Field→Structure→Slot→curves; sidetrack tie-in | Sidetrack recommend; **OPEN** multilateral editor | Unlimited tree; Create Sidetrack | Sidetrack, multilateral, re-entry | Motherhole + branches; “virtually no limits” | Many holes; wedges = separate holes |
| **Geology** | Lithology VS background; seismic **OPEN** | OpenWorks; rock properties | Lithology; StarSteer geosteering | Optional earth/reservoir models | 3D earth model in narrative | Interval/event — **out of DelvePath scope** |
| **Field / offline vs cloud** | Local `.HawkEye.mdf`/`.mdb`; optional central SQL | EDM shared DB; field-offline **OPEN** | Local `.mdb` + SQL Server + Vantage cloud; some features need internet | Office↔wellsite transfer **OPEN** | **OPEN** | Desktop DHDB; Nexus cloud upload |
| **Real-time** | Site “RT Dataflow” mechanism **OPEN** | Look-ahead from RT surveys | WITS/WITSML; DD Dashboard; RT AC | Alerts / ahead-of-bit; WITS **OPEN** | DCD parameter monitoring; NAVIGATOR live feed **OPEN** | **OPEN** |
| **UX strength** | Field Mode projections + 3D + proximity on one screen | Shared EDM object | Instant plan/survey; principal-plan columns; local .mdb | Plan vs actual + AC + geology in one 3D scene | Mining DCD vocabulary; natural deviation | Collar/survey/interval interchange + validation |
| **Friction** | Field vs Planning vs Work vs Proposal; no Undo; geodetics crash warning | Enterprise breadth; IPM burden | 8-level tree; DB-wide units; PvA templates need network | Geo-data central to the story | No public spec | Same word “inclination” means from-horizontal |
| **Lessons for DelvePath** | Split Field vs Planning; bit projection; letter PvA; local file DB | Look-ahead from latest surveys — do **not** match breadth | Keep principal plan + UD/LR; instant well; **min-curvature ≠ planner** | Ahead-of-bit next to actual editor; no earth models in MVP | Motherhole + DLS-limited curve; convention flag | Collar+Survey interchange; validate sort/depth; do not become a modeller |
| **OUT OF MVP** | ISCWSA, AC, TC, T&D, magnetics models, wall plots, SQL central, lithology | Entire COMPASS/EDM/OpenWorks stack | AC/EOU, WPC/server templates, Vantage/WITS, geosteering, licensed mag | Earth models, ISCWSA rev 5, ACR/MASD, wall-map editor | Natural-deviation engine, multi-branch campaigns, earth models | Geology, assays, Vizex patterns, Nexus |

## Innova minimum-curvature planning limitation (required)

Source: https://docs.innova-drilling.com/introduction/technical-notes/low-priority/well-seeker-x-u-zontal-well-plans-minimum-curvature-limitation

A mathematically valid min-curvature interpolation is **not** an adequate well-plan construction method for every designed trajectory. Failure case: exactly 180° azimuth change on one plan row (ADJ_MD). Result is a valid min-curvature arc, not the planner’s intended flat turn.

**Keep survey reconstruction and planned-trajectory generation architecturally distinct.**

## Mining convention collision

Aziwell public surveying page uses oilfield inclination-from-vertical. Micromine uses inclination-from-horizontal (−90 down). See `SURVEY_CONVENTIONS.md`. **BLOCKER** for a single silent converter.
