use crate::units::UnitSystem;
use serde::{Deserialize, Serialize};

/// MVP implements oilfield inclination-from-vertical only.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SurveyConvention {
    OilfieldFromVertical,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AzimuthReference {
    True,
    Grid,
    Magnetic,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StationClass {
    Measured,
    Projected,
    Planned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StationSource {
    Manual,
    Paste,
    Csv,
    TieIn,
}

/// Measured / input station. Angles in degrees at this I/O type; core converts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MeasuredStation {
    pub md: f64,
    pub inc_deg: f64,
    pub azi_deg: f64,
    pub comment: String,
    pub class: StationClass,
    pub source: StationSource,
}

/// First-station position (tie-in). Lengths in the hole unit system.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct TieIn {
    pub tvd: f64,
    pub north: f64,
    pub east: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HoleCalcInput {
    pub unit_system: UnitSystem,
    pub convention: SurveyConvention,
    pub azimuth_reference: AzimuthReference,
    /// Vertical section plane, degrees, same north as surveys.
    pub vsp_deg: f64,
    pub tie_in: TieIn,
    pub stations: Vec<MeasuredStation>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CalculatedStation {
    pub md: f64,
    pub inc_deg: f64,
    pub azi_deg: f64,
    pub tvd: f64,
    pub north: f64,
    pub east: f64,
    pub vs: f64,
    pub closure: f64,
    pub closure_azi_deg: f64,
    /// Dogleg angle of the incoming interval, degrees (0 at first station).
    pub dogleg_deg: f64,
    /// DLS of the incoming interval in the hole's display convention.
    pub dls: f64,
    pub comment: String,
    pub class: StationClass,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Trajectory {
    pub unit_system: UnitSystem,
    pub convention: SurveyConvention,
    pub azimuth_reference: AzimuthReference,
    pub vsp_deg: f64,
    pub stations: Vec<CalculatedStation>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ValidationIssue {
    pub severity: Severity,
    pub index: Option<usize>,
    pub code: String,
    pub message: String,
}
