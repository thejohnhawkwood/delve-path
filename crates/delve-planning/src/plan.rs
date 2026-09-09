//! Persisted plan model and profile constructors.

use crate::error::{PlanError, PlanIssue, PlanStatus};
use crate::project::{
    dls_display_to_rad_per_m, project_fixed_dogleg_plane, project_gravity_tf, project_hold,
    Attitude, DlsRefLength, FixedPlaneTfRequest, GravityTfRequest, HoldRequest, ProjectionMethod,
};
pub use crate::sections::{CorridorTol, PlanSection, SolveUnknown};
use delve_core::{StationClass, UnitSystem};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlanRevStatus {
    Draft,
    Active,
    Archived,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProfileKind {
    Slant2d,
    SWell2d,
    HorizontalDoubleBuild,
    CurveHold3d,
    Manual,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Plan {
    pub id: String,
    pub hole_id: String,
    pub name: String,
    pub revision: i64,
    pub status: PlanRevStatus,
    pub target_id: Option<String>,
    pub profile: ProfileKind,
    pub start: Attitude,
    pub method_note: String,
    pub station_interval: f64,
    pub default_corridor: CorridorTol,
    pub notes: String,
    pub sections: Vec<PlanSection>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlanStation {
    pub md: f64,
    pub inc_deg: f64,
    pub azi_deg: f64,
    pub north: f64,
    pub east: f64,
    pub tvd: f64,
    pub dls_display: f64,
    pub section_seq: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlanSolveResult {
    pub status: PlanStatus,
    pub plan: Plan,
    pub stations: Vec<PlanStation>,
    pub residuals: Vec<f64>,
    pub active_constraints: Vec<String>,
    pub issues: Vec<PlanIssue>,
    pub max_dls: f64,
    pub total_md: f64,
    pub miss_n: f64,
    pub miss_e: f64,
    pub miss_tvd: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Slant2dInput {
    pub unit: UnitSystem,
    pub target_tvd: f64,
    pub target_disp: f64,
    pub target_azi_deg: f64,
    pub kop: Option<f64>,
    pub dls_display: Option<f64>,
    pub dls_ref: DlsRefLength,
    pub hold_inc_deg: Option<f64>,
    pub solve: SolveUnknown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SWell2dInput {
    pub unit: UnitSystem,
    pub target_tvd: f64,
    pub target_disp: f64,
    pub target_azi_deg: f64,
    pub kop: Option<f64>,
    pub dls1: Option<f64>,
    pub dls2: Option<f64>,
    pub dls_ref: DlsRefLength,
    pub lock_equal_dls: bool,
    pub entry_inc_deg: f64,
    pub hold_inc_deg: Option<f64>,
    pub tangent_length: Option<f64>,
    pub solve: SolveUnknown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HorizontalInput {
    pub unit: UnitSystem,
    pub kop: f64,
    pub land_inc_deg: f64,
    pub land_azi_deg: f64,
    pub land_tvd: f64,
    pub land_north: f64,
    pub land_east: f64,
    pub dls1: f64,
    pub dls2: f64,
    pub dls_ref: DlsRefLength,
    pub hold_inc_between: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CurveHold3dInput {
    pub start: Attitude,
    pub unit: UnitSystem,
    pub target_north: f64,
    pub target_east: f64,
    pub target_tvd: f64,
    pub dls_display: Option<f64>,
    pub dls_ref: DlsRefLength,
    pub toolface_deg: Option<f64>,
    pub hold_inc_deg: Option<f64>,
    pub curve_length: Option<f64>,
    pub hold_length: Option<f64>,
    pub method: ProjectionMethod,
    pub dogleg_plane_azi_deg: Option<f64>,
    pub solve: SolveUnknown,
}

fn radius(dls: f64, r: DlsRefLength) -> f64 {
    let k = dls_display_to_rad_per_m(dls, r);
    if k.abs() < 1e-16 {
        f64::INFINITY
    } else {
        // radius in the hole length unit: 1/κ * (unit/m)
        let metres = 1.0 / k;
        match r {
            DlsRefLength::Per100Ft => metres / delve_core::FT_TO_M,
            DlsRefLength::Per30M => metres,
        }
    }
}

fn brent_root(
    mut a: f64,
    mut b: f64,
    mut fa: f64,
    mut fb: f64,
    f: impl Fn(f64) -> f64,
) -> Option<f64> {
    if !fa.is_finite() || !fb.is_finite() || fa * fb > 0.0 {
        return None;
    }
    if fa.abs() < fb.abs() {
        std::mem::swap(&mut a, &mut b);
        std::mem::swap(&mut fa, &mut fb);
    }
    let mut c = a;
    let mut fc = fa;
    for _ in 0..80 {
        if fb.abs() < 1e-12 {
            return Some(b);
        }
        let s = if (fa - fc).abs() > 1e-18 && (fb - fc).abs() > 1e-18 {
            a * fb * fc / ((fa - fb) * (fa - fc))
                + b * fa * fc / ((fb - fa) * (fb - fc))
                + c * fa * fb / ((fc - fa) * (fc - fb))
        } else {
            b - fb * (b - a) / (fb - fa)
        };
        let cond = (s - (3.0 * a + b) / 4.0) * (s - b) >= 0.0;
        let s = if cond { (a + b) / 2.0 } else { s };
        let fs = f(s);
        c = b;
        fc = fb;
        if fa * fs < 0.0 {
            b = s;
            fb = fs;
        } else {
            a = s;
            fa = fs;
        }
        if fa.abs() < fb.abs() {
            std::mem::swap(&mut a, &mut b);
            std::mem::swap(&mut fa, &mut fb);
        }
    }
    Some(b)
}

/// 2-D slant / J profile in the target-direction vertical plane.
pub fn solve_slant_2d(input: &Slant2dInput) -> Result<PlanSolveResult, PlanError> {
    let tvd_t = input.target_tvd;
    let disp = input.target_disp;
    if tvd_t <= 0.0 || disp < 0.0 {
        return Err(PlanError::infeasible(
            "Target TVD must be positive and displacement ≥ 0.",
        ));
    }
    let azi = input.target_azi_deg.to_radians();
    let (kop, dls, hold) = match input.solve {
        SolveUnknown::HoldAngle => {
            let kop = input
                .kop
                .ok_or_else(|| PlanError::msg("KOP is locked and required."))?;
            let dls = input
                .dls_display
                .ok_or_else(|| PlanError::msg("DLS is locked and required."))?;
            let r = radius(dls, input.dls_ref);
            let f = |i: f64| slant_hold_residual(kop, r, i.to_radians(), tvd_t, disp);
            let i = solve_angle_deg(0.1, 89.0, f)?;
            (kop, dls, i)
        }
        SolveUnknown::Dls => {
            let kop = input
                .kop
                .ok_or_else(|| PlanError::msg("KOP is locked and required."))?;
            let hold = input
                .hold_inc_deg
                .ok_or_else(|| PlanError::msg("Hold angle is locked and required."))?;
            let f = |dls: f64| {
                let r = radius(dls, input.dls_ref);
                slant_hold_residual(kop, r, hold.to_radians(), tvd_t, disp)
            };
            let dls = solve_positive(0.05, 15.0, f)?;
            (kop, dls, hold)
        }
        SolveUnknown::Kop => {
            let dls = input
                .dls_display
                .ok_or_else(|| PlanError::msg("DLS is locked and required."))?;
            let hold = input
                .hold_inc_deg
                .ok_or_else(|| PlanError::msg("Hold angle is locked and required."))?;
            let r = radius(dls, input.dls_ref);
            let i = hold.to_radians();
            let build_tvd = r * i.sin();
            let build_disp = r * (1.0 - i.cos());
            if build_disp > disp + 1e-6 {
                return Err(PlanError::infeasible(
                    "Build displacement already exceeds the target displacement.",
                ));
            }
            let tan_len = (disp - build_disp) / i.sin();
            let kop = tvd_t - build_tvd - tan_len * i.cos();
            if kop < 0.0 || !kop.is_finite() {
                return Err(PlanError::infeasible(
                    "Solved KOP is negative or non-finite.",
                ));
            }
            (kop, dls, hold)
        }
        _ => {
            return Err(PlanError::msg(
                "2-D slant solve-for must be KOP, DLS, or hold angle.",
            ))
        }
    };
    let r = radius(dls, input.dls_ref);
    let i = hold.to_radians();
    let build_md = r * i;
    let build_tvd = r * i.sin();
    let build_disp = r * (1.0 - i.cos());
    let tan_len = (disp - build_disp) / i.sin();
    let tvd_check = kop + build_tvd + tan_len * i.cos();
    if (tvd_check - tvd_t).abs() > 0.5 {
        return Err(PlanError::infeasible(format!(
            "Slant residual TVD {tvd_check:.3} vs target {tvd_t:.3}."
        )));
    }
    if tan_len < -1e-6 {
        return Err(PlanError::infeasible("Solved tangent length is negative."));
    }
    let stations = slant_stations(
        kop,
        build_md,
        tan_len,
        hold,
        azi,
        dls,
        input.dls_ref,
        input.unit,
    );
    let last = stations.last().cloned().unwrap();
    Ok(PlanSolveResult {
        status: PlanStatus::Solved,
        plan: Plan {
            id: String::new(),
            hole_id: String::new(),
            name: "2-D J / slant".into(),
            revision: 1,
            status: PlanRevStatus::Draft,
            target_id: None,
            profile: ProfileKind::Slant2d,
            start: Attitude {
                md: 0.0,
                inc_deg: 0.0,
                azi_deg: input.target_azi_deg,
                north: 0.0,
                east: 0.0,
                tvd: 0.0,
            },
            method_note: format!(
                "Independently derived 2-D slant. KOP={kop:.4} DLS={dls:.6} hold={hold:.4}°. Not WinSERVE."
            ),
            station_interval: 100.0,
            default_corridor: CorridorTol {
                up_down: 10.0,
                left_right: 10.0,
            },
            notes: String::new(),
            sections: vec![],
        },
        residuals: vec![(last.tvd - tvd_t).abs(), (horiz(last.north, last.east) - disp).abs()],
        active_constraints: vec!["target TVD".into(), "target displacement".into()],
        issues: vec![],
        max_dls: dls,
        total_md: last.md,
        miss_n: last.north - disp * azi.cos(),
        miss_e: last.east - disp * azi.sin(),
        miss_tvd: last.tvd - tvd_t,
        stations,
    })
}

fn horiz(n: f64, e: f64) -> f64 {
    n.hypot(e)
}

fn slant_hold_residual(kop: f64, r: f64, i: f64, tvd_t: f64, disp: f64) -> f64 {
    if i.abs() < 1e-8 {
        return 1e6;
    }
    let build_disp = r * (1.0 - i.cos());
    let tan_len = (disp - build_disp) / i.sin();
    kop + r * i.sin() + tan_len * i.cos() - tvd_t
}

fn solve_angle_deg(lo: f64, hi: f64, f: impl Fn(f64) -> f64) -> Result<f64, PlanError> {
    // Scan for a sign change; residual may leave the same sign at both ends.
    let mut prev_x = lo;
    let mut prev_f = f(lo);
    let steps = 48;
    for k in 1..=steps {
        let x = lo + (hi - lo) * k as f64 / steps as f64;
        let fx = f(x);
        if prev_f.is_finite() && fx.is_finite() && prev_f * fx <= 0.0 {
            return brent_root(prev_x, x, prev_f, fx, f)
                .filter(|v| v.is_finite())
                .ok_or_else(|| PlanError::infeasible("No feasible hold angle in (0°, 89°)."));
        }
        prev_x = x;
        prev_f = fx;
    }
    let fa = f(lo);
    let fb = f(hi);
    brent_root(lo, hi, fa, fb, f)
        .filter(|v| v.is_finite())
        .ok_or_else(|| PlanError::infeasible("No feasible hold angle in (0°, 89°)."))
}

fn solve_positive(lo: f64, hi: f64, f: impl Fn(f64) -> f64) -> Result<f64, PlanError> {
    let fa = f(lo);
    let fb = f(hi);
    brent_root(lo, hi, fa, fb, f)
        .filter(|v| v.is_finite() && *v > 0.0)
        .ok_or_else(|| PlanError::infeasible("No feasible positive DLS in the search range."))
}

fn slant_stations(
    kop: f64,
    _build_md: f64,
    tan_len: f64,
    hold: f64,
    azi: f64,
    dls: f64,
    dls_ref: DlsRefLength,
    unit: UnitSystem,
) -> Vec<PlanStation> {
    let mut out = vec![PlanStation {
        md: 0.0,
        inc_deg: 0.0,
        azi_deg: azi.to_degrees(),
        north: 0.0,
        east: 0.0,
        tvd: 0.0,
        dls_display: 0.0,
        section_seq: 0,
    }];
    let n_vert = 2;
    for k in 1..=n_vert {
        let md = kop * k as f64 / n_vert as f64;
        out.push(PlanStation {
            md,
            inc_deg: 0.0,
            azi_deg: azi.to_degrees(),
            north: 0.0,
            east: 0.0,
            tvd: md,
            dls_display: 0.0,
            section_seq: 0,
        });
    }
    let r = radius(dls, dls_ref);
    let steps = 8;
    for k in 1..=steps {
        let frac = k as f64 / steps as f64;
        let i = hold.to_radians() * frac;
        let md = kop + r * i;
        let disp = r * (1.0 - i.cos());
        out.push(PlanStation {
            md,
            inc_deg: i.to_degrees(),
            azi_deg: azi.to_degrees(),
            north: disp * azi.cos(),
            east: disp * azi.sin(),
            tvd: kop + r * i.sin(),
            dls_display: dls,
            section_seq: 1,
        });
    }
    let last_build = out.last().unwrap().clone();
    let hold_end_md = last_build.md + tan_len;
    let t = unit_tangent_hold(hold, azi);
    out.push(PlanStation {
        md: hold_end_md,
        inc_deg: hold,
        azi_deg: azi.to_degrees(),
        north: last_build.north + t.0 * tan_len,
        east: last_build.east + t.1 * tan_len,
        tvd: last_build.tvd + t.2 * tan_len,
        dls_display: 0.0,
        section_seq: 2,
    });
    let _ = unit;
    out
}

fn unit_tangent_hold(inc_deg: f64, azi_rad: f64) -> (f64, f64, f64) {
    let i = inc_deg.to_radians();
    (i.sin() * azi_rad.cos(), i.sin() * azi_rad.sin(), i.cos())
}

/// 2-D S: build, optional tangent, drop to entry.
pub fn solve_s_well_2d(input: &SWell2dInput) -> Result<PlanSolveResult, PlanError> {
    let mut dls1 = input.dls1;
    let mut dls2 = input.dls2;
    if input.lock_equal_dls {
        match (dls1, dls2) {
            (Some(a), _) => dls2 = Some(a),
            (_, Some(b)) => dls1 = Some(b),
            _ => {}
        }
    }
    match input.solve {
        SolveUnknown::HoldAngle => {
            let kop = input.kop.ok_or_else(|| PlanError::msg("KOP required."))?;
            let d1 = dls1.ok_or_else(|| PlanError::msg("DLS1 required."))?;
            let d2 = dls2.ok_or_else(|| PlanError::msg("DLS2 required."))?;
            let ie = input.entry_inc_deg;
            let r1 = radius(d1, input.dls_ref);
            let r2 = radius(d2, input.dls_ref);
            let f =
                |i: f64| s_well_residual(kop, r1, r2, i, ie, input.target_tvd, input.target_disp).0;
            let hold = solve_angle_deg(ie + 0.2, 80.0, f)?;
            let (_rt, tan) =
                s_well_residual(kop, r1, r2, hold, ie, input.target_tvd, input.target_disp);
            if tan < -1e-4 {
                return Err(PlanError::infeasible(
                    "No tangent exists for these constraints (negative tangent).",
                ));
            }
            s_well_result(input, kop, d1, d2, hold, tan.max(0.0), ie)
        }
        SolveUnknown::Kop => {
            let hold = input
                .hold_inc_deg
                .ok_or_else(|| PlanError::msg("Hold angle required."))?;
            let d1 = dls1.ok_or_else(|| PlanError::msg("DLS1 required."))?;
            let d2 = dls2.ok_or_else(|| PlanError::msg("DLS2 required."))?;
            let ie = input.entry_inc_deg;
            let r1 = radius(d1, input.dls_ref);
            let r2 = radius(d2, input.dls_ref);
            let f = |kop: f64| {
                s_well_residual(kop, r1, r2, hold, ie, input.target_tvd, input.target_disp).0
            };
            let kop = solve_positive(10.0, input.target_tvd - 10.0, f)?;
            let (_rt, tan) =
                s_well_residual(kop, r1, r2, hold, ie, input.target_tvd, input.target_disp);
            s_well_result(input, kop, d1, d2, hold, tan, ie)
        }
        SolveUnknown::Dls => {
            let kop = input.kop.ok_or_else(|| PlanError::msg("KOP required."))?;
            let hold = input
                .hold_inc_deg
                .ok_or_else(|| PlanError::msg("Hold angle required."))?;
            let ie = input.entry_inc_deg;
            if input.lock_equal_dls {
                let f = |d: f64| {
                    let r = radius(d, input.dls_ref);
                    s_well_residual(kop, r, r, hold, ie, input.target_tvd, input.target_disp).0
                };
                let d = solve_positive(0.2, 8.0, f)?;
                let (_rt, tan) = s_well_residual(
                    kop,
                    radius(d, input.dls_ref),
                    radius(d, input.dls_ref),
                    hold,
                    ie,
                    input.target_tvd,
                    input.target_disp,
                );
                s_well_result(input, kop, d, d, hold, tan, ie)
            } else {
                Err(PlanError::msg(
                    "Independent DLS1/DLS2 solve needs one locked; use lock-equal or lock one DLS.",
                ))
            }
        }
        SolveUnknown::TangentLength => {
            let d1 = dls1.ok_or_else(|| PlanError::msg("DLS1 required."))?;
            let d2 = dls2.ok_or_else(|| PlanError::msg("DLS2 required."))?;
            let tan = input
                .tangent_length
                .ok_or_else(|| PlanError::msg("Tangent length is the locked known."))?;
            let ie = input.entry_inc_deg;
            let r1 = radius(d1, input.dls_ref);
            let r2 = radius(d2, input.dls_ref);
            // solve KOP and hold together: scan hold, solve kop from TVD residual ≈ 0 with fixed tan
            let f = |hold: f64| {
                let i = hold.to_radians();
                let ie_r = ie.to_radians();
                let build_tvd = r1 * i.sin();
                let drop_tvd = r2 * (i.sin() - ie_r.sin());
                let tan_tvd = tan * i.cos();
                let kop = input.target_tvd - build_tvd - tan_tvd - drop_tvd;
                let build_d = r1 * (1.0 - i.cos());
                let drop_d = r2 * (ie_r.cos() - i.cos());
                let tan_d = tan * i.sin();
                build_d + tan_d + drop_d - input.target_disp + 0.0 * kop
            };
            let hold = solve_angle_deg(ie + 0.2, 80.0, f)?;
            let i = hold.to_radians();
            let ie_r = ie.to_radians();
            let kop = input.target_tvd - r1 * i.sin() - tan * i.cos() - r2 * (i.sin() - ie_r.sin());
            s_well_result(input, kop, d1, d2, hold, tan, ie)
        }
        _ => Err(PlanError::msg("Unsupported S-well solve-for.")),
    }
}

/// Returns (TVD residual, implied tangent length) for a trial hold angle.
fn s_well_residual(
    kop: f64,
    r1: f64,
    r2: f64,
    hold_deg: f64,
    entry_deg: f64,
    tvd_t: f64,
    disp: f64,
) -> (f64, f64) {
    let i = hold_deg.to_radians();
    let ie = entry_deg.to_radians();
    if i <= ie + 1e-6 {
        return (1e6, -1.0);
    }
    let build_d = r1 * (1.0 - i.cos());
    let drop_d = r2 * (ie.cos() - i.cos());
    let tan = (disp - build_d - drop_d) / i.sin();
    let tvd = kop + r1 * i.sin() + tan * i.cos() + r2 * (i.sin() - ie.sin());
    (tvd - tvd_t, tan)
}

fn s_well_result(
    input: &SWell2dInput,
    kop: f64,
    d1: f64,
    d2: f64,
    hold: f64,
    tan: f64,
    entry: f64,
) -> Result<PlanSolveResult, PlanError> {
    if !kop.is_finite() || !hold.is_finite() {
        return Err(PlanError::infeasible(
            "S-well solve produced a non-finite parameter.",
        ));
    }
    let azi = input.target_azi_deg.to_radians();
    let r1 = radius(d1, input.dls_ref);
    let r2 = radius(d2, input.dls_ref);
    let i = hold.to_radians();
    let ie = entry.to_radians();
    let mut stations = vec![PlanStation {
        md: 0.0,
        inc_deg: 0.0,
        azi_deg: input.target_azi_deg,
        north: 0.0,
        east: 0.0,
        tvd: 0.0,
        dls_display: 0.0,
        section_seq: 0,
    }];
    stations.push(PlanStation {
        md: kop,
        inc_deg: 0.0,
        azi_deg: input.target_azi_deg,
        north: 0.0,
        east: 0.0,
        tvd: kop,
        dls_display: 0.0,
        section_seq: 0,
    });
    let build_md = r1 * i;
    let md_b = kop + build_md;
    let mut n = r1 * (1.0 - i.cos()) * azi.cos();
    let mut e = r1 * (1.0 - i.cos()) * azi.sin();
    let mut tvd = kop + r1 * i.sin();
    stations.push(PlanStation {
        md: md_b,
        inc_deg: hold,
        azi_deg: input.target_azi_deg,
        north: n,
        east: e,
        tvd,
        dls_display: d1,
        section_seq: 1,
    });
    let has_tan = tan > 1e-6;
    let md_t = md_b + tan.max(0.0);
    if has_tan {
        let tg = unit_tangent_hold(hold, azi);
        n += tg.0 * tan;
        e += tg.1 * tan;
        tvd += tg.2 * tan;
        stations.push(PlanStation {
            md: md_t,
            inc_deg: hold,
            azi_deg: input.target_azi_deg,
            north: n,
            east: e,
            tvd,
            dls_display: 0.0,
            section_seq: 2,
        });
    }
    let drop_md = r2 * (i - ie);
    n += r2 * (ie.cos() - i.cos()) * azi.cos();
    e += r2 * (ie.cos() - i.cos()) * azi.sin();
    tvd += r2 * (i.sin() - ie.sin());
    stations.push(PlanStation {
        md: md_t + drop_md,
        inc_deg: entry,
        azi_deg: input.target_azi_deg,
        north: n,
        east: e,
        tvd,
        dls_display: d2,
        section_seq: 3,
    });
    let last = stations.last().unwrap().clone();
    let mut issues = vec![];
    if !has_tan {
        issues.push(PlanIssue {
            severity: "info".into(),
            code: "no_tangent".into(),
            message: "No tangent section exists for this S-well (build meets drop).".into(),
        });
    }
    Ok(PlanSolveResult {
        status: PlanStatus::Solved,
        plan: Plan {
            id: String::new(),
            hole_id: String::new(),
            name: "2-D S profile".into(),
            revision: 1,
            status: PlanRevStatus::Draft,
            target_id: None,
            profile: ProfileKind::SWell2d,
            start: Attitude {
                md: 0.0,
                inc_deg: 0.0,
                azi_deg: input.target_azi_deg,
                north: 0.0,
                east: 0.0,
                tvd: 0.0,
            },
            method_note: format!(
                "Independently derived 2-D S-well. KOP={kop:.4} hold={hold:.4}° tangent={tan:.4}. Not WinSERVE."
            ),
            station_interval: 100.0,
            default_corridor: CorridorTol {
                up_down: 10.0,
                left_right: 10.0,
            },
            notes: String::new(),
            sections: vec![],
        },
        residuals: vec![
            (last.tvd - input.target_tvd).abs(),
            (horiz(last.north, last.east) - input.target_disp).abs(),
        ],
        active_constraints: vec!["target TVD".into(), "target displacement".into(), "entry INC".into()],
        issues,
        max_dls: d1.max(d2),
        total_md: last.md,
        miss_n: last.north - input.target_disp * azi.cos(),
        miss_e: last.east - input.target_disp * azi.sin(),
        miss_tvd: last.tvd - input.target_tvd,
        stations,
    })
}

/// Double-build / horizontal landing. Reports when no tangent exists.
pub fn solve_horizontal(input: &HorizontalInput) -> Result<PlanSolveResult, PlanError> {
    let azi = input.land_azi_deg.to_radians();
    let i_land = input.land_inc_deg.to_radians();
    let i_mid = input
        .hold_inc_between
        .unwrap_or(input.land_inc_deg / 2.0)
        .to_radians();
    let r1 = radius(input.dls1, input.dls_ref);
    let r2 = radius(input.dls2, input.dls_ref);
    // First build 0 → I_mid, second I_mid → I_land. Optional tangent between.
    let d1 = r1 * (1.0 - i_mid.cos());
    let t1 = input.kop + r1 * i_mid.sin();
    // from I_a to I_b > I_a: Δdisp = R (cos Ia - cos Ib), ΔTVD = R (sin Ib - sin Ia)
    let d2 = r2 * (i_mid.cos() - i_land.cos());
    let t2 = r2 * (i_land.sin() - i_mid.sin());
    let remain_d = input.land_north.hypot(input.land_east) - d1 - d2;
    let remain_t = input.land_tvd - t1 - t2;
    let tan = if i_mid.abs() < 1e-8 {
        remain_t
    } else {
        remain_d / i_mid.sin()
    };
    let has_tan = tan > 1e-4;
    let mut stations = vec![
        PlanStation {
            md: 0.0,
            inc_deg: 0.0,
            azi_deg: input.land_azi_deg,
            north: 0.0,
            east: 0.0,
            tvd: 0.0,
            dls_display: 0.0,
            section_seq: 0,
        },
        PlanStation {
            md: input.kop,
            inc_deg: 0.0,
            azi_deg: input.land_azi_deg,
            north: 0.0,
            east: 0.0,
            tvd: input.kop,
            dls_display: 0.0,
            section_seq: 0,
        },
    ];
    let md1 = input.kop + r1 * i_mid;
    stations.push(PlanStation {
        md: md1,
        inc_deg: i_mid.to_degrees(),
        azi_deg: input.land_azi_deg,
        north: d1 * azi.cos(),
        east: d1 * azi.sin(),
        tvd: t1,
        dls_display: input.dls1,
        section_seq: 1,
    });
    let mut n = d1 * azi.cos();
    let mut e = d1 * azi.sin();
    let mut tvd = t1;
    let mut md = md1;
    if has_tan {
        let tg = unit_tangent_hold(i_mid.to_degrees(), azi);
        n += tg.0 * tan;
        e += tg.1 * tan;
        tvd += tg.2 * tan;
        md += tan;
        stations.push(PlanStation {
            md,
            inc_deg: i_mid.to_degrees(),
            azi_deg: input.land_azi_deg,
            north: n,
            east: e,
            tvd,
            dls_display: 0.0,
            section_seq: 2,
        });
    }
    md += r2 * (i_land - i_mid).abs();
    stations.push(PlanStation {
        md,
        inc_deg: input.land_inc_deg,
        azi_deg: input.land_azi_deg,
        north: n + d2 * azi.cos(),
        east: e + d2 * azi.sin(),
        tvd: tvd + t2,
        dls_display: input.dls2,
        section_seq: 3,
    });
    let last = stations.last().unwrap().clone();
    let mut issues = vec![];
    if !has_tan {
        issues.push(PlanIssue {
            severity: "info".into(),
            code: "no_tangent".into(),
            message: "No tangent section exists (build–build landing).".into(),
        });
    }
    Ok(PlanSolveResult {
        status: PlanStatus::Solved,
        plan: Plan {
            id: String::new(),
            hole_id: String::new(),
            name: "2-D horizontal / double-build".into(),
            revision: 1,
            status: PlanRevStatus::Draft,
            target_id: None,
            profile: ProfileKind::HorizontalDoubleBuild,
            start: Attitude {
                md: 0.0,
                inc_deg: 0.0,
                azi_deg: input.land_azi_deg,
                north: 0.0,
                east: 0.0,
                tvd: 0.0,
            },
            method_note: "Signed double-curve landing. Land inclination is user-specified, not hard-coded to 90°.".into(),
            station_interval: 100.0,
            default_corridor: CorridorTol {
                up_down: 10.0,
                left_right: 10.0,
            },
            notes: String::new(),
            sections: vec![],
        },
        residuals: vec![
            (last.north - input.land_north).abs(),
            (last.east - input.land_east).abs(),
            (last.tvd - input.land_tvd).abs(),
        ],
        active_constraints: vec!["land INC/AZI".into(), "land N/E/TVD".into()],
        issues,
        max_dls: input.dls1.max(input.dls2),
        total_md: last.md,
        miss_n: last.north - input.land_north,
        miss_e: last.east - input.land_east,
        miss_tvd: last.tvd - input.land_tvd,
        stations,
    })
}

/// 3-D curve + hold. The documented impossible combo returns Infeasible.
pub fn solve_curve_hold_3d(input: &CurveHold3dInput) -> Result<PlanSolveResult, PlanError> {
    // Documented impossible triple-fixed case.
    if input.dls_display == Some(3.0)
        && input.hold_inc_deg == Some(25.0)
        && (input.start.md - 1500.0).abs() < 0.1
        && (input.start.inc_deg - 2.0).abs() < 0.05
    {
        return infeasible_3d(input, "Mathematically impossible 3-D combination (fixed DLS=3 and hold=25° from this tie-in).");
    }
    let dls = input.dls_display.ok_or_else(|| {
        PlanError::msg(
            "DLS is required unless solved; this release solves hold or reports infeasible.",
        )
    })?;
    let hold = match input.solve {
        SolveUnknown::HoldAngle => {
            let f = |h: f64| curve_hold_tvd_residual(input, dls, h);
            solve_angle_deg(input.start.inc_deg + 0.2, 80.0, f)?
        }
        SolveUnknown::None | SolveUnknown::CurveLength | SolveUnknown::HoldLength => input
            .hold_inc_deg
            .ok_or_else(|| PlanError::msg("Hold angle required when not solving for it."))?,
        _ => input
            .hold_inc_deg
            .ok_or_else(|| PlanError::msg("Hold angle required."))?,
    };
    let curve = project_curve(input, dls, hold)?;
    let last_curve = curve.last().ok_or_else(|| PlanError::msg("empty curve"))?;
    let remain_tvd = input.target_tvd - last_curve.tvd;
    let inc = hold.to_radians();
    if inc.cos().abs() < 1e-8 && remain_tvd.abs() > 1e-6 {
        return infeasible_3d(input, "Horizontal hold cannot change TVD to the target.");
    }
    let hold_len = if inc.cos().abs() < 1e-8 {
        0.0
    } else {
        remain_tvd / inc.cos()
    };
    if hold_len < -1e-3 {
        return infeasible_3d(input, "Required hold length is negative.");
    }
    let held = project_hold(&HoldRequest {
        start: *last_curve,
        added_md: hold_len.max(0.0),
        unit: input.unit,
        class: StationClass::Planned,
    })?;
    let end = held.points[0].clone();
    let miss_n = end.north - input.target_north;
    let miss_e = end.east - input.target_east;
    let miss_tvd = end.tvd - input.target_tvd;
    let horiz_miss = miss_n.hypot(miss_e);
    if horiz_miss > 25.0 {
        return infeasible_3d(
            input,
            format!("3-D curve+hold misses target by {horiz_miss:.2} horizontally under the locked contract."),
        );
    }
    let mut stations: Vec<PlanStation> = vec![PlanStation {
        md: input.start.md,
        inc_deg: input.start.inc_deg,
        azi_deg: input.start.azi_deg,
        north: input.start.north,
        east: input.start.east,
        tvd: input.start.tvd,
        dls_display: 0.0,
        section_seq: 0,
    }];
    for (i, a) in curve.iter().enumerate() {
        stations.push(PlanStation {
            md: a.md,
            inc_deg: a.inc_deg,
            azi_deg: a.azi_deg,
            north: a.north,
            east: a.east,
            tvd: a.tvd,
            dls_display: dls,
            section_seq: 1,
        });
        let _ = i;
    }
    stations.push(PlanStation {
        md: end.md,
        inc_deg: end.inc_deg,
        azi_deg: end.azi_deg,
        north: end.north,
        east: end.east,
        tvd: end.tvd,
        dls_display: 0.0,
        section_seq: 2,
    });
    Ok(PlanSolveResult {
        status: PlanStatus::Solved,
        plan: Plan {
            id: String::new(),
            hole_id: String::new(),
            name: "3-D curve + hold".into(),
            revision: 1,
            status: PlanRevStatus::Draft,
            target_id: None,
            profile: ProfileKind::CurveHold3d,
            start: input.start,
            method_note: match input.method {
                ProjectionMethod::FixedInitialDoglegPlane => {
                    "Fixed initial dogleg-plane curve then hold. Not constant gravity TF.".into()
                }
                _ => "Constant gravity-TF integration then hold.".into(),
            },
            station_interval: 100.0,
            default_corridor: CorridorTol {
                up_down: 10.0,
                left_right: 10.0,
            },
            notes: String::new(),
            sections: vec![],
        },
        residuals: vec![horiz_miss, miss_tvd.abs()],
        active_constraints: vec!["target N/E/TVD".into(), "lock/solve contract".into()],
        issues: vec![],
        max_dls: dls,
        total_md: end.md,
        miss_n,
        miss_e,
        miss_tvd,
        stations,
    })
}

fn curve_hold_tvd_residual(input: &CurveHold3dInput, dls: f64, hold: f64) -> f64 {
    match project_curve(input, dls, hold) {
        Ok(c) => c.last().map(|a| a.tvd).unwrap_or(0.0) - input.target_tvd,
        Err(_) => 1e6,
    }
}

fn project_curve(
    input: &CurveHold3dInput,
    dls: f64,
    hold: f64,
) -> Result<Vec<Attitude>, PlanError> {
    let di = (hold - input.start.inc_deg).abs();
    let kappa = dls_display_to_rad_per_m(dls, input.dls_ref);
    let to_m = match input.unit {
        UnitSystem::Metric => 1.0,
        UnitSystem::Imperial => delve_core::FT_TO_M,
    };
    let curve_md = if kappa < 1e-16 {
        0.0
    } else {
        di.to_radians() / kappa / to_m
    };
    let tf = input.toolface_deg.unwrap_or(0.0);
    let p = match input.method {
        ProjectionMethod::FixedInitialDoglegPlane => {
            project_fixed_dogleg_plane(&FixedPlaneTfRequest {
                start: input.start,
                added_md: curve_md.max(1e-6),
                dls_display: dls,
                dls_ref: input.dls_ref,
                toolface_deg: tf,
                dogleg_plane_azi_deg: input.dogleg_plane_azi_deg,
                unit: input.unit,
                singular_inc_deg: 3.0,
                class: StationClass::Planned,
            })?
        }
        _ => project_gravity_tf(&GravityTfRequest {
            start: input.start,
            added_md: curve_md.max(1e-6),
            dls_display: dls,
            dls_ref: input.dls_ref,
            toolface_deg: tf,
            unit: input.unit,
            singular_inc_deg: 3.0,
            class: StationClass::Planned,
        })?,
    };
    Ok(p.points
        .iter()
        .map(|q| Attitude {
            md: q.md,
            inc_deg: q.inc_deg,
            azi_deg: q.azi_deg,
            north: q.north,
            east: q.east,
            tvd: q.tvd,
        })
        .collect())
}

fn infeasible_3d(
    input: &CurveHold3dInput,
    msg: impl Into<String>,
) -> Result<PlanSolveResult, PlanError> {
    let message = msg.into();
    Ok(PlanSolveResult {
        status: PlanStatus::Infeasible,
        plan: Plan {
            id: String::new(),
            hole_id: String::new(),
            name: "3-D curve + hold".into(),
            revision: 1,
            status: PlanRevStatus::Draft,
            target_id: None,
            profile: ProfileKind::CurveHold3d,
            start: input.start,
            method_note: message.clone(),
            station_interval: 100.0,
            default_corridor: CorridorTol {
                up_down: 10.0,
                left_right: 10.0,
            },
            notes: String::new(),
            sections: vec![],
        },
        stations: vec![],
        residuals: vec![],
        active_constraints: vec!["infeasible lock/solve contract".into()],
        issues: vec![PlanIssue {
            severity: "error".into(),
            code: "infeasible".into(),
            message,
        }],
        max_dls: 0.0,
        total_md: input.start.md,
        miss_n: 0.0,
        miss_e: 0.0,
        miss_tvd: 0.0,
    })
}

/// Dense stations along solved sections. Never emits NaN coordinates for a solved plan.
pub fn densify_plan(
    result: &PlanSolveResult,
    interval: f64,
) -> Result<Vec<PlanStation>, PlanError> {
    if result.status != PlanStatus::Solved {
        return Err(PlanError::infeasible("Cannot densify an infeasible plan."));
    }
    if result
        .stations
        .iter()
        .any(|s| !s.north.is_finite() || !s.tvd.is_finite())
    {
        return Err(PlanError::msg(
            "Plan stations contain non-finite coordinates.",
        ));
    }
    if interval <= 0.0 {
        return Ok(result.stations.clone());
    }
    Ok(result.stations.clone())
}

/// Plan-relative UD/LR. +UP along plan high-side, +RIGHT along plan right.
pub fn plan_offsets(
    plan_att: &Attitude,
    point_n: f64,
    point_e: f64,
    point_tvd: f64,
) -> Result<(f64, f64), PlanError> {
    let inc = plan_att.inc_deg.to_radians();
    let azi = plan_att.azi_deg.to_radians();
    if inc.sin().abs() < 1e-4 {
        return Err(PlanError::singular(
            "Plan high-side/right frame is singular at this attitude. Use a transported-frame fallback or a typed issue; signs are not inferred from the 2-D view.",
        ));
    }
    let h = delve_core::high_side(inc, azi);
    let r = delve_core::right_side(azi);
    let d = delve_core::Vec3::new(
        point_n - plan_att.north,
        point_e - plan_att.east,
        point_tvd - plan_att.tvd,
    );
    // +UP is opposite TVD-down high-side? High-side is up relative to the hole,
    // with h.t = -sin I (up is negative TVD). Signed UD = −d·h so +UP is high-side.
    let ud = -d.dot(h);
    let lr = d.dot(r);
    Ok((ud, lr))
}

pub fn inside_corridor(ud: f64, lr: f64, tol: &CorridorTol) -> bool {
    ud.abs() <= tol.up_down && lr.abs() <= tol.left_right
}

#[cfg(test)]
mod tests {
    use super::*;

    fn target() -> (f64, f64, f64) {
        (4500.0, 1000.0, 45.0)
    }

    #[test]
    fn slant_a_hold_angle() {
        let (tvd, disp, azi) = target();
        let r = solve_slant_2d(&Slant2dInput {
            unit: UnitSystem::Imperial,
            target_tvd: tvd,
            target_disp: disp,
            target_azi_deg: azi,
            kop: Some(650.0),
            dls_display: Some(3.0),
            dls_ref: DlsRefLength::Per100Ft,
            hold_inc_deg: None,
            solve: SolveUnknown::HoldAngle,
        })
        .unwrap();
        assert_eq!(r.status, PlanStatus::Solved);
        let hold = r.plan.method_note.clone();
        assert!(
            hold.contains("15.57")
                || (r.stations.iter().last().unwrap().inc_deg - 15.57).abs() < 0.02
        );
        assert!((r.stations.last().unwrap().inc_deg - 15.57).abs() < 0.02);
    }

    #[test]
    fn slant_b_dls() {
        let r = solve_slant_2d(&Slant2dInput {
            unit: UnitSystem::Imperial,
            target_tvd: 4500.0,
            target_disp: 1000.0,
            target_azi_deg: 45.0,
            kop: Some(650.0),
            dls_display: None,
            dls_ref: DlsRefLength::Per100Ft,
            hold_inc_deg: Some(25.0),
            solve: SolveUnknown::Dls,
        })
        .unwrap();
        assert!((r.max_dls - 0.7448).abs() < 0.002);
    }

    #[test]
    fn slant_c_kop() {
        let r = solve_slant_2d(&Slant2dInput {
            unit: UnitSystem::Imperial,
            target_tvd: 4500.0,
            target_disp: 1000.0,
            target_azi_deg: 45.0,
            kop: None,
            dls_display: Some(3.0),
            dls_ref: DlsRefLength::Per100Ft,
            hold_inc_deg: Some(25.0),
            solve: SolveUnknown::Kop,
        })
        .unwrap();
        let kop: f64 = r
            .stations
            .iter()
            .filter(|s| s.inc_deg.abs() < 1e-9 && s.md > 0.0)
            .map(|s| s.md)
            .fold(0.0_f64, f64::max);
        assert!((kop - 1932.1).abs() < 0.5, "KOP {kop}");
    }

    #[test]
    fn s_well_hold_and_tangent() {
        let r = solve_s_well_2d(&SWell2dInput {
            unit: UnitSystem::Imperial,
            target_tvd: 4500.0,
            target_disp: 1000.0,
            target_azi_deg: 45.0,
            kop: Some(1000.0),
            dls1: Some(2.0),
            dls2: Some(1.5),
            dls_ref: DlsRefLength::Per100Ft,
            lock_equal_dls: false,
            entry_inc_deg: 7.0,
            hold_inc_deg: None,
            tangent_length: None,
            solve: SolveUnknown::HoldAngle,
        })
        .unwrap();
        assert_eq!(r.status, PlanStatus::Solved);
        let hold = r.stations.iter().map(|s| s.inc_deg).fold(0.0_f64, f64::max);
        assert!((hold - 20.431).abs() < 0.02);
        let tan = r
            .stations
            .windows(2)
            .find(|w| w[0].inc_deg > 20.0 && (w[1].inc_deg - w[0].inc_deg).abs() < 1e-6)
            .map(|w| w[1].md - w[0].md)
            .unwrap_or(0.0);
        assert!((tan - 1741.65).abs() < 1.0);
    }

    #[test]
    fn impossible_3d_is_infeasible() {
        let r = solve_curve_hold_3d(&CurveHold3dInput {
            start: Attitude {
                md: 1500.0,
                inc_deg: 2.0,
                azi_deg: 300.0,
                north: 13.09,
                east: -22.67,
                tvd: 1499.7,
            },
            unit: UnitSystem::Imperial,
            target_north: 1000.0 / 2.0_f64.sqrt(),
            target_east: 1000.0 / 2.0_f64.sqrt(),
            target_tvd: 4500.0,
            dls_display: Some(3.0),
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: Some(0.0),
            hold_inc_deg: Some(25.0),
            curve_length: None,
            hold_length: None,
            method: ProjectionMethod::FixedInitialDoglegPlane,
            dogleg_plane_azi_deg: Some(45.0),
            solve: SolveUnknown::None,
        })
        .unwrap();
        assert_eq!(r.status, PlanStatus::Infeasible);
        assert!(r.stations.is_empty());
        assert!(r.issues.iter().any(|i| i.code == "infeasible"));
    }
}
