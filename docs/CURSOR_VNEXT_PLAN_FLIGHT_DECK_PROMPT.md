# Cursor implementation prompt — DelvePath v0.2 “Plan & Flight Deck”

You are the senior implementation agent responsible for evolving the existing DelvePath 0.1.1 engineering prototype into a coherent, tested v0.2 release.

This is an implementation task, not a design exercise. Inspect the actual repository, preserve the validated survey engine, make a short execution plan, then implement and verify the release. Continue autonomously through safe local work. Do not stop at scaffolding, a mock UI, or a prose proposal.

Repository:

`C:\Users\Papa\Desktop\delve-path`

## Mission

Build the first open-source DelvePath release that answers all of these practical questions in one offline workspace:

1. Where does the latest accepted survey calculate the sensor to be, with its review state and uncertainty still explicit?
2. Where is the bit estimated to be now?
3. What candidate paths can reach the defined target within the user-entered geometric and operating constraints?
4. How do actual, plan, and user-authored next-stand scenarios differ?
5. What is the closest centerline approach to another wellpath?
6. Which depth datum and depth-correlation assumptions produced a reported zone depth?
7. What can be handed to the next shift or an engineer in a reproducible report?

The release must implement the requested fundamentals:

- More forward-projection methods, including DLS/toolface.
- A real planning workspace with at least four target-profile constructors and parameters editable directly in its main table.
- Circle, rotated rectangle, and multipoint polygon targets rendered as their real shapes in Plan, Profile, and 3-D.
- Basic survey and planning reports.
- Center-to-center wellpath screening, with uncertainty-aware work explicitly separated.
- Explicit MDRKB, MDRT, TVD datum, TVDSS/elevation, and wireline-depth handling.
- Ellipsoid-of-uncertainty ingestion and rendering, with an honest optional boundary for the Geocertainty API.

The signature feature—the thing that makes this more than another survey viewer or spreadsheet ouija board—is the **Next-Stand Flight Deck + BHA Memory**:

> Separate ACCEPTED SURVEY, ESTIMATED BIT, and SCENARIO paths; let a directional driller build one- or two-stand slide/rotate scenarios; score each prediction against the next held-out accepted survey; and retain an inspectable history of what this exact BHA configuration was assumed to do versus what it actually did.

Do not implement a mobile app.

## Why this product slice

Commercial products already combine planning, project-ahead, target analysis, and collision tooling. DelvePath must not claim that category is new. Its credible wedge is different:

- completely offline and local-first by default;
- transparent, independently derived calculations;
- no opaque recommendation engine;
- clear separation of measured, calculated, projected, estimated, planned, and scenario data;
- prediction-versus-actual replay;
- portable BHA behavior history and assumption ledger;
- open fixtures and reproducible tests.

The memorable demo moment is:

> “The last accepted survey calculated the sensor here; the drilling record estimates the bit here; these were the scenarios considered; and the unseen next survey scored which assumptions were closest.”

## Protect the user’s work first

Before editing:

1. Read `git status --short --branch`.
2. Treat every existing modification and untracked file as user-owned.
3. In particular, preserve these known untracked items:
   - `assets/`
   - `docs/CURSOR_GROK_WEB_BUILD_PROMPT.md`
   - `scripts/generate_wordmark.py`
4. Do not reset, discard, overwrite, relocate, clean, or reformat unrelated work.
5. Do not rewrite history, push, publish, deploy, upload well data, change repository visibility, or alter external accounts.
6. Do not send data to Geocertainty or any other service while developing unless an explicit test token is present and the user separately authorizes the actual transmission.

Record the baseline before changes. At the time this prompt was written, the audited tree passed:

- 36 Rust tests across core, goldens, storage, and WASM;
- 19 Vitest tests;
- 4 Playwright tests;
- the production TypeScript/Vite build.

Plotly is already roughly 4.67 MB minified. Do not add a second plotting library.

## Read completely before editing

At minimum, read:

- `README.md`
- `package.json`
- `Cargo.toml`
- `.github/workflows/ci.yml`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/CALCULATION_SPEC.md`
- `docs/DATA_MODEL.md`
- `docs/SURVEY_CONVENTIONS.md`
- `docs/OFFLINE_REQUIREMENTS.md`
- `docs/TEST_PLAN.md`
- `docs/GOLDEN_DATA_CATALOG.md`
- `docs/WINSERVE_DEEP_DIVE.md`
- `research/winserve/WSDOC_NOTES.md`
- `research/standards/ISCWSA_AER_RESEARCH_HANDOFF.md`
- `src/App.tsx`
- `src/domain.ts`
- `src/records.ts`
- `src/Charts.tsx`
- `src/SurveyGrid.tsx`
- `src/report.ts`
- `src/csv.ts`
- `src/platform/types.ts`
- `src/platform/snapshot.ts`
- `src/platform/browser/idb.ts`
- `src/platform/browser/calc.ts`
- `src/platform/tauri/calc.ts`
- `crates/delve-core/src/types.rs`
- `crates/delve-core/src/min_curvature.rs`
- `crates/delve-core/src/validate.rs`
- `crates/delve-core/tests/synthetic.rs`
- `crates/delve-core/tests/golden.rs`
- `crates/delve-storage/src/lib.rs`
- `crates/delve-wasm/src/lib.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/tauri.conf.json`
- `netlify.toml`

Do not assume the documentation reflects the implemented schema. The actual database currently has projects, holes, stations, and point targets only. There are no actual plan, projection, covariance, clearance, BHA, or depth-datum tables. `StationClass::Planned` exists but is not a usable persisted planning model.

## Existing architecture to preserve

The current split is sound:

```text
React / TypeScript UI
        │
        ▼
typed platform services
   ├── Tauri IPC + SQLite
   └── WASM + IndexedDB
        │
        ▼
