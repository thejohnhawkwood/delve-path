# Agent handoff — DelvePath 0.2 Plan & Flight Deck

**Read this first.** Then inspect the repo. Do not treat older docs as the schema of record.

| Field | Value |
|---|---|
| Product | DelvePath — Mithril Consulting (Philip Bird) |
| Intended version | **0.2.0** (Plan & Flight Deck) |
| Last committed tag on `main` | **0.1.1** at `35fa535` |
| Working branch | `v0.2-plan-flight-deck` |
| Commit state | **All 0.2 work is uncommitted** (modified + untracked). Do not reset, discard, or rewrite history. |
| License | Apache-2.0 |
| Status | Engines + persistence + adapters: **TEST_VERIFIED**. Full product DoD: **IMPLEMENTED_UNVERIFIED**. Live Geocertainty HTTP: **NOT YET VALIDATED**. Do **not** report **DONE**. |
| Prior implementation chat | [Plan Flight Deck](4d38a929-cc7c-497c-8912-fb85e272b7d2) |

This is an engineering prototype. Keep this notice visible in the workspace and on every report:

> Engineering prototype / evaluation software — not certified. Not regulator-approved. Not for collision avoidance, well control, or steering decisions.

---

## 1. What you are walking into

DelvePath is a local-first directional-survey calculator. 0.1.1 was a validated Minimum Curvature survey viewer (Oregon / NM / COMPASS / HawkEye goldens) on Tauri + SQLite and a browser WASM + IndexedDB demo.

0.2 adds the first coherent offline workspace that can answer:

1. Where does the latest **accepted** survey put the sensor (review + uncertainty still explicit)?
2. Where is the bit estimated to be now?
3. What candidate paths can reach a defined target under **user-entered** constraints?
4. How do actual, plan, and next-stand scenarios differ?
5. What is the closest **centerline** approach to another wellpath?
6. Which depth datum / correlation produced a reported zone depth?
7. What can be handed to the next shift in a reproducible report?

The signature feature is **Next-Stand Flight Deck + BHA Memory**: separate ACCEPTED SURVEY, ESTIMATED bit, and SCENARIO paths; score frozen forecasts against a held-out accepted survey; keep an inspectable BHA-configuration history.

The implementation prompt that drove this pass is user-owned and untracked:

`docs/CURSOR_VNEXT_PLAN_FLIGHT_DECK_PROMPT.md`

Do not overwrite it. This handoff is the *implemented* reality; that prompt is the *requested* contract. Gaps are listed in §10.

---

## 2. Protect the user’s tree first

Before any edit, run `git status --short --branch`. Treat every existing modification and untracked file as user-owned unless this document says it is 0.2 work you are continuing.

**Never touch, relocate, reformat, or “clean” these untracked items:**

- `assets/` (brand PNGs + web fonts)
- `docs/CURSOR_GROK_WEB_BUILD_PROMPT.md`
- `docs/CURSOR_VNEXT_PLAN_FLIGHT_DECK_PROMPT.md`
- `scripts/generate_wordmark.py`

**Never:**

- `git reset`, discard, force-push, rewrite history, or push unless the user asks
- commit unless the user asks
- send well data (or any payload) to Geocertainty or any other service
- add a second plotting library (Plotly is already ~4.67 MB minified)
- implement a mobile app
- put a second TypeScript solver for trajectory / planning / projection / clearance / covariance
- weaken tests, goldens, or safety language to get a green run
- declare a path **recommended / safe / approved / execute**
- call centerline work anti-collision, separation factor, MASD, or probability of collision
- show green/red safe/unsafe
- combine a BHA response envelope with an ellipsoid of uncertainty
- label `TVDSS` without an explicit sign convention
- use `Array.prototype.at()` — `tsconfig` is ES2021

PowerShell in this repo does not accept `&&`. Use `;` to chain commands.

---

## 3. Architecture (keep this split)

