//! Arbitrary-MD minimum-curvature interval evaluator.
//!
//! `calculate_trajectory` remains the validated station reconstruction.
//! This module evaluates the same circular-arc intervals at any MD.

use crate::geom::{
    attitude_from_tangent, interpolate_min_curvature, unit_tangent, Vec3, SMALL_BETA_RAD,
};
use crate::types::{CalculatedStation, HoleCalcInput, Trajectory};
use crate::units::{deg_to_rad, ft_to_m, m_to_ft, rad_to_deg, UnitSystem};
use crate::{calculate_trajectory, CalcError};

/// Position and attitude at one MD on a continuous path.
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct PathState {
    pub md: f64,
    pub inc_deg: f64,
    pub azi_deg: f64,
    pub north: f64,
    pub east: f64,
    pub tvd: f64,
    pub tangent_n: f64,
    pub tangent_e: f64,
    pub tangent_t: f64,
}

impl PathState {
    pub fn position(self) -> Vec3 {
        Vec3::new(self.north, self.east, self.tvd)
    }

    pub fn tangent(self) -> Vec3 {
        Vec3::new(self.tangent_n, self.tangent_e, self.tangent_t)
    }
}

/// Evaluates NEV + attitude at an arbitrary MD on a reconstructed survey.
///
/// Lengths are in the hole unit system. MD must lie on `[first.md, last.md]`.
pub fn evaluate_at_md(input: &HoleCalcInput, md: f64) -> Result<PathState, CalcError> {
    let traj = calculate_trajectory(input)?;
    evaluate_trajectory_at_md(&traj, md)
}

pub fn evaluate_trajectory_at_md(traj: &Trajectory, md: f64) -> Result<PathState, CalcError> {
    if traj.stations.is_empty() {
        return Err(CalcError::Empty);
    }
    if !md.is_finite() {
        return Err(CalcError::Numerical { index: 0 });
    }
    let first = &traj.stations[0];
    let last = traj.stations.last().unwrap();
    if md < first.md - 1e-9 || md > last.md + 1e-9 {
        return Err(CalcError::MdOutOfRange { md });
    }
    if (md - first.md).abs() <= 1e-9 {
        return Ok(state_from_station(first));
    }
    if (md - last.md).abs() <= 1e-9 {
        return Ok(state_from_station(last));
    }
    for i in 1..traj.stations.len() {
        let a = &traj.stations[i - 1];
        let b = &traj.stations[i];
        if md + 1e-12 < a.md || md - 1e-12 > b.md {
            continue;
        }
        return interpolate_stations(a, b, md, traj.unit_system);
    }
    Err(CalcError::MdOutOfRange { md })
}

fn state_from_station(s: &CalculatedStation) -> PathState {
    let t = unit_tangent(deg_to_rad(s.inc_deg), deg_to_rad(s.azi_deg));
    PathState {
        md: s.md,
        inc_deg: s.inc_deg,
        azi_deg: s.azi_deg,
        north: s.north,
        east: s.east,
        tvd: s.tvd,
        tangent_n: t.n,
        tangent_e: t.e,
        tangent_t: t.t,
    }
}

