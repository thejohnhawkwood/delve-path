//! Thin WebAssembly bridge over `delve-core`.
//!
//! `delve-core` stays unaware of the browser. This crate only converts
//! JavaScript values to the same `HoleCalcInput` the Tauri host uses.

use delve_core::{
    calculate_trajectory, tangent_continue, tangent_to_tvd, validate_stations, CalcError,
    HoleCalcInput, StationClass, Trajectory, ValidationIssue,
};

/// Shared calculation entry used by native tests and the wasm bindgen layer.
pub fn calculate_req(req: &HoleCalcInput) -> Result<Trajectory, CalcError> {
    calculate_trajectory(req)
}

pub fn validate_req(req: &HoleCalcInput) -> Vec<ValidationIssue> {
    validate_stations(req.convention, &req.stations)
}

pub fn project_tangent_md_req(req: &HoleCalcInput, added_md: f64) -> Result<Trajectory, CalcError> {
    tangent_continue(
        req,
        added_md,
        StationClass::Projected,
        "PROJECTED — Straight Line continuation (hold I/A)",
    )
}

pub fn project_tangent_tvd_req(
    req: &HoleCalcInput,
    target_tvd: f64,
) -> Result<Trajectory, CalcError> {
    tangent_to_tvd(
        req,
        target_tvd,
        StationClass::Projected,
        "PROJECTED — Straight Line to TVD (hold I/A)",
    )
}

pub fn project_tangent_bit_req(
    req: &HoleCalcInput,
    bit_to_sensor: f64,
) -> Result<Trajectory, CalcError> {
    tangent_continue(
        req,
        bit_to_sensor,
        StationClass::Projected,
        "PROJECTED — Straight Line bit projection (hold I/A; not WinSERVE BHL trend)",
    )
}

#[cfg(target_arch = "wasm32")]
mod bindgen_api {
    use super::*;
    use wasm_bindgen::prelude::*;

    fn js_err(e: impl ToString) -> JsValue {
        JsValue::from_str(&e.to_string())
    }

    fn parse_req(req: JsValue) -> Result<HoleCalcInput, JsValue> {
        serde_wasm_bindgen::from_value(req).map_err(js_err)
    }

