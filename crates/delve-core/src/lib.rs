//! Pure directional-survey domain. No Tauri, no SQLite, no UI.

pub mod min_curvature;
pub mod types;
pub mod units;
pub mod validate;

pub use min_curvature::{calculate_trajectory, tangent_continue, tangent_to_tvd, SMALL_BETA_RAD};
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
}

impl serde::Serialize for CalcError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