pure Rust calculation code
```

Keep these invariants:

- `delve-core` remains pure Rust and remains the validated survey-reconstruction engine.
- React, Tauri, SQLite, IndexedDB, Plotly, browser globals, and networking do not enter pure math crates.
- Desktop and browser use the same Rust math through Tauri/WASM adapters.
- Do not create a second TypeScript implementation of trajectory, planning, projection, clearance, or covariance mathematics.
- Calculated positions are derived; raw measurements are never silently overwritten.
- Production desktop operation remains fully offline.

Add clean pure-Rust boundaries rather than turning `delve-core` into a catch-all:

```text
crates/delve-core         validated survey reconstruction + reusable interval evaluator
crates/delve-planning     forward projections, plan sections, profile solvers, Flight Deck geometry
crates/delve-assurance    target geometry, depth transforms, centerline scan, covariance geometry
```

If a smaller boundary is demonstrably cleaner after inspection, document the decision, but keep survey reconstruction, planning, and assurance concepts separated.

The current `src/App.tsx` is about 1,923 lines. Refactor it incrementally before adding several more workspaces. Preserve behavior while extracting cohesive feature modules. The current chart tab called `"plan"` means **plan view**, not well planning; rename that internal concept to `planView` or equivalent to prevent collisions with the new planning domain.

## Non-negotiable terminology and safety contract

Keep this notice visible in the workspace and on every report:

> Engineering prototype / evaluation software — not certified. Not regulator-approved. Not for collision avoidance, well control, or steering decisions.

Additional rules:

- Never label a candidate path “recommended,” “safe,” “approved,” or “execute.” Use **scenario**, **candidate**, **user-selected**, **estimated**, and **screening**.
- Never call centerline separation an anti-collision clearance result, separation factor, MASD, or probability of collision.
- Never show green/red “safe/unsafe” semantics. Say **above configured centerline threshold** or **below configured centerline threshold**.
- Never combine a BHA response envelope with an ellipsoid of positional uncertainty. They represent different things.
- `ACCEPTED SURVEY` means user-reviewed MD/INC/AZI feeding a calculated sensor position. It does not mean exact, uncertainty-free, regulator-approved, or independently certified.
- Never present imported covariance or a Geocertainty response as DelvePath-certified ISCWSA compliance.
- Never describe a derived wireline mapping as a simple datum conversion unless it is explicitly a constant-offset mapping selected by the user.
- Every result must carry method, unit, north reference, horizontal origin, vertical datum, source/provenance, and validation state where applicable.
- Continue to use `WORKING`, `VALIDATED`, `NOT YET VALIDATED`, and `SYNTHETIC / constructed` accurately.

## Implementation order

Work in vertical slices and keep the application runnable after each slice.

Use hard quality gates so the signature feature cannot be diluted into eight sets of scaffolding:

1. **Signature gate:** complete Slices 0–4, the Flight Deck Shift Card model/preview, and the timed held-out-survey demo end-to-end. All associated Rust, adapter, migration, UI, and E2E tests must pass before beginning Slice 5.
2. **Field-fundamentals gate:** complete Slices 5–7 with their reports and parity tests.
3. **Uncertainty gate:** complete Slice 8 offline import/rendering; keep the live Geocertainty call separately gated as described below.

If context or time is constrained, stop only at a passing gate and report the unimplemented later gate plainly. Never substitute mock cards, unconnected tabs, or hard-coded demo answers for a completed gate.

### Slice 0 — Baseline and correctness prerequisites

1. Run and record the existing Rust, UI, E2E, license, SBOM, bundle, and build checks.
2. Add a project/hole coordinate-frame model sufficient to prove whether two paths are comparable:
   - length unit;
   - local N/E origin identifier and offsets;
   - north reference;
   - vertical datum;
   - optional CRS/EPSG metadata without performing geodetic transformations.
3. Fix the current Units control. It currently reinterprets existing numbers instead of converting them. A unit change must either:
   - atomically convert every affected raw length, tie-in, target, plan input, BHA length, threshold, datum, and covariance unit; or
   - be blocked once data exist with a clear action to create/convert a copy.

Silent relabelling is forbidden. Add regression tests before any depth or clearance work.

4. Add a persisted station review state: `unreviewed | accepted | excluded`, plus reviewer/source, review timestamp, and exclusion reason. Existing stations migrate to `unreviewed`; do not silently declare old rows accepted. Survey reconstruction may still display unreviewed rows with an unmistakable state, but Flight Deck anchors and forecast scoring require an explicitly accepted station. Provide a deliberate bulk-review workflow rather than weakening that rule.

### Slice 1 — Shared trajectory primitives and forward projections

Preserve `calculate_trajectory()` and all existing golden results. Add an arbitrary-MD minimum-curvature interval evaluator and a generic typed projection API.

Required forward projection methods:

1. **Hold INC/AZI** — existing straight-line behavior, retained exactly.
2. **Constant DLS + gravity toolface** over a specified added MD or to a supported end constraint, with gravity toolface held in the *evolving* local high-side/right frame.
3. **Constant build rate + azimuth-turn rate** over added MD. Here `B = dINC/dMD` and `T = dAZI/dMD`; persist their angle/reference-length units. This is not generally a constant-DLS path because its instantaneous curvature is `sqrt(B² + (T sin I)²)`.
4. **Recent accepted-survey trend** — an explicitly documented least-squares fit over a user-selected 2–5-station window, not an imitation of WinSERVE’s undocumented BHL “trend of last two surveys.”
5. **Ordered slide/rotate segments** for the Flight Deck, using user-entered slide yield and rotary tendency.

The method selector must show required inputs, method assumptions, and applicability. Projected points remain `PROJECTED` or `ESTIMATED`; they can never be saved as measured stations.

#### DLS/toolface convention

For gravity toolface:

- 0° = build;
- 90° = turn right;
- 180° = drop;
- 270° = turn left.

Use a local tangent/high-side/right basis. The following is a suitable independently derived **local step**, evaluated from the current attitude:

```text
t = (sin I cos A, sin I sin A, cos I)
h = (cos I cos A, cos I sin A, -sin I)   // high side
r = (-sin A, cos A, 0)                   // right side
u = cos(TF) h + sin(TF) r
κ = DLS in radians per unit MD

β = κ ds
t_next = cos(β)t + sin(β)u
Δx = (sin β / κ)t + ((1 - cos β) / κ)u
```

This equation is not a one-shot closed-form solution for constant gravity toolface over the whole interval. During true constant-gravity-TF propagation, recompute `h`, `r`, and `u` from the evolving attitude and integrate the resulting vector/quaternion ODE with a convergence-controlled method. Its attitude equations provide an independent test oracle:

```text
dp/ds = t
dI/ds = κ cos(TF)
dA/ds = κ sin(TF) / sin(I)
```

Use the tangent limit as `κ → 0`, normalize defensively, and wrap azimuth. Bound/adapt steps by both MD and angular change and prove step-halving convergence.

Also expose a distinct **fixed initial dogleg-plane TF** primitive because it has a useful analytic circular-arc solution. In that mode only, freeze `u0` at the start and, for `θ = κs`, use:

```text
t(s)  = cos(θ)t0 + sin(θ)u0
Δp(s) = (sin(θ)/κ)t0 + ((1 - cos(θ))/κ)u0
```

Name these two modes unambiguously in types, UI, exports, and tests. Never label a frozen initial dogleg plane as constant gravity toolface. Confirm both implementations against an independent derivation/reference and synthetic invariants; do not treat this equation block alone as a sufficient validation source.

Gravity toolface is singular wherever `|sin(I)| ≤ ε`, near both 0° and 180°. Apply the conservative configurable threshold throughout propagation, not just at the start; use event detection to stop before a step crosses the singular region. Return a blocking typed issue and require a separately sourced magnetic-toolface or steering-azimuth mode rather than guessing. A fixed-dogleg-plane path that starts at a singular attitude requires an explicit steering/dogleg-plane azimuth; it cannot derive `u0` from undefined high-side/AZI.

For recent-trend projection:

- unwrap azimuth before fitting;
- expose the fitted build and turn rates and residuals;
- reject insufficient, duplicated, non-monotonic, mixed-BHA, or near-vertical input;
- label it `Recent trend (least-squares)`;
- do not call it WinSERVE BHL.

### Slice 2 — Real planning engine and editable plan table

Create a separate persisted plan model. Do not store plan sections or plan stations in the measured-station table.

At minimum:

```text
Plan
  id, hole_id, name, revision, status(draft|active|archived), target_id,
  start/tie-in reference, method, station_interval,
  default UD/LR corridor tolerances, notes, timestamps

