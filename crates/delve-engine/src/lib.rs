//! Tagged JSON engine dispatch for WASM and Tauri.

use delve_planning::Attitude;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub mod collision;
pub mod survey_path;
pub mod uncertainty;

#[derive(Debug, Deserialize)]
struct Call {
    op: String,
    #[serde(default)]
    payload: Value,
}

#[derive(Debug, Serialize)]
struct ErrBody {
    error: String,
}

#[derive(Debug, Deserialize)]
struct FrozenPred {
    name: String,
    pred: Attitude,
}

pub fn engine_call_json(req: &str) -> Result<String, String> {
    let call: Call = serde_json::from_str(req).map_err(|e| e.to_string())?;
    match dispatch(&call.op, call.payload) {
        Ok(out) => Ok(out),
        Err(e) => Err(serde_json::to_string(&ErrBody { error: e.clone() }).unwrap_or(e)),
    }
}

fn dispatch(op: &str, p: Value) -> Result<String, String> {
    match op {
        "sample_survey_path" => ser(survey_path::sample(
            &de_field(&p, "input")?,
            num(&p, "tolerance")?,
        )),
        "collision_demo" => serde_json::to_string(&collision::demo()).map_err(|e| e.to_string()),
        "collision_analyze" => ser(collision::analyze(&de(&p)?)),
        "screen_forecast" => ser(collision::screen_forecast(
            &de_field(&p, "case")?,
            &de_field::<Vec<collision::SurveyPoint>>(&p, "points")?,
        )),
        "generate_drill_path" => ser(collision::generate(&de(&p)?)),
        "uncertainty_glyphs" => {
            let requests: Vec<uncertainty::GlyphRequest> = de(&p)?;
            if requests.len() > 100 {
                return Err("At most 100 ellipsoids per request.".into());
            }
            ser(requests
                .iter()
                .map(uncertainty::glyph)
                .collect::<Result<Vec<_>, _>>())
        }
        "evaluate_at_md" => {
            let req: delve_core::HoleCalcInput = if p.get("input").is_some() {
                de_field(&p, "input")?
            } else {
                de(&p)?
            };
            let md = num(&p, "md")?;
            let s = delve_core::evaluate_at_md(&req, md).map_err(|e| e.to_string())?;
            serde_json::to_string(&s).map_err(|e| e.to_string())
        }
        "project_hold" => ser(delve_planning::project_hold(&de(&p)?)),
        "project_gravity_tf" => ser(delve_planning::project_gravity_tf(&de(&p)?)),
        "project_fixed_plane" => ser(delve_planning::project_fixed_dogleg_plane(&de(&p)?)),
        "project_build_turn" => ser(delve_planning::project_build_turn(&de(&p)?)),
        "project_trend" => {
            if p.get("start").is_some() {
                ser(delve_planning::project_recent_trend_from(
                    &de_field(&p, "trend")?,
                    de_field(&p, "start")?,
                ))
            } else {
                ser(delve_planning::project_recent_trend(&de(&p)?))
            }
        }
        "project_slide_rotate" => ser(delve_planning::project_slide_rotate(&de(&p)?)),
        "method_help" => {
            let m: delve_planning::ProjectionMethod = if p.get("method").is_some() {
                de_field(&p, "method")?
            } else {
                de(&p)?
            };
            let (inputs, assumptions, applicability) = delve_planning::method_help(m);
            serde_json::to_string(&serde_json::json!({
                "inputs": inputs,
                "assumptions": assumptions,
                "applicability": applicability
            }))
            .map_err(|e| e.to_string())
        }
        "solve_slant" => ser(delve_planning::solve_slant_2d(&de(&p)?)),
        "solve_swell" => ser(delve_planning::solve_s_well_2d(&de(&p)?)),
        "solve_horizontal" => ser(delve_planning::solve_horizontal(&de(&p)?)),
        "solve_curve_hold" => ser(delve_planning::solve_curve_hold_3d(&de(&p)?)),
        "densify_plan" => {
            let result = de_field(&p, "result")?;
            let interval = num(&p, "interval")?;
            ser(delve_planning::densify_plan(&result, interval))
        }
        "plan_offsets" => {
            let att = de_field(&p, "plan")?;
            match delve_planning::plan_offsets(&att, num(&p, "north")?, num(&p, "east")?, num(&p, "tvd")?) {
                Ok((ud, lr)) => serde_json::to_string(&serde_json::json!({
                    "ud": ud,
                    "lr": lr,
                    "convention": "UP/DOWN along plan high-side (positive up); LEFT/RIGHT along plan right (positive right)"
                }))
                .map_err(|e| e.to_string()),
                Err(e) => Err(e.to_string()),
            }
        }
        "convert_length" => {
            let v = num(&p, "value")?;
            let from: delve_core::UnitSystem = de_field(&p, "from")?;
            let to: delve_core::UnitSystem = de_field(&p, "to")?;
            serde_json::to_string(&delve_core::convert_length(v, from, to))
                .map_err(|e| e.to_string())
        }
        "frames_comparable" => {
            let a = de_field(&p, "a")?;
            let b = de_field(&p, "b")?;
            match delve_core::frames_comparable(&a, &b) {
                Ok(()) => serde_json::to_string(&serde_json::json!({ "ok": true }))
                    .map_err(|e| e.to_string()),
                Err(iss) => {
                    serde_json::to_string(&serde_json::json!({ "ok": false, "issues": iss }))
                        .map_err(|e| e.to_string())
                }
            }
        }
        "target_outline" => {
            let t = de(&p)?;
            serde_json::to_string(&delve_assurance::target_world_outline(&t, 48))
                .map_err(|e| e.to_string())
        }
        "target_query" => {
            let t = de_field(&p, "target")?;
            let states: Vec<delve_core::PathState> = de_field(&p, "states")?;
            ser(delve_assurance::query_path_target(&t, &states))
        }
        "target_section_intersection" => {
            let t = de_field(&p, "target")?;
            serde_json::to_string(&delve_assurance::section_plane_intersection(
                &t,
                num(&p, "vsp_deg")?,
            ))
            .map_err(|e| e.to_string())
        }
        "target_section_projection" => {
            let t = de_field(&p, "target")?;
            serde_json::to_string(&delve_assurance::orthogonal_section_projection(
                &t,
                num(&p, "vsp_deg")?,
            ))
            .map_err(|e| e.to_string())
        }
        "canonical_basis" => ser(delve_assurance::canonical_basis(de(&p)?)),
        "legacy_target" => {
            let t = delve_assurance::TargetGeom::from_legacy_point(
                str_field(&p, "id")?,
                str_field(&p, "hole_id")?,
                str_field(&p, "name")?,
                num(&p, "north")?,
                num(&p, "east")?,
                num(&p, "tvd")?,
                p.get("parent_target_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                p.get("horiz_tol").and_then(|v| v.as_f64()),
                p.get("vert_tol").and_then(|v| v.as_f64()),
            );
            serde_json::to_string(&t).map_err(|e| e.to_string())
        }
        "centerline_scan" => {
            let req: CenterlineReq = de(&p)?;
            ser(delve_assurance::closest_approach(
                &req.ref_intervals,
                &req.off_intervals,
                &req.ref_frame,
                &req.off_frame,
                req.ref_md_range,
                req.off_md_range,
                req.exclude_ref,
                req.exclude_off,
                req.threshold,
                req.to_m,
            ))
        }
        "intervals_from_states" => {
            let states: Vec<delve_core::PathState> = de_field(&p, "states")?;
            let to_m = num(&p, "to_m")?;
            serde_json::to_string(&delve_assurance::min_curvature_intervals(&states, to_m))
                .map_err(|e| e.to_string())
        }
        "translate_depth" => ser(delve_assurance::translate_depth(
            num(&p, "depth")?,
            &de_field(&p, "source")?,
            &de_field(&p, "target")?,
            de_field(&p, "unit")?,
        )),
        "convert_md" => {
            let shift = p
                .get("shift")
                .cloned()
                .and_then(|v| serde_json::from_value(v).ok());
            ser(delve_assurance::convert_md(
                num(&p, "md")?,
                &de_field(&p, "source")?,
                &de_field(&p, "target")?,
                de_field(&p, "unit")?,
                shift.as_ref(),
            ))
        }
        "apply_wireline" => {
            let reverse = p.get("reverse").and_then(|v| v.as_bool()).unwrap_or(false);
            ser(delve_assurance::apply_wireline(
                &de_field(&p, "map")?,
                num(&p, "source")?,
                reverse,
            ))
        }
        "md_for_tvd" => {
            let traj = de_field(&p, "traj")?;
            serde_json::to_string(&delve_assurance::md_for_tvd(&traj, num(&p, "tvd")?))
                .map_err(|e| e.to_string())
        }
        "normalize_covariance" => ser(delve_assurance::normalize_one_sigma(
            &de_field(&p, "row")?,
            de_field(&p, "hole_unit")?,
        )),
        "chi2_k" => {
            let dim = p.get("dim").and_then(|v| v.as_u64()).ok_or("dim")? as u32;
            ser(delve_assurance::chi2_k(dim, num(&p, "p")?))
        }
        "project_ellipse" => ser(delve_assurance::project_ellipse(
            &de_field(&p, "c")?,
            de_field(&p, "mode")?,
            num(&p, "p")?,
            p.get("plane").and_then(|v| v.as_str()).unwrap_or("plan"),
        )),
        "ellipse_polyline" => {
            let ell = delve_assurance::project_ellipse(
                &de_field(&p, "c")?,
                de_field(&p, "mode")?,
                num(&p, "p")?,
                p.get("plane").and_then(|v| v.as_str()).unwrap_or("plan"),
            )
            .map_err(|e| e.to_string())?;
            let center: [f64; 3] = de_field(&p, "center")?;
            let n = p.get("n").and_then(|v| v.as_u64()).unwrap_or(32) as usize;
            serde_json::to_string(&delve_assurance::ellipse_polyline(
                center,
                &ell,
                p.get("plane").and_then(|v| v.as_str()).unwrap_or("plan"),
                n,
            ))
            .map_err(|e| e.to_string())
        }
        "ellipsoid_wireframe" => {
            let center: [f64; 3] = de_field(&p, "center")?;
            let k = num(&p, "k")?;
            let n = p.get("n").and_then(|v| v.as_u64()).unwrap_or(24) as usize;
            serde_json::to_string(&delve_assurance::ellipsoid_wireframe(
                center,
                &de_field(&p, "c")?,
                k,
                n,
            ))
            .map_err(|e| e.to_string())
        }
        "flight_estimate" => {
            let segs: Vec<delve_planning::DrillingSegment> = de_field(&p, "segments")?;
            ser(delve_planning::estimate_bit(
                de_field(&p, "sensor")?,
                &de_field(&p, "bha")?,
                &segs,
                p.get("entered_bit_md").and_then(|v| v.as_f64()),
                de_field(&p, "unit")?,
            ))
        }
        "flight_scenario" => {
            let plan_att = p
                .get("plan")
                .cloned()
                .and_then(|v| serde_json::from_value(v).ok());
            let corridor = p
                .get("corridor")
                .cloned()
                .and_then(|v| serde_json::from_value(v).ok());
            ser(delve_planning::evaluate_scenario(
                de_field(&p, "start_bit")?,
                &de_field(&p, "bha")?,
                &de_field(&p, "input")?,
                plan_att.as_ref(),
                corridor.as_ref(),
                &de_field(&p, "constraints")?,
                de_field(&p, "unit")?,
                p.get("target_boundary").and_then(|v| v.as_f64()),
                p.get("min_centerline").and_then(|v| v.as_f64()),
            ))
        }
        "flight_qualify" => {
            let samples: Vec<delve_planning::MemorySample> = de_field(&p, "samples")?;
            let mem = delve_planning::qualify_memory(
                &de_field(&p, "bha")?,
                &samples,
                p.get("threshold_deg")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.5),
                p.get("min_slide").and_then(|v| v.as_f64()).unwrap_or(10.0),
            );
            serde_json::to_string(&mem).map_err(|e| e.to_string())
        }
        "flight_score" => {
            let frozen: Vec<FrozenPred> = de_field(&p, "frozen")?;
            let pairs: Vec<(String, Attitude)> =
                frozen.into_iter().map(|f| (f.name, f.pred)).collect();
            let scores = delve_planning::score_forecasts(
                &de_field(&p, "decision")?,
                num(&p, "actual_md")?,
                de_field(&p, "actual")?,
                &pairs,
            );
            serde_json::to_string(&scores).map_err(|e| e.to_string())
        }
        "shift_card_footage" => {
            let segs: Vec<delve_planning::DrillingSegment> = if p.is_array() {
                de(&p)?
            } else {
                de_field(&p, "segments")?
            };
            let (slide, rotate, pct, hours) = delve_planning::shift_card_footage(&segs);
            serde_json::to_string(&serde_json::json!({
                "slide": slide,
                "rotate": rotate,
                "slide_pct": pct,
                "elapsed_hours": hours
            }))
            .map_err(|e| e.to_string())
        }
        "curve_recovery_demo" => {
            let demo = delve_planning::demo::curve_recovery_demo();
            serde_json::to_string(&demo).map_err(|e| e.to_string())
        }
        "assert_demo_story" => {
            let demo = delve_planning::demo::curve_recovery_demo();
            ser(delve_planning::demo::assert_demo_story(&demo))
        }
        other => Err(format!("Unknown engine op '{other}'")),
    }
}

