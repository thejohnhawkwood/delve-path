//! Bounded polyline sampling of the same minimum-curvature arcs used by Survey.
use crate::collision::SurveyPoint;
use delve_core::{
    calculate_trajectory, evaluate_trajectory_at_md, min_curvature_chord_deviation_m, HoleCalcInput,
};
use serde::Serialize;

#[derive(Serialize)]
pub struct SampledSurvey {
    pub points: Vec<SurveyPoint>,
    pub chord_error_bound: f64,
}

pub fn sample(input: &HoleCalcInput, tolerance: f64) -> Result<SampledSurvey, String> {
    if !tolerance.is_finite() || tolerance <= 0.0 {
        return Err("Survey chord tolerance must be positive and finite.".into());
    }
    let traj = calculate_trajectory(input).map_err(|e| e.to_string())?;
    if traj.stations.len() < 2 {
        return Err("At least two survey stations are required.".into());
    }
    let mut mds = vec![traj.stations[0].md];
    let mut bound = 0.0_f64;
    for pair in traj.stations.windows(2) {
        let course = pair[1].md - pair[0].md;
        let beta = pair[1].dogleg_deg.to_radians();
        // 1-cos(x) <= x²/2: sagitta <= course * beta / (8 * n²).
        // The homogeneous sagitta helper works in any consistent length unit.
        let n = (course * beta / (8.0 * tolerance)).sqrt().ceil().max(1.0) as usize;
        if n > 1999 || mds.len() + n > 2000 {
            return Err("This survey needs more than 2000 samples at the requested tolerance. Limit the offset interval or use a larger declared tolerance.".into());
        }
        bound = bound.max(min_curvature_chord_deviation_m(
            course / n as f64,
            beta / n as f64,
        ));
        for j in 1..=n {
            mds.push(pair[0].md + course * j as f64 / n as f64);
        }
    }
    let points = mds
        .into_iter()
        .map(|md| {
            let p = evaluate_trajectory_at_md(&traj, md).map_err(|e| e.to_string())?;
            Ok(SurveyPoint {
                md,
                north: p.north,
                east: p.east,
                tvd: p.tvd,
                inc_deg: p.inc_deg,
                azi_deg: p.azi_deg,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(SampledSurvey {
        points,
        chord_error_bound: bound,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn quarter_circle_matches_analytic_arc_and_bounds_each_chord() {
        let input: HoleCalcInput = serde_json::from_value(serde_json::json!({
            "unit_system":"metric", "convention":"oilfield_from_vertical", "azimuth_reference":"grid", "vsp_deg":0,
            "tie_in":{"north":0,"east":0,"tvd":0}, "stations":[
                {"md":0,"inc_deg":0,"azi_deg":0,"comment":"","class":"measured","source":"manual"},
                {"md":157.07963267948966,"inc_deg":90,"azi_deg":0,"comment":"","class":"measured","source":"manual"}
            ]
        })).unwrap();
        let sampled = sample(&input, 0.01).unwrap();
        assert!(sampled.chord_error_bound <= 0.01);
        assert!(sampled.points.len() > 50);
        for p in &sampled.points {
            let angle = p.md / 100.0;
            assert!((p.north - 100.0 * (1.0 - angle.cos())).abs() < 1e-9);
            assert!((p.tvd - 100.0 * angle.sin()).abs() < 1e-9);
        }
        for pair in sampled.points.windows(2) {
            let sagitta = 100.0 * (1.0 - ((pair[1].md - pair[0].md) / 200.0).cos());
            assert!(sagitta <= sampled.chord_error_bound + 1e-12);
        }
        assert!(sample(&input, 1e-12).is_err());
    }
}