PlanSection
  id, plan_id, seq, discriminated section kind, locked inputs,
  optional section UD/LR corridor overrides,
  solve-for parameter, solved outputs, source/provenance
```

Use a versioned, typed Rust/Serde representation for section parameters. Persist source inputs and solved parameters, not just a dense list of coordinates. Derived plan stations may be cached but must be reproducible.

Implement a main planning table with columns similar to:

```text
Seq | Section | End constraint | ΔMD / End MD | End TVD | INC | AZI |
DLS | TF | Build | Turn | Solve/Lock | Residual / Status
```

Users must be able to edit applicable inputs directly in this table. Recompute downstream sections and all plots on edit. Clearly distinguish:

- entered/locked values;
- solved values;
- calculated station outputs;
- infeasible constraints.

Never emit `NaN`, enormous sentinel coordinates, or a visually plausible partial plan for an infeasible solve. Return a typed result containing status, residuals, active constraints, and a useful failure reason.

Define plan-relative offsets at the same MD using the active plan’s evolving local frame. Persist and display the exact convention: `UP/DOWN` is signed along the plan high-side axis and `LEFT/RIGHT` is signed along the plan right axis, with positive labels declared in the UI/report. At endpoints or singular attitudes, use a documented transported-frame fallback or return a typed issue; never infer signs from the current 2-D view. A scenario is inside the plan corridor only when it satisfies the applicable persisted section/default UD and LR tolerances.

#### Required profile constructors

Implement at least these four real constructors, plus manual section composition:

1. **2-D J / slant profile**
   - tie-in or KOP;
   - constant-DLS build/drop;
   - tangent/hold to a target center or target plane;
   - solve one selected value such as KOP, DLS, hold angle, or tangent length.

2. **2-D S profile**
   - build, tangent, drop, optional post-hold;
   - specified entry inclination;
   - independently editable DLS1/DLS2 or a locked-equal option;
   - solve a selected parameter with feasibility checks.

3. **2-D horizontal / double-build landing profile**
   - generalized signed double-curve geometry;
   - land at specified inclination (commonly but not hard-coded to 90°), direction, and target/corridor;
   - support build–hold–build and clearly report when no tangent section exists.

4. **3-D curve + hold to target**
   - arbitrary valid tie-in INC/AZI/N/E/TVD;
   - explicitly selected constant-gravity-TF integration or fixed-initial-dogleg-plane curve followed by hold;
   - solve DLS, toolface, curve length, and/or hold length under an explicit lock/solve contract;
   - report miss vector, entry attitude, total MD, and max DLS.

5. **Manual section plan**
   - Hold;
   - build/drop to inclination;
   - build/turn or DLS/toolface to MD/TVD/attitude where mathematically supported;
   - target/formation marker rows.

Use the verified WinSERVE manual examples in `docs/GOLDEN_DATA_CATALOG.md` §2.5 and `research/winserve/WSDOC_NOTES.md` as regression oracles for equivalent independently derived 2-D slant/S-well geometry. Do not copy undocumented WinSERVE algorithms or claim bit-identical compatibility.

Important examples include:

- Target TVD 4500 ft, displacement 1000 ft, direction 45°.
- 2-D slant: KOP 650 ft + DLS 3°/100 ft → hold angle about 15.57°.
- 2-D slant: KOP 650 ft + hold 25° → DLS about 0.7448°/100 ft.
- 2-D slant: hold 25° + DLS 3°/100 ft → KOP about 1932.1 ft.
- 2-D S-well: KOP 1000 ft, DLS1 2°/100 ft, DLS2 1.5°/100 ft, entry 7° → hold about 20.431° and tangent about 1741.65 ft.
- The documented impossible 3-D combination must return `Infeasible`, not a corrupted path.

### Slice 3 — Target geometry as first-class engineering data

Replace the point-only target assumption with a target plane plus an explicit in-plane footprint union. A target is not assumed horizontal merely because legacy data contains one TVD:

```text
TargetPlane {
  aimPoint: N/E/TVD,
  orientationInput: Horizontal | NormalVector | DipAndDipAzimuth,
  canonicalWorldFromPlaneTransform,
  thicknessAbove,
  thicknessBelow
}

Footprint (coordinates are local plane u/v):
  Point
  Circle { radius }
  Ellipse { semiMajor, semiMinor, rotationInPlane }
  Rectangle { length, width, rotationInPlane }
  Polygon { ordered [u,v] vertices }