```text
React / TypeScript UI
        │
        ▼
typed platform services   src/platform + src/api.ts + src/engine.ts
   ├── Tauri IPC + SQLite     (desktop *.delvepath)
   └── WASM + IndexedDB       (browser + .delvepath.json snapshots)
        │
        ▼
delve-engine   tagged JSON dispatch   engine_call_json({"op","payload"})
        │
        ├── delve-core         survey reconstruction + interval evaluator + frame/review/units
        ├── delve-planning     projections, plan constructors, Flight Deck, Curve Recovery demo
        └── delve-assurance    targets, depth, centerline, imported covariance
```

Invariants:

- `delve-core` stays pure Rust. No React, Tauri, SQLite, IndexedDB, Plotly, or networking.
- Desktop and browser use the **same** Rust math.
- Calculated N/E/TVD are derived. Raw MD/INC/AZI are never silently overwritten.
- Production desktop stays fully offline. Default CSP: `connect-src ipc: http://ipc.localhost` only.
- Internal geom is metres + radians. Hole unit is used at I/O.
- `StationClass::Planned` exists in core but **plans are not stored as measured stations**.

Workspace crates:

| Crate | Role |
|---|---|
| `crates/delve-core` | Min curvature, `evaluate_at_md`, `CoordinateFrame`, `frames_comparable`, review state, length convert |
| `crates/delve-planning` | Hold / gravity TF / fixed-plane TF / build-turn / trend / slide-rotate; slant/S/horizontal/curve-hold; Flight Deck; demo |
| `crates/delve-assurance` | Target plane + footprints, depth/wireline, centerline scan, covariance import + ellipse/ellipsoid |
| `crates/delve-engine` | Single JSON op router used by WASM and Tauri |
| `crates/delve-storage` | SQLite through **schema v5** |
| `crates/delve-wasm` | `engine_call(req: String)` plus existing calc exports |
| `src-tauri` | `engine_call`, `save_document`, `load_documents`, `delete_document` |

Clippy `-D warnings` is required. Existing allows:

```rust
// delve-planning
#![allow(clippy::too_many_arguments)]

// delve-assurance
#![allow(clippy::too_many_arguments, clippy::needless_range_loop, clippy::len_zero)]

// delve-core geom.rs on Vec3::add / Vec3::sub
#[allow(clippy::should_implement_trait)]
```

After any Rust interface change: `npm run build:wasm` **before** the production web build. The last native centerline MD-clip landed **after** the last WASM rebuild; if you ship web, rebuild WASM.

---

## 4. Persistence

| Store | Version | Notes |
|---|---|---|
| Desktop SQLite | **v5** | Additive. Existing `*.delvepath` must still open. |
| Browser IndexedDB | **v2** | Adds `documents` store; normalize holes/stations on read. |
| Browser snapshot | **v2** | Real v1 → v2 migration. Do not reject v1 files. |

Schema v5 adds:

- Hole frame: `origin_id`, `origin_north`, `origin_east`, `vertical_datum`, `vertical_datum_name`, `crs_epsg`, `crs_note`
- Station review: `unreviewed | accepted | excluded` plus reviewer / source / timestamp / exclusion reason
- `targets.geometry_json` (legacy N/E/TVD → horizontal point footprint, no invented dip)
- `documents` table: `kind` ∈ `plan | bha | segment | decision | datum | wireline | marker | covariance | scan`

**Migrated stations stay `unreviewed`.** Do not silently accept old rows. Flight Deck anchors and scoring require an explicitly **accepted** station.

`frames_comparable` **blocks** when north is `unknown`, `origin_id` is `unspecified`, or vertical datum is unspecified. Oregon example stays unspecified (centerline will block until the user sets a frame). Dual-lateral and Curve Recovery use `comparableDemoFrame()` (`origin_id: wellhead`, `vertical_datum: rkb`, grid north).

`src/unitsConvert.ts`: a unit change **converts** stored lengths (MD, tie-in, targets, origin offsets, BHA lengths, thresholds). Silent relabelling is forbidden.

Do not persist derived survey coordinates as source truth. Do not put plans/scenarios into the measured-station table.

---

## 5. What is implemented

### 5.1 Survey (0.1.1 preserved + 0.2 review/units/frame)

Keyboard-first MD/INC/AZI, paste, CSV, parent + sidetrack branch, Plotly Plan / Profile / 3-D, Oregon and dual-lateral demos. Chart tab formerly `"plan"` is now **`planView`** so it does not collide with planning.