#[derive(Debug, Deserialize)]
struct CenterlineReq {
    ref_intervals: Vec<delve_assurance::PathInterval>,
    off_intervals: Vec<delve_assurance::PathInterval>,
    ref_frame: delve_core::CoordinateFrame,
    off_frame: delve_core::CoordinateFrame,
    ref_md_range: (f64, f64),
    off_md_range: (f64, f64),
    exclude_ref: Option<(f64, f64)>,
    exclude_off: Option<(f64, f64)>,
    threshold: Option<f64>,
    to_m: f64,
}

fn de<T: serde::de::DeserializeOwned>(p: &Value) -> Result<T, String> {
    serde_json::from_value(p.clone()).map_err(|e| e.to_string())
}

fn de_field<T: serde::de::DeserializeOwned>(p: &Value, key: &str) -> Result<T, String> {
    serde_json::from_value(
        p.get(key)
            .cloned()
            .ok_or_else(|| format!("missing {key}"))?,
    )
    .map_err(|e| e.to_string())
}

fn num(p: &Value, key: &str) -> Result<f64, String> {
    p.get(key)
        .and_then(|v| v.as_f64())
        .ok_or_else(|| format!("missing number {key}"))
}

fn str_field(p: &Value, key: &str) -> Result<String, String> {
    p.get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("missing string {key}"))
}

fn ser<T: Serialize, E: ToString>(r: Result<T, E>) -> Result<String, String> {
    match r {
        Ok(v) => serde_json::to_string(&v).map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hold_dispatch() {
        let req = r#"{"op":"project_hold","payload":{"start":{"md":0,"inc_deg":0,"azi_deg":0,"north":0,"east":0,"tvd":0},"added_md":10,"unit":"imperial","class":"projected"}}"#;
        let out = engine_call_json(req).unwrap();
        assert!(out.contains("Hold INC/AZI"));
    }

    #[test]
    fn convert_length_dispatch() {
        let req =
            r#"{"op":"convert_length","payload":{"value":100,"from":"imperial","to":"metric"}}"#;
        let out = engine_call_json(req).unwrap();
        let v: f64 = serde_json::from_str(&out).unwrap();
        assert!((v - 30.48).abs() < 1e-9);
    }

    #[test]
    fn demo_dispatch() {
        let out = engine_call_json(r#"{"op":"curve_recovery_demo","payload":{}}"#).unwrap();
        assert!(out.contains("Curve Recovery"));
        assert!(out.contains("SYNTHETIC"));
    }
}