```

Requirements:

- Preserve and migrate every existing point target.
- Legacy N/E/TVD targets migrate to a horizontal target plane with an audit-recorded default; do not invent dip.
- Treat `orientationInput` as source/provenance, then validate and derive one authoritative orthonormal plane transform. Do not persist independently editable `orientation` and `basis` values that can disagree. Use the canonical transform for hit testing, solving, plotting, hover coordinates, and report dimensions.
- Use NEV with TVD/`V` positive down. Define dip `δ` down from horizontal and dip azimuth `α` clockwise from north. One canonical construction is:

  ```text
  u = strike   = (-sin α,       cos α,       0)
  v = downDip  = ( cos δ cos α, cos δ sin α, sin δ)
  n = u × v    = ( sin δ cos α, sin δ sin α, -cos δ)
  ```

  `n` is the above/up-normal; positive signed normal distance is above the plane. `thicknessAbove` extends along `+n`, and `thicknessBelow` along `-n`. For `Horizontal`, use the explicit canonical `α=0` basis rather than an undefined dip azimuth. Normalize a normal-vector input to the same polarity; a vertical plane requires its positive side to be explicit. Define positive footprint rotation algebraically as `uθ = cosθ u + sinθ v`, so it cannot be misread from chart orientation.
- Circle input is explicitly **radius**. If importing a source that uses diameter, convert once and preserve the source field/provenance.
- Polygon requires at least three distinct vertices, closes automatically for rendering, rejects self-intersection, and preserves entered vertex order.
- Display dip, dip azimuth, normal polarity, and in-plane rotation conventions explicitly. Normalize and round-trip the transform rather than letting each chart derive its own.
- Thickness is optional and explicit. No thickness means a planar target, not an infinite prism.
- Provide inside/outside/boundary distance functions in pure shared code.
- For a path, calculate finite curve–target intersection(s), including first entry/exit MD where applicable. If there is no hit, minimize one Euclidean curve-to-finite-target distance and return the paired trajectory point, target point, MD, signed normal distance, signed footprint-boundary distance, and 3-D miss vector. Do not independently minimize normal and in-plane distances and combine unrelated points.
- Define signed footprint-boundary distance as negative inside, zero on the boundary within tolerance, and positive outside. For a zero-thickness plane, distinguish crossing inside the footprint from nearest miss; never treat it as an infinite prism.

Render the true geometry:

- Plan: orthographically project the actual world-space mesh at equal N/E scale. A dipped circle may appear elliptical; do not redraw it as a horizontal circle.
- Profile offers two explicitly labelled representations: **section-plane intersection** of the finite target, which may be empty, and **orthogonal projection** into the vertical-section view. Do not silently substitute one for the other.
- 3-D: render the authoritative plane footprint or extruded volume; a zero-thickness target remains a plane/outline.
- Selection/hover must identify target name, shape, dimensions, datum, and source.

Generate plot-ready geometry from a shared domain layer. Plotly should render it, not define engineering geometry.

### Slice 4 — Next-Stand Flight Deck + BHA Memory

This is required, not a “future idea.” Keep its first release focused and inspectable.

#### Core user flow

1. Select the latest accepted survey station.
2. Select/create the active revision of the exact BHA configuration, including sensor-to-bit distance.
3. Paste or edit the relevant MD-indexed drilling record as ordered slide/rotate segments. It must cover the already-drilled sensor-to-bit blind interval and all subsequent footage through current bit; derive current bit MD from the final segment end.
4. If a separately entered current bit MD disagrees with the segment-derived value, block resolution and show the discrepancy.
5. Show three unmistakable path classes:
   - **ACCEPTED SURVEY** — user-reviewed MD/INC/AZI and calculated sensor position; survey and reconstruction uncertainty still apply.
   - **ESTIMATED** — user-entered BHA/drilling assumptions from sensor to current bit.
   - **SCENARIO** — one- or two-stand forward alternatives authored by the user.
6. Let the user compare at least:
   - hold;
   - DLS/toolface;
   - build/turn;
   - ordered slide/rotate with low/nominal/high user-entered yield.
7. For each scenario show:
   - future bit MD and position;
   - next expected sensor MD and predicted survey INC/AZI;
   - up/down and left/right versus active plan;
   - target/corridor boundary distance;
   - max and average DLS;
   - slide footage;
   - minimum centerline separation if a valid comparable offset is selected;
   - every active assumption and warning.
8. Evaluate stand length, maximum slide per stand, minimum useful slide, maximum allowed DLS/yield, toolface applicability, and plan corridor constraints entered by the user. Say **constraint-feasible under entered assumptions**, never “drillable,” and list every violation directly on the scenario card.
9. Allow a user to pin a scenario to an immutable shift record.
10. When a later accepted survey arrives, first score every frozen forecast at that survey’s **actual MD**, preserving any difference from expected survey MD, and only then update BHA Memory.
11. Preserve the original inputs and residuals; never rewrite history using later knowledge.

Require drilling segments to be contiguous, non-overlapping, ordered, and to cover the full interval from the accepted sensor station MD to current bit MD under an explicit sensor/bit mapping. Never silently fill a gap with hold, rotate, or zero-yield behavior. Show extra/duplicate coverage and missing footage as blocking typed issues.

The expected next sensor location is not the future bit location:

```text
next_sensor_md = future_bit_md - sensor_to_bit_distance
```

Report both.

#### Initial BHA model

Support one motor-BHA run at a time:

```text
BhaRun
  hole, name, configuration revision, start/end MD,
  motor identifier/model, bend setting, bit size, hole size,
  sensor-to-bit distance, optional hole-section/formation tag,
  toolface basis, user low/nominal/high slide yield,
  rotary DLS/toolface tendency, notes, timestamps

DrillingSegment
  BHA, start/end bit MD, mode(slide|rotate),
  target/effective toolface, toolface basis,
  optional WOB/flow/RPM/ROP, source, timestamp

ScenarioSet / ScenarioSegment / ScenarioDecision
  immutable survey, bit, plan-revision, BHA, target, offset-well,
  assumptions, operating constraints, scenario inputs, selected scenario,
  BHA-memory revision/sample IDs frozen at forecast time,
  expected survey MD, actual resolution survey MD, resolution, timestamps
