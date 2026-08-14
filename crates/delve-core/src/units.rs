//! Canonical units: metres and radians internally.
//! Degrees and feet exist only at I/O boundaries.

pub const FT_TO_M: f64 = 0.3048;
pub const M_TO_FT: f64 = 1.0 / FT_TO_M;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UnitSystem {
    Metric,
    Imperial,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DlsDisplay {
    DegPer30m,
    DegPer100ft,
}

#[inline]
pub fn deg_to_rad(deg: f64) -> f64 {
    deg.to_radians()
}

#[inline]
pub fn rad_to_deg(rad: f64) -> f64 {
    rad.to_degrees()
}

#[inline]
pub fn ft_to_m(ft: f64) -> f64 {
    ft * FT_TO_M
}

#[inline]
pub fn m_to_ft(m: f64) -> f64 {
    m * M_TO_FT
}

/// Convert DLS in rad/m to presentation units.
pub fn dls_to_display(dls_rad_per_m: f64, display: DlsDisplay) -> f64 {
    let deg_per_m = rad_to_deg(dls_rad_per_m);
    match display {
        DlsDisplay::DegPer30m => deg_per_m * 30.0,
        DlsDisplay::DegPer100ft => deg_per_m * (100.0 * FT_TO_M),
    }
}

pub fn dls_from_display(value: f64, display: DlsDisplay) -> f64 {
    let deg_per_m = match display {
        DlsDisplay::DegPer30m => value / 30.0,
        DlsDisplay::DegPer100ft => value / (100.0 * FT_TO_M),
    };
    deg_to_rad(deg_per_m)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn foot_metre_roundtrip() {
        let m = ft_to_m(100.0);
        assert!((m_to_ft(m) - 100.0).abs() < 1e-12);
    }

    #[test]
    fn dls_units_are_not_relabels() {
        let dls = dls_from_display(3.0, DlsDisplay::DegPer100ft);
        let per_30 = dls_to_display(dls, DlsDisplay::DegPer30m);
        // 3°/100ft = 3° / 30.48 m ≈ 2.953°/30m
        assert!((per_30 - 2.952755905511811).abs() < 1e-9);
        assert!((dls_to_display(dls, DlsDisplay::DegPer100ft) - 3.0).abs() < 1e-12);
    }
}