fn interpolate_stations(
    a: &CalculatedStation,
    b: &CalculatedStation,
    md: f64,
    unit: UnitSystem,
) -> Result<PathState, CalcError> {
    let cl = b.md - a.md;
    if cl <= 0.0 {
        return Err(CalcError::NonPositiveCourse { index: 0 });
    }
    let frac = (md - a.md) / cl;
    let to_m = match unit {
        UnitSystem::Metric => 1.0,
        UnitSystem::Imperial => ft_to_m(1.0),
    };
    let from_m = match unit {
        UnitSystem::Metric => 1.0,
        UnitSystem::Imperial => m_to_ft(1.0),
    };
    let start = Vec3::new(a.north * to_m, a.east * to_m, a.tvd * to_m);
    let v1 = unit_tangent(deg_to_rad(a.inc_deg), deg_to_rad(a.azi_deg));
    let v2 = unit_tangent(deg_to_rad(b.inc_deg), deg_to_rad(b.azi_deg));
    let (pos_m, t, _) = interpolate_min_curvature(start, v1, v2, cl * to_m, frac);
    if !pos_m.is_finite() || !t.is_finite() {
        return Err(CalcError::Numerical { index: 0 });
    }
    let (inc, azi) = attitude_from_tangent(t);
    Ok(PathState {
        md,
        inc_deg: rad_to_deg(inc),
        azi_deg: rad_to_deg(azi),
        north: pos_m.n * from_m,
        east: pos_m.e * from_m,
        tvd: pos_m.t * from_m,
        tangent_n: t.n,
        tangent_e: t.e,
        tangent_t: t.t,
    })
}

/// Certified chord-deviation bound (metres) for a min-curvature interval.
///
/// A circular arc of radius R and dogleg β has sagitta `R (1 - cos(β/2))`.
/// That is the maximum distance from the chord to the arc.
pub fn min_curvature_chord_deviation_m(course_m: f64, beta_rad: f64) -> f64 {
    if beta_rad < SMALL_BETA_RAD || course_m <= 0.0 {
        return 0.0;
    }
    let radius = course_m / beta_rad;
    // Equivalent half-angle form avoids cancellation at small doglegs.
    2.0 * radius * (beta_rad / 4.0).sin().powi(2)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tiny_dogleg_sagitta_does_not_round_to_zero() {
        let s = min_curvature_chord_deviation_m(100_000_000.0, 1e-8);
        assert!((s - 0.125).abs() < 1e-12);
    }
    use crate::types::{
        AzimuthReference, MeasuredStation, StationClass, StationSource, SurveyConvention, TieIn,
    };

    fn st(md: f64, inc: f64, azi: f64) -> MeasuredStation {
        MeasuredStation {
            md,
            inc_deg: inc,
            azi_deg: azi,
            comment: String::new(),
            class: StationClass::Measured,
            source: StationSource::Manual,
        }
    }

    fn input() -> HoleCalcInput {
        HoleCalcInput {
            unit_system: UnitSystem::Metric,
            convention: SurveyConvention::OilfieldFromVertical,
            azimuth_reference: AzimuthReference::Unknown,
            vsp_deg: 0.0,
            tie_in: TieIn {
                tvd: 0.0,
                north: 0.0,
                east: 0.0,
            },
            stations: vec![st(0.0, 10.0, 0.0), st(100.0, 20.0, 10.0)],
        }
    }

    #[test]
    fn endpoints_match_calculated_stations() {
        let req = input();
        let traj = calculate_trajectory(&req).unwrap();
        let a = evaluate_at_md(&req, 0.0).unwrap();
        let b = evaluate_at_md(&req, 100.0).unwrap();
        assert!((a.north - traj.stations[0].north).abs() < 1e-12);
        assert!((b.north - traj.stations[1].north).abs() < 1e-9);
        assert!((b.east - traj.stations[1].east).abs() < 1e-9);
        assert!((b.tvd - traj.stations[1].tvd).abs() < 1e-9);
        assert!((b.inc_deg - 20.0).abs() < 1e-9);
    }

    #[test]
    fn midpoint_is_between_stations() {
        let req = input();
        let mid = evaluate_at_md(&req, 50.0).unwrap();
        let traj = calculate_trajectory(&req).unwrap();
        assert!(mid.north > traj.stations[0].north);
        assert!(mid.north < traj.stations[1].north);
        assert!(mid.inc_deg > 10.0 && mid.inc_deg < 20.0);
    }

    #[test]
    fn out_of_range_md_is_error() {
        assert!(evaluate_at_md(&input(), -1.0).is_err());
        assert!(evaluate_at_md(&input(), 101.0).is_err());
    }
}
