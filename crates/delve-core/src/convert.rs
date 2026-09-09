//! Atomic length-unit conversion. Silent relabelling is forbidden.
//!
//! Changing the hole unit system must convert every affected raw length,
//! or be blocked. Numbers are never reinterpreted under a new label.

use crate::units::{ft_to_m, m_to_ft, UnitSystem};

pub fn convert_length(value: f64, from: UnitSystem, to: UnitSystem) -> f64 {
    if from == to {
        return value;
    }
    match (from, to) {
        (UnitSystem::Imperial, UnitSystem::Metric) => ft_to_m(value),
        (UnitSystem::Metric, UnitSystem::Imperial) => m_to_ft(value),
        _ => value,
    }
}

/// Convert a length-squared quantity (covariance, area).
pub fn convert_length_sq(value: f64, from: UnitSystem, to: UnitSystem) -> f64 {
    let s = convert_length(1.0, from, to);
    value * s * s
}

/// True when two lengths represent the same physical distance in different units.
pub fn lengths_equivalent(
    a: f64,
    unit_a: UnitSystem,
    b: f64,
    unit_b: UnitSystem,
    tol_m: f64,
) -> bool {
    let am = convert_length(a, unit_a, UnitSystem::Metric);
    let bm = convert_length(b, unit_b, UnitSystem::Metric);
    (am - bm).abs() <= tol_m
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn foot_to_metre_is_conversion_not_relabel() {
        let md_ft = 100.0;
        let md_m = convert_length(md_ft, UnitSystem::Imperial, UnitSystem::Metric);
        assert!((md_m - 30.48).abs() < 1e-12);
        assert!(
            (md_m - 100.0).abs() > 1.0,
            "must not silently relabel 100 ft as 100 m"
        );
        let back = convert_length(md_m, UnitSystem::Metric, UnitSystem::Imperial);
        assert!((back - 100.0).abs() < 1e-12);
    }

    #[test]
    fn same_unit_is_identity() {
        assert_eq!(
            convert_length(12.5, UnitSystem::Imperial, UnitSystem::Imperial),
            12.5
        );
    }

    #[test]
    fn covariance_scales_as_length_squared() {
        let c_ft2 = 4.0;
        let c_m2 = convert_length_sq(c_ft2, UnitSystem::Imperial, UnitSystem::Metric);
        assert!((c_m2 - 4.0 * 0.3048 * 0.3048).abs() < 1e-12);
    }

    #[test]
    fn metric_imperial_survey_lengths_are_equivalent() {
        assert!(lengths_equivalent(
            30.48,
            UnitSystem::Metric,
            100.0,
            UnitSystem::Imperial,
            1e-9
        ));
    }
}
