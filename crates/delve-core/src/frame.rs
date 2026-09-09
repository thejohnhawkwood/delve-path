//! Project/hole coordinate-frame metadata.
//!
//! Two paths are comparable only when unit, local origin, north reference,
//! and vertical datum are all known and agree. This crate does not perform
//! geodetic transformations.

use crate::types::AzimuthReference;
use crate::units::UnitSystem;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum NorthReference {
    True,
    Grid,
    Magnetic,
    #[default]
    Unknown,
}

impl From<AzimuthReference> for NorthReference {
    fn from(v: AzimuthReference) -> Self {
        match v {
            AzimuthReference::True => Self::True,
            AzimuthReference::Grid => Self::Grid,
            AzimuthReference::Magnetic => Self::Magnetic,
            AzimuthReference::Unknown => Self::Unknown,
        }
    }
}

impl From<NorthReference> for AzimuthReference {
    fn from(v: NorthReference) -> Self {
        match v {
            NorthReference::True => Self::True,
            NorthReference::Grid => Self::Grid,
            NorthReference::Magnetic => Self::Magnetic,
            NorthReference::Unknown => Self::Unknown,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum VerticalDatumKind {
    #[default]
    Unspecified,
    Rkb,
    Kb,
    Rt,
    Df,
    Gl,
    Msl,
    Lat,
    Custom,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CoordinateFrame {
    pub unit_system: UnitSystem,
    pub north_reference: NorthReference,
    /// User-visible origin identifier (e.g. wellhead, slot A).
    pub origin_id: String,
    /// Local +N offset of the origin in `unit_system`.
    pub origin_north: f64,
    /// Local +E offset of the origin in `unit_system`.
    pub origin_east: f64,
    pub vertical_datum: VerticalDatumKind,
    pub vertical_datum_name: String,
    /// Optional EPSG code. Stored only; no transform is applied.
    pub crs_epsg: Option<i32>,
    pub crs_note: String,
}

impl CoordinateFrame {
    pub fn unspecified(unit: UnitSystem, north: AzimuthReference) -> Self {
        Self {
            unit_system: unit,
            north_reference: north.into(),
            origin_id: "unspecified".into(),
            origin_north: 0.0,
            origin_east: 0.0,
            vertical_datum: VerticalDatumKind::Unspecified,
            vertical_datum_name: String::new(),
            crs_epsg: None,
            crs_note: String::new(),
        }
    }

    pub fn wellhead(unit: UnitSystem, north: AzimuthReference) -> Self {
        Self {
            origin_id: "wellhead".into(),
            ..Self::unspecified(unit, north)
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FrameIssue {
    pub code: String,
    pub message: String,
}

/// Returns Ok when both frames are known and agree closely enough to compare paths.
pub fn frames_comparable(a: &CoordinateFrame, b: &CoordinateFrame) -> Result<(), Vec<FrameIssue>> {
    let mut issues = Vec::new();
    if ![a.origin_north, a.origin_east, b.origin_north, b.origin_east]
        .iter()
        .all(|x| x.is_finite())
    {
        issues.push(FrameIssue {
            code: "origin_non_finite".into(),
            message: "Origin coordinates must be finite.".into(),
        });
    }
    if a.crs_epsg != b.crs_epsg {
        issues.push(FrameIssue { code: "crs_mismatch".into(), message: "CRS identifiers differ or are missing on one path. No geodetic transform is applied.".into() });
    }
    if a.unit_system != b.unit_system {
        issues.push(FrameIssue {
            code: "unit_mismatch".into(),
            message: format!(
                "Length units differ ({:?} vs {:?}). Convert or copy before comparing paths.",
                a.unit_system, b.unit_system
            ),
        });
    }
    if a.north_reference == NorthReference::Unknown || b.north_reference == NorthReference::Unknown
    {
        issues.push(FrameIssue {
            code: "north_unknown".into(),
            message: "North reference is unknown on one or both paths. Comparable only after an explicit north is recorded.".into(),
        });
    } else if a.north_reference != b.north_reference {
        issues.push(FrameIssue {
            code: "north_mismatch".into(),
            message: format!(
                "North references differ ({:?} vs {:?}). No silent rotation is applied.",
                a.north_reference, b.north_reference
            ),
        });
    }
    if a.origin_id.trim().is_empty()
        || b.origin_id.trim().is_empty()
        || a.origin_id == "unspecified"
        || b.origin_id == "unspecified"
    {
        issues.push(FrameIssue {
            code: "origin_unknown".into(),
            message: "Local N/E origin identifier is unspecified. Comparable only after both paths name the same origin.".into(),
        });
    } else if a.origin_id != b.origin_id {
        issues.push(FrameIssue {
            code: "origin_mismatch".into(),
            message: format!(
                "Local origins differ ({} vs {}). No silent translation is applied.",
                a.origin_id, b.origin_id
            ),
        });
    }
    if (a.origin_north - b.origin_north).abs() > 1e-9
        || (a.origin_east - b.origin_east).abs() > 1e-9
    {
        issues.push(FrameIssue {
            code: "origin_offset_mismatch".into(),
            message: "Local origin N/E offsets differ. No silent translation is applied.".into(),
        });
    }
    if a.vertical_datum == VerticalDatumKind::Unspecified
        || b.vertical_datum == VerticalDatumKind::Unspecified
    {
        issues.push(FrameIssue {
            code: "datum_unknown".into(),
            message: "Vertical datum is unspecified on one or both paths.".into(),
        });
    } else if a.vertical_datum != b.vertical_datum || a.vertical_datum_name != b.vertical_datum_name
    {
        issues.push(FrameIssue {
            code: "datum_mismatch".into(),
            message: "Vertical datums differ. No silent datum shift is applied.".into(),
        });
    }
    if issues.is_empty() {
        Ok(())
    } else {
        Err(issues)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::AzimuthReference;

    #[test]
    fn parent_child_same_frame_is_comparable() {
        let mut a = CoordinateFrame::wellhead(UnitSystem::Imperial, AzimuthReference::Grid);
        a.vertical_datum = VerticalDatumKind::Rkb;
        a.vertical_datum_name = "RKB".into();
        let b = a.clone();
        assert!(frames_comparable(&a, &b).is_ok());
    }

    #[test]
    fn unknown_north_blocks() {
        let a = CoordinateFrame::wellhead(UnitSystem::Imperial, AzimuthReference::Unknown);
        let b = a.clone();
        let err = frames_comparable(&a, &b).unwrap_err();
        assert!(err.iter().any(|i| i.code == "north_unknown"));
    }

    #[test]
    fn unit_mismatch_blocks() {
        let mut a = CoordinateFrame::wellhead(UnitSystem::Imperial, AzimuthReference::True);
        a.vertical_datum = VerticalDatumKind::Msl;
        let mut b = a.clone();
        b.unit_system = UnitSystem::Metric;
        let err = frames_comparable(&a, &b).unwrap_err();
        assert!(err.iter().any(|i| i.code == "unit_mismatch"));
    }

    #[test]
    fn conflicting_crs_and_nonfinite_origin_block() {
        let mut a = CoordinateFrame::wellhead(UnitSystem::Metric, AzimuthReference::Grid);
        a.vertical_datum = VerticalDatumKind::Rkb;
        let mut b = a.clone();
        b.crs_epsg = Some(26912);
        assert!(frames_comparable(&a, &b)
            .unwrap_err()
            .iter()
            .any(|i| i.code == "crs_mismatch"));
        b = a.clone();
        b.origin_east = f64::NAN;
        assert!(frames_comparable(&a, &b)
            .unwrap_err()
            .iter()
            .any(|i| i.code == "origin_non_finite"));
    }
}
