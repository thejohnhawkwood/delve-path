# DelvePath 0.2.2 — integrated field workflow

The working question is “Where are we, what happens next, and how much space is left?” Survey, Flight Deck, Uncertainty and Clearance now share one active hole and one viewer. Planning, targets, depth, centerline and reports remain available as supporting tools.

## Walk through it

1. Open **Flight Deck**, then **Load Curve Recovery demo**. It creates a separate example project with accepted surveys and a comparison plan. Select Hold direction, Your slide then rotate, or Longer, gentler slide. The selected path is cyan; amber shows the bit estimate and hold comparison; violet is the plan. Change slide length or toolface to recalculate. The cards report the next sensor attitude and the largest bend anywhere in the interval.
2. Open **Uncertainty (EOU)**. Choose a survey station, estimated bit, or forecast endpoint. Enter the one-sigma North, East and vertical spreads and their source; use the advanced matrix only for correlated errors. Import places a true ellipsoid and its corresponding outlines in the shared viewer. A whole-hole envelope is a separate, explicit declaration; a single station ellipsoid is not automatically extended along the hole.
3. Open **Clearance (anti-collision)**, then **Load crossing demo**. It creates three Survey holes in metres and supplies labelled synthetic uncertainty envelopes. DP-03 heads north toward an eastbound crossing; the lower parallel lateral constrains a downward detour. Choose **Use active hole & forecast**, then **Generate drill path**.
4. Toggle path, uncertainty and closest-approach layers. Inspect the complete calculation or export the audit. **Use correction as comparison plan** carries the chosen route into Flight Deck for comparison with the next stand. It remains planned geometry; it never becomes a measured survey.
5. Change a survey, forecast or uncertainty declaration. The previous clearance snapshot is marked out of date and cannot be generated, adopted or exported until refreshed. Save project data and save the immutable calculation run separately. Browser reopening restores the active hole and uncertainty declarations; saved runs replay their own complete recorded inputs.

Keep **Explain mode** enabled. Hovering or focusing controls explains the action, units or assumption; Escape dismisses the explanation. Plan, Profile and 3-D are views of the same data. The browser workspace fills the window; all three field panels stay mounted across navigation so card choices and form inputs survive tab changes.

## Findings corrected

- Scenario cards had no selection action and displayed unrelated paths. Cards now select an explicit forecast object shared with the viewer, uncertainty and clearance.
- The demo’s position was hardcoded independently of its surveys. It now comes from the same minimum-curvature reconstruction as Survey.
- The previous reveal flow fabricated a future position and claimed learning. That UI was removed. This build uses entered motor response and does not claim automatic BHA learning.
- The next sensor was linearly interpolated across the whole stand. It now evaluates the actual slide/rotate prefix at future bit MD minus sensor spacing. Intervals shorter than the spacing are rejected because the necessary earlier trajectory was not supplied.
- The bend-limit check used the final rotary point and missed an earlier slide. It now checks maximum DLS across the interval; average DLS is weighted by course length. Segment lengths must sum to the requested interval.
- Collision had a disconnected demo and separate chart. It now consumes the active hole, selected bit/forecast, source-labelled envelopes and project offsets. A separately labelled check screens the exact selected forecast polyline; generating a correction explores endpoint-constrained curves.
- Project offset surveys were coarse chords. The shared Rust engine now samples their minimum-curvature arcs with a sagitta bound, and clearance subtracts that bound as well as the generated curve bound.
- Uncertainty was presented primarily as raw matrix entries. Plain spread inputs now precede the advanced covariance matrix. Source, units and whole-hole coverage are retained in project documents.
- Stale asynchronous survey results could anchor later work. Forecasts now require a result matching the current complete calculation request, and superseded calculations are discarded.
- The field viewer could be tiny, embedded beneath the marketing page or lose useful state during navigation. Its container now fills the workspace and the 3-D camera uses a readable orthographic view with equal length scale on all axes.

## Mathematical basis and limits

Survey intervals are the `delve-core` minimum-curvature circular arcs. Flight Deck estimates the bit by holding the last accepted attitude over the sensor gap; forecasts integrate an entered gravity toolface and slide response, with zero rotary tendency. The interval must cover the sensor spacing. There is no inferred motor response or hidden covariance propagation.

ISCWSA distinguishes survey-position uncertainty from project-ahead response uncertainty. The UI retains that distinction: deterministic forecast differences are not positional confidence regions. See [Project Ahead Uncertainty: Implications and Interpretation](https://www.iscwsa.net/files/776/) and [ISCWSA Error Model Documentation](https://www.iscwsa.net/error-model-documentation/). The former is a draft technical reference, not certification of this implementation.

The geometric correction search, confidence interpretation, coordinate checks, enclosing-sphere clearance and continuous Bézier bounds are specified in [ANTI_COLLISION_METHOD.md](ANTI_COLLISION_METHOD.md). A generated curve is a comparison plan, not a motor command or operational clearance decision. Imported polylines have only the geometry and bounds explicitly supplied. EOU values remain user-supplied covariance; this release does not implement ISCWSA tool-error propagation.

## Verification and traceability

`e2e/field-workflow.spec.ts` exercises card-to-trace changes, recalculation, explanatory help, placement of uncertainty on the bit, tab persistence, a complete three-hole correction workflow, stale-result blocking and actionable missing-input states. Existing browser tests cover projection layouts, repeated 2-D/3-D/target transitions, layer visibility, audit replay, offline calculation and local project reopening.

Rust regression tests independently check the sensor inside a slide before rotation, a slide that exceeds the bend limit despite a final zero-DLS rotary interval, analytic quarter-circle sampling and its sagitta, and clearance reduction by the offset approximation bound. Existing minimum-curvature golden fixtures and native/WASM parity checks remain part of release validation.

Reproduce with `cargo test --workspace`, `npm run test-ui`, `npm run verify:collision`, and `npm run test-e2e` against a production preview. Build WASM before the web bundle. Browser comparisons export all inputs, selected card, scenario results, assumptions and source fingerprint. Collision audits retain all 65 search candidates and input/result hashes; replay reports any engine-result difference.

Local release verification on 2026-09-09: 121 Rust tests, 29 TypeScript unit tests and 15 production-browser walkthroughs passed. Seven field/viewer walkthroughs were repeated after the final camera framing change. Rust formatting and Clippy with warnings denied passed. The four native/WASM collision variants compared 9,986 numeric values with maximum absolute difference 5.69×10⁻¹⁴. License and bundle checks passed. Browser screenshots and calculation records are generated under `test-results/` and `artifacts/verification/` rather than checked into source.
