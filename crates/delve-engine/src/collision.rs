//! Reproducible geometric anti-collision planning experiment.
//! See docs/ANTI_COLLISION_METHOD.md for the derivation and scope of the bounds.
//! No survey error propagation, collision probability, rig control, or steering advice.

use delve_assurance::covariance::{chi2_k, eigen_sym3};
use delve_core::{
    frames_comparable, high_side, right_side, unit_tangent, CoordinateFrame, NorthReference,
    UnitSystem, Vec3, VerticalDatumKind,
};
use serde::{Deserialize, Serialize};

pub const METHOD: &str = "delvepath/bezier-envelope-screen/2";
pub const NOTICE: &str = "Engineering prototype / evaluation software — not certified. Not regulator-approved. Not for collision avoidance, well control, or steering decisions.";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurveyPoint {
    pub md: f64,
    pub north: f64,
    pub east: f64,
    pub tvd: f64,
    pub inc_deg: f64,
    pub azi_deg: f64,
}
impl SurveyPoint {
    fn pos(&self) -> Vec3 {
        Vec3::new(self.north, self.east, self.tvd)
    }
    fn tangent(&self) -> Vec3 {
        unit_tangent(self.inc_deg.to_radians(), self.azi_deg.to_radians())
    }
    fn at(p: Vec3, t: Vec3, md: f64) -> Self {
        let t = t.try_normalize().unwrap_or(t);
        Self {
            md,
            north: p.n,
            east: p.e,
            tvd: p.t,
            inc_deg: t.t.clamp(-1.0, 1.0).acos().to_degrees(),
            azi_deg: t.e.atan2(t.n).to_degrees().rem_euclid(360.0),
        }
    }
}