```

Manual/CSV slide-sheet entry is sufficient. Do not add WITS/WITSML live feeds, rig controls, downlinks, automation, or ML.

#### Transparent BHA memory

Start with user-entered low/nominal/high response. Add descriptive observed performance only when the data support it:

- never pool samples across BHA configuration revisions automatically;
- estimate rotary tendency only from qualified rotate-only intervals of the exact configuration;
- for a qualified slide interval, replay the logged sequence with slide yield as the **only fitted unknown**, a fixed/known rotary tendency, and minimize endpoint tangent error;
- require effective toolface, at least 10 ft / 3.048 m of slide footage, exact BHA-configuration match, and endpoint tangent residual no greater than a visible project threshold (initial default 0.5°); exclude missing toolface, mixed-BHA, excessive-residual, or ambiguous multi-toolface intervals;
- show median, robust spread/quantiles, sample count, and fit residual;
- require at least five qualified held-in samples before offering observed response as a scenario input;
- list every included and excluded interval with its qualification result and reason;
- never call the range a confidence interval unless it actually is one.

Render low/nominal/high response as three deterministic traces or endpoint bounds. A 2-D fill between them is allowed only when explicitly labelled:

> BHA response envelope — not positional uncertainty.

Do not render an unlabeled 3-D probability-looking fan. If centerline screening is requested, evaluate each bound separately.

#### Forecast scorecard

Resolve forecasts without data leakage. The next accepted survey is a holdout until **Reveal/resolve**. At its actual MD, score at least:

- hold baseline;
- the user’s original nominal-yield forecast;
- the pre-existing BHA Memory median forecast frozen at decision time;
- each pinned scenario.

Show position residual/3-D miss, INC residual, wrapped AZI residual, expected-versus-actual survey-MD difference, qualified sample count, and rolling held-out performance. Persist the pre-update memory revision and sample IDs. Only after scores are frozen may the new interval be qualified and incorporated; show `n → n+1` and how the next forecast changes. A median recalculated after seeing the answer is not a forecast score.

The defensible asset is the assumption → held-out forecast → actual score → configuration-specific learning → handover record, not a proprietary steering optimizer.

### Slice 5 — Center-to-center screening

Implement a pure, deterministic 3-D closest-approach engine for comparable trajectories.

Do not compare only stations at matching MD, only station endpoints, or Plotly screen coordinates.

A defensible approach is:

1. Use a shared continuous-path interval interface that evaluates position/tangent at arbitrary MD. Measured surveys use minimum-curvature intervals; plan and scenario section types use their own exact or convergence-tested evaluators and certified bounds.
2. Adaptively subdivide every curved interval until its method-specific, documented chord-deviation bound is met.
3. Inflate each chord AABB by that deviation bound; a bare chord AABB does **not** enclose the curved path. Use exact 3-D segment-to-segment distance plus the inflated bounds to locate candidates.
4. Refine every candidate whose lower bound is within the current best plus tolerance against the continuous evaluators. Do not refine only the single best chord pair.
5. Search explicit user-visible MD ranges and return a global distance/MD convergence bound plus numerical metadata.

For every result return:

- center-to-center distance;
- reference-hole MD and N/E/TVD;
- offset-hole MD and N/E/TVD;
- `ΔNEV = offset − reference` vector;
- acute local tangent crossing angle `acos(|t_reference · t_offset|)` in `[0°, 90°]`;
- calculation tolerance;
- applicable user threshold;
- frame/datum compatibility evidence;
- exclusions used, such as a shared parent path before a branch.

Block the calculation when units, local origin, north reference, or vertical datum are incompatible or unknown. Do not silently rotate, translate, or datum-shift unrelated wells. Parent and child holes may inherit a proven shared frame.

For sidetracks, allow the shared parent interval before the branch to be explicitly excluded so the expected zero distance is not reported as the minimum.

Support actual-vs-actual, plan-vs-actual, plan-vs-plan, and Flight-Deck-scenario-vs-offset where the coordinate contract is satisfied.

Label the feature everywhere:

> Centerline separation screening only — position uncertainty, hole/casing size, survey quality, and company anti-collision rules are not included.

Do not compute separation factor, ellipse separation, MASD, probability of collision, or a safe/unsafe result in this slice.

Do not subtract guessed wellbore or casing radii. If a later opt-in view derives physical edge-to-edge clearance, require explicit radius/diameter and provenance for both paths and continue to label it geometric screening, not an anti-collision safety decision.

### Slice 6 — Depth Reference & Zone Integrity workbench

Treat depth as a typed coordinate with provenance, not a naked number or suffix.

#### Datum model

Support named depth reference points such as:

- RKB / KB;
- rotary table (RT);
- drill floor (DF);
- ground level (GL);
- mean sea level (MSL);
- lowest astronomical tide (LAT);
- custom.

Store each datum’s elevation relative to an explicitly named permanent vertical datum, its unit, positive direction, source, date, and notes. Never infer RKB–RT or KB–GL from the label. Before calculation, normalize both elevations to the same vertical reference and unit with elevation positive up; never feed arbitrary stored `positiveDirection` values directly into the equation.

For normalized elevations `Esource` and `Etarget`, with reported depth positive down:

```text
Depth_at_target_datum = Depth_at_source_datum + Etarget - Esource
```

For TVD, this is a vertical-coordinate datum translation whenever the datum relationship is known; wellbore inclination does not change the datum shift.

For MD origins, deriving the shift from `Etarget - Esource` is allowed only for colocated reference points connected by a vertical measured interval. Otherwise require an explicit signed `mdOriginShiftSourceToTarget` with unit, path meaning, provenance, and uncertainty/notes, and apply exactly:

```text
MD_at_target_origin = MD_at_source_origin + mdOriginShiftSourceToTarget
```

The field is the amount **added** when converting source-origin MD to target-origin MD. Do not substitute an elevation difference for a non-vertical or non-colocated MD-origin relationship.

Test every sign with a diagram and round-trip cases. Raw entered survey MD remains immutable; converted columns are derived views.

Do not use the ambiguous label `TVDSS` by itself. Offer explicit outputs:

- `TVD MSL (positive down)`; and/or
- `Elevation MSL (positive up)`.

If an imported report calls a column TVDSS, record its stated sign convention and map it explicitly.

#### MDRKB / MDRT

Provide derived display/report columns for MDRKB, MDRT, TVDRKB, TVDRT, TVD from the selected datum, TVD MSL positive down, and elevation MSL positive up. Every column heading includes unit and datum.

#### Wireline depth is a mapping, not automatically a datum shift

Support explicit user-selected transforms:

1. Constant offset after datum normalization.
2. Two-point affine mapping (scale + offset).
3. Monotonic piecewise-linear mapping from two or more correlation tie points.

For each mapping:

- preserve source pairs and provenance;
- show scale, offset, residuals, interpolation span, and extrapolation warnings;
- after datum normalization, require both source and destination tie depths to be strictly monotone and reject duplicates on either side for a bidirectional mapping;
- if only one direction is valid, persist and label it one-way and block reverse conversion;
- never silently extrapolate outside the tie range;
- support a deliberate “allow extrapolation” override recorded in the audit trail.

Add formation/zone markers that can be entered in any supported typed depth coordinate and viewed in the others. MD↔TVD conversion must use the actual trajectory interpolation. If an upgoing wellpath produces multiple MDs for one TVD, show all candidates and require selection.

The Depth workbench should make a few-foot discrepancy visible before it becomes a hidden pay-zone error. A compact audit card must answer:

> Original value → source datum/scale → applied transform(s) → reported value.

### Slice 7 — Reports and handover artifacts

Refactor `src/report.ts` into a testable report-model layer plus renderers. Do not build engineering facts directly inside `window.open()` HTML strings.

Required printable reports:

1. **Survey report**
   - project/hole identity;
   - units, north reference, local origin, MD and TVD datums;
   - survey method and tie-in;
   - selected calculated columns;
   - station class plus `unreviewed/accepted/excluded` review state and provenance;
   - targets and current-position summary;
   - safety notice and provenance.

2. **Planning report**
   - plan name/revision/status;
   - target geometry and datum;
   - constraints and solved variables;
   - section table;
   - calculated plan stations at configurable interval;
   - endpoint residuals, max DLS, total MD;
   - Plan/Profile plots suitable for printing.

3. **Centerline screening report**
   - compared path revisions;
   - frame compatibility;
   - closest points and both MDs;
   - threshold and numerical tolerance;
   - explicit list of what is not included.

4. **Depth & Zone Integrity report**
   - datum registry;
   - RKB/RT/GL/MSL relationships;
   - wireline tie table and residuals;
   - formation/zone marker conversion audit.

5. **Flight Deck Shift Card**
   - latest accepted sensor survey;
   - estimated current bit;
   - automatically derived start/end bit MD and drilled footage from the same validated segment log;
   - slide footage, rotate footage, slide percentage, and elapsed hours where timestamps support them;
   - user-selected scenario and alternative summary;
   - plan/target offsets;
   - exact BHA configuration revision and sensor-to-bit assumptions;
   - response sample count/range and fit quality;
   - frozen pre-survey forecast scorecard and held-out residuals once resolved;
   - centerline screening result if valid;
   - unresolved warnings;
   - plan revision and immutable scenario timestamp.

Build this card from the authoritative segment/scenario/report models, not duplicate editable summary fields. Its purpose is to replace a real piece of shift-handover spreadsheet work without attempting a full morning-report, inventory, WITS, or ERP system.

Also provide CSV/JSON exports for underlying tabular data. Keep normal production runtime local; reports must not fetch remote assets.

### Slice 8 — Ellipsoids of uncertainty and Geocertainty boundary

Do not attempt to implement the full ISCWSA Rev 5 position-uncertainty propagation model from memory. First ship a trustworthy covariance ingestion/rendering path.

#### Offline provider required

Implement an `UncertaintyProvider` abstraction with an offline imported-covariance provider.

Accept a documented CSV/JSON format containing, per station:

```text
MD,
C_NN, C_NE, C_NV,
C_EE, C_EV,
C_VV,
length unit, covariance unit,
matrix basis: OneSigmaCovariance | ScaledMatrix,
if ScaledMatrix: sourceDimension, sourceProbability and/or numeric sourceK,
provider/model/version, source timestamp
```

Validate:

- default exact station-MD matching; arbitrary covariance interpolation is not ISCWSA propagation;
- if an explicitly enabled display-only numerical interpolation is later added, label it as such and never use it for collision metrics or compliance claims;
- finite values;
- symmetry within tolerance;
- positive semidefiniteness within a documented numerical tolerance;
- length-squared unit conversion;
- covariance frame (NEV) and datum compatibility.

Internally store true one-sigma NEV covariance in length². For a scaled input matrix require a numeric `sourceK` (and dimension/probability provenance where available) and normalize with `C_1σ = C_input / sourceK²`. A free-text “confidence basis” is not sufficient to perform this conversion; reject an ambiguous matrix.

For covariance `C`, use a symmetric eigendecomposition. At scale `k`, ellipsoid semi-axes are:

```text
k * sqrt(eigenvalue)
```

Use the eigenvectors for orientation. Render:

- selected-station 3-D ellipsoid;
- optional sparse ellipsoids along the path;
- Plan/Profile covariance views derived from `P C Pᵀ`, not misleading axis-aligned circles or central slices;
- clear 1σ/2σ/3σ or confidence labels without implying the same probability in 1-D, 2-D, and 3-D.

For a stated `p`-confidence region in `d` dimensions, calculate `k = sqrt(χ²_d(p))`; do not reuse a one-dimensional normal multiplier. Regression-test and display at least these reference values:

```text
2-D 95%: k ≈ 2.4477
3-D 95%: k ≈ 2.7955
3-D k=3: coverage ≈ 97.1% (not 99.7%)
```

Do not conflate these two valid but different 2-D displays:

1. **2-D marginal p-confidence ellipse:** use `P C Pᵀ` with `χ²₂(p)`.
2. **Orthographic outline of the 3-D p-confidence ellipsoid:** use the same projected shape matrix but retain `χ²₃(p)`.

Label the chosen mode explicitly; they have different coverage meanings and sizes. Every legend/report states dimensionality, confidence basis, and source-to-1σ normalization.

Keep imported EOU provenance visible and include it in reports.

#### Geocertainty integration is optional and connected-mode only

The current public Geocertainty client README (API v0.1.2 when this prompt was prepared) documents:

- `getComputeAsync` for corrected/QC’d surveys;
- `getUncertAsync` for NEV and HLA 3×3 covariance matrices per station;
- supported ISCWSA Rev 4 / OWSG Rev 2 family models at that time;
- token/private-key authentication and daily quotas;
- no depth parameter—the client must preserve input/output ordering.

DelvePath’s production contract currently forbids runtime APIs and its default CSP permits only local IPC/same-origin access. Do not weaken that default and do not put a private key in the static browser bundle.

Implement the provider interface and imported-response workflow now. A real Geocertainty HTTP adapter may be implemented only as a separately enabled **desktop connected mode** when all of these are true:

1. A user-supplied token is available—never bundled.
2. The user sees and confirms the exact outbound payload for each call.
3. The secret is not logged or placed in project snapshots.
4. Default offline builds retain their current CSP/capabilities and make no network calls.
5. Timeout, quota, model version, response validation, and reproducible local caching are handled.
6. A real round-trip test succeeds against the published contract.

If no token is available, do not block the release and do not create a fake “connected” success path. Complete the offline importer/provider, UI, persistence, tests, and documentation; report the optional connector as `NOT YET VALIDATED`.

Do not vendor or call Python `welleng` at runtime. It may be used as a pinned development oracle only after license review and with provenance; do not copy its code into the Rust engine.

## UI and interaction design

Keep the existing DelvePath visual identity and current Survey workflow. Add clear top-level workspaces, for example:

```text
Survey | Planning | Flight Deck | Targets | Centerline | Depth | Reports
```

Within views, retain synchronized:

```text
Plan View | Profile | 3-D
```

Required visual language:

- ACCEPTED SURVEY / calculated sensor path: solid hole color with review state and EOU availability visible; do not imply exact position.
- PLANNED: distinct solid/dash pattern and persistent revision label.
- PROJECTED: amber dashed.
- ESTIMATED bit interval: amber with explicit uncertainty-of-assumption styling.
- SCENARIO: individually selectable colors; only hovered/selected scenario emphasized.
- BHA response low/nominal/high: three deterministic traces/endpoints; any 2-D fill is labelled as an input-response range, not EOU or probability.
- EOU: sparse translucent ellipsoids with provider/model/scale legend.
- Target shapes: true outline/volume.
- Closest approach: connector line and markers at both closest points.

At 1366×768, a user must be able to see the active table, current result summary, and a useful plot without excessive scrolling. Preserve keyboard-first survey entry. Planning cells must support tab/enter editing. Use semantic labels, visible focus, sufficient contrast, reduced motion, and non-chart summaries.

Do not turn the interface into a generic dashboard, add decorative AI content, or introduce a full SPA routing framework unless the extracted workspace architecture actually requires it.

## Persistence and migrations

Implement additive, tested migrations in both stores.

Desktop SQLite must evolve beyond schema v4 without breaking existing `.delvepath` projects. Browser IndexedDB must evolve beyond version 1. Browser snapshot format must evolve to version 2 with a real v1 migration instead of rejecting all older files.

Persist at minimum:

- coordinate-frame and datum metadata;
- station review status and review provenance;
- plans and typed plan sections;
- expanded target geometry and polygon vertices;
- configuration-revisioned BHA runs and raw drilling segments;
- immutable scenario decisions/resolutions;
- depth datums, wireline transforms, and tie points;
- imported covariance/provenance;
- user centerline thresholds and saved scan metadata where appropriate.

Do not persist derived survey coordinates as new source truth. Do not put plans/scenarios into measured stations. Do not silently mutate old snapshot values during import without recording the migration version.

Add round-trip parity tests for SQLite, IndexedDB, and browser snapshots.

## Required synthetic demo — the 90-second proof

Add a deterministic built-in demo named something like **Curve Recovery — Plan & Flight Deck**. Do not name it after a commenter. Mark every screen/report `SYNTHETIC / constructed`.

The demo must include:

- an active plan with at least one shaped landing target;
- accepted survey stations trending away from that plan;
- a configuration-revisioned motor BHA with sensor-to-bit distance and at least five prior qualified response samples;
- a complete drilling-segment record covering accepted sensor MD through current bit MD;
- a hidden held-out “next survey” that is excluded from all pre-reveal BHA Memory samples and forecasts;
- frozen predictions from hold, original user nominal yield, pre-existing BHA Memory median, and two correction scenarios.

Timed Flight Deck proof:

1. **0–15 s:** show accepted calculated sensor position versus estimated current bit and next expected sensor MD.
2. **15–40 s:** compare hold, short-correction, and longer/gentler scenarios with plan/target offset, DLS, slide footage, constraint status, and deterministic BHA response bounds.
3. **40–60 s:** edit slide length or toolface and update Plan/Profile/3-D plus scenario cards immediately.
4. **60–75 s:** click **Reveal held-out synthetic survey** and score every frozen prediction at its actual survey MD.
5. **75–90 s:** show BHA Memory `n → n+1`, the changed next forecast, and the automatically derived Shift Card preview.

Add engine assertions that hold visibly misses the corridor, the two alternatives show a meaningful DLS/slide-footage tradeoff, the held-out station was absent from every pre-reveal sample set, and no forecast changes during scoring.

After later gates are complete, provide an optional encore—not part of the timed proof—with one comparable offset path, synthetic imported NEV covariance, explicit RKB/RT/GL/MSL relationships, a non-constant wireline tie table, centerline/EOU views, the Depth pay-zone audit, and full Planning report.

Fixture outputs must be generated by the engines, not hand-entered to make the reveal look correct. The hidden truth may use a distinct deterministic synthetic response parameter, but that parameter and its survey must never enter the forecasts being scored.

## Validation matrix

### Existing regression gates

- Every current delve-core synthetic and golden test remains unchanged and passes.
- Oregon, NM, COMPASS, and HawkEye tolerances do not loosen.
- Existing Survey entry, paste, CSV, branch, target, browser persistence, and desktop behavior remain working.

### Projection and Flight Deck

- Hold equals the existing tangent projection.
- DLS=0 equals hold.
- Gravity TF 0/90/180/270 yields build/right/drop/left behavior.
- Splitting an equivalent DLS/TF interval into subsegments is invariant within documented tolerance.
- Gravity-TF integration agrees with the stated attitude ODE and blocks near 0°, near 180°, and before crossing either singularity; fixed dogleg-plane mode remains analytically distinct.
- Constant build/azimuth-turn tests verify `I'=B`, `A'=T`, units/reference length, and the nonconstant instantaneous DLS relation.
- Metric and imperial runs are equivalent.
- Azimuth wrap is stable.
- Sensor MD and bit MD are never conflated.
- Segment gaps, overlaps, unordered coverage, and manual/derived current-bit disagreement block the estimate.
- Synthetic replay recovers a known slide yield within tolerance.
- Samples never cross BHA configuration revisions; qualification thresholds and every include/exclude reason are tested.
- Held-out predictions and their pre-update BHA Memory revision remain immutable when resolved; scoring precedes `n → n+1` update.
- Scenario/estimated points cannot become measured rows.
- Existing stations migrate to `unreviewed`, and only explicitly accepted surveys can anchor/resolve a Flight Deck record.

### Planning

- Verified slant/S-well examples match their printed precision without claiming WinSERVE identity.
- Impossible constraints return typed infeasibility.
- Editing an upstream table parameter deterministically recomputes downstream sections.
- Endpoint target residuals use boundary geometry, not just target center.
- Plan revision persistence and browser/desktop parity pass.

### Targets

- Radius is not confused with diameter.
- Rotated rectangle vertices and projected profile span are correct.
- Polygon containment, boundary distance, closure, vertex order, and self-intersection validation pass.
- Dipped target canonical transform, normal polarity, curve entry/exit, and single closest-point miss agree with analytic fixtures.
- Section-plane intersection and orthogonal projection are tested and labelled as different results.
- Plan/Profile/3-D traces represent the same geometry.

### Centerline screening

- Parallel vertical paths with known spacing.
- Intersecting paths return approximately zero at correct MDs.
- Known skew segments.
- An arc whose closest point lies outside its chord AABB is not pruned; certified inflated bounds and multi-candidate adaptive refinement converge globally over the declared MD ranges.
- `offset − reference` ΔNEV and acute tangent crossing angle have deterministic signs/range.
- Shared-parent exclusion.
- Incompatible unit/origin/north/datum blocks the scan.
- Station spacing changes do not materially change the converged answer.

### Depth

- Datum conversions round-trip and have correct sign.
- RKB↔RT and TVD↔MSL examples normalize elevations to one positive-up vertical frame.
- TVD translation works on a deviated path; MD origin conversion requires the explicit additive shift when the reference connector is not vertical/colocated.
- Constant-offset, affine, and piecewise wireline mappings.
- Duplicate/non-monotonic source or destination ties and accidental extrapolation are rejected; one-way maps block reverse conversion.
- MD↔TVD handles vertical, deviated, and upgoing/multiple-solution cases.
- Unit changes never reinterpret values.

### EOU

- Diagonal covariance produces expected axes.
- Rotated covariance produces expected eigenvectors/orientation.
- Non-PSD input is rejected with useful diagnostics.
- Unit² conversion is correct.
- One-sigma and explicitly scaled input matrices normalize to the same covariance; ambiguous confidence metadata is rejected.
- A 2-D marginal 95% ellipse (`χ²₂`) and projection of a 3-D 95% ellipsoid (`χ²₃`) differ correctly and are labelled distinctly from a slice.
- BHA low/nominal/high deterministic response traces and EOU remain distinct in data, legend, and report.

### Reports and E2E

- Report models are unit-tested without browser popups.
- Reports include method, revision, datums, provenance, assumptions, and safety notices.
- Browser and Tauri service results match for the same requests.
- Playwright covers the full synthetic reveal flow and snapshot migration.
- Add Playwright to CI if runtime remains reasonable.

## Performance and packaging

- Rebuild WASM before the production web build whenever Rust interfaces change: `npm run build:wasm`.
- Keep calculations deterministic across native and WASM targets.
- A typical demo edit should update within about 200 ms on a normal development machine. If a scan/solver exceeds that, move it off the React render path and show cancellable progress.
- Lazy-load heavy workspace code as practical.
- Do not add a backend, database server, cloud auth, analytics, telemetry, update checker, or runtime CDN.
- Keep the Tauri default CSP and capabilities offline-only.
- Run license, SBOM, and bundle scans for every new dependency.

## Source hierarchy and research basis

Use this hierarchy:

1. Published standards/committee material and normative schemas.
2. Repository goldens and official filed reports.
3. Independently derived math with explicit tests.
4. Vendor documentation for workflow/terminology, not copied proprietary algorithms.

Primary/official references:

- ISCWSA Introduction to Wellbore Positioning and local repository copy/research notes.
- ISCWSA Error Model Revision 5 documentation and diagnostic workbooks:  
  `https://www.iscwsa.net/error-model-documentation/`
