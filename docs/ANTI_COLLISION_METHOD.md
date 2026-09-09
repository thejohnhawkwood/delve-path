# Anti-collision planning experiment: calculation specification

Method identifier: `delvepath/bezier-envelope-screen/2`. Created by Philip Bird — Mithril Consulting. Independent implementation in `crates/delve-engine/src/collision.rs`; no proprietary solver or runtime service. Version 2 adds an explicit offset-curve approximation bound; old cases without this field mean supplied straight segments.

**Engineering prototype / evaluation software — not certified. Not regulator-approved. Not for collision avoidance, well control, or steering decisions.**

This method generates and checks geometric correction candidates. It does not implement a company anti-collision policy, an ISCWSA error model, separation factor, minimum allowable separation distance rule, collision probability, or actual motor/RSS control. The existing Centerline workspace remains a separate uncertainty-free distance calculation.

## Research and design decisions

ISCWSA describes centerline distance, uncertainty separation, ratio-based rules and probability calculations as distinct methods. It highlights the effect of scan geometry and interval selection. This implementation therefore checks continuous segment pairs in 3-D, retains explicit uncertainty/radius/margin inputs, and names the actual metric rather than calling a centerline distance a separation factor. Its enclosing-sphere test is deliberately conservative; ISCWSA notes that largest-axis approximations can be overly conservative. A passing geometric bound is not an operational safety conclusion. [ISCWSA, Collision Avoidance Calculations — Current Common Practice, §§1–2](https://www.iscwsa.net/media/files/files/b6fb074d/current-common-practice-in-collision-avoidance-calculations-oct-2017.pdf).

Survey covariance and project-ahead response uncertainty have different sources. A fitted BHA response band is not automatically a positional probability region. The lab uses explicitly declared whole-path covariance envelopes and does not turn the Flight Deck's deterministic yield bands into covariance. [ISCWSA, Project Ahead Uncertainty: Implications and Interpretation](https://www.iscwsa.net/files/776/).

ISCWSA publishes error-model definitions, diagnostics and tool-code material. DelvePath does not propagate those models in this build. A manually entered matrix or the constructed demo must not be represented as a validated tool model. [ISCWSA Error Model Documentation](https://www.iscwsa.net/error-model-documentation/).

Confidence scaling is dimensional: the radius multiplier is the square root of the chi-square quantile for the region's dimension. Independent tests use NIST's printed 3-degree-of-freedom values at probabilities 0.90, 0.975, 0.99 and 0.999. [NIST/SEMATECH e-Handbook §1.3.6.7.4](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3674.htm).

Sources reviewed 2026-09-08 America/Edmonton. These references motivate definitions and interpretation; the bounded Bézier search below is an independently derived geometric experiment, not an ISCWSA-endorsed algorithm.

## Inputs and coordinate contract

All coordinates are local North/East/TVD, with TVD positive down. Inclination is from vertical down; azimuth is clockwise from north. Every path must specify matching units, north reference, origin, vertical datum and CRS identifier. CRS is metadata: no rotation, datum shift or geodetic transformation is silently performed.

The correction anchor must match the final supplied current state in position, MD and tangent. That state may be a supplied survey or an externally estimated bit state; the lab does not estimate sensor-to-bit distance. Target position and exit attitude are explicit. The target's input MD is not a constraint; generated MD follows arc length from the anchor.

Offsets are explicitly supplied **polylines**, with increasing MD. No minimum-curvature interpolation is implied by this interchange format. Survey reconstruction remains in `delve-core`. Imported offset geometry must be resolved to adequate fidelity before using this lab. The reference curve's approximation bound does not cover unknown errors in imported offsets.

The integrated **Use active hole & forecast** workflow reconstructs project offsets through `delve-core`, then samples each minimum-curvature circular arc. For course length L, dogleg β and n equal subintervals, the chord deviation is `2(L/β) sin²(β/(4n))`, bounded above by `Lβ/(8n²)`. The sampler chooses n to meet its tolerance (0.01 m or 0.03 ft), retains a whole-offset `chord_error_bound`, and rejects requests needing more than 2000 points. Straight intervals need only their endpoints. The interchange file records the resulting points and bound; it does not silently replace imported geometry.

Each path has a physical hole/casing radius, a symmetric positive-semidefinite one-sigma covariance in length², provenance, and the literal coverage declaration `whole_path_constant_envelope`. This is a constant envelope asserted over the whole supplied interval, not an individual station covariance extrapolated downstream. No covariance is inferred when it is missing.

## Generated curve family

Let P₀, P₁ be the anchor and target, T₀, T₁ their unit tangents, and L = |P₁−P₀|. Start with the quintic Bézier control points:

```text
P₀
P₀ + L T₀/5
P₀ + 2 L T₀/5
P₁ − 2 L T₁/5
P₁ − L T₁/5
P₁
```

This fixes endpoint position and tangent and gives zero endpoint second derivative. Degree-elevate to six, then add an excursion to the middle control point. Equivalently:

```text
r(u) = baseline(u) + 64 u³(1−u)³ (a R₀ + b H₀),  0 ≤ u ≤ 1
```

R₀ and H₀ are the initial right and high-side vectors. The bump has zero first and second derivatives at both ends and peaks at one at u=0.5. Thus the correction preserves the endpoint constraints. At a vertical anchor, azimuth explicitly selects the geometric bending frame; no gravity-toolface steering instruction is inferred.

The search evaluates the baseline plus sixteen directions at four excursion magnitudes: 65 candidates. Passing candidates are ordered by approximate length, then clearance and ID. The first three are available for comparison. “No candidate in search” does not prove no feasible trajectory exists outside this finite family. Likewise, the shortest passing candidate is not a globally optimal path.

## Continuous bounds and numerical work

De Casteljau subdivision retains the exact curve. The maximum distance of the control points from the closed endpoint chord bounds the subcurve's distance from that chord by the convex-hull property. Endpoints and continuity also ensure every chord point has a curve point within this bound. Subdivision continues until this bound is at most the requested chord tolerance and the control-polygon length is at most 10 m (30 ft for imperial display). A resolution limit returns an error; it does not accept an unresolved curve.

For each subcurve, arc length lies between endpoint-chord length and control-polygon length. Output MD uses the midpoint of these bounds. The accumulated half-difference is reported as the arc-length error bound. Closest-approach points lie on the tessellation and their MDs locate that approximate geometry; the length bound is not a bound on the MD of a possibly nonunique continuous minimizer.

Curvature is `|r′ × r″| / |r′|³`. The engine forms the Bernstein coefficients of `r′ × r″` using the Bernstein product identity. The largest coefficient norm bounds the numerator. The smallest projection of derivative control points along the chord bounds speed below. A nonpositive speed bound forces further subdivision. The quotient supplies a curvature upper bound for the **whole** subcurve, not just sampled vertices. DLS is curvature × 180/π × reference length (30 m or 100 ft). Tests compare the bound to an independently evaluated dense derivative grid.

Every reference chord is checked against every segment of every supplied offset. Analytic segment-pair minimization covers interior and endpoint minima, including parallel cases. The minimum over the tessellation is D. Frame checks run before geometry.

## Clearance metric

For covariance C and stated per-location confidence p, set:

```text
k = sqrt(χ²₃(p))
R = k sqrt(λmax(C))
required = Rreference + Roffset + holeRadiusReference + holeRadiusOffset + margin
clearance lower bound = D − required − chordTolerance − offset.chord_error_bound
```

Each ellipsoid is enclosed by its corresponding sphere. Subtracting both curve-approximation bounds gives a conservative lower bound on separation of the geometric uncertainty/radius envelopes over the specified intervals. Positive or zero passes this configured geometric check; negative is inconclusive about actual ellipsoid intersection and is rejected by this conservative search.

The ellipsoid confidence interpretation assumes a centered Gaussian positional-error model at each location. It is **not** joint confidence for an entire well, and it is not collision probability. No independence or cross-well correlation assumption is needed to state the geometric enclosing-sphere bound; a probabilistic interpretation of joint events would need much more information.

For inspection only, an encounter also records a directional support-plane gap:

```text
D − k sqrt(uᵀ Cref u) − k sqrt(uᵀ Coff u) − radii − margin
```

This is evaluated at that point pair. It is not the global minimum ellipsoid distance and does not select a candidate. This distinction is retained in the JSON field name and code comments.

## Preview geometry

`uncertainty.rs` diagonalizes the full symmetric matrix. Mesh vertices satisfy the ellipsoid quadratic surface, including rotated covariance. Plan and Profile outlines use `P C Pᵀ` with the **same 3-D k**. Profile P uses the selected section azimuth, not a fixed North/TVD plane. The EOU workspace separately shows the smaller 2-D marginal ellipse in Plan, using χ²₂. At 95%, k₂≈2.4477 and k₃≈2.7955; k=3 in three dimensions covers about 97.1%.

Layers independently control the current path, offsets, uncorrected route, selected correction, uncertainty, connectors and target. BHA response curves remain distinct. Plot coordinates preserve true length proportions; focused 3-D aspect uses the displayed bounds. A target crosshair is a display marker, not a target radius.

## Reproduction and evidence

`npm run verify:collision` builds the native JSON example, executes identical requests through native and WASM engines, compares all output fields, and writes the case, result, timings and parity evidence to `artifacts/verification/`. Comparison tolerance is `1e-8 + 1e-10 × max(|a|,|b|)` for numeric values; structure and nonnumeric fields must agree exactly.

The UI exports an audit with complete inputs, method version, source fingerprint, all 65 candidate summaries, baseline, three passing alternatives, assumptions and input/result SHA-256 hashes. Import verifies the hashes before recomputing. A hash mismatch on recomputation is surfaced, including changes caused by different engine builds or floating-point platforms. Hashes detect content changes; they are not signatures or certification.

Saved runs are immutable `scan` documents with unique IDs in the existing SQLite v5 / IndexedDB v2 / snapshot v2 stores. They do not become measured survey rows. Candidate CSVs are explicitly labelled `planned` and include units, prototype notice and MD error bounds.

The browser worker uses the already compiled WASM module and embedded worker code, so subsequent calculations do not require a fetch. Desktop dispatch uses the same Rust engine on a background thread. File access is offline; native import/export paths are chosen in OS dialogs. Native cancellation discards the result but does not preempt the bounded Rust call.