/// A declared constant covariance envelope over the ENTIRE supplied path, in unit².
/// This is not interpolation/extrapolation from an individual survey covariance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Envelope {
    pub covariance: [[f64; 3]; 3],
    pub source: String,
    pub scope: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OffsetPath {
    pub id: String,
    pub name: String,
    pub frame: CoordinateFrame,
    /// Explicit polyline geometry; no implied minimum-curvature reconstruction.
    pub points: Vec<SurveyPoint>,
    /// Maximum distance from this polyline to the reconstructed offset curve.
    /// Zero denotes explicitly supplied straight segments (legacy case format).
    #[serde(default)]
    pub chord_error_bound: f64,
    pub radius: f64,
    pub envelope: Envelope,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Case {
    pub name: String,
    pub synthetic: bool,
    pub frame: CoordinateFrame,
    pub current: Vec<SurveyPoint>,
    pub start: SurveyPoint,
    pub target: SurveyPoint,
    pub radius: f64,
    pub envelope: Envelope,
    pub offsets: Vec<OffsetPath>,
    pub confidence: f64,
    pub margin: f64,
    pub max_dls: f64,
    pub max_excursion: f64,
    pub chord_tolerance: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Encounter {
    pub offset_id: String,
    pub offset_name: String,
    pub distance: f64,
    pub reference: SurveyPoint,
    pub offset: SurveyPoint,
    pub reference_envelope_radius: f64,
    pub offset_envelope_radius: f64,
    pub required_distance: f64,
    pub clearance_lower_bound: f64,
    /// Support-plane gap at this point pair only; NOT minimum ellipsoid distance.
    pub directional_support_gap: Option<f64>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateSummary {
    pub id: String,
    pub excursion_right: f64,
    pub excursion_high: f64,
    pub length: f64,
    pub length_error_bound: f64,
    pub max_dls_bound: f64,
    pub min_clearance_bound: f64,
    pub meets_constraints: bool,
    pub reasons: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candidate {
    pub summary: CandidateSummary,
    pub points: Vec<SurveyPoint>,
    pub controls: Vec<[f64; 3]>,
    pub encounters: Vec<Encounter>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Generation {
    pub method: String,
    pub notice: String,
    pub input: Case,
    pub baseline: Candidate,
    pub alternatives: Vec<Candidate>,
    pub ledger: Vec<CandidateSummary>,
    pub status: String,
    pub assumptions: Vec<String>,
}

fn err(s: &str) -> String {
    s.into()
}
fn valid_point(p: &SurveyPoint) -> bool {
    [p.md, p.north, p.east, p.tvd, p.inc_deg, p.azi_deg]
        .iter()
        .all(|x| x.is_finite())
        && (0.0..=180.0).contains(&p.inc_deg)
}
pub fn validate_covariance(c: &[[f64; 3]; 3]) -> Result<f64, String> {
    if !c.iter().flatten().all(|x| x.is_finite()) {
        return Err(err("Covariance entries must be finite."));
    }
    let scale = c.iter().flatten().map(|v| v.abs()).fold(1.0_f64, f64::max);
    for (i, row) in c.iter().enumerate() {
        for (j, value) in row.iter().enumerate() {
            if (*value - c[j][i]).abs() > 1e-12 * scale {
                return Err(err("Covariance must be symmetric."));
            }
        }
    }
    let eig = eigen_sym3(c).0;
    if eig.iter().any(|v| *v < 0.0) {
        return Err(err("Covariance must be positive semidefinite."));
    }
    Ok(eig.into_iter().fold(0.0, f64::max).sqrt())
}
fn envelope_radius(e: &Envelope, k: f64) -> Result<f64, String> {
    if e.source.trim().is_empty() || e.scope != "whole_path_constant_envelope" {
        return Err(err("Record covariance provenance and explicitly declare whole_path_constant_envelope coverage. Station covariance cannot be extrapolated."));
    }
    Ok(k * validate_covariance(&e.covariance)?)
}
pub fn validate(c: &Case) -> Result<(), String> {
    frames_comparable(&c.frame, &c.frame).map_err(|e| format!("Coordinate frame: {e:?}"))?;
    if !valid_point(&c.start)
        || !valid_point(&c.target)
        || c.current.is_empty()
        || !c.current.iter().all(valid_point)
    {
        return Err(err(
            "Finite start, target and current survey points are required.",
        ));
    }
    if c.current.windows(2).any(|p| p[1].md <= p[0].md) {
        return Err(err("Current survey MDs must increase."));
    }
    let last = c.current.last().unwrap();
    if last.pos().sub(c.start.pos()).norm() > 1e-6
        || (last.md - c.start.md).abs() > 1e-6
        || last.tangent().sub(c.start.tangent()).norm() > 1e-8
    {
        return Err(err("The correction must start at the last supplied current survey/bit state, with the same position and attitude."));
    }
    let scale = if c.frame.unit_system == UnitSystem::Imperial {
        0.3048
    } else {
        1.0
    };
    let span = c.target.pos().sub(c.start.pos()).norm() * scale;
    if !(1.0..=10000.0).contains(&span) {
        return Err(err("Target distance must be between 1 m and 10 km."));
    }
    if ![
        c.radius,
        c.margin,
        c.max_dls,
        c.max_excursion,
        c.chord_tolerance,
        c.confidence,
    ]
    .iter()
    .all(|x| x.is_finite())
        || c.radius < 0.0
        || c.margin < 0.0
        || c.max_dls <= 0.0
        || c.max_excursion <= 0.0
        || c.max_excursion * scale > 2000.0
        || !(0.001..=0.1).contains(&(c.chord_tolerance * scale))
    {
        return Err(err("Enter nonnegative radii/margin, positive DLS/excursion (≤ 2 km), and chord tolerance between 0.001 and 0.1 m."));
    }
    let k = chi2_k(3, c.confidence).map_err(|e| e.to_string())?;
    envelope_radius(&c.envelope, k)?;
    if c.offsets.is_empty() || c.offsets.len() > 20 {
        return Err(err("Provide between 1 and 20 offset paths."));
    }
    let mut ids = std::collections::HashSet::new();
    for off in &c.offsets {
        if off.id.trim().is_empty() || !ids.insert(&off.id) {
            return Err(err("Offset IDs must be nonempty and unique."));
        }
        frames_comparable(&c.frame, &off.frame)
            .map_err(|e| format!("Offset {} frame: {e:?}", off.name))?;
        if !off.radius.is_finite()
            || off.radius < 0.0
            || !off.chord_error_bound.is_finite()
            || !(0.0..=0.1).contains(&(off.chord_error_bound * scale))
            || off.points.len() < 2
            || off.points.len() > 2000
            || !off.points.iter().all(valid_point)
            || off
                .points
                .windows(2)
                .any(|p| p[1].md <= p[0].md || p[1].pos().sub(p[0].pos()).norm() <= 1e-9)
        {
            return Err(err("Offsets require nonnegative radius and 2–2000 finite polyline points with increasing MD and distinct positions."));
        }
        envelope_radius(&off.envelope, k)?;
    }
    Ok(())
}

fn mix(a: Vec3, b: Vec3, t: f64) -> Vec3 {
    a.scale(1.0 - t).add(b.scale(t))
}
fn split(p: &[Vec3]) -> (Vec<Vec3>, Vec<Vec3>) {
    let mut row = p.to_vec();
    let mut left = vec![row[0]];
    let mut right = vec![*row.last().unwrap()];
    while row.len() > 1 {
        row = row.windows(2).map(|w| mix(w[0], w[1], 0.5)).collect();
        left.push(row[0]);
        right.push(*row.last().unwrap());
    }
    right.reverse();
    (left, right)
}
fn deriv(p: &[Vec3]) -> Vec<Vec3> {
    p.windows(2)
        .map(|w| w[1].sub(w[0]).scale((p.len() - 1) as f64))
        .collect()
}
fn choose(n: usize, k: usize) -> f64 {
    if k > n {
        return 0.0;
    }
    (0..k).fold(1.0, |v, i| v * (n - i) as f64 / (i + 1) as f64)
}
/// Bernstein product coefficients bound |r' × r''|. Positive tangent projection
/// bounds speed below. These convex-hull bounds hold over the entire subcurve.
fn curvature_bound(p: &[Vec3]) -> f64 {
    let d = deriv(p);
    let dd = deriv(&d);
    let n = d.len() - 1;
    let m = dd.len() - 1;
    let axis = p[p.len() - 1]
        .sub(p[0])
        .try_normalize()
        .unwrap_or(Vec3::ZERO);
    let speed = d.iter().map(|v| v.dot(axis)).fold(f64::INFINITY, f64::min);
    if speed <= 1e-12 {
        return f64::INFINITY;
    }
    let max_cross = (0..=n + m)
        .map(|k| {
            (0..=n)
                .filter(|i| k >= *i && k - *i <= m)
                .fold(Vec3::ZERO, |v, i| {
                    v.add(
                        d[i].cross(dd[k - i])
                            .scale(choose(n, i) * choose(m, k - i) / choose(n + m, k)),
                    )
                })
                .norm()
        })
        .fold(0.0, f64::max);
    max_cross / speed.powi(3)
}
fn point_seg_distance(p: Vec3, a: Vec3, b: Vec3) -> f64 {
    let v = b.sub(a);
    let t = (p.sub(a).dot(v) / v.dot(v).max(1e-30)).clamp(0.0, 1.0);
    p.sub(a.add(v.scale(t))).norm()
}
struct Flattened {
    points: Vec<SurveyPoint>,
    length: f64,
    length_error: f64,
    curvature: f64,
}
fn flatten(p: &[Vec3], md: f64, tol: f64, max_step: f64) -> Result<Flattened, String> {
    let mut out = Flattened {
        points: vec![SurveyPoint::at(p[0], p[1].sub(p[0]), md)],
        length: 0.0,
        length_error: 0.0,
        curvature: 0.0,
    };
    let mut stack = vec![(p.to_vec(), 0)];
    while let Some((cp, depth)) = stack.pop() {
        let end = *cp.last().unwrap();
        let chord = end.sub(cp[0]).norm();
        let upper: f64 = cp.windows(2).map(|w| w[1].sub(w[0]).norm()).sum();
        let flat = cp
            .iter()
            .map(|v| point_seg_distance(*v, cp[0], end))
            .fold(0.0, f64::max);
        let curvature = curvature_bound(&cp);
        if flat <= tol && upper <= max_step && curvature.is_finite() {
            out.length += (chord + upper) / 2.0;
            out.length_error += (upper - chord).max(0.0) / 2.0;
            out.curvature = out.curvature.max(curvature);
            out.points.push(SurveyPoint::at(
                end,
                end.sub(cp[cp.len() - 2]),
                md + out.length,
            ));
        } else {
            if depth >= 20 || out.points.len() + stack.len() > 10000 {
                return Err(err("Curve resolution limit reached or curve reverses/cusps; no candidate accepted."));
            }
            let (left, right) = split(&cp);
            stack.push((right, depth + 1));
            stack.push((left, depth + 1));
        }
    }
    Ok(out)
}
fn controls(c: &Case, right: f64, high: f64) -> Vec<Vec3> {
    let a = c.start.pos();
    let b = c.target.pos();
    let len = b.sub(a).norm();
    let ta = c.start.tangent().scale(len / 5.0);
    let tb = c.target.tangent().scale(len / 5.0);
    // Quintic endpoint Hermite: positions/tangents fixed, zero endpoint curvature.
    let base = [
        a,
        a.add(ta),
        a.add(ta.scale(2.0)),
        b.sub(tb.scale(2.0)),
        b.sub(tb),
        b,
    ];
    let mut cp = vec![a];
    for i in 1..6 {
        cp.push(mix(base[i], base[i - 1], i as f64 / 6.0));
    }
    cp.push(b);
    // Add 64 u³(1-u)³ (right R + high H), peaking at the entered excursion.
    let r = right_side(c.start.azi_deg.to_radians());
    let h = high_side(c.start.inc_deg.to_radians(), c.start.azi_deg.to_radians());
    cp[3] = cp[3].add(r.scale(3.2 * right)).add(h.scale(3.2 * high));
    cp
}

/// Analytic closest points over two closed segments, including endpoint minima.
pub fn segment_pair(a: Vec3, b: Vec3, c: Vec3, d: Vec3) -> (f64, f64, f64) {
    let u = b.sub(a);
    let v = d.sub(c);
    let w = a.sub(c);
    let aa = u.dot(u);
    let bb = u.dot(v);
    let cc = v.dot(v);
    let dd = u.dot(w);
    let ee = v.dot(w);
    let mut best = (f64::INFINITY, 0.0, 0.0);
    let mut try_pair = |s: f64, t: f64| {
        let dist = w.add(u.scale(s)).sub(v.scale(t)).norm();
        if dist < best.0 {
            best = (dist, s, t);
        }
    };
    try_pair(0.0, (ee / cc.max(1e-30)).clamp(0.0, 1.0));
    try_pair(1.0, ((ee + bb) / cc.max(1e-30)).clamp(0.0, 1.0));
    try_pair((-dd / aa.max(1e-30)).clamp(0.0, 1.0), 0.0);
    try_pair(((bb - dd) / aa.max(1e-30)).clamp(0.0, 1.0), 1.0);
    let den = aa * cc - bb * bb;
    if den > 1e-14 * aa * cc {
        let s = (bb * ee - cc * dd) / den;
        let t = (aa * ee - bb * dd) / den;
        if (0.0..=1.0).contains(&s) && (0.0..=1.0).contains(&t) {
            try_pair(s, t);
        }
    }
    best
}
fn lerp_point(a: &SurveyPoint, b: &SurveyPoint, t: f64) -> SurveyPoint {
    SurveyPoint::at(
        mix(a.pos(), b.pos(), t),
        mix(a.tangent(), b.tangent(), t),
        a.md + (b.md - a.md) * t,
    )
}
fn support(c: &[[f64; 3]; 3], u: Vec3) -> f64 {
    let a = u.to_array();
    (0..3)
        .map(|i| (0..3).map(|j| a[i] * c[i][j] * a[j]).sum::<f64>())
        .sum::<f64>()
        .max(0.0)
        .sqrt()
}
fn encounter(
    c: &Case,
    points: &[SurveyPoint],
    off: &OffsetPath,
    k: f64,
) -> Result<Encounter, String> {
    let mut best = (f64::INFINITY, points[0].clone(), off.points[0].clone());
    for a in points.windows(2) {
        for b in off.points.windows(2) {
            let (dist, s, t) = segment_pair(a[0].pos(), a[1].pos(), b[0].pos(), b[1].pos());
            if dist < best.0 {
                best = (
                    dist,
                    lerp_point(&a[0], &a[1], s),
                    lerp_point(&b[0], &b[1], t),
                );
            }
        }
    }
    let rr = envelope_radius(&c.envelope, k)?;
    let ro = envelope_radius(&off.envelope, k)?;
    let required = rr + ro + c.radius + off.radius + c.margin;
    let directional = best.2.pos().sub(best.1.pos()).try_normalize().map(|u| {
        best.0
            - k * (support(&c.envelope.covariance, u) + support(&off.envelope.covariance, u))
            - c.radius
            - off.radius
            - c.margin
    });
    Ok(Encounter {
        offset_id: off.id.clone(),
        offset_name: off.name.clone(),
        distance: best.0,
        reference: best.1,
        offset: best.2,
        reference_envelope_radius: rr,
        offset_envelope_radius: ro,
        required_distance: required,
        clearance_lower_bound: best.0 - required - c.chord_tolerance - off.chord_error_bound,
        directional_support_gap: directional,
    })
}
fn candidate(c: &Case, id: String, right: f64, high: f64) -> Result<Candidate, String> {
    let cp = controls(c, right, high);
    let step = if c.frame.unit_system == UnitSystem::Imperial {
        30.0
    } else {
        10.0
    };
    let path = flatten(&cp, c.start.md, c.chord_tolerance, step)?;
    let ref_length = if c.frame.unit_system == UnitSystem::Imperial {
        100.0
    } else {
        30.0
    };
    let dls = path.curvature.to_degrees() * ref_length;
    let k = chi2_k(3, c.confidence).map_err(|e| e.to_string())?;
    let encounters = c
        .offsets
        .iter()
        .map(|off| encounter(c, &path.points, off, k))
        .collect::<Result<Vec<_>, _>>()?;
    let clearance = encounters
        .iter()
        .map(|e| e.clearance_lower_bound)
        .fold(f64::INFINITY, f64::min);
    let mut reasons = Vec::new();
    if clearance < 0.0 {
        reasons.push("Envelope clearance below configured margin".into());
    }
    if dls > c.max_dls {
        reasons.push("Dogleg upper bound exceeds configured limit".into());
    }
    Ok(Candidate {
        summary: CandidateSummary {
            id,
            excursion_right: right,
            excursion_high: high,
            length: path.length,
            length_error_bound: path.length_error,
            max_dls_bound: dls,
            min_clearance_bound: clearance,
            meets_constraints: reasons.is_empty(),
            reasons,
        },
        points: path.points,
        controls: cp.iter().map(|p| p.to_array()).collect(),
        encounters,
    })
}
pub fn analyze(c: &Case) -> Result<Candidate, String> {
    validate(c)?;
    candidate(c, "uncorrected".into(), 0.0, 0.0)
}

/// Screen the explicitly supplied forecast polyline, not a regenerated endpoint curve.
/// This says nothing about unprovided curvature between its sampled points.
pub fn screen_forecast(c: &Case, points: &[SurveyPoint]) -> Result<Vec<Encounter>, String> {
    validate(c)?;
    if points.len() < 2
        || points.len() > 2000
        || points.iter().any(|p| !valid_point(p))
        || points.windows(2).any(|w| w[1].md <= w[0].md)
    {
        return Err(err(
            "Forecast needs 2–2000 finite points with increasing MD.",
        ));
    }
    if points[0].pos().sub(c.start.pos()).norm() > 1e-6
        || (points[0].md - c.start.md).abs() > 1e-6
        || points.last().unwrap().pos().sub(c.target.pos()).norm() > 1e-6
    {
        return Err(err(
            "Forecast must match the active bit and chosen endpoint.",
        ));
    }
    let k = chi2_k(3, c.confidence).map_err(|e| e.to_string())?;
    c.offsets
        .iter()
        .map(|off| encounter(c, points, off, k))
        .collect()
}
pub fn generate(c: &Case) -> Result<Generation, String> {
    validate(c)?;
    let baseline = candidate(c, "uncorrected".into(), 0.0, 0.0)?;
    let mut ledger = vec![baseline.summary.clone()];
    let mut alternatives = Vec::new();
    if baseline.summary.meets_constraints {
        alternatives.push(baseline.clone());
    }
    for level in 1..=4 {
        for direction in 0..16 {
            let angle = std::f64::consts::TAU * direction as f64 / 16.0;
            let excursion = c.max_excursion * level as f64 / 4.0;
            let mut cand = candidate(
                c,
                format!("C{level}-{:02}", direction + 1),
                excursion * angle.cos(),
                excursion * angle.sin(),
            )?;
            ledger.push(cand.summary.clone());
            if cand.summary.meets_constraints {
                alternatives.push(cand);
            } else {
                cand.points.clear();
            }
        }
    }
    alternatives.sort_by(|a, b| {
        a.summary
            .length
            .total_cmp(&b.summary.length)
            .then_with(|| {
                b.summary
                    .min_clearance_bound
                    .total_cmp(&a.summary.min_clearance_bound)
            })
            .then_with(|| a.summary.id.cmp(&b.summary.id))
    });
    alternatives.truncate(3);
    let status = if alternatives.is_empty() {
        "no_candidate_in_search"
    } else if baseline.summary.meets_constraints {
        "baseline_meets_constraints"
    } else {
        "candidates_found"
    }
    .into();
    Ok(Generation{method:METHOD.into(),notice:NOTICE.into(),input:c.clone(),baseline,alternatives,ledger,status,assumptions:vec![
        "Local NEV, TVD positive down. Explicit offset polylines; no geodetic transformation.".into(),
        "One-sigma covariance envelopes are user-declared constant over each entire path. No ISCWSA propagation or covariance interpolation.".into(),
        "Ellipsoid confidence assumes centered Gaussian positional errors at each location. It is not joint confidence for a whole path or a collision probability.".into(),
        "Clearance uses the sum of enclosing 3-D ellipsoid radii, hole radii, margin and a curve/chord error bound. Conservative geometric screening; not separation factor or collision probability.".into(),
        "65 deterministic endpoint-constrained Bézier candidates. Shortest passing candidate first; limited search does not prove general feasibility or optimality.".into(),
        "Curvature is bounded over every subdivided curve segment using Bernstein coefficients. MD is approximate arc length with a reported error bound.".into(),
        "BHA response, bit lag, formation response, torque/drag, casing design and operational rules require separate validation. Curve is an evaluation candidate, not a toolface instruction.".into(),
    ]})
}

pub fn demo() -> Case {
    let frame = CoordinateFrame {
        unit_system: UnitSystem::Metric,
        north_reference: NorthReference::Grid,
        origin_id: "synthetic-pad-NEV".into(),
        origin_north: 0.0,
        origin_east: 0.0,
        vertical_datum: VerticalDatumKind::Rkb,
        vertical_datum_name: "Common synthetic RKB".into(),
        crs_epsg: None,
        crs_note: "Constructed local frame; no field coordinates".into(),
    };
    let p = |md, n, e, v, i, a| SurveyPoint {
        md,
        north: n,
        east: e,
        tvd: v,
        inc_deg: i,
        azi_deg: a,
    };
    let envelope=Envelope{covariance:[[1.0,0.0,0.0],[0.0,4.0,0.0],[0.0,0.0,1.0]],source:"SYNTHETIC whole-interval envelope, σNEV = (1, 2, 1) m; constructed, not a tool error model".into(),scope:"whole_path_constant_envelope".into()};
    let start = p(2400.0, 0.0, 0.0, 2000.0, 90.0, 0.0);
    Case {
        name: "Crossing Laterals — correction before the intersection".into(),
        synthetic: true,
        frame: frame.clone(),
        current: vec![
            p(2280.0, -120.0, 0.0, 2000.0, 90.0, 0.0),
            p(2340.0, -60.0, 0.0, 2000.0, 90.0, 0.0),
            start.clone(),
        ],
        start,
        target: p(0.0, 600.0, 0.0, 2000.0, 90.0, 0.0),
        radius: 0.1556,
        envelope: envelope.clone(),
        offsets: vec![
            OffsetPath {
                id: "crossing".into(),
                name: "DP-01 · crossing lateral".into(),
                frame: frame.clone(),
                points: vec![
                    p(2100.0, 300.0, -180.0, 2001.0, 90.0, 90.0),
                    p(2460.0, 300.0, 180.0, 2001.0, 90.0, 90.0),
                ],
                radius: 0.1778,
                chord_error_bound: 0.0,
                envelope: envelope.clone(),
            },
            OffsetPath {
                id: "lower".into(),
                name: "DP-02 · lower parallel lateral".into(),
                frame,
                points: vec![
                    p(2300.0, 100.0, 0.0, 2026.0, 90.0, 0.0),
                    p(2900.0, 700.0, 0.0, 2026.0, 90.0, 0.0),
                ],
                radius: 0.1778,
                chord_error_bound: 0.0,
                envelope,
            },
        ],
        confidence: 0.95,
        margin: 3.0,
        max_dls: 6.0,
        max_excursion: 60.0,
        chord_tolerance: 0.01,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offset_curve_error_reduces_the_clearance_bound() {
        let mut c = demo();
        let before = analyze(&c).unwrap().encounters[0].clearance_lower_bound;
        c.offsets[0].chord_error_bound = 0.03;
        let after = analyze(&c).unwrap().encounters[0].clearance_lower_bound;
        assert!((before - after - 0.03).abs() < 1e-10);
        c.offsets[0].chord_error_bound = -1.0;
        assert!(analyze(&c).is_err());
    }

    #[test]
    fn forecast_screen_uses_supplied_path_and_rejects_a_different_anchor() {
        let c = demo();
        let baseline = analyze(&c).unwrap();
        let encounters = screen_forecast(&c, &baseline.points).unwrap();
        assert!((encounters[0].distance - 1.0).abs() < 1e-8);
        let corrected = candidate(&c, "offset".into(), 0.0, 15.0).unwrap();
        let clear = screen_forecast(&c, &corrected.points).unwrap();
        assert!(clear[0].distance > encounters[0].distance);
        let mut wrong = corrected.points;
        wrong[0].north += 1.0;
        assert!(screen_forecast(&c, &wrong).is_err());
    }

    #[test]
    fn metric_and_imperial_describe_the_same_correction() {
        let metric = demo();
        let m = candidate(&metric, "unit-test".into(), 0.0, 15.0).unwrap();
        let mut c = metric.clone();
        let f = 1.0 / 0.3048;
        let convert = |p: &mut SurveyPoint| {
            p.md *= f;
            p.north *= f;
            p.east *= f;
            p.tvd *= f;
        };
        convert(&mut c.start);
        convert(&mut c.target);
        for p in &mut c.current {
            convert(p);
        }
        c.frame.unit_system = UnitSystem::Imperial;
        c.radius *= f;
        c.margin *= f;
        c.max_excursion *= f;
        c.chord_tolerance *= f;
        c.max_dls *= 30.48 / 30.0;
        for row in &mut c.envelope.covariance {
            for v in row {
                *v *= f * f;
            }
        }
        for off in &mut c.offsets {
            off.frame.unit_system = UnitSystem::Imperial;
            off.radius *= f;
            for p in &mut off.points {
                convert(p);
            }
            for row in &mut off.envelope.covariance {
                for v in row {
                    *v *= f * f;
                }
            }
        }
        validate(&c).unwrap();
        let i = candidate(&c, "unit-test".into(), 0.0, 15.0 * f).unwrap();
        assert!((i.summary.min_clearance_bound / f - m.summary.min_clearance_bound).abs() < 0.02);
        assert!((i.summary.length / f - m.summary.length).abs() < 0.001);
        assert!((i.summary.max_dls_bound * 30.0 / 30.48 - m.summary.max_dls_bound).abs() < 0.01);
    }

    #[test]
    fn covariance_cross_terms_and_more_uncertainty_change_clearance() {
        let mut c = demo();
        let a = analyze(&c).unwrap();
        c.envelope.covariance = [[4.0, 1.5, 0.0], [1.5, 4.0, 0.0], [0.0, 0.0, 1.0]];
        let b = analyze(&c).unwrap();
        assert!(b.summary.min_clearance_bound < a.summary.min_clearance_bound);
    }
    #[test]
    fn crossing_between_endpoints_is_found() {
        let (d, s, t) = segment_pair(
            Vec3::new(-10.0, 0.0, 0.0),
            Vec3::new(10.0, 0.0, 0.0),
            Vec3::new(0.0, -10.0, 1.0),
            Vec3::new(0.0, 10.0, 1.0),
        );
        assert!((d - 1.0).abs() < 1e-12);
        assert!((s - 0.5).abs() < 1e-12);
        assert!((t - 0.5).abs() < 1e-12);
    }
    #[test]
    fn parallel_and_endpoint_pairs() {
        assert!(
            (segment_pair(
                Vec3::ZERO,
                Vec3::new(10.0, 0.0, 0.0),
                Vec3::new(0.0, 3.0, 0.0),
                Vec3::new(10.0, 3.0, 0.0)
            )
            .0 - 3.0)
                .abs()
                < 1e-12
        );
        assert!(
            (segment_pair(
                Vec3::ZERO,
                Vec3::new(1.0, 0.0, 0.0),
                Vec3::new(4.0, 4.0, 0.0),
                Vec3::new(5.0, 4.0, 0.0)
            )
            .0 - 5.0)
                .abs()
                < 1e-12
        );
    }
    #[test]
    fn synthetic_requires_correction_and_reaches_target() {
        let c = demo();
        let g = generate(&c).unwrap();
        assert_eq!(g.ledger.len(), 65);
        assert!((g.baseline.encounters[0].distance - 1.0).abs() < 1e-9);
        assert!(!g.baseline.summary.meets_constraints);
        assert_eq!(g.status, "candidates_found");
        for a in g.alternatives {
            assert!(a.summary.meets_constraints);
            assert!(a.summary.excursion_high > 0.0);
            assert!(a.summary.max_dls_bound <= c.max_dls);
            assert!(a.points.last().unwrap().pos().sub(c.target.pos()).norm() < 1e-9);
            assert!(a.points[0].tangent().sub(c.start.tangent()).norm() < 1e-9);
            assert!(
                a.points
                    .last()
                    .unwrap()
                    .tangent()
                    .sub(c.target.tangent())
                    .norm()
                    < 1e-9
            );
        }
    }
    #[test]
    fn too_tight_constraints_return_no_path() {
        let mut c = demo();
        c.max_dls = 0.001;
        let g = generate(&c).unwrap();
        assert!(g.alternatives.is_empty());
        assert_eq!(g.status, "no_candidate_in_search");
    }
    #[test]
    fn invalid_data_blocks() {
        let mut c = demo();
        c.offsets[0].frame.origin_id = "different".into();
        assert!(generate(&c).is_err());
        c = demo();
        c.envelope.covariance[0][0] = -1.0;
        assert!(generate(&c).is_err());
        c = demo();
        c.envelope.source.clear();
        assert!(generate(&c).is_err());
        c = demo();
        c.start.md += 1.0;
        assert!(generate(&c).is_err());
    }
    #[test]
    fn bound_contains_dense_curve_and_curvature() {
        let c = demo();
        let cp = controls(&c, 0.0, 30.0);
        let f = flatten(&cp, c.start.md, 0.01, 10.0).unwrap();
        let eval = |points: &[Vec3], t: f64| {
            let mut r = points.to_vec();
            while r.len() > 1 {
                r = r.windows(2).map(|w| mix(w[0], w[1], t)).collect();
            }
            r[0]
        };
        let d = deriv(&cp);
        let dd = deriv(&d);
        let mut fine_length = 0.0;
        let mut prev = cp[0];
        for i in 0..=10000 {
            let t = i as f64 / 10000.0;
            let p = eval(&cp, t);
            fine_length += p.sub(prev).norm();
            prev = p;
            let v = eval(&d, t);
            let a = eval(&dd, t);
            assert!(v.cross(a).norm() / v.norm().powi(3) <= f.curvature + 1e-12);
            if i % 20 == 0 {
                let distance = f
                    .points
                    .windows(2)
                    .map(|w| point_seg_distance(p, w[0].pos(), w[1].pos()))
                    .fold(f64::INFINITY, f64::min);
                assert!(distance <= 0.01000001);
            }
        }
        assert!((fine_length - f.length).abs() <= f.length_error + 1e-6);
    }
    #[test]
    fn tighter_tessellation_preserves_clearance() {
        let mut c = demo();
        let a = candidate(&c, "a".into(), 0.0, 30.0).unwrap();
        c.chord_tolerance = 0.001;
        let b = candidate(&c, "b".into(), 0.0, 30.0).unwrap();
        assert!((a.summary.min_clearance_bound - b.summary.min_clearance_bound).abs() < 0.03);
    }
    #[test]
    fn deterministic_roundtrip() {
        let c = demo();
        let a = generate(&c).unwrap();
        let b =
            generate(&serde_json::from_str(&serde_json::to_string(&c).unwrap()).unwrap()).unwrap();
        assert_eq!(
            serde_json::to_string(&a).unwrap(),
            serde_json::to_string(&b).unwrap()
        );
    }
}