Survey grid is **hidden** when `workspace !== "survey"` so 1366×768 can show the active table + plot.

Bulk **Accept unreviewed** exists. Persist keeps station IDs.

### 5.2 Forward projections (`delve-planning`)

| Method | Engine op | Notes |
|---|---|---|
| Hold INC/AZI | `project_hold` | Same as existing tangent. DLS=0 must equal hold. |
| Constant gravity TF | `project_gravity_tf` | Evolving high-side/right, RK4 + step-halving. **Not** a one-shot circular arc. |
| Fixed initial dogleg-plane TF | `project_fixed_plane` | Analytic arc with frozen `u0`. Never label this gravity TF. |
| Constant build + azimuth-turn | `project_build_turn` | `I′=B`, `A′=T`. Instantaneous DLS is `√(B²+(T sin I)²)`. |
| Recent trend LS | `project_trend` | 2–5 stations, unwrap AZI. Label **Recent trend (least-squares)**. Not WinSERVE BHL. |
| Slide/rotate segments | `project_slide_rotate` | User yield + rotary tendency. Gaps/overlaps/unordered coverage **block**. |

Gravity TF: 0° build, 90° right, 180° drop, 270° left. Singular when `|sin I| ≤ ε` (default 3°) near 0° and 180° — stop with a typed issue; do not guess a magnetic TF. Near-vertical **manual** planning uses `project_fixed_plane` with an explicit dogleg-plane azimuth.

`method_help` payload is `{ method: "slide_rotate_segments" }` (snake_case enum).

### 5.3 Planning workspace

UI: `src/workspaces/PlanningWorkspace.tsx`.

Constructors: 2-D slant (J), 2-D S, 2-D horizontal / double-build, 3-D curve+hold, plus a thin manual hold-then-TF composition.

Oracle numbers (imperial, independently derived; WinSERVE is a print oracle only):

- Target TVD 4500 ft, displacement 1000 ft, direction 45°
- KOP 650 + DLS 3°/100 ft → hold **15.57°**
- KOP 650 + hold 25° → DLS **0.7448°/100 ft**
- Hold 25° + DLS 3°/100 ft → KOP **1932.1 ft**
- S-well KOP 1000, DLS1 2, DLS2 1.5, entry 7° → hold **20.431°**, tangent **1741.65 ft**
- Impossible 3-D combination → typed `Infeasible`, never NaN / sentinel coordinates

**Gap vs prompt:** the UI is a constructor editor that persists a JSON document. It is **not** yet a full multi-section `Plan` / `PlanSection` lock/solve ledger with per-row Solve/Lock and revision workflow. Rust types for `Plan` / `PlanSection` exist in `crates/delve-planning/src/plan.rs` and `sections.rs`.

Infeasible solves must clear the plotted path.

### 5.4 Targets

`crates/delve-assurance/src/target.rs` + `src/workspaces/TargetsWorkspace.tsx`.

Target = plane + in-plane footprint (`Point | Circle{radius} | Ellipse | Rectangle | Polygon`). Circle input is **radius**. Legacy points migrate to a horizontal plane (`α=0` basis), no invented dip.

Canonical NEV construction (TVD/`V` positive down; dip `δ` down from horizontal; dip azimuth `α` clockwise from north) is in the prompt and in `target.rs`. Shared domain emits plot-ready outlines; Plotly only renders.

Profile has two labelled modes: **section-plane intersection** vs **orthogonal projection**. Do not silently substitute.

### 5.5 Flight Deck + BHA Memory (signature)

`crates/delve-planning/src/flight.rs` + `demo.rs` + `src/workspaces/FlightDeckWorkspace.tsx`.

Three path classes, visually distinct:

- **ACCEPTED SURVEY** — user-reviewed MD/INC/AZI → calculated sensor
- **ESTIMATED** — sensor-to-bit from the drilling-segment log + BHA
- **SCENARIO** — user-authored one-/two-stand alternatives

`next_sensor_md = future_bit_md - sensor_to_bit`. Never conflate them.

Scoring is at the **actual held-out survey MD** (next-sensor attitude), **before** BHA Memory `n → n+1`. Frozen forecasts must not change during Reveal.