- ISCWSA Collision Avoidance Calculations — Current Common Practice:  
  `https://www.iscwsa.net/articles/collision-avoidance-calculations-current-common-practice/`
- ISCWSA collision-avoidance lexicon:  
  `https://www.iscwsa.net/files/478/`
- ISCWSA Project Ahead Uncertainty — Implications and Interpretation:  
  `https://www.iscwsa.net/files/776/`
- Energistics WITSML 2.1 developer resources (latest standard at the time of research):  
  `https://energistics.org/witsml-developers-users`
- Energistics trajectory station types and calculation-algorithm semantics:  
  `https://docs.energistics.org/WITSML/WITSML_TOPICS/WITSML-500-214-0-R-sv2000.html`  
  `https://energistics.org/sites/default/files/energyML/data/witsml/v2.0/doc/schema/Trajectory.html`
- Energistics RESQML minimum-curvature interval semantics:  
  `https://docs.energistics.org/RESQML/RESQML_TOPICS/RESQML-000-168-0-C-sv2010.html`  
  `https://docs.energistics.org/RESQML/RESQML_TOPICS/RESQML-000-170-0-C-sv2010.html`
- Energistics depth-datum and log datum-reference semantics:  
  `https://energistics.org/sites/default/files/energyML/data/witsml/v2.0/doc/schema/Well.html`  
  `https://energistics.org/sites/default/files/energyML/data/witsml/v2.0/doc/schema/Log.html`
