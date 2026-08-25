//! Minimum Curvature survey reconstruction.
//!
//! ISCWSA ebook V09.10.17 Ch. 7: industry-standard spherical arc between
//! station unit tangents. Dogleg = arccos(v1·v2). Ratio factor is the
//! standard algebraic form of that circular arc.
//! See docs/CALCULATION_SPEC.md.

use crate::types::{CalculatedStation, HoleCalcInput, MeasuredStation, StationClass, Trajectory};
use crate::units::{
    deg_to_rad, dls_to_display, ft_to_m, m_to_ft, rad_to_deg, DlsDisplay, UnitSystem,
};
use crate::validate::{has_blocking_error, validate_stations};
use crate::CalcError;

/// β below this (radians) uses RF = 1 (limit of 2/β tan(β/2)).
pub const SMALL_BETA_RAD: f64 = 1e-12;

#[derive(Debug, Clone, Copy)]
struct Vec3 {
    n: f64,
    e: f64,
    t: f64,
}

fn unit_tangent(inc_rad: f64, azi_rad: f64) -> Vec3 {
    let s = inc_rad.sin();
    Vec3 {
        n: s * azi_rad.cos(),
        e: s * azi_rad.sin(),
        t: inc_rad.cos(),
    }
}

fn dogleg_and_rf(v1: Vec3, v2: Vec3) -> (f64, f64) {
    let cos_b = (v1.n * v2.n + v1.e * v2.e + v1.t * v2.t).clamp(-1.0, 1.0);
    let beta = cos_b.acos();
    let rf = if beta < SMALL_BETA_RAD {
        1.0
    } else {
        (2.0 / beta) * (beta / 2.0).tan()
    };
    (beta, rf)
}

fn vertical_section(north: f64, east: f64, vsp_rad: f64) -> f64 {
    north * vsp_rad.cos() + east * vsp_rad.sin()
}

fn closure(north: f64, east: f64) -> (f64, f64) {
    let dist = north.hypot(east);
    let mut azi = east.atan2(north);
    if azi < 0.0 {
        azi += std::f64::consts::TAU;
    }
    (dist, azi)
}

/// Reconstruct a trajectory. Lengths in the hole `unit_system`.
pub fn calculate_trajectory(input: &HoleCalcInput) -> Result<Trajectory, CalcError> {
    let issues = validate_stations(input.convention, &input.stations);
    if has_blocking_error(&issues) {
        return Err(CalcError::Validation(issues));
    }

    let to_m = match input.unit_system {
        UnitSystem::Metric => 1.0,
        UnitSystem::Imperial => ft_to_m(1.0),
    };
    let from_m = match input.unit_system {
        UnitSystem::Metric => 1.0,
        UnitSystem::Imperial => m_to_ft(1.0),
    };
    let dls_disp = match input.unit_system {
        UnitSystem::Metric => DlsDisplay::DegPer30m,
        UnitSystem::Imperial => DlsDisplay::DegPer100ft,
    };

    let vsp = deg_to_rad(input.vsp_deg);
    let mut out = Vec::with_capacity(input.stations.len());

    let first = &input.stations[0];
    let (c0, a0) = closure(input.tie_in.north, input.tie_in.east);
    out.push(CalculatedStation {
        md: first.md,
        inc_deg: first.inc_deg,
        azi_deg: first.azi_deg,
        tvd: input.tie_in.tvd,
        north: input.tie_in.north,
        east: input.tie_in.east,
        vs: vertical_section(input.tie_in.north, input.tie_in.east, vsp),
        closure: c0,
        closure_azi_deg: rad_to_deg(a0),
        dogleg_deg: 0.0,
        dls: 0.0,
        comment: first.comment.clone(),
        class: first.class,
    });

    for i in 1..input.stations.len() {
        let prev = &input.stations[i - 1];
        let cur = &input.stations[i];
        let cl_m = (cur.md - prev.md) * to_m;
        if cl_m <= 0.0 {
            return Err(CalcError::NonPositiveCourse { index: i });
        }
        let v1 = unit_tangent(deg_to_rad(prev.inc_deg), deg_to_rad(prev.azi_deg));
        let v2 = unit_tangent(deg_to_rad(cur.inc_deg), deg_to_rad(cur.azi_deg));
        let (beta, rf) = dogleg_and_rf(v1, v2);
        if !beta.is_finite() || !rf.is_finite() {
            return Err(CalcError::Numerical { index: i });
        }

        let dn_m = (cl_m / 2.0) * (v1.n + v2.n) * rf;
        let de_m = (cl_m / 2.0) * (v1.e + v2.e) * rf;
        let dt_m = (cl_m / 2.0) * (v1.t + v2.t) * rf;

        let last = out.last().unwrap();
        let north = last.north + dn_m * from_m;
        let east = last.east + de_m * from_m;
        let tvd = last.tvd + dt_m * from_m;
        let (clsr, clsr_azi) = closure(north, east);
        let dls_rad_m = beta / cl_m;

        out.push(CalculatedStation {
            md: cur.md,
            inc_deg: cur.inc_deg,
            azi_deg: cur.azi_deg,
            tvd,
            north,
            east,
            vs: vertical_section(north, east, vsp),
            closure: clsr,
            closure_azi_deg: rad_to_deg(clsr_azi),
            dogleg_deg: rad_to_deg(beta),
            dls: dls_to_display(dls_rad_m, dls_disp),
            comment: cur.comment.clone(),
            class: cur.class,
        });
    }

    if out.iter().any(|s| {
        !s.tvd.is_finite() || !s.north.is_finite() || !s.east.is_finite() || !s.dls.is_finite()
    }) {
        return Err(CalcError::Numerical { index: 0 });
    }

    Ok(Trajectory {
        unit_system: input.unit_system,
        convention: input.convention,
        azimuth_reference: input.azimuth_reference,
        vsp_deg: input.vsp_deg,
        stations: out,
    })
}

/// Hold attitude from the last measured station to an added course length (same units as MD).
pub fn tangent_continue(
    input: &HoleCalcInput,
    added_md: f64,
    class: StationClass,
    comment: &str,
) -> Result<Trajectory, CalcError> {
    if added_md <= 0.0 || !added_md.is_finite() {
        return Err(CalcError::NonPositiveCourse {
            index: input.stations.len(),
        });
    }
    let last = input.stations.last().ok_or(CalcError::Empty)?;
    let mut next = input.clone();
    next.stations.push(MeasuredStation {
        md: last.md + added_md,
        inc_deg: last.inc_deg,
        azi_deg: last.azi_deg,
        comment: comment.to_string(),
        class,
        source: last.source,
    });
    calculate_trajectory(&next)
}

/// Continue at constant I/A until TVD is reached. Fails if the hold cannot reach that TVD.
pub fn tangent_to_tvd(
    input: &HoleCalcInput,
    target_tvd: f64,
    class: StationClass,
    comment: &str,
) -> Result<Trajectory, CalcError> {
    let traj = calculate_trajectory(input)?;
    let last = traj.stations.last().ok_or(CalcError::Empty)?;
    let inc = deg_to_rad(last.inc_deg);
    let cos_i = inc.cos();
    if cos_i.abs() < 1e-10 {
        return Err(CalcError::Numerical {
            index: input.stations.len(),
        });
    }
    let dt = target_tvd - last.tvd;
    let added = dt / cos_i;
    if added <= 0.0 {
        return Err(CalcError::NonPositiveCourse {
            index: input.stations.len(),
        });
    }
    tangent_continue(input, added, class, comment)
}
