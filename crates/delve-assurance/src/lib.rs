#![allow(
    clippy::too_many_arguments,
    clippy::needless_range_loop,
    clippy::len_zero
)]

//! Target geometry, depth transforms, centerline screening, and covariance.
//!
//! No UI, SQLite, or networking. Does not implement ISCWSA Rev 5 propagation.

pub mod centerline;
pub mod covariance;
pub mod depth;
pub mod target;

pub use centerline::*;
pub use covariance::*;
pub use depth::*;
pub use target::*;