    fn to_js<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(value).map_err(js_err)
    }

    #[wasm_bindgen]
    pub fn calculate(req: JsValue) -> Result<JsValue, JsValue> {
        let req = parse_req(req)?;
        to_js(&calculate_req(&req).map_err(js_err)?)
    }

    #[wasm_bindgen]
    pub fn validate_survey(req: JsValue) -> Result<JsValue, JsValue> {
        let req = parse_req(req)?;
        to_js(&validate_req(&req))
    }

    #[wasm_bindgen]
    pub fn project_tangent_md(req: JsValue, added_md: f64) -> Result<JsValue, JsValue> {
        let req = parse_req(req)?;
        to_js(&project_tangent_md_req(&req, added_md).map_err(js_err)?)
    }

    #[wasm_bindgen]
    pub fn project_tangent_tvd(req: JsValue, target_tvd: f64) -> Result<JsValue, JsValue> {
        let req = parse_req(req)?;
        to_js(&project_tangent_tvd_req(&req, target_tvd).map_err(js_err)?)
    }

    #[wasm_bindgen]
    pub fn project_tangent_bit(req: JsValue, bit_to_sensor: f64) -> Result<JsValue, JsValue> {
        let req = parse_req(req)?;
        to_js(&project_tangent_bit_req(&req, bit_to_sensor).map_err(js_err)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use delve_core::{
        AzimuthReference, MeasuredStation, StationSource, SurveyConvention, TieIn, UnitSystem,
    };

    fn st(md: f64, inc: f64, azi: f64) -> MeasuredStation {
        MeasuredStation {
            md,
            inc_deg: inc,
            azi_deg: azi,
            comment: String::new(),
            class: delve_core::StationClass::Measured,
            source: StationSource::Manual,
        }
    }

    fn metric(stations: Vec<MeasuredStation>, vsp: f64, tie: TieIn) -> HoleCalcInput {
        HoleCalcInput {
            unit_system: UnitSystem::Metric,
            convention: SurveyConvention::OilfieldFromVertical,
            azimuth_reference: AzimuthReference::Unknown,
            vsp_deg: vsp,
            tie_in: tie,
            stations,
        }
    }

    fn zero_tie() -> TieIn {
        TieIn {
            tvd: 0.0,
            north: 0.0,
            east: 0.0,
        }
    }

    #[test]
    fn l1_vertical() {
        let t = calculate_req(&metric(
            vec![
                st(0.0, 0.0, 123.0),
                st(100.0, 0.0, 123.0),
                st(250.0, 0.0, 40.0),
            ],
            0.0,
            zero_tie(),
        ))
        .unwrap();
        for s in &t.stations {
            assert!(s.north.abs() < 1e-12);
            assert!(s.east.abs() < 1e-12);
        }
        assert!((t.stations[2].tvd - 250.0).abs() < 1e-12);
    }

    #[test]
    fn l1_due_north() {
        let t = calculate_req(&metric(
            vec![st(0.0, 30.0, 0.0), st(100.0, 30.0, 0.0)],
            0.0,
            zero_tie(),
        ))
        .unwrap();
        assert!(t.stations[1].east.abs() < 1e-12);
        assert!(t.stations[1].north > 0.0);
    }

    #[test]
    fn l1_due_east() {
        let t = calculate_req(&metric(
            vec![st(0.0, 30.0, 90.0), st(100.0, 30.0, 90.0)],
            90.0,
            zero_tie(),
        ))
        .unwrap();
        assert!(t.stations[1].north.abs() < 1e-12);
        assert!(t.stations[1].east > 0.0);
    }

    #[test]
    fn l1_azimuth_wrap() {
        let t = calculate_req(&metric(
            vec![st(0.0, 10.0, 359.0), st(30.0, 10.0, 1.0)],
            0.0,
            zero_tie(),
        ))
        .unwrap();
        assert!(t.stations[1].dogleg_deg < 3.0);
        assert!(t.stations[1].dogleg_deg > 0.1);
    }

    #[test]
    fn l1_near_zero_dogleg() {
        let t = calculate_req(&metric(
            vec![st(0.0, 45.0, 90.0), st(50.0, 45.0, 90.0)],
            90.0,
            zero_tie(),
        ))
        .unwrap();
        assert!(t.stations[1].dls.abs() < 1e-9);
    }

    #[test]
    fn l1_cross_horizontal() {
        let t = calculate_req(&metric(
            vec![st(0.0, 85.0, 0.0), st(30.0, 90.0, 0.0), st(60.0, 95.0, 0.0)],
            0.0,
            TieIn {
                tvd: 1000.0,
                north: 0.0,
                east: 0.0,
            },
        ))
        .unwrap();
        assert!(t.stations[1].tvd > t.stations[0].tvd);
        assert!(t.stations[2].tvd < t.stations[1].tvd);
    }

    #[test]
    fn l1_vsp_independence() {
        let stations = vec![st(0.0, 20.0, 45.0), st(100.0, 25.0, 50.0)];
        let a = calculate_req(&metric(stations.clone(), 0.0, zero_tie())).unwrap();
        let b = calculate_req(&metric(stations, 90.0, zero_tie())).unwrap();
        assert!((a.stations[1].north - b.stations[1].north).abs() < 1e-12);
        assert!((a.stations[1].vs - b.stations[1].vs).abs() > 1.0);
    }

    #[test]
    fn l1_unit_equivalence() {
        let metric_t = calculate_req(&metric(
            vec![st(0.0, 30.0, 0.0), st(30.48, 30.0, 0.0)],
            0.0,
            zero_tie(),
        ))
        .unwrap();
        let imperial = calculate_req(&HoleCalcInput {
            unit_system: UnitSystem::Imperial,
            convention: SurveyConvention::OilfieldFromVertical,
            azimuth_reference: AzimuthReference::Unknown,
            vsp_deg: 0.0,
            tie_in: zero_tie(),
            stations: vec![st(0.0, 30.0, 0.0), st(100.0, 30.0, 0.0)],
        })
        .unwrap();
        let n_m = delve_core::ft_to_m(imperial.stations[1].north);
        assert!((n_m - metric_t.stations[1].north).abs() < 1e-9);
    }

    #[test]
    fn l1_tie_in() {
        let t = calculate_req(&metric(
            vec![st(1500.0, 2.0, 300.0), st(1600.0, 2.0, 300.0)],
            0.0,
            TieIn {
                tvd: 1499.7,
                north: 13.09,
                east: 22.67,
            },
        ))
        .unwrap();
        assert!((t.stations[0].tvd - 1499.7).abs() < 1e-12);
        assert!(t.stations[1].tvd > 1499.7);
    }

    #[test]
    fn decreasing_md_is_error() {
        let issues = validate_req(&metric(
            vec![st(100.0, 0.0, 0.0), st(90.0, 0.0, 0.0)],
            0.0,
            zero_tie(),
        ));
        assert!(issues.iter().any(|i| i.code == "md_decreasing"));
        assert!(calculate_req(&metric(
            vec![st(100.0, 0.0, 0.0), st(90.0, 0.0, 0.0)],
            0.0,
            zero_tie()
        ))
        .is_err());
    }

    #[test]
    fn duplicate_md_is_error() {
        let issues = validate_req(&metric(
            vec![st(100.0, 0.0, 0.0), st(100.0, 1.0, 0.0)],
            0.0,
            zero_tie(),
        ));
        assert!(issues.iter().any(|i| i.code == "md_duplicate"));
    }

    #[test]
    fn high_angle_hold() {
        let t = calculate_req(&metric(
            vec![st(0.0, 90.0, 90.0), st(100.0, 90.0, 90.0)],
            90.0,
            zero_tie(),
        ))
        .unwrap();
        assert!((t.stations[1].east - 100.0).abs() < 1e-9);
        assert!(t.stations[1].tvd.abs() < 1e-9);
        assert!(t.stations[1].north.abs() < 1e-9);
    }

    #[test]
    fn tangent_md_is_projected() {
        let t = project_tangent_md_req(
            &metric(
                vec![st(0.0, 0.0, 0.0), st(100.0, 0.0, 0.0)],
                0.0,
                zero_tie(),
            ),
            50.0,
        )
        .unwrap();
        let last = t.stations.last().unwrap();
        assert_eq!(last.class, StationClass::Projected);
        assert!((last.md - 150.0).abs() < 1e-12);
        assert!(last.comment.contains("PROJECTED"));
    }

    #[test]
    fn tangent_tvd_is_projected() {
        let t = project_tangent_tvd_req(
            &metric(
                vec![st(0.0, 0.0, 0.0), st(100.0, 0.0, 0.0)],
                0.0,
                zero_tie(),
            ),
            160.0,
        )
        .unwrap();
        let last = t.stations.last().unwrap();
        assert_eq!(last.class, StationClass::Projected);
        assert!((last.tvd - 160.0).abs() < 1e-9);
    }

    #[test]
    fn bit_projection_is_projected() {
        let t = project_tangent_bit_req(
            &metric(
                vec![st(0.0, 0.0, 0.0), st(100.0, 0.0, 0.0)],
                0.0,
                zero_tie(),
            ),
            60.0,
        )
        .unwrap();
        assert_eq!(t.stations.last().unwrap().class, StationClass::Projected);
        assert!((t.stations.last().unwrap().md - 160.0).abs() < 1e-12);
    }
}
