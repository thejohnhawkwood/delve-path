#![allow(clippy::too_many_arguments)]

//! Forward projections, plan constructors, and Flight Deck geometry.
//!
//! Survey reconstruction stays in `delve-core`. This crate never writes
//! projected or estimated points as measured stations.

pub mod demo;
pub mod error;
pub mod flight;
pub mod plan;
pub mod project;
pub mod sections;

pub use error::{PlanError, PlanIssue, PlanStatus};
pub use flight::*;
pub use plan::*;
pub use project::*;
pub use sections::*;