Demo name: **Curve Recovery — Plan & Flight Deck**. Mark **SYNTHETIC / constructed**.

Engine-produced story numbers (imperial):

| Item | Value |
|---|---|
| Last accepted | MD 2400, INC 16.2°, AZI 62°, N 180, E 320, TVD 2385 |
| Sensor-to-bit | 52 ft |
| Estimated bit MD | 2495 ft |
| Next expected sensor MD | 2443 ft |
| Held-out survey MD | 2495 |

`curve_recovery_demo` and `assert_demo_story` live in the engine. Fixture outputs must come from the engines, not hand-edited reveal numbers.

BHA low/nominal/high traces must be labelled:

> BHA response envelope — not positional uncertainty.

Do not render an unlabeled 3-D probability fan.

### 5.6 Centerline screening

`crates/delve-assurance/src/centerline.rs` + `src/workspaces/CenterlineWorkspace.tsx`.

Continuous closest-approach: inflated chord AABBs, multi-candidate refine, `ΔNEV = offset − reference`, acute crossing angle in `[0°, 90°]`. Label everywhere:

> Centerline separation screening only — position uncertainty, hole/casing size, survey quality, and company anti-collision rules are not included.

Say **above / below configured centerline threshold**. Never safe/unsafe.

Offset surveys come from **in-memory hole overlays**, not a dedicated offset-project picker.

`frames_comparable` runs first. Shared-parent exclusion clips MD through the branch on **both** paths (`clip_md_range`); the junction station is not the intended minimum of the shared vertical. Laterals that still share the kick-off point can still report a near-zero just after the branch — that is geometry.

Offset ID must resolve against the **current** hole list. A stale ID from a previous demo load used to look like a self-scan. `resolvedOffsetId` in `CenterlineWorkspace.tsx` is the fix.

### 5.7 Depth

`crates/delve-assurance/src/depth.rs` + `src/workspaces/DepthWorkspace.tsx`.

Elevations are normalized **positive-up** before any shift:

```text
Depth_at_target = Depth_at_source + E_target − E_source
```

TVD datum translation does not depend on inclination. MD origin conversion requires an explicit signed `mdOriginShiftSourceToTarget` unless the references are colocated and vertical. Do not substitute `E_RT − E_RKB` for a non-vertical MD-origin relationship.

Outputs: `TVD MSL (positive down)` and `Elevation MSL (positive up)` — not a bare `TVDSS`.

Wireline: constant offset, two-point affine, piecewise-linear. No silent extrapolation. One-way maps block reverse conversion.

Audit card form: Original value → source datum/scale → applied transform(s) → reported value.

### 5.8 Reports

`src/reportModel.ts` is the testable model. `src/report.ts` is a thin wrapper. `openReport` does `window.open` + `document.write` + `print()`. Unit tests must not depend on popups (`src/reportModel.test.ts`).

Reports: Survey, Planning, Centerline, Depth, Flight Deck Shift Card. Safety notice + provenance on all. No remote assets.

Do not rebuild engineering facts inside HTML strings.

### 5.9 EOU

Offline imported 1σ NEV covariance. Scaled matrices require numeric `sourceK`. Store `C_1σ = C_input / sourceK²`. Symmetric eigendecomposition; `k = √χ²_d(p)`.

Reference values that must stay tested and labelled:

- 2-D 95%: k ≈ 2.4477
- 3-D 95%: k ≈ 2.7955
- 3-D k=3: coverage ≈ 97.1% (not 99.7%)

`marginal_2d` (`χ²₂`) and `outline_3d` (`χ²₃`) are different. Label them.

**Geocertainty live HTTP is not implemented and must stay gated.** Import-only. No token in the bundle. No CSP relaxation.

---

## 6. Engine API

UI talks to Rust only through:

```ts
import { engineCall, parseEngineError } from "./engine";
await engineCall<T>("op_name", payload);
```

Adapters: `src/platform/browser/calc.ts`, `src/platform/tauri/calc.ts`. WASM `engine_call` returns a JSON string; adapters `JSON.parse` and throw on `{error}`.