- API RP 78 ballot draft, clearly labelled a draft rather than an approved standard:  
  `https://eballotprodstorage.blob.core.windows.net/eballotscontainer/78_e1-Ballot%20Draft.pdf`
- Alberta Energy Regulator Directive 059:  
  `https://www.aer.ca/documents/directives/Directive059.pdf`
- Geocertainty API client v0.1.2 README:  
  `https://raw.githubusercontent.com/kotesla/gcapiclient/main/README.md`

Workflow/category validation only:

- Halliburton COMPASS project-ahead, planning, and anti-collision overview:  
  `https://www.halliburton.com/en/products/engineers-desktop-suite/compass-software`
- Halliburton Wellbore Planner user guide for profile categories and planning terminology:  
  `https://esd.halliburton.com/support/LSM/GGT/WellborePlanner/WellborePlanner/5000/5000_0/Help/WBP.pdf`
- U.S. BSEE directional-drilling technology study for workflow and sensor/bit context:  
  `https://www.bsee.gov/sites/bsee.gov/files/research-reports/761aa.pdf`
- Dynamic Graphics WellArchitect return-to-plan, EOU, targets, and clearance workflow:  
  `https://www.dgi.com/well-planning-and-survey-management/`
- Innova slide-sheet and directional dashboard documentation:  
  `https://docs.innova-drilling.com/introduction/innova-engineering-manual/well-seeker-pro-1/3.0-software-overview`  
  `https://docs.innova-drilling.com/introduction/innova-engineering-manual/well-seeker-pro-1/appendix-f-slide-sheet-column-options`  
  `https://docs.innova-drilling.com/introduction/innova-engineering-manual/well-seeker-pro-1/13.0-reporting/13.11-directional-drilling-dashboard`
