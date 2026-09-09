//! Forward projection methods. Projected points are never measured stations.

use crate::error::{issue, PlanError, PlanIssue};
use delve_core::{
    attitude_from_tangent, azimuth_delta_rad, calculate_trajectory, convert_length, high_side,
    right_side, unit_tangent, wrap_azimuth_rad, AzimuthReference, CalculatedStation, HoleCalcInput,
    PathState, StationClass, SurveyConvention, TieIn, UnitSystem, Vec3,
};
use serde::{Deserialize, Serialize};

/// Default gravity-toolface singularity threshold, degrees from 0° or 180°.
pub const DEFAULT_GTF_SINGULAR_DEG: f64 = 3.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectionMethod {
    HoldIncAzi,
    ConstantGravityToolface,
    FixedInitialDoglegPlane,
    ConstantBuildTurn,
    RecentTrendLeastSquares,
    SlideRotateSegments,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Attitude {
    pub md: f64,
    pub inc_deg: f64,
    pub azi_deg: f64,
    pub north: f64,
    pub east: f64,
    pub tvd: f64,
}

impl Attitude {
    pub fn from_path(p: PathState) -> Self {
        Self {
            md: p.md,
            inc_deg: p.inc_deg,
            azi_deg: p.azi_deg,
            north: p.north,
            east: p.east,
            tvd: p.tvd,
        }
    }

    pub fn tangent(&self) -> Vec3 {
        unit_tangent(self.inc_deg.to_radians(), self.azi_deg.to_radians())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProjectionPoint {
    pub md: f64,
    pub inc_deg: f64,
    pub azi_deg: f64,
    pub north: f64,
    pub east: f64,
    pub tvd: f64,
    pub dogleg_deg: f64,
    pub dls_display: f64,
    pub class: StationClass,
    pub comment: String,
}

impl ProjectionPoint {
    pub fn to_calculated(&self) -> CalculatedStation {
        let (closure, closure_azi) = delve_core::closure(self.north, self.east);
        CalculatedStation {
            md: self.md,
            inc_deg: self.inc_deg,
            azi_deg: self.azi_deg,
            tvd: self.tvd,
            north: self.north,
            east: self.east,
            vs: 0.0,
            closure,
            closure_azi_deg: closure_azi.to_degrees(),
            dogleg_deg: self.dogleg_deg,
            dls: self.dls_display,
            comment: self.comment.clone(),
            class: self.class,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProjectionResult {
    pub method: ProjectionMethod,
    pub method_label: String,
    pub assumptions: Vec<String>,
    pub applicability: Vec<String>,
    pub points: Vec<ProjectionPoint>,
    pub issues: Vec<PlanIssue>,
    pub fitted_build_deg_per_ref: Option<f64>,
    pub fitted_turn_deg_per_ref: Option<f64>,
    pub fit_residuals_deg: Option<Vec<f64>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DlsRefLength {
    Per100Ft,
    Per30M,
}

impl DlsRefLength {
    pub fn metres(self) -> f64 {
        match self {
            Self::Per100Ft => 100.0 * delve_core::FT_TO_M,
            Self::Per30M => 30.0,
        }
    }

    pub fn from_unit(u: UnitSystem) -> Self {
        match u {
            UnitSystem::Imperial => Self::Per100Ft,
            UnitSystem::Metric => Self::Per30M,
        }
    }
}

/// DLS in display units → rad / metre.
pub fn dls_display_to_rad_per_m(value: f64, display: DlsRefLength) -> f64 {
    let deg_per_m = value
        / match display {
            DlsRefLength::Per100Ft => 100.0 * delve_core::FT_TO_M,
            DlsRefLength::Per30M => 30.0,
        };
    deg_per_m.to_radians()
}

pub fn dls_rad_per_m_to_display(kappa: f64, display: DlsRefLength) -> f64 {
    kappa.to_degrees()
        * match display {
            DlsRefLength::Per100Ft => 100.0 * delve_core::FT_TO_M,
            DlsRefLength::Per30M => 30.0,
        }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HoldRequest {
    pub start: Attitude,
    pub added_md: f64,
    pub unit: UnitSystem,
    pub class: StationClass,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GravityTfRequest {
    pub start: Attitude,
    pub added_md: f64,
    pub dls_display: f64,
    pub dls_ref: DlsRefLength,
    /// Gravity toolface, degrees. 0=build, 90=right, 180=drop, 270=left.
    pub toolface_deg: f64,
    pub unit: UnitSystem,
    pub singular_inc_deg: f64,
    pub class: StationClass,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FixedPlaneTfRequest {
    pub start: Attitude,
    pub added_md: f64,
    pub dls_display: f64,
    pub dls_ref: DlsRefLength,
    pub toolface_deg: f64,
    /// Required when the start attitude is gravity-TF singular.
    pub dogleg_plane_azi_deg: Option<f64>,
    pub unit: UnitSystem,
    pub singular_inc_deg: f64,
    pub class: StationClass,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BuildTurnRequest {
    pub start: Attitude,
    pub added_md: f64,
    /// dINC/dMD in degrees per reference length.
    pub build_deg_per_ref: f64,
    /// dAZI/dMD in degrees per reference length.
    pub turn_deg_per_ref: f64,
    pub rate_ref: DlsRefLength,
    pub unit: UnitSystem,
    pub class: StationClass,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TrendStation {
    pub md: f64,
    pub inc_deg: f64,
    pub azi_deg: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RecentTrendRequest {
    pub stations: Vec<TrendStation>,
    pub added_md: f64,
    pub unit: UnitSystem,
    pub singular_inc_deg: f64,
    pub class: StationClass,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SlideMode {
    Slide,
    Rotate,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SlideRotateSeg {
    pub mode: SlideMode,
    pub length: f64,
    pub toolface_deg: f64,
    pub slide_yield_dls: f64,
    pub rotary_dls: f64,
    pub rotary_tf_deg: f64,
    pub dls_ref: DlsRefLength,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SlideRotateRequest {
    pub start: Attitude,
    pub segments: Vec<SlideRotateSeg>,
    pub unit: UnitSystem,
    pub singular_inc_deg: f64,
    pub class: StationClass,
}

fn class_label(class: StationClass) -> &'static str {
    match class {
        StationClass::Projected => "PROJECTED",
        StationClass::Planned => "PLANNED",
        StationClass::Measured => "ESTIMATED",
    }
}

fn dls_label(unit: UnitSystem) -> DlsRefLength {
    DlsRefLength::from_unit(unit)
}

fn point(
    start: &Attitude,
    end: Attitude,
    class: StationClass,
    comment: &str,
    unit: UnitSystem,
) -> ProjectionPoint {
    let t0 = start.tangent();
    let t1 = end.tangent();
    let (beta, _) = delve_core::dogleg_and_rf(t0, t1);
    let cl = end.md - start.md;
    let to_m = match unit {
        UnitSystem::Metric => 1.0,
        UnitSystem::Imperial => delve_core::FT_TO_M,
    };
    let kappa = if cl.abs() < 1e-15 {
        0.0
    } else {
        beta / (cl * to_m)
    };
    ProjectionPoint {
        md: end.md,
        inc_deg: end.inc_deg,
        azi_deg: delve_core::wrap_azimuth_deg(end.azi_deg),
        north: end.north,
        east: end.east,
        tvd: end.tvd,
        dogleg_deg: beta.to_degrees(),
        dls_display: dls_rad_per_m_to_display(kappa, dls_label(unit)),
        class,
        comment: comment.to_string(),
    }
}

pub fn project_hold(req: &HoldRequest) -> Result<ProjectionResult, PlanError> {
    if req.added_md <= 0.0 || !req.added_md.is_finite() {
        return Err(PlanError::msg("Added MD must be positive and finite."));
    }
    let t = req.start.tangent();
    let end = Attitude {
        md: req.start.md + req.added_md,
        inc_deg: req.start.inc_deg,
        azi_deg: req.start.azi_deg,
        north: req.start.north + t.n * req.added_md,
        east: req.start.east + t.e * req.added_md,
        tvd: req.start.tvd + t.t * req.added_md,
    };
    let label = class_label(req.class);
    Ok(ProjectionResult {
        method: ProjectionMethod::HoldIncAzi,
        method_label: "Hold INC/AZI".into(),
        assumptions: vec![
            "Attitude held constant.".into(),
            "Path is a straight line (minimum-curvature RF = 1).".into(),
        ],
        applicability: vec!["Any non-singular attitude. DLS = 0.".into()],
        points: vec![point(
            &req.start,
            end,
            req.class,
            &format!("{label} — Hold INC/AZI"),
            req.unit,
        )],
        issues: vec![],
        fitted_build_deg_per_ref: Some(0.0),
        fitted_turn_deg_per_ref: Some(0.0),
        fit_residuals_deg: None,
    })
}

/// Hold via the existing `delve-core` tangent continuation (regression oracle).
pub fn hold_via_core(
    start: &Attitude,
    added_md: f64,
    unit: UnitSystem,
) -> Result<ProjectionResult, PlanError> {
    let input = HoleCalcInput {
        unit_system: unit,
        convention: SurveyConvention::OilfieldFromVertical,
        azimuth_reference: AzimuthReference::Unknown,
        vsp_deg: 0.0,
        tie_in: TieIn {
            tvd: start.tvd,
            north: start.north,
            east: start.east,
        },
        stations: vec![delve_core::MeasuredStation {
            md: start.md,
            inc_deg: start.inc_deg,
            azi_deg: start.azi_deg,
            comment: String::new(),
            class: StationClass::Measured,
            source: delve_core::StationSource::Manual,
        }],
    };
    let traj = delve_core::tangent_continue(
        &input,
        added_md,
        StationClass::Projected,
        "PROJECTED — Hold INC/AZI",
    )
    .map_err(|e| PlanError::msg(e.to_string()))?;
    let last = traj
        .stations
        .last()
        .ok_or_else(|| PlanError::msg("empty"))?;
    Ok(ProjectionResult {
        method: ProjectionMethod::HoldIncAzi,
        method_label: "Hold INC/AZI".into(),
        assumptions: vec!["Uses delve-core tangent_continue.".into()],
        applicability: vec![],
        points: vec![ProjectionPoint {
            md: last.md,
            inc_deg: last.inc_deg,
            azi_deg: last.azi_deg,
            north: last.north,
            east: last.east,
            tvd: last.tvd,
            dogleg_deg: last.dogleg_deg,
            dls_display: last.dls,
            class: StationClass::Projected,
            comment: last.comment.clone(),
        }],
        issues: vec![],
        fitted_build_deg_per_ref: Some(0.0),
        fitted_turn_deg_per_ref: Some(0.0),
        fit_residuals_deg: None,
    })
}

fn gtf_singular(inc_deg: f64, thresh: f64) -> bool {
    inc_deg <= thresh || inc_deg >= 180.0 - thresh
}

fn steering_u(inc_rad: f64, azi_rad: f64, tf_rad: f64) -> Vec3 {
    let h = high_side(inc_rad, azi_rad);
    let r = right_side(azi_rad);
    h.scale(tf_rad.cos()).add(r.scale(tf_rad.sin()))
}

/// Integrate constant gravity toolface. Recomputes h, r, u each step.
pub fn project_gravity_tf(req: &GravityTfRequest) -> Result<ProjectionResult, PlanError> {
    if req.added_md <= 0.0 || !req.added_md.is_finite() {
        return Err(PlanError::msg("Added MD must be positive and finite."));
    }
    if gtf_singular(req.start.inc_deg, req.singular_inc_deg) {
        return Err(PlanError::singular(format!(
            "Gravity toolface is singular at INC {:.3}° (|sin I| at or below the {:.2}° threshold). Use magnetic toolface or a steering-azimuth / fixed-dogleg-plane mode.",
            req.start.inc_deg, req.singular_inc_deg
        )));
    }
    let kappa = dls_display_to_rad_per_m(req.dls_display, req.dls_ref);
    if !kappa.is_finite() || kappa < 0.0 {
        return Err(PlanError::msg("DLS must be finite and ≥ 0."));
    }
    if kappa.abs() < 1e-16 {
        return project_hold(&HoldRequest {
            start: req.start,
            added_md: req.added_md,
            unit: req.unit,
            class: req.class,
        });
    }
    let to_m = match req.unit {
        UnitSystem::Metric => 1.0,
        UnitSystem::Imperial => delve_core::FT_TO_M,
    };
    let added_m = req.added_md * to_m;
    let tf = req.toolface_deg.to_radians();
    let (n, e, tvd, inc, azi) = integrate_gravity_tf(
        req.start,
        added_m,
        kappa,
        tf,
        req.singular_inc_deg.to_radians(),
        to_m,
    )?;
    let end = Attitude {
        md: req.start.md + req.added_md,
        inc_deg: inc.to_degrees(),
        azi_deg: azi.to_degrees(),
        north: n,
        east: e,
        tvd,
    };
    let label = class_label(req.class);
    Ok(ProjectionResult {
        method: ProjectionMethod::ConstantGravityToolface,
        method_label: "Constant DLS + gravity toolface".into(),
        assumptions: vec![
            "Gravity TF held in the evolving local high-side/right frame.".into(),
            "0° = build, 90° = turn right, 180° = drop, 270° = turn left.".into(),
            "Integrated with adaptive RK4; not a one-shot circular arc.".into(),
        ],
        applicability: vec![format!(
            "Blocked when |sin I| corresponds to INC within {:.2}° of 0° or 180° at any step.",
            req.singular_inc_deg
        )],
        points: vec![point(
            &req.start,
            end,
            req.class,
            &format!(
                "{label} — Constant gravity TF {tf:.1}°",
                tf = req.toolface_deg
            ),
            req.unit,
        )],
        issues: vec![],
        fitted_build_deg_per_ref: None,
        fitted_turn_deg_per_ref: None,
        fit_residuals_deg: None,
    })
}

fn integrate_gravity_tf(
    start: Attitude,
    added_m: f64,
    kappa: f64,
    tf: f64,
    singular_rad: f64,
    to_m: f64,
) -> Result<(f64, f64, f64, f64, f64), PlanError> {
    let mut n = start.north;
    let mut e = start.east;
    let mut tvd = start.tvd;
    let mut inc = start.inc_deg.to_radians();
    let mut azi = start.azi_deg.to_radians();
    let mut s = 0.0;
    let mut ds = (added_m / 32.0).clamp(0.05, 2.0);
    let max_dinc = 0.5_f64.to_radians();
    while s < added_m - 1e-12 {
        if (inc.sin()).abs() <= singular_rad.sin().max(1e-8) {
            return Err(PlanError::singular(
                "Gravity toolface became singular during propagation. Stopped before crossing 0°/180°.",
            ));
        }
        let remain = added_m - s;
        let mut step = ds.min(remain);
        if kappa * step > max_dinc {
            step = max_dinc / kappa;
        }
        // Predict singularity crossing on this step.
        let dinc = kappa * tf.cos() * step;
        let next_inc = inc + dinc;
        if next_inc <= singular_rad || next_inc >= std::f64::consts::PI - singular_rad {
            return Err(PlanError::singular(
                "Next gravity-TF step would enter the singular region near 0° or 180°. Use magnetic toolface or a steering-azimuth mode.",
            ));
        }
        let (n1, e1, t1, i1, a1) = rk4_gtf(n, e, tvd, inc, azi, step, kappa, tf, to_m)?;
        let (n2, e2, t2, i2, a2) = {
            let h = step / 2.0;
            let mid = rk4_gtf(n, e, tvd, inc, azi, h, kappa, tf, to_m)?;
            rk4_gtf(mid.0, mid.1, mid.2, mid.3, mid.4, h, kappa, tf, to_m)?
        };
        let pos_err = ((n1 - n2).hypot(e1 - e2).hypot(t1 - t2)).abs();
        let att_err = (i1 - i2).abs().max(azimuth_delta_rad(a1, a2).abs());
        if (pos_err > 1e-5 || att_err > 1e-6) && step > 0.02 {
            ds = step * 0.5;
            continue;
        }
        n = n2;
        e = e2;
        tvd = t2;
        inc = i2;
        azi = wrap_azimuth_rad(a2);
        s += step;
        if pos_err < 1e-7 && att_err < 1e-8 {
            ds = (step * 1.4).min(2.0);
        }
    }
    Ok((n, e, tvd, inc, azi))
}

fn rk4_gtf(
    n: f64,
    e: f64,
    tvd: f64,
    inc: f64,
    azi: f64,
    ds: f64,
    kappa: f64,
    tf: f64,
    to_m: f64,
) -> Result<(f64, f64, f64, f64, f64), PlanError> {
    fn deriv(inc: f64, azi: f64, kappa: f64, tf: f64, to_m: f64) -> (f64, f64, f64, f64, f64) {
        let t = unit_tangent(inc, azi);
        let dinc = kappa * tf.cos();
        let dazi = if inc.sin().abs() < 1e-15 {
            0.0
        } else {
            kappa * tf.sin() / inc.sin()
        };
        // Position derivatives are per metre of MD; convert to hole units.
        let scale = 1.0 / to_m;
        (t.n * scale, t.e * scale, t.t * scale, dinc, dazi)
    }
    let k1 = deriv(inc, azi, kappa, tf, to_m);
    let k2 = deriv(
        inc + 0.5 * ds * k1.3,
        azi + 0.5 * ds * k1.4,
        kappa,
        tf,
        to_m,
    );
    let k3 = deriv(
        inc + 0.5 * ds * k2.3,
        azi + 0.5 * ds * k2.4,
        kappa,
        tf,
        to_m,
    );
    let k4 = deriv(inc + ds * k3.3, azi + ds * k3.4, kappa, tf, to_m);
    let n2 = n + ds * (k1.0 + 2.0 * k2.0 + 2.0 * k3.0 + k4.0) / 6.0;
    let e2 = e + ds * (k1.1 + 2.0 * k2.1 + 2.0 * k3.1 + k4.1) / 6.0;
    let t2 = tvd + ds * (k1.2 + 2.0 * k2.2 + 2.0 * k3.2 + k4.2) / 6.0;
    let i2 = inc + ds * (k1.3 + 2.0 * k2.3 + 2.0 * k3.3 + k4.3) / 6.0;
    let a2 = azi + ds * (k1.4 + 2.0 * k2.4 + 2.0 * k3.4 + k4.4) / 6.0;
    if !n2.is_finite() || !i2.is_finite() {
        return Err(PlanError::msg("Gravity-TF integration became non-finite."));
    }
    Ok((n2, e2, t2, i2, a2))
}

pub fn project_fixed_dogleg_plane(
    req: &FixedPlaneTfRequest,
) -> Result<ProjectionResult, PlanError> {
    if req.added_md <= 0.0 || !req.added_md.is_finite() {
        return Err(PlanError::msg("Added MD must be positive and finite."));
    }
    let kappa = dls_display_to_rad_per_m(req.dls_display, req.dls_ref);
    if kappa.abs() < 1e-16 {
        return project_hold(&HoldRequest {
            start: req.start,
            added_md: req.added_md,
            unit: req.unit,
            class: req.class,
        });
    }
    let to_m = match req.unit {
        UnitSystem::Metric => 1.0,
        UnitSystem::Imperial => delve_core::FT_TO_M,
    };
    let added_m = req.added_md * to_m;
    let t0 = req.start.tangent();
    let inc0 = req.start.inc_deg.to_radians();
    let azi0 = req.start.azi_deg.to_radians();
    let u0 = if gtf_singular(req.start.inc_deg, req.singular_inc_deg) {
        let plane_azi = req.dogleg_plane_azi_deg.ok_or_else(|| {
            PlanError::singular(
                "Fixed initial dogleg-plane path at a singular attitude requires an explicit steering / dogleg-plane azimuth. High-side/AZI cannot define u0.",
            )
        })?;
        // At I≈0, build toward plane azimuth: u0 is horizontal in that direction.
        Vec3::new(
            plane_azi.to_radians().cos(),
            plane_azi.to_radians().sin(),
            0.0,
        )
    } else {
        steering_u(inc0, azi0, req.toolface_deg.to_radians())
    };
    let u0 = u0
        .try_normalize()
        .ok_or_else(|| PlanError::msg("Dogleg-plane u0 is degenerate."))?;
    let theta = kappa * added_m;
    let t = t0.scale(theta.cos()).add(u0.scale(theta.sin()));
    let t = t.try_normalize().unwrap_or(t);
    let delta_m = t0
        .scale(theta.sin() / kappa)
        .add(u0.scale((1.0 - theta.cos()) / kappa));
    let (inc, azi) = attitude_from_tangent(t);
    let end = Attitude {
        md: req.start.md + req.added_md,
        inc_deg: inc.to_degrees(),
        azi_deg: azi.to_degrees(),
        north: req.start.north + delta_m.n / to_m,
        east: req.start.east + delta_m.e / to_m,
        tvd: req.start.tvd + delta_m.t / to_m,
    };
    let label = class_label(req.class);
    Ok(ProjectionResult {
        method: ProjectionMethod::FixedInitialDoglegPlane,
        method_label: "Fixed initial dogleg-plane TF".into(),
        assumptions: vec![
            "u0 is frozen at the start attitude; the path is a circular arc in that plane.".into(),
            "This is not constant gravity toolface.".into(),
        ],
        applicability: vec![
            "Analytic circular-arc solution. Singular start requires an explicit dogleg-plane azimuth.".into(),
        ],
        points: vec![point(
            &req.start,
            end,
            req.class,
            &format!("{label} — Fixed initial dogleg-plane TF"),
            req.unit,
        )],
        issues: vec![],
        fitted_build_deg_per_ref: None,
        fitted_turn_deg_per_ref: None,
        fit_residuals_deg: None,
    })
}

pub fn project_build_turn(req: &BuildTurnRequest) -> Result<ProjectionResult, PlanError> {
    if req.added_md <= 0.0 || !req.added_md.is_finite() {
        return Err(PlanError::msg("Added MD must be positive and finite."));
    }
    let to_m = match req.unit {
        UnitSystem::Metric => 1.0,
        UnitSystem::Imperial => delve_core::FT_TO_M,
    };
    let ref_m = req.rate_ref.metres();
    let b = req.build_deg_per_ref.to_radians() / ref_m; // rad / m
    let t_rate = req.turn_deg_per_ref.to_radians() / ref_m;
    let added_m = req.added_md * to_m;
    let mut n = req.start.north;
    let mut e = req.start.east;
    let mut tvd = req.start.tvd;
    let mut inc = req.start.inc_deg.to_radians();
    let mut azi = req.start.azi_deg.to_radians();
    let steps = ((added_m / 0.5).ceil() as usize).clamp(8, 400);
    let ds = added_m / steps as f64;
    for _ in 0..steps {
        let tang = unit_tangent(inc, azi);
        n += tang.n * ds / to_m;
        e += tang.e * ds / to_m;
        tvd += tang.t * ds / to_m;
        inc += b * ds;
        azi = wrap_azimuth_rad(azi + t_rate * ds);
    }
    let end = Attitude {
        md: req.start.md + req.added_md,
        inc_deg: inc.to_degrees(),
        azi_deg: azi.to_degrees(),
        north: n,
        east: e,
        tvd,
    };
    // Instantaneous DLS at start: sqrt(B² + (T sin I)²)
    let inst = (b * b + (t_rate * req.start.inc_deg.to_radians().sin()).powi(2)).sqrt();
    let label = class_label(req.class);
    Ok(ProjectionResult {
        method: ProjectionMethod::ConstantBuildTurn,
        method_label: "Constant build + azimuth-turn".into(),
        assumptions: vec![
            "I' = B and A' = T are constant in the entered angle / reference-length units.".into(),
            format!(
                "Instantaneous curvature is sqrt(B² + (T sin I)²); start-of-interval DLS ≈ {:.4} {}.",
                dls_rad_per_m_to_display(inst, req.rate_ref),
                match req.rate_ref {
                    DlsRefLength::Per100Ft => "°/100 ft",
                    DlsRefLength::Per30M => "°/30 m",
                }
            ),
        ],
        applicability: vec!["Not generally a constant-DLS path.".into()],
        points: vec![point(
            &req.start,
            end,
            req.class,
            &format!("{label} — Constant build/turn"),
            req.unit,
        )],
        issues: vec![],
        fitted_build_deg_per_ref: Some(req.build_deg_per_ref),
        fitted_turn_deg_per_ref: Some(req.turn_deg_per_ref),
        fit_residuals_deg: None,
    })
}

pub fn project_recent_trend(req: &RecentTrendRequest) -> Result<ProjectionResult, PlanError> {
    let n = req.stations.len();
    if !(2..=5).contains(&n) {
        return Err(PlanError::msg(
            "Recent trend (least-squares) requires a 2–5 station window.",
        ));
    }
    for i in 1..n {
        if req.stations[i].md <= req.stations[i - 1].md {
            return Err(PlanError::msg(
                "Trend window MD must be strictly increasing. Duplicates and non-monotonic lists are rejected.",
            ));
        }
    }
    if req.added_md <= 0.0 {
        return Err(PlanError::msg("Added MD must be positive."));
    }
    let mids: Vec<f64> = req.stations.iter().map(|s| s.md).collect();
    let incs: Vec<f64> = req.stations.iter().map(|s| s.inc_deg).collect();
    if incs
        .iter()
        .any(|i| *i <= req.singular_inc_deg || *i >= 180.0 - req.singular_inc_deg)
    {
        return Err(PlanError::msg(
            "Recent trend (least-squares) rejects a near-vertical window; gravity-TF / azimuth rates are undefined.",
        ));
    }
    let mut azis = vec![req.stations[0].azi_deg];
    for i in 1..n {
        let prev = azis[i - 1];
        let raw = req.stations[i].azi_deg;
        let mut unwrapped = raw;
        while unwrapped - prev > 180.0 {
            unwrapped -= 360.0;
        }
        while unwrapped - prev < -180.0 {
            unwrapped += 360.0;
        }
        azis.push(unwrapped);
    }
    let (b, i0, res_i) = least_squares_line(&mids, &incs)?;
    let (t_rate, _a0, res_a) = least_squares_line(&mids, &azis)?;
    let last = req.stations.last().unwrap();
    let start = Attitude {
        md: last.md,
        inc_deg: last.inc_deg,
        azi_deg: last.azi_deg,
        north: 0.0,
        east: 0.0,
        tvd: 0.0,
    };
    // Caller supplies position separately via `start` overlay — trend fit is attitude-only.
    // Position must be provided by wrapping with a real start. Use last station attitude
    // and require the caller to pass position through `project_recent_trend_from`.
    let _ = (i0, start);
    let residuals: Vec<f64> = res_i
        .iter()
        .zip(res_a.iter())
        .map(|(di, da)| di.hypot(*da))
        .collect();
    Ok(ProjectionResult {
        method: ProjectionMethod::RecentTrendLeastSquares,
        method_label: "Recent trend (least-squares)".into(),
        assumptions: vec![
            "Independent linear least-squares fits of INC and unwrapped AZI versus MD.".into(),
            "Not WinSERVE BHL. Not a two-station undocumented trend.".into(),
        ],
        applicability: vec![
            "2–5 strictly increasing stations; near-vertical and mixed-BHA windows rejected by the caller.".into(),
        ],
        points: vec![],
        issues: vec![],
        fitted_build_deg_per_ref: Some(b * match req.unit {
            UnitSystem::Imperial => 100.0,
            UnitSystem::Metric => 30.0,
        }),
        fitted_turn_deg_per_ref: Some(t_rate * match req.unit {
            UnitSystem::Imperial => 100.0,
            UnitSystem::Metric => 30.0,
        }),
        fit_residuals_deg: Some(residuals),
    })
}

/// Fit + project from an explicit start position using the last window station as attitude.
pub fn project_recent_trend_from(
    req: &RecentTrendRequest,
    start: Attitude,
) -> Result<ProjectionResult, PlanError> {
    let fit = project_recent_trend(req)?;
    let last = req.stations.last().unwrap();
    if (start.md - last.md).abs() > 1e-6
        || (start.inc_deg - last.inc_deg).abs() > 1e-6
        || azimuth_delta_rad(start.azi_deg.to_radians(), last.azi_deg.to_radians()).abs() > 1e-6
    {
        return Err(PlanError::msg(
            "Trend projection start must be the last window station (MD/INC/AZI).",
        ));
    }
    let b = fit.fitted_build_deg_per_ref.unwrap_or(0.0);
    let t = fit.fitted_turn_deg_per_ref.unwrap_or(0.0);
    let mut proj = project_build_turn(&BuildTurnRequest {
        start,
        added_md: req.added_md,
        build_deg_per_ref: b,
        turn_deg_per_ref: t,
        rate_ref: DlsRefLength::from_unit(req.unit),
        unit: req.unit,
        class: req.class,
    })?;
    proj.method = ProjectionMethod::RecentTrendLeastSquares;
    proj.method_label = "Recent trend (least-squares)".into();
    proj.assumptions = fit.assumptions;
    proj.fitted_build_deg_per_ref = fit.fitted_build_deg_per_ref;
    proj.fitted_turn_deg_per_ref = fit.fitted_turn_deg_per_ref;
    proj.fit_residuals_deg = fit.fit_residuals_deg;
    if let Some(p) = proj.points.first_mut() {
        p.comment = format!("{} — Recent trend (least-squares)", class_label(req.class));
    }
    Ok(proj)
}

fn least_squares_line(x: &[f64], y: &[f64]) -> Result<(f64, f64, Vec<f64>), PlanError> {
    let n = x.len() as f64;
    if n < 2.0 {
        return Err(PlanError::msg(
            "Need at least two points for a least-squares fit.",
        ));
    }
    let mx = x.iter().sum::<f64>() / n;
    let my = y.iter().sum::<f64>() / n;
    let mut sxx = 0.0;
    let mut sxy = 0.0;
    for i in 0..x.len() {
        sxx += (x[i] - mx) * (x[i] - mx);
        sxy += (x[i] - mx) * (y[i] - my);
    }
    if sxx < 1e-18 {
        return Err(PlanError::msg("Trend window MD span is too small to fit."));
    }
    let slope = sxy / sxx;
    let intercept = my - slope * mx;
    let res: Vec<f64> = x
        .iter()
        .zip(y.iter())
        .map(|(xi, yi)| yi - (slope * xi + intercept))
        .collect();
    Ok((slope, intercept, res))
}

pub fn project_slide_rotate(req: &SlideRotateRequest) -> Result<ProjectionResult, PlanError> {
    if req.segments.is_empty() {
        return Err(PlanError::msg(
            "At least one slide/rotate segment is required.",
        ));
    }
    let mut cur = req.start;
    let mut points = Vec::new();
    for (i, seg) in req.segments.iter().enumerate() {
        if seg.length <= 0.0 || !seg.length.is_finite() {
            return Err(PlanError::msg(format!(
                "Segment {i} length must be positive."
            )));
        }
        let (dls, tf) = match seg.mode {
            SlideMode::Slide => (seg.slide_yield_dls, seg.toolface_deg),
            SlideMode::Rotate => (seg.rotary_dls, seg.rotary_tf_deg),
        };
        let step = project_gravity_tf(&GravityTfRequest {
            start: cur,
            added_md: seg.length,
            dls_display: dls,
            dls_ref: seg.dls_ref,
            toolface_deg: tf,
            unit: req.unit,
            singular_inc_deg: req.singular_inc_deg,
            class: req.class,
        })?;
        let p = step
            .points
            .last()
            .cloned()
            .ok_or_else(|| PlanError::msg("empty segment"))?;
        cur = Attitude {
            md: p.md,
            inc_deg: p.inc_deg,
            azi_deg: p.azi_deg,
            north: p.north,
            east: p.east,
            tvd: p.tvd,
        };
        points.push(p);
    }
    Ok(ProjectionResult {
        method: ProjectionMethod::SlideRotateSegments,
        method_label: "Ordered slide/rotate segments".into(),
        assumptions: vec![
            "Slide uses the user-entered slide yield as constant gravity-TF DLS.".into(),
            "Rotate uses the user-entered rotary DLS/toolface tendency.".into(),
            "Gaps are never filled with hold, rotate, or zero-yield behaviour.".into(),
        ],
        applicability: vec!["Requires a contiguous user-authored segment list.".into()],
        points,
        issues: vec![],
        fitted_build_deg_per_ref: None,
        fitted_turn_deg_per_ref: None,
        fit_residuals_deg: None,
    })
}

pub fn method_help(method: ProjectionMethod) -> (Vec<String>, Vec<String>, Vec<String>) {
    match method {
        ProjectionMethod::HoldIncAzi => (
            vec!["Added MD or target TVD.".into()],
            vec!["Constant INC/AZI; RF = 1.".into()],
            vec!["Always applicable when added course > 0.".into()],
        ),
        ProjectionMethod::ConstantGravityToolface => (
            vec!["DLS, gravity toolface, added MD.".into()],
            vec!["TF held in the evolving high-side/right frame.".into()],
            vec!["Not applicable near INC 0° or 180°.".into()],
        ),
        ProjectionMethod::FixedInitialDoglegPlane => (
            vec!["DLS, initial TF (or dogleg-plane azimuth), added MD.".into()],
            vec!["Circular arc in the frozen start plane. Not constant gravity TF.".into()],
            vec!["Singular start needs an explicit plane azimuth.".into()],
        ),
        ProjectionMethod::ConstantBuildTurn => (
            vec!["Build rate B, turn rate T, reference length, added MD.".into()],
            vec!["I' = B, A' = T. Instantaneous DLS = sqrt(B² + (T sin I)²).".into()],
            vec!["Rates persist in their entered angle / reference-length units.".into()],
        ),
        ProjectionMethod::RecentTrendLeastSquares => (
            vec!["2–5 accepted stations, added MD.".into()],
            vec!["Least-squares INC and unwrapped AZI versus MD.".into()],
            vec!["Rejects duplicates, non-monotonic MD, and near-vertical windows.".into()],
        ),
        ProjectionMethod::SlideRotateSegments => (
            vec!["Ordered slide/rotate lengths, yield, rotary tendency, toolface.".into()],
            vec!["User-entered response only; no silent gap fill.".into()],
            vec!["Same gravity-TF singularity rules as constant gravity TF.".into()],
        ),
    }
}

/// Convert a length when the hole unit system changes. Angles are unchanged.
pub fn convert_projection_length(value: f64, from: UnitSystem, to: UnitSystem) -> f64 {
    convert_length(value, from, to)
}

pub fn last_measured_as_attitude(stations: &[CalculatedStation]) -> Option<Attitude> {
    stations
        .iter()
        .rev()
        .find(|s| s.class == StationClass::Measured)
        .map(|s| Attitude {
            md: s.md,
            inc_deg: s.inc_deg,
            azi_deg: s.azi_deg,
            north: s.north,
            east: s.east,
            tvd: s.tvd,
        })
}

pub fn last_accepted_as_attitude(
    calc: &[CalculatedStation],
    accepted_mds: &[f64],
) -> Option<Attitude> {
    calc.iter()
        .rev()
        .find(|s| accepted_mds.iter().any(|m| (m - s.md).abs() < 1e-9))
        .map(|s| Attitude {
            md: s.md,
            inc_deg: s.inc_deg,
            azi_deg: s.azi_deg,
            north: s.north,
            east: s.east,
            tvd: s.tvd,
        })
}

#[allow(dead_code)]
fn _unused_issue() -> PlanIssue {
    issue("info", "x", "")
}

#[allow(dead_code)]
fn _calc_traj(input: &HoleCalcInput) -> Result<delve_core::Trajectory, delve_core::CalcError> {
    calculate_trajectory(input)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn start() -> Attitude {
        Attitude {
            md: 1000.0,
            inc_deg: 30.0,
            azi_deg: 90.0,
            north: 10.0,
            east: 20.0,
            tvd: 950.0,
        }
    }

    #[test]
    fn hold_matches_core_tangent() {
        let a = start();
        let ours = project_hold(&HoldRequest {
            start: a,
            added_md: 50.0,
            unit: UnitSystem::Imperial,
            class: StationClass::Projected,
        })
        .unwrap();
        let core = hold_via_core(&a, 50.0, UnitSystem::Imperial).unwrap();
        let p = &ours.points[0];
        let q = &core.points[0];
        assert!((p.north - q.north).abs() < 1e-9);
        assert!((p.east - q.east).abs() < 1e-9);
        assert!((p.tvd - q.tvd).abs() < 1e-9);
        assert_eq!(p.class, StationClass::Projected);
        assert!(p.dls_display.abs() < 1e-9);
    }

    #[test]
    fn dls_zero_equals_hold() {
        let a = start();
        let hold = project_hold(&HoldRequest {
            start: a,
            added_md: 40.0,
            unit: UnitSystem::Imperial,
            class: StationClass::Projected,
        })
        .unwrap();
        let gtf = project_gravity_tf(&GravityTfRequest {
            start: a,
            added_md: 40.0,
            dls_display: 0.0,
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: 45.0,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        })
        .unwrap();
        assert!((hold.points[0].north - gtf.points[0].north).abs() < 1e-8);
        assert_eq!(gtf.method, ProjectionMethod::HoldIncAzi);
    }

    #[test]
    fn gravity_tf_cardinals() {
        let a = start();
        let build = project_gravity_tf(&GravityTfRequest {
            start: a,
            added_md: 100.0,
            dls_display: 3.0,
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: 0.0,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        })
        .unwrap();
        assert!(build.points[0].inc_deg > a.inc_deg + 2.0);
        let drop = project_gravity_tf(&GravityTfRequest {
            start: a,
            added_md: 100.0,
            dls_display: 3.0,
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: 180.0,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        })
        .unwrap();
        assert!(drop.points[0].inc_deg < a.inc_deg - 2.0);
        let right = project_gravity_tf(&GravityTfRequest {
            start: a,
            added_md: 100.0,
            dls_display: 3.0,
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: 90.0,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        })
        .unwrap();
        let dazi = delve_core::azimuth_delta_rad(
            a.azi_deg.to_radians(),
            right.points[0].azi_deg.to_radians(),
        );
        assert!(dazi > 0.0, "90° TF should increase azimuth (turn right)");
        let left = project_gravity_tf(&GravityTfRequest {
            start: a,
            added_md: 100.0,
            dls_display: 3.0,
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: 270.0,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        })
        .unwrap();
        let dazi_l = delve_core::azimuth_delta_rad(
            a.azi_deg.to_radians(),
            left.points[0].azi_deg.to_radians(),
        );
        assert!(dazi_l < 0.0, "270° TF should decrease azimuth (turn left)");
    }

    #[test]
    fn gravity_tf_matches_attitude_ode() {
        let a = start();
        let kappa = dls_display_to_rad_per_m(2.0, DlsRefLength::Per100Ft);
        let tf = 30_f64.to_radians();
        let added = 80.0;
        let out = project_gravity_tf(&GravityTfRequest {
            start: a,
            added_md: added,
            dls_display: 2.0,
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: 30.0,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        })
        .unwrap();
        let ds_m = added * delve_core::FT_TO_M;
        let exp_inc = a.inc_deg + (kappa * tf.cos() * ds_m).to_degrees();
        assert!((out.points[0].inc_deg - exp_inc).abs() < 0.05);
    }

    #[test]
    fn gravity_tf_blocks_near_vertical() {
        let mut a = start();
        a.inc_deg = 1.0;
        let err = project_gravity_tf(&GravityTfRequest {
            start: a,
            added_md: 20.0,
            dls_display: 3.0,
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: 90.0,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        })
        .unwrap_err();
        assert!(matches!(err, PlanError::Singular(_)));
    }

    #[test]
    fn gravity_tf_blocks_before_crossing_singularity() {
        let mut a = start();
        a.inc_deg = 5.0;
        let err = project_gravity_tf(&GravityTfRequest {
            start: a,
            added_md: 200.0,
            dls_display: 8.0,
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: 180.0,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        })
        .unwrap_err();
        assert!(matches!(err, PlanError::Singular(_)));
    }

    #[test]
    fn split_interval_is_invariant() {
        let a = start();
        let one = project_gravity_tf(&GravityTfRequest {
            start: a,
            added_md: 80.0,
            dls_display: 2.5,
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: 45.0,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        })
        .unwrap();
        let mid = project_gravity_tf(&GravityTfRequest {
            start: a,
            added_md: 40.0,
            dls_display: 2.5,
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: 45.0,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        })
        .unwrap();
        let m = &mid.points[0];
        let two = project_gravity_tf(&GravityTfRequest {
            start: Attitude {
                md: m.md,
                inc_deg: m.inc_deg,
                azi_deg: m.azi_deg,
                north: m.north,
                east: m.east,
                tvd: m.tvd,
            },
            added_md: 40.0,
            dls_display: 2.5,
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: 45.0,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        })
        .unwrap();
        assert!((one.points[0].north - two.points[0].north).abs() < 0.02);
        assert!((one.points[0].east - two.points[0].east).abs() < 0.02);
        assert!((one.points[0].inc_deg - two.points[0].inc_deg).abs() < 0.02);
    }

    #[test]
    fn fixed_plane_is_not_labelled_gravity_tf() {
        let a = start();
        let p = project_fixed_dogleg_plane(&FixedPlaneTfRequest {
            start: a,
            added_md: 50.0,
            dls_display: 3.0,
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: 45.0,
            dogleg_plane_azi_deg: None,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        })
        .unwrap();
        assert_eq!(p.method, ProjectionMethod::FixedInitialDoglegPlane);
        assert!(p.method_label.contains("dogleg-plane"));
        assert!(!p.method_label.to_lowercase().contains("gravity"));
    }

    #[test]
    fn fixed_plane_singular_start_needs_plane_azimuth() {
        let mut a = start();
        a.inc_deg = 0.2;
        let err = project_fixed_dogleg_plane(&FixedPlaneTfRequest {
            start: a,
            added_md: 50.0,
            dls_display: 3.0,
            dls_ref: DlsRefLength::Per100Ft,
            toolface_deg: 0.0,
            dogleg_plane_azi_deg: None,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        })
        .unwrap_err();
        assert!(matches!(err, PlanError::Singular(_)));
    }

    #[test]
    fn build_turn_rates_and_nonconstant_dls() {
        let a = start();
        let p = project_build_turn(&BuildTurnRequest {
            start: a,
            added_md: 100.0,
            build_deg_per_ref: 2.0,
            turn_deg_per_ref: 3.0,
            rate_ref: DlsRefLength::Per100Ft,
            unit: UnitSystem::Imperial,
            class: StationClass::Projected,
        })
        .unwrap();
        assert!((p.points[0].inc_deg - 32.0).abs() < 0.05);
        let dazi =
            delve_core::azimuth_delta_rad(a.azi_deg.to_radians(), p.points[0].azi_deg.to_radians())
                .to_degrees();
        assert!((dazi - 3.0).abs() < 0.05);
        assert!(p.assumptions.iter().any(|s| s.contains("sqrt")));
    }

    #[test]
    fn recent_trend_unwraps_and_rejects_vertical() {
        let req = RecentTrendRequest {
            stations: vec![
                TrendStation {
                    md: 100.0,
                    inc_deg: 20.0,
                    azi_deg: 359.0,
                },
                TrendStation {
                    md: 200.0,
                    inc_deg: 22.0,
                    azi_deg: 1.0,
                },
                TrendStation {
                    md: 300.0,
                    inc_deg: 24.0,
                    azi_deg: 3.0,
                },
            ],
            added_md: 50.0,
            unit: UnitSystem::Imperial,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        };
        let fit = project_recent_trend(&req).unwrap();
        assert!(fit.fitted_build_deg_per_ref.unwrap() > 1.5);
        assert!(fit.fitted_turn_deg_per_ref.unwrap() > 1.5);
        assert_eq!(fit.method_label, "Recent trend (least-squares)");
        let mut bad = req.clone();
        bad.stations[0].inc_deg = 1.0;
        assert!(project_recent_trend(&bad).is_err());
    }

    #[test]
    fn metric_imperial_hold_equivalent() {
        let a_ft = start();
        let hold_ft = project_hold(&HoldRequest {
            start: a_ft,
            added_md: 100.0,
            unit: UnitSystem::Imperial,
            class: StationClass::Projected,
        })
        .unwrap();
        let a_m = Attitude {
            md: convert_length(a_ft.md, UnitSystem::Imperial, UnitSystem::Metric),
            north: convert_length(a_ft.north, UnitSystem::Imperial, UnitSystem::Metric),
            east: convert_length(a_ft.east, UnitSystem::Imperial, UnitSystem::Metric),
            tvd: convert_length(a_ft.tvd, UnitSystem::Imperial, UnitSystem::Metric),
            ..a_ft
        };
        let hold_m = project_hold(&HoldRequest {
            start: a_m,
            added_md: convert_length(100.0, UnitSystem::Imperial, UnitSystem::Metric),
            unit: UnitSystem::Metric,
            class: StationClass::Projected,
        })
        .unwrap();
        let n_ft = convert_length(
            hold_m.points[0].north,
            UnitSystem::Metric,
            UnitSystem::Imperial,
        );
        assert!((n_ft - hold_ft.points[0].north).abs() < 1e-9);
    }
}