Ops (see `crates/delve-engine/src/lib.rs`):

```text
evaluate_at_md
project_hold | project_gravity_tf | project_fixed_plane | project_build_turn
project_trend | project_slide_rotate | method_help
solve_slant | solve_swell | solve_horizontal | solve_curve_hold
densify_plan | plan_offsets
convert_length | frames_comparable
target_outline | target_query | target_section_intersection | target_section_projection
canonical_basis | legacy_target
centerline_scan | intervals_from_states
translate_depth | convert_md | apply_wireline | md_for_tvd
normalize_covariance | chi2_k | project_ellipse | ellipse_polyline | ellipsoid_wireframe
flight_estimate | flight_scenario | flight_qualify | flight_score | shift_card_footage
curve_recovery_demo | assert_demo_story
```

Serde is `rename_all = "snake_case"`. Payloads must use these strings, not PascalCase:

| Rust | JSON |
|---|---|
| `UnitSystem::Imperial` | `imperial` |
| `DlsRefLength::Per100Ft` | `per100_ft` |
| `DlsRefLength::Per30M` | `per30_m` |
| `SolveUnknown::HoldAngle` | `hold_angle` |
| `ProjectionMethod::HoldIncAzi` | `hold_inc_azi` |
| `ProjectionMethod::ConstantGravityToolface` | `constant_gravity_toolface` |
| `ProjectionMethod::FixedInitialDoglegPlane` | `fixed_initial_dogleg_plane` |
| `ProjectionMethod::SlideRotateSegments` | `slide_rotate_segments` |
| `EllipseMode` | `marginal_2d` / `outline_3d` |
| `MatrixBasis` | `one_sigma_covariance` / `scaled_matrix` |
| `PlanStatus` | `solved` / `infeasible` / … |
| `SlideMode` | `slide` / `rotate` |

`ScenarioCard` and `BitEstimate` include `path: Vec<ProjectionPoint>` for traces. `CurveRecoveryDemo` includes `last_accepted: Attitude`.

`newUuid()` in `src/api.ts` **must** return `getPlatform().newId()`. A previous edit briefly broke this.

---

## 7. UI map

Top-level workspaces in `src/App.tsx` (~2.2k lines; incrementally extracted, not lazy-loaded except `Charts`):

```text
Survey | Planning | Flight Deck | Targets | Centerline | Depth | Reports | EOU
```

| File | Role |
|---|---|
| `src/App.tsx` | Project/hole/survey chrome, persist, demo loaders, workspace host |
| `src/SurveyGrid.tsx` | Keyboard survey entry + review column |
| `src/Charts.tsx` | Plotly; `extraPaths`, `targetOutlines`, `profileTargetMode` |
| `src/workspaces/*.tsx` | Feature panels |
| `src/reportModel.ts` | Report models + HTML + `openReport` |
| `src/unitsConvert.ts` | Atomic unit conversion |
| `src/records.ts` | `HoleRecord`, `DocumentRecord`, `comparableDemoFrame()` |
| `src/web/SiteApp.tsx` | Public marketing chrome around `#workspace` |
| `src/styles.css` | Existing DelvePath identity — keep it |

Visual language (do not invent a dashboard look):

- Accepted / calculated sensor: solid hole color; review + EOU availability visible
- Planned: distinct dash + revision label
- Projected: amber dashed
- Estimated bit: amber, assumption styling
- Scenarios: selectable colors; emphasize hovered/selected only
- BHA envelope: three deterministic traces; fill only if labelled “not positional uncertainty”
- EOU: sparse translucent ellipsoids + provider/model/scale legend
- Closest approach: connector + both MDs

Site marketing chrome sits **above** `#workspace`. For screenshots, scroll `.workspace-nav` / `#workspace` into view. IndexedDB can be dirty from Playwright (leftover dual-lateral holes). Load the demo you want before judging UI.

---

## 8. Tests, builds, last known evidence

Commands (repo root; PowerShell: use `;` not `&&`):

```text
cargo test -p delve-core
cargo test -p delve-core --test golden
cargo test -p delve-core --test synthetic
cargo test -p delve-planning -p delve-assurance -p delve-engine -p delve-storage -p delve-wasm
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
npx tsc --noEmit
npm run test-ui
npm run build:wasm
npm run build
npm run test-license
npm run test-sbom
npm run test-bundle
npm run test-e2e
cargo build -p delvepath
```