- Apache-2.0 `welleng` as an optional development comparison/oracle, not a runtime dependency:  
  `https://github.com/jonnymaserati/welleng`

Important source cautions:

- WITSML provides useful types and interoperability semantics; this release does not need to claim WITSML conformance or implement ETP.
- API RP 78 is a ballot draft in the linked form. Do not call it an approved API standard.
- ISCWSA explicitly warns that centerline-only/S-type rules do not account for position uncertainty and are too simplistic as a primary collision-avoidance rule.
- Geocertainty is a cloud service. It conflicts with DelvePath’s default air-gapped runtime unless isolated as optional connected desktop mode.
- Vendor pages prove workflows and terminology. They do not authorize copying proprietary solvers, optimizers, UI, or steering logic.

## Documentation to update

Update implemented reality, not aspirations:

- `README.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/CALCULATION_SPEC.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_PLAN.md`
- `docs/ROADMAP.md`
- `docs/OFFLINE_REQUIREMENTS.md`
- `docs/OPERATOR_NOTES.md`
- public web feature copy in `src/web/SiteApp.tsx`
- snapshot/export format documentation

Include a calculation note for every new method, its reference/derivation, applicability, numerical approach, tests, and validation state.

## Definition of done

Do not declare completion until:

1. All required slices except the gated live Geocertainty HTTP call are implemented end-to-end in both browser and desktop adapters.
2. Existing projects and v1 browser snapshots migrate without data loss.
3. The synthetic demo completes the 90-second flow.
4. Every old and new Rust/Vitest/Playwright test passes.
5. WASM, production web, and Tauri debug builds pass.
6. License, SBOM, and bundle checks pass.
7. Default builds remain offline and make no unexpected network requests.
8. Reports render legibly and contain all required warnings/provenance.
9. Public claims match tested behavior.
10. No unrelated user-owned work is changed.

At handoff, report:

- concise outcome summary;
- files and schema versions changed;
- calculation methods added and their validation state;
- exact test/build commands and results;
- before/after bundle sizes;
- screenshots of Survey, Planning, Flight Deck, Centerline, Depth, and report preview at 1366×768;
- remaining limitations;
- whether Geocertainty is import-only or has a separately validated connected adapter;
- confirmation that default runtime remains offline.
