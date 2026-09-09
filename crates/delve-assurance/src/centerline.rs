//! Centerline separation screening only. Not anti-collision, SF, MASD, or probability.

use delve_core::{
    frames_comparable, interpolate_min_curvature, min_curvature_chord_deviation_m, unit_tangent,
    CoordinateFrame, PathState, Vec3,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq)]
pub enum ScanError {
    #[error("{0}")]
    Message(String),
}

impl serde::Serialize for ScanError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PathInterval {
    pub md0: f64,
    pub md1: f64,
    pub p0: [f64; 3],
    pub p1: [f64; 3],
    pub t0: [f64; 3],
    pub t1: [f64; 3],
    /// Method-specific chord-deviation bound in the same length unit.
    pub deviation_bound: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CenterlineResult {
    pub distance: f64,
    pub ref_md: f64,
    pub ref_n: f64,
    pub ref_e: f64,
    pub ref_tvd: f64,
    pub off_md: f64,
    pub off_n: f64,
    pub off_e: f64,
    pub off_tvd: f64,
    pub d_north: f64,
    pub d_east: f64,
    pub d_tvd: f64,
    pub crossing_angle_deg: f64,
    pub tolerance: f64,
    pub threshold: Option<f64>,
    pub above_threshold: Option<bool>,
    pub frame_ok: bool,
    pub exclusions: Vec<String>,
    pub label: String,
}

const LABEL: &str = "Centerline separation screening only — position uncertainty, hole/casing size, survey quality, and company anti-collision rules are not included.";

pub fn min_curvature_intervals(states: &[PathState], to_m: f64) -> Vec<PathInterval> {
    let mut out = Vec::new();
    for w in states.windows(2) {
        let a = &w[0];
        let b = &w[1];
        let cl = (b.md - a.md) * to_m;
        let v1 = unit_tangent(a.inc_deg.to_radians(), a.azi_deg.to_radians());
        let v2 = unit_tangent(b.inc_deg.to_radians(), b.azi_deg.to_radians());
        let (beta, _) = delve_core::dogleg_and_rf(v1, v2);
        let dev_m = min_curvature_chord_deviation_m(cl.max(0.0), beta);
        out.push(PathInterval {
            md0: a.md,
            md1: b.md,
            p0: [a.north, a.east, a.tvd],
            p1: [b.north, b.east, b.tvd],
            t0: [v1.n, v1.e, v1.t],
            t1: [v2.n, v2.e, v2.t],
            deviation_bound: dev_m / to_m,
        });
    }
    out
}

fn seg_seg(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3) -> (f64, f64, f64, Vec3, Vec3) {
    let d1 = q1.sub(p1);
    let d2 = q2.sub(p2);
    let r = p1.sub(p2);
    let a = d1.dot(d1);
    let e = d2.dot(d2);
    let f = d2.dot(r);
    let eps = 1e-14;
    let (s, t) = if a <= eps && e <= eps {
        (0.0, 0.0)
    } else if a <= eps {
        (0.0, (f / e).clamp(0.0, 1.0))
    } else {
        let c = d1.dot(r);
        if e <= eps {
            ((-c / a).clamp(0.0, 1.0), 0.0)
        } else {
            let b = d1.dot(d2);
            let den = a * e - b * b;
            let mut s = if den.abs() > eps {
                (b * f - c * e) / den
            } else {
                0.0
            };
            s = s.clamp(0.0, 1.0);
            let mut t = (b * s + f) / e;
            if t < 0.0 {
                t = 0.0;
                s = (-c / a).clamp(0.0, 1.0);
            } else if t > 1.0 {
                t = 1.0;
                s = ((b - c) / a).clamp(0.0, 1.0);
            }
            (s, t)
        }
    };
    let c1 = p1.add(d1.scale(s));
    let c2 = p2.add(d2.scale(t));
    (c1.sub(c2).norm(), s, t, c1, c2)
}

fn aabb_inflated(p0: Vec3, p1: Vec3, bound: f64) -> (Vec3, Vec3) {
    let mn = Vec3::new(
        p0.n.min(p1.n) - bound,
        p0.e.min(p1.e) - bound,
        p0.t.min(p1.t) - bound,
    );
    let mx = Vec3::new(
        p0.n.max(p1.n) + bound,
        p0.e.max(p1.e) + bound,
        p0.t.max(p1.t) + bound,
    );
    (mn, mx)
}

fn aabb_dist(a0: Vec3, a1: Vec3, b0: Vec3, b1: Vec3) -> f64 {
    let dx = (a0.n - b1.n).max(b0.n - a1.n).max(0.0);
    let dy = (a0.e - b1.e).max(b0.e - a1.e).max(0.0);
    let dz = (a0.t - b1.t).max(b0.t - a1.t).max(0.0);
    (dx * dx + dy * dy + dz * dz).sqrt()
}

fn eval_interval(iv: &PathInterval, md: f64, to_m: f64) -> PathState {
    let f = if (iv.md1 - iv.md0).abs() < 1e-15 {
        0.0
    } else {
        ((md - iv.md0) / (iv.md1 - iv.md0)).clamp(0.0, 1.0)
    };
    let start = Vec3::new(iv.p0[0] * to_m, iv.p0[1] * to_m, iv.p0[2] * to_m);
    let v1 = Vec3::new(iv.t0[0], iv.t0[1], iv.t0[2]);
    let v2 = Vec3::new(iv.t1[0], iv.t1[1], iv.t1[2]);
    let (pos, t, _) = interpolate_min_curvature(start, v1, v2, (iv.md1 - iv.md0) * to_m, f);
    let inv = 1.0 / to_m;
    PathState {
        md,
        inc_deg: t.t.clamp(-1.0, 1.0).acos().to_degrees(),
        azi_deg: t.e.atan2(t.n).to_degrees().rem_euclid(360.0),
        north: pos.n * inv,
        east: pos.e * inv,
        tvd: pos.t * inv,
        tangent_n: t.n,
        tangent_e: t.e,
        tangent_t: t.t,
    }
}

/// Keep the overlap of `[md0, md1]` with `user`, then drop `[elo, ehi]` inclusive.
/// The remainder after a branch starts just past `ehi` so the junction is not the reported minimum.
fn clip_md_range(
    md0: f64,
    md1: f64,
    user: (f64, f64),
    exclude: Option<(f64, f64)>,
) -> Vec<(f64, f64)> {
    let lo = md0.max(user.0.min(user.1));
    let hi = md1.min(user.0.max(user.1));
    if hi <= lo {
        return vec![];
    }
    let Some((a, b)) = exclude else {
        return vec![(lo, hi)];
    };
    let elo = a.min(b);
    let ehi = a.max(b);
    if ehi < lo || elo > hi {
        return vec![(lo, hi)];
    }
    let mut out = Vec::new();
    if lo < elo {
        out.push((lo, (elo - 1e-6).min(hi)));
    }
    if hi > ehi {
        out.push(((ehi + 1e-6).max(lo), hi));
    }
    out.retain(|(a, b)| b > a);
    out
}

fn sub_bound(iv: &PathInterval, lo: f64, hi: f64) -> f64 {
    let t0 = Vec3::new(iv.t0[0], iv.t0[1], iv.t0[2]);
    let t1 = Vec3::new(iv.t1[0], iv.t1[1], iv.t1[2]);
    let beta = t0.dot(t1).clamp(-1.0, 1.0).acos() * (hi - lo) / (iv.md1 - iv.md0);
    // Function is homogeneous in length: input and output use the path unit.
    min_curvature_chord_deviation_m(hi - lo, beta)
}

pub fn closest_approach(
    ref_iv: &[PathInterval],
    off_iv: &[PathInterval],
    ref_frame: &CoordinateFrame,
    off_frame: &CoordinateFrame,
    ref_md_range: (f64, f64),
    off_md_range: (f64, f64),
    exclude_ref: Option<(f64, f64)>,
    exclude_off: Option<(f64, f64)>,
    threshold: Option<f64>,
    to_m: f64,
) -> Result<CenterlineResult, ScanError> {
    frames_comparable(ref_frame, off_frame).map_err(|iss| {
        ScanError::Message(
            iss.iter()
                .map(|i| i.message.clone())
                .collect::<Vec<_>>()
                .join(" "),
        )
    })?;
    if !to_m.is_finite()
        || to_m <= 0.0
        || (to_m
            - if ref_frame.unit_system == delve_core::UnitSystem::Imperial {
                0.3048
            } else {
                1.0
            })
        .abs()
            > 1e-12
    {
        return Err(ScanError::Message(
            "Length conversion must match the declared coordinate frame.".into(),
        ));
    }
    if ![
        ref_md_range.0,
        ref_md_range.1,
        off_md_range.0,
        off_md_range.1,
    ]
    .iter()
    .all(|v| v.is_finite())
        || threshold.is_some_and(|x| !x.is_finite() || x < 0.0)
    {
        return Err(ScanError::Message(
            "Finite MD ranges and nonnegative threshold required.".into(),
        ));
    }
    for iv in ref_iv.iter().chain(off_iv) {
        if ![iv.md0, iv.md1]
            .iter()
            .chain(iv.p0.iter())
            .chain(iv.p1.iter())
            .chain(iv.t0.iter())
            .chain(iv.t1.iter())
            .all(|x| x.is_finite())
            || iv.md1 <= iv.md0
        {
            return Err(ScanError::Message(
                "Intervals require finite geometry and increasing MD.".into(),
            ));
        }
        let ta = Vec3::new(iv.t0[0], iv.t0[1], iv.t0[2]);
        let tb = Vec3::new(iv.t1[0], iv.t1[1], iv.t1[2]);
        if (ta.norm() - 1.0).abs() > 1e-8
            || (tb.norm() - 1.0).abs() > 1e-8
            || ta.dot(tb) < -0.999999
        {
            return Err(ScanError::Message(
                "Unit tangents and non-antipodal intervals required.".into(),
            ));
        }
        let end = eval_interval(iv, iv.md1, to_m);
        if Vec3::new(end.north, end.east, end.tvd)
            .sub(Vec3::new(iv.p1[0], iv.p1[1], iv.p1[2]))
            .norm()
            > 1e-4
        {
            return Err(ScanError::Message(
                "Interval endpoint disagrees with minimum-curvature geometry.".into(),
            ));
        }
    }
    let mut best = f64::MAX;
    let mut best_pair: Option<(PathState, PathState)> = None;
    let tol = 1e-4;
    let mut exclusions = Vec::new();
    if exclude_ref.is_some() || exclude_off.is_some() {
        exclusions.push("Explicit shared-parent MD ranges are excluded on both paths.".into());
    }
    let mut candidates = Vec::new();
    for a in ref_iv {
        for (amd0, amd1) in clip_md_range(a.md0, a.md1, ref_md_range, exclude_ref) {
            for b in off_iv {
                for (bmd0, bmd1) in clip_md_range(b.md0, b.md1, off_md_range, exclude_off) {
                    let pa0 = Vec3::new(a.p0[0], a.p0[1], a.p0[2]);
                    let pa1 = Vec3::new(a.p1[0], a.p1[1], a.p1[2]);
                    let pb0 = Vec3::new(b.p0[0], b.p0[1], b.p0[2]);
                    let pb1 = Vec3::new(b.p1[0], b.p1[1], b.p1[2]);
                    // Recompute bounds from geometry: never trust caller-supplied pruning bounds.
                    let (amin, amax) = aabb_inflated(pa0, pa1, sub_bound(a, a.md0, a.md1));
                    let (bmin, bmax) = aabb_inflated(pb0, pb1, sub_bound(b, b.md0, b.md1));
                    candidates.push((
                        aabb_dist(amin, amax, bmin, bmax),
                        a,
                        b,
                        amd0,
                        amd1,
                        bmd0,
                        bmd1,
                    ));
                }
            }
        }
    }
    candidates.sort_by(|x, y| x.0.total_cmp(&y.0));
    let mut visits = 0usize;
    for (lower, a, b, amd0, amd1, bmd0, bmd1) in candidates {
        if lower >= best - tol {
            continue;
        }
        let mut stack = vec![(amd0, amd1, bmd0, bmd1)];
        while let Some((am0, am1, bm0, bm1)) = stack.pop() {
            visits += 1;
            if visits > 500_000 {
                return Err(ScanError::Message("Scan resolution budget exceeded; no converged result returned. Narrow the MD ranges.".into()));
            }
            let sa = eval_interval(a, am0, to_m);
            let sb = eval_interval(a, am1, to_m);
            let oa = eval_interval(b, bm0, to_m);
            let ob = eval_interval(b, bm1, to_m);
            let (d, s, t, _, _) = seg_seg(
                Vec3::new(sa.north, sa.east, sa.tvd),
                Vec3::new(sb.north, sb.east, sb.tvd),
                Vec3::new(oa.north, oa.east, oa.tvd),
                Vec3::new(ob.north, ob.east, ob.tvd),
            );
            let ba = sub_bound(a, am0, am1);
            let bb = sub_bound(b, bm0, bm1);
            let pa = eval_interval(a, am0 + s * (am1 - am0), to_m);
            let pb = eval_interval(b, bm0 + t * (bm1 - bm0), to_m);
            let dd = Vec3::new(pa.north, pa.east, pa.tvd)
                .sub(Vec3::new(pb.north, pb.east, pb.tvd))
                .norm();
            if dd < best {
                best = dd;
                best_pair = Some((pa, pb));
            }
            // Exact curve distance lies in [chord distance - summed sagittae, best].
            // Global pruning only when this whole rectangle cannot improve by > tol.
            if d - ba - bb >= best - tol {
                continue;
            }
            if ba >= bb {
                let mid = (am0 + am1) / 2.0;
                stack.push((am0, mid, bm0, bm1));
                stack.push((mid, am1, bm0, bm1));
            } else {
                let mid = (bm0 + bm1) / 2.0;
                stack.push((am0, am1, bm0, mid));
                stack.push((am0, am1, mid, bm1));
            }
        }
    }
    let (pa, pb) =
        best_pair.ok_or_else(|| ScanError::Message("No overlapping MD ranges to scan.".into()))?;
    let tr = Vec3::new(pa.tangent_n, pa.tangent_e, pa.tangent_t);
    let to = Vec3::new(pb.tangent_n, pb.tangent_e, pb.tangent_t);
    let cross = tr.dot(to).abs().clamp(0.0, 1.0).acos().to_degrees();
    let above = threshold.map(|th| best + 1e-9 >= th);
    Ok(CenterlineResult {
        distance: best,
        ref_md: pa.md,
        ref_n: pa.north,
        ref_e: pa.east,
        ref_tvd: pa.tvd,
        off_md: pb.md,
        off_n: pb.north,
        off_e: pb.east,
        off_tvd: pb.tvd,
        d_north: pb.north - pa.north,
        d_east: pb.east - pa.east,
        d_tvd: pb.tvd - pa.tvd,
        crossing_angle_deg: cross,
        tolerance: tol,
        threshold,
        above_threshold: above,
        frame_ok: true,
        exclusions,
        label: LABEL.into(),
    })
}

pub fn states_from_xyz(points: &[(f64, f64, f64, f64)]) -> Vec<PathState> {
    // (md, n, e, tvd) — vertical-ish dummy attitudes
    points
        .iter()
        .map(|(md, n, e, t)| PathState {
            md: *md,
            inc_deg: 0.0,
            azi_deg: 0.0,
            north: *n,
            east: *e,
            tvd: *t,
            tangent_n: 0.0,
            tangent_e: 0.0,
            tangent_t: 1.0,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use delve_core::{NorthReference, UnitSystem, VerticalDatumKind};

    fn frame() -> CoordinateFrame {
        CoordinateFrame {
            unit_system: UnitSystem::Imperial,
            north_reference: NorthReference::Grid,
            origin_id: "wellhead".into(),
            origin_north: 0.0,
            origin_east: 0.0,
            vertical_datum: VerticalDatumKind::Rkb,
            vertical_datum_name: "RKB".into(),
            crs_epsg: None,
            crs_note: String::new(),
        }
    }

    #[test]
    fn parallel_vertical_spacing() {
        let a = states_from_xyz(&[(0.0, 0.0, 0.0, 0.0), (100.0, 0.0, 0.0, 100.0)]);
        let b = states_from_xyz(&[(0.0, 0.0, 50.0, 0.0), (100.0, 0.0, 50.0, 100.0)]);
        let r = closest_approach(
            &min_curvature_intervals(&a, 0.3048),
            &min_curvature_intervals(&b, 0.3048),
            &frame(),
            &frame(),
            (0.0, 100.0),
            (0.0, 100.0),
            None,
            None,
            Some(40.0),
            0.3048,
        )
        .unwrap();
        assert!((r.distance - 50.0).abs() < 0.05);
        assert!((r.d_east - 50.0).abs() < 0.05);
        assert_eq!(r.above_threshold, Some(true));
        assert!(r.label.contains("Centerline separation screening only"));
    }

    #[test]
    fn intersecting_paths_near_zero() {
        let a = states_from_xyz(&[(0.0, 0.0, 0.0, 0.0), (100.0, 100.0, 0.0, 0.0)]);
        let b = states_from_xyz(&[(0.0, 100.0, 0.0, 0.0), (100.0, 0.0, 0.0, 0.0)]);
        // Need non-vertical tangents
        let mut a = a;
        let mut b = b;
        a[0].inc_deg = 90.0;
        a[1].inc_deg = 90.0;
        a[0].azi_deg = 0.0;
        a[1].azi_deg = 0.0;
        b[0].inc_deg = 90.0;
        b[1].inc_deg = 90.0;
        b[0].azi_deg = 180.0;
        b[1].azi_deg = 180.0;
        // Actually these are along N. Let me set a along N, b along -N from east...
        // Simpler: a from (0,0) to (0,100) east, b from (50,-50) to (50,50) — they miss.
        // Intersect at origin: a along east, b along north through origin.
        let a = vec![
            PathState {
                md: 0.0,
                inc_deg: 90.0,
                azi_deg: 90.0,
                north: 0.0,
                east: -50.0,
                tvd: 0.0,
                tangent_n: 0.0,
                tangent_e: 1.0,
                tangent_t: 0.0,
            },
            PathState {
                md: 100.0,
                inc_deg: 90.0,
                azi_deg: 90.0,
                north: 0.0,
                east: 50.0,
                tvd: 0.0,
                tangent_n: 0.0,
                tangent_e: 1.0,
                tangent_t: 0.0,
            },
        ];
        let b = vec![
            PathState {
                md: 0.0,
                inc_deg: 90.0,
                azi_deg: 0.0,
                north: -50.0,
                east: 0.0,
                tvd: 0.0,
                tangent_n: 1.0,
                tangent_e: 0.0,
                tangent_t: 0.0,
            },
            PathState {
                md: 100.0,
                inc_deg: 90.0,
                azi_deg: 0.0,
                north: 50.0,
                east: 0.0,
                tvd: 0.0,
                tangent_n: 1.0,
                tangent_e: 0.0,
                tangent_t: 0.0,
            },
        ];
        let r = closest_approach(
            &min_curvature_intervals(&a, 0.3048),
            &min_curvature_intervals(&b, 0.3048),
            &frame(),
            &frame(),
            (0.0, 100.0),
            (0.0, 100.0),
            None,
            None,
            None,
            0.3048,
        )
        .unwrap();
        assert!(r.distance < 0.2);
        assert!((r.crossing_angle_deg - 90.0).abs() < 1.0);
    }

    #[test]
    fn incompatible_frame_blocks() {
        let a = states_from_xyz(&[(0.0, 0.0, 0.0, 0.0), (10.0, 0.0, 0.0, 10.0)]);
        let mut f2 = frame();
        f2.unit_system = UnitSystem::Metric;
        let err = closest_approach(
            &min_curvature_intervals(&a, 0.3048),
            &min_curvature_intervals(&a, 1.0),
            &frame(),
            &f2,
            (0.0, 10.0),
            (0.0, 10.0),
            None,
            None,
            None,
            0.3048,
        );
        assert!(err.is_err());
    }

    #[test]
    fn shared_parent_exclusion() {
        // A 50-unit minimum-curvature build from vertical to horizontal has
        // radius 50/(π/2), not a 50-unit right-angle polyline corner.
        let radius = 100.0 / std::f64::consts::PI;
        let mut a = states_from_xyz(&[
            (0.0, 0.0, 0.0, 0.0),
            (50.0, 0.0, 0.0, 50.0),
            (100.0, radius, 0.0, 50.0 + radius),
        ]);
        let mut b = states_from_xyz(&[
            (0.0, 0.0, 0.0, 0.0),
            (50.0, 0.0, 0.0, 50.0),
            (100.0, -radius, 0.0, 50.0 + radius),
        ]);
        a[2].inc_deg = 90.0;
        b[2].inc_deg = 90.0;
        b[2].azi_deg = 180.0;
        let r = closest_approach(
            &min_curvature_intervals(&a, 0.3048),
            &min_curvature_intervals(&b, 0.3048),
            &frame(),
            &frame(),
            (0.0, 100.0),
            (0.0, 100.0),
            Some((0.0, 50.0)),
            Some((0.0, 50.0)),
            None,
            0.3048,
        )
        .unwrap();
        assert!(r.exclusions.iter().any(|e| e.contains("parent")));
        // Shared vertical through MD 50 is excluded. Remaining laterals start at the branch
        // and diverge, so the reported MDs must be after the excluded interval.
        assert!(r.ref_md > 50.0);
        assert!(r.off_md > 50.0);
    }

    #[test]
    fn interior_exclusion_keeps_both_remaining_ranges() {
        assert_eq!(
            clip_md_range(0.0, 100.0, (0.0, 100.0), Some((40.0, 60.0))),
            vec![(0.0, 40.0 - 1e-6), (60.0 + 1e-6, 100.0)]
        );
    }

    #[test]
    fn bowed_arc_closest_point_outside_chord_box_converges() {
        let length = 100.0 * std::f64::consts::FRAC_PI_2;
        let mut a = states_from_xyz(&[(0.0, 0.0, 0.0, 0.0), (length, 100.0, 0.0, 100.0)]);
        a[1].inc_deg = 90.0;
        let n = 100.0 * (1.0 - std::f64::consts::FRAC_1_SQRT_2);
        let b = states_from_xyz(&[(0.0, n, 2.0, 70.0), (2.0, n, 2.0, 72.0)]);
        let mut f = frame();
        f.unit_system = UnitSystem::Metric;
        let r = closest_approach(
            &min_curvature_intervals(&a, 1.0),
            &min_curvature_intervals(&b, 1.0),
            &f,
            &f,
            (0.0, length),
            (0.0, 2.0),
            None,
            None,
            None,
            1.0,
        )
        .unwrap();
        assert!((r.distance - 2.0).abs() <= r.tolerance);
        assert!((r.ref_md - length / 2.0).abs() < 0.1);
    }

    #[test]
    fn inconsistent_arc_geometry_is_rejected() {
        let a = states_from_xyz(&[(0.0, 0.0, 0.0, 0.0), (10.0, 10.0, 0.0, 0.0)]);
        let iv = min_curvature_intervals(&a, 0.3048);
        assert!(closest_approach(
            &iv,
            &iv,
            &frame(),
            &frame(),
            (0.0, 10.0),
            (0.0, 10.0),
            None,
            None,
            None,
            0.3048
        )
        .is_err());
    }
}