Last recorded results in the implementation pass:

| Gate | Result |
|---|---|
| Rust (core + goldens + planning + assurance + engine + storage + wasm) | **99** passed; assurance **22/22** after shared-parent MD clip |
| Vitest | **26** (was 19) |
| Playwright | **5** including Curve Recovery reveal |
| `tsc --noEmit` | pass |
| fmt / clippy `-D warnings` | pass |
| WASM | **~1.17 MB** (was ~136 KB) because planning + assurance + engine are now in the wasm crate |
| Vite production | pass; Plotly **4,673.67 kB**; no second plot lib |
| License / SBOM / bundle | pass |
| `cargo build -p delvepath` | pass |
| `cargo tauri build --debug` / NSIS | **not run** this pass |

Do **not** loosen Oregon / NM / COMPASS / HawkEye tolerances.

Playwright is in `.github/workflows/ci.yml`. Preview is `http://127.0.0.1:4173` after `npm run build` + `npm run preview`. Port 4173 is often left occupied.

E2E coverage today: Oregon safety credit, dual-lateral PROJECTED label, Curve Recovery Reveal (`n → n+1`, forecasts stayed frozen), public link attributes. Snapshot-migration E2E is Vitest (`src/platform/snapshot.test.ts`), not Playwright.

---

## 9. Documentation that already matches 0.2

Updated to implemented reality (not aspirations):

- `README.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/CALCULATION_SPEC.md` (§ 0.2 methods table)
- `docs/DATA_MODEL.md`
- `docs/TEST_PLAN.md`
- `docs/ROADMAP.md`
- `docs/OFFLINE_REQUIREMENTS.md`
- `docs/OPERATOR_NOTES.md`
- `docs/BROWSER_SNAPSHOT.md`
- `src/web/SiteApp.tsx`

If you change behavior, update these to match. Do not document features that are not wired.

Source hierarchy for any new math: published standards → repo goldens → independently derived + tested → vendor docs for workflow/terminology only. Do not copy WinSERVE / COMPASS / WellArchitect / welleng algorithms. Do not vendor Python `welleng` at runtime.

---

## 10. Current limitations (honest)

These are the gaps a follow-on agent should treat as unfinished, not as bugs to paper over with mocks.

1. **Planning persistence vs prompt.** Rust `Plan` / `PlanSection` types exist; the UI is still a constructor form + densified stations, not a full editable section table with per-row lock/solve, revision status, and corridor overrides.
2. **Centerline offsets** are sibling holes already loaded in memory. No offset-project / offset-revision picker.
3. **Shared-parent exclusion** now clips MD through the branch in native Rust. WASM may be one rebuild behind. Dual-lateral still meets at the kick-off; excluding the shared vertical does not invent separation after the junction.
4. **Geocertainty** is import-only. No token flow, no payload confirm, no connected desktop mode. Keep it **NOT YET VALIDATED**.
5. **ISCWSA Rev 5 propagation** is not implemented. Import + render only. Do not claim compliance.
6. **No anti-collision:** no SF, ellipse separation, MASD, PoC, or edge-to-edge unless a later opt-in view has explicit radii/provenance and still says “geometric screening.”
7. **No mining convention**, no geodetic transforms, no auto declination/grid. CRS/EPSG is metadata.
8. **No WITS/WITSML**, live feeds, rig controls, ML, or recommendation engine.
9. **Kick-off interpolation** at an arbitrary MD is not implemented. Branch is from a **selected measured station**.
10. **Parent curve is not copied** into the lateral. Overlay parent + laterals.
11. **`App.tsx` is still large.** Workspaces are extracted components but not code-split (except Charts).
12. **Full Tauri installer** (`cargo tauri build --debug` / release NSIS) was not produced this pass. Frozen 0.1.1 installer docs in README are stale relative to 0.2.0 version fields.
13. **Report preview** uses `window.open` + `print()`, which automation browsers often fail to capture.
14. **Playwright** does not yet cover snapshot-file import in the browser UI.
15. **WASM size** jumped ~9×. Plotly is unchanged. Do not add another heavy client library.
16. **Oregon** hole frame stays unspecified, so centerline vs Oregon correctly **blocks**.

