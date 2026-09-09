//! Pure directional-survey domain. No Tauri, no SQLite, no UI.

pub mod convert;
pub mod frame;
pub mod geom;
pub mod interval;
pub mod min_curvature;
pub mod review;
pub mod types;
pub mod units;
pub mod validate;

pub use convert::{convert_length, convert_length_sq, lengths_equivalent};
pub use frame::{
    frames_comparable, CoordinateFrame, FrameIssue, NorthReference, VerticalDatumKind,
};
pub use geom::{
    attitude_from_tangent, azimuth_delta_rad, closure, dogleg_and_rf, high_side,
    interpolate_min_curvature, min_curvature_delta_m, right_side, unit_tangent, wrap_azimuth_deg,
    wrap_azimuth_rad, Vec3, SMALL_BETA_RAD,
};
pub use interval::{
    evaluate_at_md, evaluate_trajectory_at_md, min_curvature_chord_deviation_m, PathState,
};
pub use min_curvature::{calculate_trajectory, tangent_continue, tangent_to_tvd};
pub use review::{ReviewState, StationReview};
pub use types::*;
pub use units::*;
pub use validate::{has_blocking_error, validate_stations};

use thiserror::Error;

#[derive(Debug, Error)]
pub enum CalcError {
    #[error("validation failed")]
    Validation(Vec<ValidationIssue>),
    #[error("empty survey")]
    Empty,
    #[error("non-positive course length at station {index}")]
    NonPositiveCourse { index: usize },
    #[error("non-finite numerical result at station {index}")]
    Numerical { index: usize },
    #[error("MD {md} is outside the reconstructed survey range")]
    MdOutOfRange { md: f64 },
}

impl serde::Serialize for CalcError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
