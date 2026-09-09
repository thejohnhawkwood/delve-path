//! Next-Stand Flight Deck + BHA Memory.

use crate::error::{issue, PlanError, PlanIssue};
use crate::plan::{inside_corridor, plan_offsets};
use crate::project::{
    project_build_turn, project_gravity_tf, project_hold, project_slide_rotate, Attitude,
    BuildTurnRequest, DlsRefLength, GravityTfRequest, HoldRequest, ProjectionPoint, SlideMode,
    SlideRotateRequest, SlideRotateSeg, DEFAULT_GTF_SINGULAR_DEG,
};
use crate::sections::CorridorTol;
use delve_core::{azimuth_delta_rad, StationClass, UnitSystem};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PathClass {
    AcceptedSurvey,
    Estimated,
    Scenario,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolfaceBasis {
    Gravity,
    Magnetic,
    SteeringAzimuth,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BhaRun {
    pub id: String,
    pub hole_id: String,
    pub name: String,
    pub configuration_revision: i64,
    pub start_md: f64,
    pub end_md: Option<f64>,
    pub motor_id: String,
    pub motor_model: String,
    pub bend_setting: String,
    pub bit_size: f64,
    pub hole_size: f64,
    pub sensor_to_bit: f64,
    pub hole_section: String,
    pub formation_tag: String,
    pub toolface_basis: ToolfaceBasis,
    pub slide_yield_low: f64,
    pub slide_yield_nom: f64,
    pub slide_yield_high: f64,
    pub rotary_dls: f64,
    pub rotary_tf_deg: f64,
    pub yield_ref: DlsRefLength,
    pub notes: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DrillingSegment {
    pub id: String,
    pub bha_id: String,
    pub start_bit_md: f64,
    pub end_bit_md: f64,
    pub mode: SlideMode,
    pub toolface_deg: Option<f64>,
    pub toolface_basis: ToolfaceBasis,
    pub wob: Option<f64>,
    pub flow: Option<f64>,
    pub rpm: Option<f64>,
    pub rop: Option<f64>,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OperatingConstraints {
    pub stand_length: f64,
    pub max_slide_per_stand: f64,
    pub min_useful_slide: f64,
    pub max_dls: f64,
    pub max_yield: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ScenarioInput {
    pub id: String,
    pub name: String,
    pub method: String,
    pub added_md: f64,
    pub dls_display: Option<f64>,
    pub toolface_deg: Option<f64>,
    pub build_deg_per_ref: Option<f64>,
    pub turn_deg_per_ref: Option<f64>,
    pub slide_yield: Option<f64>,
    pub segments: Vec<SlideRotateSeg>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ScenarioCard {
    pub input: ScenarioInput,
    pub future_bit_md: f64,
    pub future_bit: ProjectionPoint,
    pub next_sensor_md: f64,
    pub next_sensor: ProjectionPoint,
    pub path: Vec<ProjectionPoint>,
    pub ud: Option<f64>,
    pub lr: Option<f64>,
    pub target_boundary_distance: Option<f64>,
    pub max_dls: f64,
    pub avg_dls: f64,
    pub slide_footage: f64,
    pub min_centerline: Option<f64>,
    pub constraint_feasible: bool,
    pub violations: Vec<String>,
    pub assumptions: Vec<String>,
    pub issues: Vec<PlanIssue>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BitEstimate {
    pub sensor: Attitude,
    pub bit: Attitude,
    pub derived_bit_md: f64,
    pub entered_bit_md: Option<f64>,
    pub next_expected_sensor_md: f64,
    pub path: Vec<ProjectionPoint>,
    pub issues: Vec<PlanIssue>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MemorySample {
    pub id: String,
    pub bha_revision: i64,
    pub start_bit_md: f64,
    pub end_bit_md: f64,
    pub mode: SlideMode,
    pub included: bool,
    pub reason: String,
    pub fitted_yield: Option<f64>,
    pub residual_deg: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BhaMemory {
    pub revision: i64,
    pub sample_ids: Vec<String>,
    pub samples: Vec<MemorySample>,
    pub median_slide_yield: Option<f64>,
    pub q25_slide_yield: Option<f64>,
    pub q75_slide_yield: Option<f64>,
    pub qualified_count: usize,
    pub rotary_dls: Option<f64>,
    pub threshold_deg: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ForecastScore {
    pub name: String,
    pub expected_survey_md: f64,
    pub actual_survey_md: f64,
    pub md_difference: f64,
    pub miss_n: f64,
    pub miss_e: f64,
    pub miss_tvd: f64,
    pub miss_3d: f64,
    pub inc_residual_deg: f64,
    pub azi_residual_deg: f64,
    pub pre_update_memory_revision: i64,
    pub pre_update_sample_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ScenarioDecision {
    pub id: String,
    pub hole_id: String,
    pub accepted_survey_md: f64,
    pub estimated_bit_md: f64,
    pub plan_revision: i64,
    pub bha_id: String,
    pub bha_revision: i64,
    pub target_id: Option<String>,
    pub offset_hole_id: Option<String>,
    pub assumptions: Vec<String>,
    pub constraints: OperatingConstraints,
    pub scenarios: Vec<ScenarioInput>,
    pub selected_scenario_id: Option<String>,
    pub memory_revision: i64,
    pub memory_sample_ids: Vec<String>,
    pub expected_survey_md: f64,
    pub actual_resolution_md: Option<f64>,
    pub scores: Vec<ForecastScore>,
    pub created_at: String,
    pub resolved_at: Option<String>,
}

pub fn validate_segments(
    sensor_md: f64,
    sensor_to_bit: f64,
    entered_bit_md: Option<f64>,
    segs: &[DrillingSegment],
) -> Result<(f64, Vec<PlanIssue>), PlanError> {
    let mut issues = Vec::new();
    if segs.is_empty() {
        return Err(PlanError::msg(
            "Drilling record is empty. Segments must cover accepted sensor MD through current bit MD.",
        ));
    }
    let mut ordered = segs.to_vec();
    ordered.sort_by(|a, b| a.start_bit_md.partial_cmp(&b.start_bit_md).unwrap());
    for w in ordered.windows(2) {
        if (w[1].start_bit_md - w[0].end_bit_md).abs() > 1e-6 {
            if w[1].start_bit_md > w[0].end_bit_md + 1e-6 {
                issues.push(issue(
                    "error",
                    "segment_gap",
                    format!(
                        "Missing footage between {:.3} and {:.3}. Gaps are not filled with hold, rotate, or zero yield.",
                        w[0].end_bit_md, w[1].start_bit_md
                    ),
                ));
            } else {
                issues.push(issue(
                    "error",
                    "segment_overlap",
                    format!(
                        "Overlapping or duplicate coverage between {:.3} and {:.3}.",
                        w[1].start_bit_md, w[0].end_bit_md
                    ),
                ));
            }
        }
        if w[1].start_bit_md < w[0].start_bit_md {
            issues.push(issue(
                "error",
                "segment_order",
                "Segments are not ordered by bit MD.",
            ));
        }
    }
    for s in &ordered {
        if s.end_bit_md <= s.start_bit_md {
            issues.push(issue(
                "error",
                "segment_length",
                format!("Segment {} has non-positive length.", s.id),
            ));
        }
    }
    let derived_bit = ordered.last().unwrap().end_bit_md;
    let cover_start = ordered.first().unwrap().start_bit_md;
    let sensor_bit = sensor_md + sensor_to_bit;
    if (cover_start - sensor_md).abs() > 1e-4 && (cover_start - sensor_bit).abs() > 1e-4 {
        issues.push(issue(
            "error",
            "segment_cover_start",
            format!(
                "First segment start {:.3} does not match accepted sensor MD {:.3} or sensor+bit {:.3}.",
                cover_start, sensor_md, sensor_bit
            ),
        ));
    }
    if let Some(entered) = entered_bit_md {
        if (entered - derived_bit).abs() > 1e-4 {
            issues.push(issue(
                "error",
                "bit_md_mismatch",
                format!(
                    "Entered current bit MD {entered:.3} disagrees with segment-derived bit MD {derived_bit:.3}."
                ),
            ));
        }
    }
    if issues.iter().any(|i| i.severity == "error") {
        return Err(PlanError::msg(
            issues
                .iter()
                .map(|i| i.message.clone())
                .collect::<Vec<_>>()
                .join(" "),
        ));
    }
    Ok((derived_bit, issues))
}

pub fn estimate_bit(
    sensor: Attitude,
    bha: &BhaRun,
    segs: &[DrillingSegment],
    entered_bit_md: Option<f64>,
    unit: UnitSystem,
) -> Result<BitEstimate, PlanError> {
    let (derived_bit, issues) =
        validate_segments(sensor.md, bha.sensor_to_bit, entered_bit_md, segs)?;
    let mut ordered = segs.to_vec();
    ordered.sort_by(|a, b| a.start_bit_md.partial_cmp(&b.start_bit_md).unwrap());
    let mut slide = Vec::new();
    for s in &ordered {
        let len = s.end_bit_md - s.start_bit_md;
        slide.push(SlideRotateSeg {
            mode: s.mode,
            length: len,
            toolface_deg: s.toolface_deg.unwrap_or(0.0),
            slide_yield_dls: bha.slide_yield_nom,
            rotary_dls: bha.rotary_dls,
            rotary_tf_deg: bha.rotary_tf_deg,
            dls_ref: bha.yield_ref,
        });
    }
    let proj = project_slide_rotate(&SlideRotateRequest {
        start: sensor,
        segments: slide,
        unit,
        singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
        class: StationClass::Projected,
    })?;
    let last = proj
        .points
        .last()
        .ok_or_else(|| PlanError::msg("empty estimate"))?;
    let bit = Attitude {
        md: derived_bit,
        inc_deg: last.inc_deg,
        azi_deg: last.azi_deg,
        north: last.north,
        east: last.east,
        tvd: last.tvd,
    };
    Ok(BitEstimate {
        sensor,
        bit,
        derived_bit_md: derived_bit,
        entered_bit_md,
        next_expected_sensor_md: derived_bit - bha.sensor_to_bit,
        path: proj.points,
        issues,
    })
}

pub fn evaluate_scenario(
    start_bit: Attitude,
    bha: &BhaRun,
    input: &ScenarioInput,
    plan_att: Option<&Attitude>,
    corridor: Option<&CorridorTol>,
    constraints: &OperatingConstraints,
    unit: UnitSystem,
    target_boundary: Option<f64>,
    min_centerline: Option<f64>,
) -> Result<ScenarioCard, PlanError> {
    let class = StationClass::Projected;
    let proj = match input.method.as_str() {
        "hold" => project_hold(&HoldRequest {
            start: start_bit,
            added_md: input.added_md,
            unit,
            class,
        })?,
        "dls_tf" | "gravity_tf" => project_gravity_tf(&GravityTfRequest {
            start: start_bit,
            added_md: input.added_md,
            dls_display: input.dls_display.unwrap_or(bha.slide_yield_nom),
            dls_ref: bha.yield_ref,
            toolface_deg: input.toolface_deg.unwrap_or(0.0),
            unit,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class,
        })?,
        "build_turn" => project_build_turn(&BuildTurnRequest {
            start: start_bit,
            added_md: input.added_md,
            build_deg_per_ref: input.build_deg_per_ref.unwrap_or(0.0),
            turn_deg_per_ref: input.turn_deg_per_ref.unwrap_or(0.0),
            rate_ref: bha.yield_ref,
            unit,
            class,
        })?,
        _ => project_slide_rotate(&SlideRotateRequest {
            start: start_bit,
            segments: if input.segments.is_empty() {
                vec![SlideRotateSeg {
                    mode: SlideMode::Slide,
                    length: input.added_md,
                    toolface_deg: input.toolface_deg.unwrap_or(0.0),
                    slide_yield_dls: input.slide_yield.unwrap_or(bha.slide_yield_nom),
                    rotary_dls: bha.rotary_dls,
                    rotary_tf_deg: bha.rotary_tf_deg,
                    dls_ref: bha.yield_ref,
                }]
            } else {
                input.segments.clone()
            },
            unit,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class,
        })?,
    };
    let future = proj
        .points
        .last()
        .cloned()
        .ok_or_else(|| PlanError::msg("empty scenario"))?;
    let next_md = future.md - bha.sensor_to_bit;
    let next_sensor = if next_md <= start_bit.md {
        ProjectionPoint {
            md: next_md,
            inc_deg: start_bit.inc_deg,
            azi_deg: start_bit.azi_deg,
            north: start_bit.north,
            east: start_bit.east,
            tvd: start_bit.tvd,
            dogleg_deg: 0.0,
            dls_display: 0.0,
            class,
            comment: "next expected sensor (behind current bit)".into(),
        }
    } else {
        // Approximate: same path, earlier MD by interpolating linearly in MD along the last interval.
        let frac = (next_md - start_bit.md) / (future.md - start_bit.md).max(1e-9);
        ProjectionPoint {
            md: next_md,
            inc_deg: start_bit.inc_deg + frac * (future.inc_deg - start_bit.inc_deg),
            azi_deg: start_bit.azi_deg
                + frac
                    * azimuth_delta_rad(
                        start_bit.azi_deg.to_radians(),
                        future.azi_deg.to_radians(),
                    )
                    .to_degrees(),
            north: start_bit.north + frac * (future.north - start_bit.north),
            east: start_bit.east + frac * (future.east - start_bit.east),
            tvd: start_bit.tvd + frac * (future.tvd - start_bit.tvd),
            dogleg_deg: future.dogleg_deg * frac,
            dls_display: future.dls_display,
            class,
            comment: "next expected sensor".into(),
        }
    };
    let (ud, lr) = if let Some(p) = plan_att {
        match plan_offsets(p, future.north, future.east, future.tvd) {
            Ok(v) => (Some(v.0), Some(v.1)),
            Err(_) => (None, None),
        }
    } else {
        (None, None)
    };
    let slide_footage: f64 = if input.segments.is_empty() {
        if input.method == "hold" || input.method == "build_turn" {
            0.0
        } else {
            input.added_md
        }
    } else {
        input
            .segments
            .iter()
            .filter(|s| s.mode == SlideMode::Slide)
            .map(|s| s.length)
            .sum()
    };
    let max_dls = proj
        .points
        .iter()
        .map(|p| p.dls_display)
        .fold(0.0_f64, f64::max)
        .max(
            input
                .segments
                .iter()
                .map(|s| match s.mode {
                    SlideMode::Slide => s.slide_yield_dls,
                    SlideMode::Rotate => s.rotary_dls,
                })
                .fold(0.0_f64, f64::max),
        )
        .max(input.dls_display.unwrap_or(0.0))
        .max(input.slide_yield.unwrap_or(0.0));
    let mut violations = Vec::new();
    if input.added_md > constraints.stand_length * 2.0 + 1e-6 {
        violations.push(format!(
            "Added MD {:.1} exceeds two stands of {:.1}.",
            input.added_md, constraints.stand_length
        ));
    }
    if slide_footage > constraints.max_slide_per_stand + 1e-6
        && input.added_md <= constraints.stand_length + 1e-6
    {
        violations.push(format!(
            "Slide footage {:.1} exceeds max slide per stand {:.1}.",
            slide_footage, constraints.max_slide_per_stand
        ));
    }
    if slide_footage > 0.0 && slide_footage + 1e-9 < constraints.min_useful_slide {
        violations.push(format!(
            "Slide footage {:.1} is below minimum useful slide {:.1}.",
            slide_footage, constraints.min_useful_slide
        ));
    }
    if future.dls_display > constraints.max_dls + 1e-6 {
        violations.push(format!(
            "Max DLS {:.3} exceeds allowed {:.3}.",
            future.dls_display, constraints.max_dls
        ));
    }
    if let Some(y) = input.slide_yield {
        if y > constraints.max_yield + 1e-6 {
            violations.push(format!(
                "Yield {y:.3} exceeds allowed {:.3}.",
                constraints.max_yield
            ));
        }
    }
    if let (Some(ud), Some(lr), Some(tol)) = (ud, lr, corridor) {
        if !inside_corridor(ud, lr, tol) {
            violations.push(format!(
                "Outside plan corridor (UD {ud:.2}, LR {lr:.2}; limits ±{}/{ }).",
                tol.up_down, tol.left_right
            ));
        }
    }
    let mut path = vec![ProjectionPoint {
        md: start_bit.md,
        inc_deg: start_bit.inc_deg,
        azi_deg: start_bit.azi_deg,
        north: start_bit.north,
        east: start_bit.east,
        tvd: start_bit.tvd,
        dogleg_deg: 0.0,
        dls_display: 0.0,
        class,
        comment: "scenario start (estimated bit)".into(),
    }];
    path.extend(proj.points.iter().cloned());
    Ok(ScenarioCard {
        input: input.clone(),
        future_bit_md: future.md,
        future_bit: future.clone(),
        next_sensor_md: next_md,
        next_sensor,
        path,
        ud,
        lr,
        target_boundary_distance: target_boundary,
        max_dls,
        avg_dls: if proj.points.is_empty() {
            max_dls
        } else {
            proj.points.iter().map(|p| p.dls_display).sum::<f64>() / proj.points.len() as f64
        },
        slide_footage,
        min_centerline,
        constraint_feasible: violations.is_empty(),
        violations,
        assumptions: proj.assumptions,
        issues: proj.issues,
    })
}

pub fn qualify_memory(
    bha: &BhaRun,
    intervals: &[MemorySample],
    threshold_deg: f64,
    min_slide: f64,
) -> BhaMemory {
    let mut samples = Vec::new();
    for raw in intervals {
        let mut s = raw.clone();
        if s.bha_revision != bha.configuration_revision {
            s.included = false;
            s.reason = "Excluded: different BHA configuration revision. Samples are never pooled across revisions.".into();
        } else if s.mode == SlideMode::Slide && (s.end_bit_md - s.start_bit_md) + 1e-9 < min_slide {
            s.included = false;
            s.reason = format!("Excluded: slide footage below {min_slide}.");
        } else if s.residual_deg.unwrap_or(99.0) > threshold_deg {
            s.included = false;
            s.reason = format!(
                "Excluded: endpoint tangent residual {:.2}° exceeds threshold {:.2}°.",
                s.residual_deg.unwrap_or(0.0),
                threshold_deg
            );
        } else if s.mode == SlideMode::Slide && s.fitted_yield.is_none() {
            s.included = false;
            s.reason = "Excluded: missing effective toolface or yield fit.".into();
        } else {
            s.included = true;
            s.reason = "Included: exact configuration match and residual within threshold.".into();
        }
        samples.push(s);
    }
    let mut yields: Vec<f64> = samples
        .iter()
        .filter(|s| s.included && s.mode == SlideMode::Slide)
        .filter_map(|s| s.fitted_yield)
        .collect();
    yields.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = yields.len();
    let median = if n == 0 {
        None
    } else if n % 2 == 1 {
        Some(yields[n / 2])
    } else {
        Some(0.5 * (yields[n / 2 - 1] + yields[n / 2]))
    };
    let q = |p: f64| {
        if n == 0 {
            None
        } else {
            let i = ((n as f64 - 1.0) * p).round() as usize;
            Some(yields[i.min(n - 1)])
        }
    };
    let rotary: Vec<f64> = samples
        .iter()
        .filter(|s| s.included && s.mode == SlideMode::Rotate)
        .filter_map(|s| s.fitted_yield)
        .collect();
    BhaMemory {
        revision: bha.configuration_revision,
        sample_ids: samples
            .iter()
            .filter(|s| s.included)
            .map(|s| s.id.clone())
            .collect(),
        samples,
        median_slide_yield: median,
        q25_slide_yield: q(0.25),
        q75_slide_yield: q(0.75),
        qualified_count: n,
        rotary_dls: if rotary.is_empty() {
            None
        } else {
            Some(rotary.iter().sum::<f64>() / rotary.len() as f64)
        },
        threshold_deg,
    }
}

pub fn score_forecasts(
    decision: &ScenarioDecision,
    actual_md: f64,
    actual: Attitude,
    frozen: &[(String, Attitude)],
) -> Vec<ForecastScore> {
    frozen
        .iter()
        .map(|(name, pred)| {
            let dn = actual.north - pred.north;
            let de = actual.east - pred.east;
            let dt = actual.tvd - pred.tvd;
            ForecastScore {
                name: name.clone(),
                expected_survey_md: decision.expected_survey_md,
                actual_survey_md: actual_md,
                md_difference: actual_md - decision.expected_survey_md,
                miss_n: dn,
                miss_e: de,
                miss_tvd: dt,
                miss_3d: (dn * dn + de * de + dt * dt).sqrt(),
                inc_residual_deg: actual.inc_deg - pred.inc_deg,
                azi_residual_deg: azimuth_delta_rad(
                    pred.azi_deg.to_radians(),
                    actual.azi_deg.to_radians(),
                )
                .to_degrees(),
                pre_update_memory_revision: decision.memory_revision,
                pre_update_sample_ids: decision.memory_sample_ids.clone(),
            }
        })
        .collect()
}

/// Replay a slide interval fitting yield as the only unknown.
pub fn fit_slide_yield(
    start: Attitude,
    end: Attitude,
    toolface_deg: f64,
    rotary_dls: f64,
    unit: UnitSystem,
    ref_len: DlsRefLength,
) -> Result<(f64, f64), PlanError> {
    let length = end.md - start.md;
    if length <= 0.0 {
        return Err(PlanError::msg("Fit interval length must be positive."));
    }
    let mut best = 1.0;
    let mut best_res = f64::MAX;
    let mut y = 0.2;
    while y <= 12.0 {
        let p = project_gravity_tf(&GravityTfRequest {
            start,
            added_md: length,
            dls_display: y,
            dls_ref: ref_len,
            toolface_deg,
            unit,
            singular_inc_deg: DEFAULT_GTF_SINGULAR_DEG,
            class: StationClass::Projected,
        });
        if let Ok(p) = p {
            let q = &p.points[0];
            let di = (q.inc_deg - end.inc_deg).abs();
            let da = azimuth_delta_rad(q.azi_deg.to_radians(), end.azi_deg.to_radians())
                .to_degrees()
                .abs();
            let res = di.hypot(da);
            if res < best_res {
                best_res = res;
                best = y;
            }
        }
        y += 0.1;
        let _ = rotary_dls;
    }
    Ok((best, best_res))
}

pub fn shift_card_footage(segs: &[DrillingSegment]) -> (f64, f64, f64, Option<f64>) {
    let mut slide = 0.0;
    let mut rotate = 0.0;
    let mut hours = 0.0;
    let mut have_hours = false;
    for s in segs {
        let len = (s.end_bit_md - s.start_bit_md).max(0.0);
        match s.mode {
            SlideMode::Slide => slide += len,
            SlideMode::Rotate => rotate += len,
        }
        if let (Some(a), Some(b)) = (&s.started_at, &s.ended_at) {
            if let (Ok(ta), Ok(tb)) = (chrono_hours(a), chrono_hours(b)) {
                hours += (tb - ta).max(0.0);
                have_hours = true;
            }
        }
    }
    let total = slide + rotate;
    let pct = if total > 0.0 {
        100.0 * slide / total
    } else {
        0.0
    };
    (
        slide,
        rotate,
        pct,
        if have_hours { Some(hours) } else { None },
    )
}

fn chrono_hours(iso: &str) -> Result<f64, ()> {
    // Minimal ISO-8601 hour parser: YYYY-MM-DDTHH:MM
    if iso.len() < 16 {
        return Err(());
    }
    let h: f64 = iso[11..13].parse().map_err(|_| ())?;
    let m: f64 = iso[14..16].parse().map_err(|_| ())?;
    Ok(h + m / 60.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bha() -> BhaRun {
        BhaRun {
            id: "b1".into(),
            hole_id: "h1".into(),
            name: "Motor A".into(),
            configuration_revision: 1,
            start_md: 8000.0,
            end_md: None,
            motor_id: "M1".into(),
            motor_model: "7/8 1.5°".into(),
            bend_setting: "1.5".into(),
            bit_size: 8.5,
            hole_size: 8.75,
            sensor_to_bit: 45.0,
            hole_section: "8.5".into(),
            formation_tag: "demo".into(),
            toolface_basis: ToolfaceBasis::Gravity,
            slide_yield_low: 6.0,
            slide_yield_nom: 8.0,
            slide_yield_high: 10.0,
            rotary_dls: 0.4,
            rotary_tf_deg: 0.0,
            yield_ref: DlsRefLength::Per100Ft,
            notes: String::new(),
        }
    }

    fn sensor() -> Attitude {
        Attitude {
            md: 9000.0,
            inc_deg: 88.0,
            azi_deg: 90.0,
            north: 10.0,
            east: 4000.0,
            tvd: 7400.0,
        }
    }

    #[test]
    fn gap_blocks_estimate() {
        let segs = vec![
            DrillingSegment {
                id: "1".into(),
                bha_id: "b1".into(),
                start_bit_md: 9000.0,
                end_bit_md: 9020.0,
                mode: SlideMode::Rotate,
                toolface_deg: None,
                toolface_basis: ToolfaceBasis::Gravity,
                wob: None,
                flow: None,
                rpm: None,
                rop: None,
                started_at: None,
                ended_at: None,
                source: "manual".into(),
            },
            DrillingSegment {
                id: "2".into(),
                bha_id: "b1".into(),
                start_bit_md: 9040.0,
                end_bit_md: 9060.0,
                mode: SlideMode::Slide,
                toolface_deg: Some(0.0),
                toolface_basis: ToolfaceBasis::Gravity,
                wob: None,
                flow: None,
                rpm: None,
                rop: None,
                started_at: None,
                ended_at: None,
                source: "manual".into(),
            },
        ];
        assert!(validate_segments(9000.0, 45.0, Some(9060.0), &segs).is_err());
    }

    #[test]
    fn bit_md_disagreement_blocks() {
        let segs = vec![DrillingSegment {
            id: "1".into(),
            bha_id: "b1".into(),
            start_bit_md: 9000.0,
            end_bit_md: 9045.0,
            mode: SlideMode::Rotate,
            toolface_deg: None,
            toolface_basis: ToolfaceBasis::Gravity,
            wob: None,
            flow: None,
            rpm: None,
            rop: None,
            started_at: None,
            ended_at: None,
            source: "manual".into(),
        }];
        assert!(validate_segments(9000.0, 45.0, Some(9100.0), &segs).is_err());
    }

    #[test]
    fn next_sensor_is_not_bit() {
        let b = bha();
        let segs = vec![DrillingSegment {
            id: "1".into(),
            bha_id: "b1".into(),
            start_bit_md: 9000.0,
            end_bit_md: 9045.0,
            mode: SlideMode::Rotate,
            toolface_deg: None,
            toolface_basis: ToolfaceBasis::Gravity,
            wob: None,
            flow: None,
            rpm: None,
            rop: None,
            started_at: None,
            ended_at: None,
            source: "manual".into(),
        }];
        let est = estimate_bit(sensor(), &b, &segs, Some(9045.0), UnitSystem::Imperial).unwrap();
        assert!((est.derived_bit_md - 9045.0).abs() < 1e-9);
        assert!((est.next_expected_sensor_md - 9000.0).abs() < 1e-9);
        assert!((est.bit.md - est.sensor.md - 45.0).abs() < 1e-9);
    }

    #[test]
    fn memory_never_crosses_revision() {
        let b = bha();
        let samples = vec![
            MemorySample {
                id: "a".into(),
                bha_revision: 1,
                start_bit_md: 8500.0,
                end_bit_md: 8520.0,
                mode: SlideMode::Slide,
                included: true,
                reason: String::new(),
                fitted_yield: Some(8.1),
                residual_deg: Some(0.2),
            },
            MemorySample {
                id: "b".into(),
                bha_revision: 2,
                start_bit_md: 8600.0,
                end_bit_md: 8620.0,
                mode: SlideMode::Slide,
                included: true,
                reason: String::new(),
                fitted_yield: Some(11.0),
                residual_deg: Some(0.1),
            },
        ];
        let mem = qualify_memory(&b, &samples, 0.5, 10.0);
        assert_eq!(mem.qualified_count, 1);
        assert_eq!(mem.sample_ids, vec!["a".to_string()]);
        assert!(mem.samples.iter().any(|s| !s.included && s.id == "b"));
    }

    #[test]
    fn scores_do_not_mutate_frozen_forecast() {
        let decision = ScenarioDecision {
            id: "d1".into(),
            hole_id: "h1".into(),
            accepted_survey_md: 9000.0,
            estimated_bit_md: 9045.0,
            plan_revision: 1,
            bha_id: "b1".into(),
            bha_revision: 1,
            target_id: None,
            offset_hole_id: None,
            assumptions: vec![],
            constraints: OperatingConstraints {
                stand_length: 93.0,
                max_slide_per_stand: 40.0,
                min_useful_slide: 5.0,
                max_dls: 12.0,
                max_yield: 12.0,
            },
            scenarios: vec![],
            selected_scenario_id: None,
            memory_revision: 1,
            memory_sample_ids: vec!["a".into()],
            expected_survey_md: 9090.0,
            actual_resolution_md: None,
            scores: vec![],
            created_at: "t0".into(),
            resolved_at: None,
        };
        let pred = Attitude {
            md: 9093.0,
            inc_deg: 89.0,
            azi_deg: 91.0,
            north: 12.0,
            east: 4080.0,
            tvd: 7402.0,
        };
        let actual = Attitude {
            md: 9095.0,
            inc_deg: 89.4,
            azi_deg: 90.2,
            north: 11.0,
            east: 4070.0,
            tvd: 7401.0,
        };
        let scores = score_forecasts(&decision, 9095.0, actual, &[("hold".into(), pred)]);
        assert_eq!(scores[0].pre_update_memory_revision, 1);
        assert_eq!(scores[0].pre_update_sample_ids, vec!["a".to_string()]);
        assert!((scores[0].md_difference - 5.0).abs() < 1e-9);
        assert_eq!(pred.inc_deg, 89.0);
    }
}