---

## 11. Landmines (read before coding)

1. **Do not reimplement math in TypeScript.** Add a Rust function + engine op + thin UI.
2. **Do not store plans or scenarios as `StationClass::Planned` measured rows.**
3. **Do not relabel units.** Use `convertHoleLengths` / `convert_length` / `convert_length_sq`.
4. **Do not accept stations by default.** Flight Deck needs an explicit accept.
5. **Do not call gravity TF and fixed-plane TF the same thing** in types, UI, exports, or tests.
6. **Do not silently fill segment gaps** with hold / rotate / zero yield.
7. **Do not score forecasts after updating BHA Memory.** Score first; then `n → n+1`.
8. **Do not interpolate covariance** and then use it for collision or compliance.
9. **Do not weaken default CSP** for a “connected” demo.
10. **Do not use `.at(-1)`.** Use `arr[arr.length - 1]` or `.slice(-1)[0]`.
11. **`engineCall` errors** are JSON `{error}` strings. Use `parseEngineError`.
12. **`saveDocument` payload** is a string (`DocumentRecord.payload`). Stringify JSON yourself.
13. **IndexedDB leftover holes** after e2e will confuse Centerline offset lists. Load dual-lateral or Curve Recovery fresh.
14. **Site chrome** can hide the workspace at 1366×768. Scroll `#workspace` before judging layout.
15. **Goldens are print-precision oracles**, not a license to copy vendor code or claim bit-identity.

---

## 12. Suggested next work (if asked)

Priority if the user wants the prompt contract tightened, not new product surface:

1. Rebuild WASM after the centerline clip; re-run `npm run build` + Playwright.
2. Promote planning UI to the persisted `Plan` / `PlanSection` table (lock/solve, revision, corridor).
3. Run `cargo tauri build --debug` and record installer evidence.
4. Add Playwright for v1 snapshot import and Shift Card preview (without relying on `window.print`).
5. Lazy-load workspaces if bundle/main-thread cost shows up.
6. Only then consider a **separately enabled** desktop Geocertainty adapter (user token, payload confirm, no secret in snapshots, default CSP unchanged). Do not fake a connected success path.

If the user asks to commit: include 0.2 source, generated WASM, and docs; **exclude** the four user-owned untracked paths in §2 unless they explicitly ask to add them.

---

## 13. Reading order for a new agent

1. This file.
2. `git status --short --branch` and `git log -5 --oneline`.
3. `README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/CALCULATION_SPEC.md`.
4. `crates/delve-engine/src/lib.rs` (op list).
5. `src/App.tsx` workspace host + `src/workspaces/*`.
6. `src/platform/types.ts`, `snapshot.ts`, `browser/idb.ts`, `crates/delve-storage/src/lib.rs`.
7. Only then the original prompt `docs/CURSOR_VNEXT_PLAN_FLIGHT_DECK_PROMPT.md` if you need the unmet contract.

Do not assume documentation is newer than the code. If they disagree, the code and tests win — then fix the docs.

---

## 14. Completion-contract reminder

Use only: `PLANNED`, `IMPLEMENTED_UNVERIFIED`, `TEST_VERIFIED`, `STAGING_VERIFIED`, `CLIENT_ARTIFACT_VERIFIED`, `BLOCKED`, `DONE`.

`DONE` requires every applicable acceptance criterion with command / metric / job / artifact evidence. Unit tests alone do not verify PDFs, PNGs, 3-D semantics, or client-facing claims.

At the end of the last implementation pass:

- Calculation crates + migrations + adapters: **TEST_VERIFIED**
- Browser workspaces exercised at 1366×768: **CLIENT_ARTIFACT_VERIFIED** for Survey / Planning / Flight Deck / Centerline / Depth / Reports panels; report-print popup not captured
- Live Geocertainty: **NOT YET VALIDATED**
- Product release vs the full prompt: **IMPLEMENTED_UNVERIFIED**
- Default runtime: **offline**
