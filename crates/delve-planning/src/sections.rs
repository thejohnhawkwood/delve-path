//! Versioned, typed plan-section parameters. Persist inputs and solved values.

use crate::project::{DlsRefLength, ProjectionMethod};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SectionKind {
    Hold,
    BuildDropToInc,
    BuildTurn,
    DlsToolface,
    TangentToTarget,
    Marker,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SolveUnknown {
    Kop,
    Dls,
    HoldAngle,
    TangentLength,
    CurveLength,
    Toolface,
    HoldLength,
    EndMd,
    None,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SectionParams {
    Hold {
        length: Option<f64>,
        end_md: Option<f64>,
        inc_deg: Option<f64>,
        azi_deg: Option<f64>,
    },
    BuildDropToInc {
        end_inc_deg: f64,
        dls_display: Option<f64>,
        dls_ref: DlsRefLength,
        azi_deg: Option<f64>,
    },
    BuildTurn {
        build_deg_per_ref: f64,
        turn_deg_per_ref: f64,
        rate_ref: DlsRefLength,
        length: Option<f64>,
        end_md: Option<f64>,
    },
    DlsToolface {
        dls_display: f64,
        dls_ref: DlsRefLength,
        toolface_deg: f64,
        method: ProjectionMethod,
        length: Option<f64>,
        dogleg_plane_azi_deg: Option<f64>,
    },
    TangentToTarget {
        target_id: Option<String>,
    },
    Marker {
        name: String,
        md: Option<f64>,
        tvd: Option<f64>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CorridorTol {
    pub up_down: f64,
    pub left_right: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlanSection {
    pub id: String,
    pub seq: i64,
    pub params: SectionParams,
    pub locked: Vec<String>,
    pub solve_for: SolveUnknown,
    pub corridor: Option<CorridorTol>,
    pub solved_end_md: Option<f64>,
    pub solved_end_tvd: Option<f64>,
    pub solved_inc_deg: Option<f64>,
    pub solved_azi_deg: Option<f64>,
    pub solved_dls: Option<f64>,
    pub solved_tf_deg: Option<f64>,
    pub residual_md: Option<f64>,
    pub residual_tvd: Option<f64>,
    pub residual_n: Option<f64>,
    pub residual_e: Option<f64>,
    pub status: String,
    pub source: String,
    pub notes: String,
}

impl PlanSection {
    pub fn hold(id: impl Into<String>, seq: i64, length: f64) -> Self {
        Self {
            id: id.into(),
            seq,
            params: SectionParams::Hold {
                length: Some(length),
                end_md: None,
                inc_deg: None,
                azi_deg: None,
            },
            locked: vec!["length".into()],
            solve_for: SolveUnknown::None,
            corridor: None,
            solved_end_md: None,
            solved_end_tvd: None,
            solved_inc_deg: None,
            solved_azi_deg: None,
            solved_dls: None,
            solved_tf_deg: None,
            residual_md: None,
            residual_tvd: None,
            residual_n: None,
            residual_e: None,
            status: "draft".into(),
            source: "manual".into(),
            notes: String::new(),
        }
    }
}
