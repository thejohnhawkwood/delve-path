//! Typed depth coordinates. Elevation is normalized positive-up before any shift.

use delve_core::{evaluate_trajectory_at_md, Trajectory, UnitSystem};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq)]
pub enum DepthError {
    #[error("{0}")]
    Message(String),
}

impl serde::Serialize for DepthError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DatumKind {
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
pub struct DepthDatum {
    pub id: String,
    pub name: String,
    pub kind: DatumKind,
    /// Elevation relative to `permanent_vertical_datum`, stored as entered.
    pub elevation: f64,
    pub elevation_unit: UnitSystem,
    /// Must be normalized to positive-up before calculation.
    pub positive_direction: String,
    pub permanent_vertical_datum: String,
    pub source: String,
    pub date: String,
    pub notes: String,
}

/// Elevation positive up, in `unit`.
pub fn elevation_positive_up(d: &DepthDatum, unit: UnitSystem) -> f64 {
    let e = delve_core::convert_length(d.elevation, d.elevation_unit, unit);
    if d.positive_direction == "down" {
        -e
    } else {
        e
    }
}

/// Depth_at_target = Depth_at_source + E_target − E_source
/// after both elevations are positive-up in the same unit.
pub fn translate_depth(
    depth_source: f64,
    source: &DepthDatum,
    target: &DepthDatum,
    unit: UnitSystem,
) -> Result<f64, DepthError> {
    if source.permanent_vertical_datum != target.permanent_vertical_datum {
        return Err(DepthError::Message(
            "Datums do not share a named permanent vertical reference. No silent shift.".into(),
        ));
    }
    let es = elevation_positive_up(source, unit);
    let et = elevation_positive_up(target, unit);
    Ok(depth_source + et - es)
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MdOriginShift {
    pub source_id: String,
    pub target_id: String,
    /// Amount added when converting source-origin MD to target-origin MD.
    pub shift: f64,
    pub unit: UnitSystem,
    pub path_meaning: String,
    pub provenance: String,
    pub notes: String,
    pub colocated_vertical: bool,
}

pub fn convert_md(
    md_source: f64,
    source: &DepthDatum,
    target: &DepthDatum,
    unit: UnitSystem,
    shift: Option<&MdOriginShift>,
) -> Result<f64, DepthError> {
    if let Some(s) = shift {
        if s.colocated_vertical {
            return translate_depth(md_source, source, target, unit);
        }
        let add = delve_core::convert_length(s.shift, s.unit, unit);
        return Ok(md_source + add);
    }
    Err(DepthError::Message(
        "MD origin conversion requires an explicit signed mdOriginShiftSourceToTarget unless the references are colocated and connected by a vertical measured interval.".into(),
    ))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WirelineKind {
    ConstantOffset,
    AffineTwoPoint,
    PiecewiseLinear,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TiePoint {
    pub source_depth: f64,
    pub dest_depth: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WirelineMap {
    pub id: String,
    pub kind: WirelineKind,
    pub ties: Vec<TiePoint>,
    pub allow_extrapolation: bool,
    pub one_way: bool,
    pub source: String,
    pub notes: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WirelineApply {
    pub output: f64,
    pub scale: Option<f64>,
    pub offset: Option<f64>,
    pub residual: Option<f64>,
    pub extrapolated: bool,
    pub audit: String,
}

pub fn apply_wireline(
    map: &WirelineMap,
    source: f64,
    reverse: bool,
) -> Result<WirelineApply, DepthError> {
    if reverse && map.one_way {
        return Err(DepthError::Message(
            "This wireline mapping is one-way. Reverse conversion is blocked.".into(),
        ));
    }
    let mut ties = map.ties.clone();
    if reverse {
        for t in &mut ties {
            std::mem::swap(&mut t.source_depth, &mut t.dest_depth);
        }
    }
    validate_ties(&ties, !map.one_way || !reverse)?;
    match map.kind {
        WirelineKind::ConstantOffset => {
            if ties.is_empty() {
                return Err(DepthError::Message(
                    "Constant-offset map needs a tie.".into(),
                ));
            }
            let off = ties[0].dest_depth - ties[0].source_depth;
            Ok(WirelineApply {
                output: source + off,
                scale: Some(1.0),
                offset: Some(off),
                residual: Some(0.0),
                extrapolated: false,
                audit: format!("{source} → constant offset {off} → {}", source + off),
            })
        }
        WirelineKind::AffineTwoPoint => {
            if ties.len() < 2 {
                return Err(DepthError::Message("Affine map needs two ties.".into()));
            }
            let dx = ties[1].source_depth - ties[0].source_depth;
            if dx.abs() < 1e-12 {
                return Err(DepthError::Message("Affine source span is zero.".into()));
            }
            let scale = (ties[1].dest_depth - ties[0].dest_depth) / dx;
            let offset = ties[0].dest_depth - scale * ties[0].source_depth;
            let lo = ties[0].source_depth.min(ties[1].source_depth);
            let hi = ties[0].source_depth.max(ties[1].source_depth);
            let extra = source < lo - 1e-9 || source > hi + 1e-9;
            if extra && !map.allow_extrapolation {
                return Err(DepthError::Message(
                    "Source is outside the tie range. Extrapolation is blocked unless explicitly allowed and audited.".into(),
                ));
            }
            let out = scale * source + offset;
            Ok(WirelineApply {
                output: out,
                scale: Some(scale),
                offset: Some(offset),
                residual: Some(0.0),
                extrapolated: extra,
                audit: format!("{source} → affine scale={scale} offset={offset} → {out}"),
            })
        }
        WirelineKind::PiecewiseLinear => piecewise(&ties, source, map.allow_extrapolation),
    }
}

fn validate_ties(ties: &[TiePoint], bidirectional: bool) -> Result<(), DepthError> {
    if ties.len() < 1 {
        return Err(DepthError::Message("No tie points.".into()));
    }
    for w in ties.windows(2) {
        if (w[1].source_depth - w[0].source_depth).abs() < 1e-12 {
            return Err(DepthError::Message("Duplicate source tie depth.".into()));
        }
        if w[1].source_depth <= w[0].source_depth {
            return Err(DepthError::Message(
                "Source ties must be strictly monotone.".into(),
            ));
        }
        if bidirectional {
            if (w[1].dest_depth - w[0].dest_depth).abs() < 1e-12 {
                return Err(DepthError::Message(
                    "Duplicate destination tie depth.".into(),
                ));
            }
            if w[1].dest_depth <= w[0].dest_depth {
                return Err(DepthError::Message(
                    "Destination ties must be strictly monotone for a bidirectional mapping."
                        .into(),
                ));
            }
        }
    }
    Ok(())
}

fn piecewise(
    ties: &[TiePoint],
    source: f64,
    allow_extra: bool,
) -> Result<WirelineApply, DepthError> {
    if ties.len() < 2 {
        return Err(DepthError::Message(
            "Piecewise map needs two or more ties.".into(),
        ));
    }
    if source < ties[0].source_depth - 1e-9 || source > ties.last().unwrap().source_depth + 1e-9 {
        if !allow_extra {
            return Err(DepthError::Message(
                "Source is outside the interpolation span. Extrapolation is blocked.".into(),
            ));
        }
        let (a, b) = if source < ties[0].source_depth {
            (&ties[0], &ties[1])
        } else {
            (&ties[ties.len() - 2], &ties[ties.len() - 1])
        };
        let t = (source - a.source_depth) / (b.source_depth - a.source_depth);
        let out = a.dest_depth + t * (b.dest_depth - a.dest_depth);
        return Ok(WirelineApply {
            output: out,
            scale: Some((b.dest_depth - a.dest_depth) / (b.source_depth - a.source_depth)),
            offset: None,
            residual: None,
            extrapolated: true,
            audit: format!("{source} → piecewise (extrapolated) → {out}"),
        });
    }
    for w in ties.windows(2) {
        if source >= w[0].source_depth - 1e-12 && source <= w[1].source_depth + 1e-12 {
            let t = (source - w[0].source_depth) / (w[1].source_depth - w[0].source_depth);
            let out = w[0].dest_depth + t * (w[1].dest_depth - w[0].dest_depth);
            return Ok(WirelineApply {
                output: out,
                scale: Some(
                    (w[1].dest_depth - w[0].dest_depth) / (w[1].source_depth - w[0].source_depth),
                ),
                offset: None,
                residual: None,
                extrapolated: false,
                audit: format!(
                    "{source} → piecewise span [{}, {}] → {out}",
                    w[0].source_depth, w[1].source_depth
                ),
            });
        }
    }
    Err(DepthError::Message("Tie span miss.".into()))
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ZoneMarker {
    pub id: String,
    pub name: String,
    pub depth: f64,
    pub depth_kind: String,
    pub datum_id: String,
    pub notes: String,
}

/// MD candidates for a TVD. Upgoing paths may return more than one.
pub fn md_for_tvd(traj: &Trajectory, tvd: f64) -> Vec<f64> {
    let mut out = Vec::new();
    let st = &traj.stations;
    for w in st.windows(2) {
        let (a, b) = (&w[0], &w[1]);
        let dt = b.tvd - a.tvd;
        if dt.abs() < 1e-12 {
            if (a.tvd - tvd).abs() < 1e-9 {
                out.push(a.md);
            }
            continue;
        }
        let t = (tvd - a.tvd) / dt;
        if (0.0..=1.0).contains(&t) {
            if let Ok(s) = evaluate_trajectory_at_md(traj, a.md + t * (b.md - a.md)) {
                if (s.tvd - tvd).abs() < 0.05 * (b.md - a.md).abs().max(1.0) {
                    out.push(s.md);
                }
            }
        }
    }
    out.sort_by(|a, b| a.partial_cmp(b).unwrap());
    out.dedup_by(|a, b| (*a - *b).abs() < 1e-6);
    out
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DepthAudit {
    pub original: f64,
    pub source_datum: String,
    pub transforms: Vec<String>,
    pub reported: f64,
    pub reported_label: String,
}

pub fn tvd_msl_positive_down(
    tvd_at_datum: f64,
    datum: &DepthDatum,
    msl: &DepthDatum,
    unit: UnitSystem,
) -> Result<f64, DepthError> {
    translate_depth(tvd_at_datum, datum, msl, unit)
}

pub fn elevation_msl_positive_up(tvd_msl_down: f64) -> f64 {
    -tvd_msl_down
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rkb() -> DepthDatum {
        DepthDatum {
            id: "rkb".into(),
            name: "RKB".into(),
            kind: DatumKind::Rkb,
            elevation: 32.0,
            elevation_unit: UnitSystem::Imperial,
            positive_direction: "up".into(),
            permanent_vertical_datum: "MSL".into(),
            source: "survey".into(),
            date: "2026-01-01".into(),
            notes: "".into(),
        }
    }
    fn rt() -> DepthDatum {
        DepthDatum {
            id: "rt".into(),
            name: "RT".into(),
            kind: DatumKind::Rt,
            elevation: 30.0,
            elevation_unit: UnitSystem::Imperial,
            positive_direction: "up".into(),
            permanent_vertical_datum: "MSL".into(),
            source: "survey".into(),
            date: "2026-01-01".into(),
            notes: "".into(),
        }
    }
    fn msl() -> DepthDatum {
        DepthDatum {
            id: "msl".into(),
            name: "MSL".into(),
            kind: DatumKind::Msl,
            elevation: 0.0,
            elevation_unit: UnitSystem::Imperial,
            positive_direction: "up".into(),
            permanent_vertical_datum: "MSL".into(),
            source: "survey".into(),
            date: "2026-01-01".into(),
            notes: "".into(),
        }
    }

    #[test]
    fn rkb_rt_sign() {
        let d = translate_depth(1000.0, &rkb(), &rt(), UnitSystem::Imperial).unwrap();
        // E_rt - E_rkb = 30 - 32 = -2 → 1000 - 2 = 998
        assert!((d - 998.0).abs() < 1e-12);
        let back = translate_depth(d, &rt(), &rkb(), UnitSystem::Imperial).unwrap();
        assert!((back - 1000.0).abs() < 1e-12);
    }

    #[test]
    fn tvd_msl_and_elevation() {
        let tvd_msl = tvd_msl_positive_down(1000.0, &rkb(), &msl(), UnitSystem::Imperial).unwrap();
        // E_msl - E_rkb = 0 - 32 = -32 → 968
        assert!((tvd_msl - 968.0).abs() < 1e-12);
        assert!((elevation_msl_positive_up(tvd_msl) + 968.0).abs() < 1e-12);
    }

    #[test]
    fn down_stored_elevation_is_normalized() {
        let mut weird = rkb();
        weird.elevation = -32.0;
        weird.positive_direction = "down".into();
        let d = translate_depth(1000.0, &weird, &msl(), UnitSystem::Imperial).unwrap();
        assert!((d - 968.0).abs() < 1e-12);
    }

    #[test]
    fn md_requires_explicit_shift() {
        assert!(convert_md(100.0, &rkb(), &rt(), UnitSystem::Imperial, None).is_err());
        let shift = MdOriginShift {
            source_id: "rkb".into(),
            target_id: "rt".into(),
            shift: -2.0,
            unit: UnitSystem::Imperial,
            path_meaning: "RKB to RT along a vertical connector".into(),
            provenance: "user".into(),
            notes: "".into(),
            colocated_vertical: false,
        };
        assert!(
            (convert_md(100.0, &rkb(), &rt(), UnitSystem::Imperial, Some(&shift)).unwrap() - 98.0)
                .abs()
                < 1e-12
        );
    }

    #[test]
    fn wireline_affine_and_reject_duplicate() {
        let map = WirelineMap {
            id: "w".into(),
            kind: WirelineKind::AffineTwoPoint,
            ties: vec![
                TiePoint {
                    source_depth: 1000.0,
                    dest_depth: 1002.0,
                },
                TiePoint {
                    source_depth: 2000.0,
                    dest_depth: 2004.0,
                },
            ],
            allow_extrapolation: false,
            one_way: false,
            source: "test".into(),
            notes: "".into(),
        };
        let a = apply_wireline(&map, 1500.0, false).unwrap();
        assert!((a.output - 1503.0).abs() < 1e-9);
        assert!(apply_wireline(&map, 500.0, false).is_err());
        let mut dup = map.clone();
        dup.ties[1].source_depth = 1000.0;
        assert!(apply_wireline(&dup, 1500.0, false).is_err());
    }

    #[test]
    fn one_way_blocks_reverse() {
        let map = WirelineMap {
            id: "w".into(),
            kind: WirelineKind::ConstantOffset,
            ties: vec![TiePoint {
                source_depth: 0.0,
                dest_depth: 2.0,
            }],
            allow_extrapolation: false,
            one_way: true,
            source: "test".into(),
            notes: "".into(),
        };
        assert!(apply_wireline(&map, 10.0, true).is_err());
        assert!((apply_wireline(&map, 10.0, false).unwrap().output - 12.0).abs() < 1e-12);
    }
}
