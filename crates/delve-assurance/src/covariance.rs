//! Offline imported NEV covariance. Not ISCWSA Rev 5 propagation.
//! Not a DelvePath-certified compliance result.

use delve_core::{convert_length, convert_length_sq, UnitSystem};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq)]
pub enum CovError {
    #[error("{0}")]
    Message(String),
}

impl serde::Serialize for CovError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MatrixBasis {
    OneSigmaCovariance,
    ScaledMatrix,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImportedCovariance {
    pub md: f64,
    pub c_nn: f64,
    pub c_ne: f64,
    pub c_nv: f64,
    pub c_ee: f64,
    pub c_ev: f64,
    pub c_vv: f64,
    pub length_unit: UnitSystem,
    pub covariance_unit: UnitSystem,
    pub basis: MatrixBasis,
    pub source_dimension: Option<u32>,
    pub source_probability: Option<f64>,
    pub source_k: Option<f64>,
    pub provider: String,
    pub model: String,
    pub version: String,
    pub source_timestamp: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OneSigmaNev {
    pub md: f64,
    pub c: [[f64; 3]; 3],
    pub provenance: String,
}

/// k = sqrt(χ²_d(p)) for a stated p-confidence region in d dimensions.
pub fn chi2_k(dim: u32, p: f64) -> Result<f64, CovError> {
    if dim != 2 && dim != 3 {
        return Err(CovError::Message(
            "Only 2-D and 3-D confidence regions are supported.".into(),
        ));
    }
    if !(0.0 < p && p < 1.0) {
        return Err(CovError::Message("Confidence p must be in (0, 1).".into()));
    }
    match (dim, p == 0.95) {
        (2, true) => Ok(2.447746849),
        (3, true) => Ok(2.795479268),
        _ => {
            // Inverse χ² via Newton on the regularized gamma for common cases.
            let x = inv_chi2(dim as f64, p)?;
            Ok(x.sqrt())
        }
    }
}

/// Coverage of a 3-D ellipsoid at scale k (χ²_3 CDF).
/// For ν=3: F(x) = erf(√(x/2)) − √(2x/π) e^{-x/2}, x = k².
pub fn coverage_3d(k: f64) -> f64 {
    let x = k * k;
    let s = (x / 2.0).sqrt();
    erf_approx(s) - (2.0 * x / std::f64::consts::PI).sqrt() * (-x / 2.0).exp()
}

fn erf_approx(z: f64) -> f64 {
    // Abramowitz & Stegun 7.1.26
    let t = 1.0 / (1.0 + 0.3275911 * z.abs());
    let a = t
        * (0.254829592
            + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    let y = 1.0 - a * (-z * z).exp();
    if z < 0.0 {
        -y
    } else {
        y
    }
}

// Monotone bracketing avoids unconverged Newton steps in the tails.
fn inv_chi2(k: f64, p: f64) -> Result<f64, CovError> {
    if k == 2.0 {
        return Ok(-2.0 * (-p).ln_1p());
    }
    let mut lo = 0.0;
    let mut hi: f64 = 1.0;
    while coverage_3d(hi.sqrt()) < p {
        hi *= 2.0;
    }
    for _ in 0..80 {
        let mid = (lo + hi) / 2.0;
        if coverage_3d(mid.sqrt()) < p {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    Ok((lo + hi) / 2.0)
}

pub fn normalize_one_sigma(
    row: &ImportedCovariance,
    hole_unit: UnitSystem,
) -> Result<OneSigmaNev, CovError> {
    if !row.md.is_finite() {
        return Err(CovError::Message("Covariance MD must be finite.".into()));
    }
    if ![row.c_nn, row.c_ne, row.c_nv, row.c_ee, row.c_ev, row.c_vv]
        .iter()
        .all(|v| v.is_finite())
    {
        return Err(CovError::Message(
            "Covariance entries must be finite.".into(),
        ));
    }
    let mut c = [
        [row.c_nn, row.c_ne, row.c_nv],
        [row.c_ne, row.c_ee, row.c_ev],
        [row.c_nv, row.c_ev, row.c_vv],
    ];
    // Symmetry
    if (c[0][1] - c[1][0]).abs() > 1e-9
        || (c[0][2] - c[2][0]).abs() > 1e-9
        || (c[1][2] - c[2][1]).abs() > 1e-9
    {
        return Err(CovError::Message(
            "Covariance is not symmetric within tolerance.".into(),
        ));
    }
    match row.basis {
        MatrixBasis::OneSigmaCovariance => {}
        MatrixBasis::ScaledMatrix => {
            let k = row.source_k.ok_or_else(|| {
                CovError::Message(
                    "ScaledMatrix requires a numeric sourceK. A free-text confidence basis is not sufficient.".into(),
                )
            })?;
            if !k.is_finite() || k <= 0.0 {
                return Err(CovError::Message("sourceK must be positive.".into()));
            }
            let s = 1.0 / (k * k);
            for r in &mut c {
                for v in r.iter_mut() {
                    *v *= s;
                }
            }
        }
    }
    if !is_psd(&c, 1e-9) {
        return Err(CovError::Message(
            "Covariance is not positive semidefinite within the documented numerical tolerance."
                .into(),
        ));
    }
    // Convert length² into the hole unit.
    for r in 0..3 {
        for col in 0..3 {
            c[r][col] = convert_length_sq(c[r][col], row.covariance_unit, hole_unit);
        }
    }
    Ok(OneSigmaNev {
        md: convert_length(row.md, row.length_unit, hole_unit),
        c,
        provenance: format!(
            "{} {} {} @ {} — imported covariance, not DelvePath-certified ISCWSA compliance",
            row.provider, row.model, row.version, row.source_timestamp
        ),
    })
}

fn is_psd(c: &[[f64; 3]; 3], tol: f64) -> bool {
    let eigs = eigen_sym3(c).0;
    eigs.iter().all(|e| *e >= -tol)
}

/// Symmetric 3×3 Jacobi eigendecomposition. Returns (eigenvalues, eigenvectors as columns).
pub fn eigen_sym3(c: &[[f64; 3]; 3]) -> ([f64; 3], [[f64; 3]; 3]) {
    let mut a = *c;
    let mut v = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
    for _ in 0..32 {
        let mut p = 0;
        let mut q = 1;
        let mut max = a[0][1].abs();
        if a[0][2].abs() > max {
            max = a[0][2].abs();
            p = 0;
            q = 2;
        }
        if a[1][2].abs() > max {
            p = 1;
            q = 2;
            max = a[1][2].abs();
        }
        if max < 1e-14 {
            break;
        }
        let app = a[p][p];
        let aqq = a[q][q];
        let apq = a[p][q];
        let tau = (aqq - app) / (2.0 * apq);
        let t = tau.signum() / (tau.abs() + (1.0 + tau * tau).sqrt());
        let cth = 1.0 / (1.0 + t * t).sqrt();
        let sth = t * cth;
        for k in 0..3 {
            if k != p && k != q {
                let aik = a[p][k];
                let aqk = a[q][k];
                a[p][k] = cth * aik - sth * aqk;
                a[k][p] = a[p][k];
                a[q][k] = sth * aik + cth * aqk;
                a[k][q] = a[q][k];
            }
            let vip = v[k][p];
            let viq = v[k][q];
            v[k][p] = cth * vip - sth * viq;
            v[k][q] = sth * vip + cth * viq;
        }
        a[p][p] = cth * cth * app - 2.0 * sth * cth * apq + sth * sth * aqq;
        a[q][q] = sth * sth * app + 2.0 * sth * cth * apq + cth * cth * aqq;
        a[p][q] = 0.0;
        a[q][p] = 0.0;
    }
    ([a[0][0], a[1][1], a[2][2]], v)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EllipseMode {
    /// 2-D marginal p-confidence: P C Pᵀ with χ²₂(p).
    Marginal2d,
    /// Orthographic outline of the 3-D p-confidence ellipsoid: same shape, χ²₃(p).
    Outline3d,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Ellipse2d {
    pub mode: EllipseMode,
    pub k: f64,
    pub axes: [f64; 2],
    pub angle_deg: f64,
    pub label: String,
}

pub fn project_ellipse(
    c: &[[f64; 3]; 3],
    mode: EllipseMode,
    p: f64,
    plane: &str,
) -> Result<Ellipse2d, CovError> {
    let pmat = match plane {
        "plan" => [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],    // N, E
        "profile" => [[1.0, 0.0, 0.0], [0.0, 0.0, 1.0]], // VS-ish N, TVD — caller should pass a proper P
        _ => [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
    };
    // S = P C Pᵀ
    let mut s = [[0.0; 2]; 2];
    for i in 0..2 {
        for j in 0..2 {
            for r in 0..3 {
                for col in 0..3 {
                    s[i][j] += pmat[i][r] * c[r][col] * pmat[j][col];
                }
            }
        }
    }
    let tr = s[0][0] + s[1][1];
    let det = s[0][0] * s[1][1] - s[0][1] * s[1][0];
    let disc = (tr * tr - 4.0 * det).max(0.0).sqrt();
    let l1 = 0.5 * (tr + disc);
    let l2 = 0.5 * (tr - disc);
    let k = match mode {
        EllipseMode::Marginal2d => chi2_k(2, p)?,
        EllipseMode::Outline3d => chi2_k(3, p)?,
    };
    let angle = (2.0 * s[0][1]).atan2(s[0][0] - s[1][1]) / 2.0;
    let label = match mode {
        EllipseMode::Marginal2d => {
            format!(
                "2-D marginal {:.1}% confidence ellipse (χ²₂). Not a 3-D slice.",
                p * 100.0
            )
        }
        EllipseMode::Outline3d => {
            format!(
                "Orthographic outline of the 3-D {:.1}% confidence ellipsoid (χ²₃).",
                p * 100.0
            )
        }
    };
    Ok(Ellipse2d {
        mode,
        k,
        axes: [k * l1.max(0.0).sqrt(), k * l2.max(0.0).sqrt()],
        angle_deg: angle.to_degrees(),
        label,
    })
}

pub fn ellipsoid_axes(c: &[[f64; 3]; 3], k: f64) -> ([f64; 3], [[f64; 3]; 3]) {
    let (eigs, vecs) = eigen_sym3(c);
    (
        [
            k * eigs[0].max(0.0).sqrt(),
            k * eigs[1].max(0.0).sqrt(),
            k * eigs[2].max(0.0).sqrt(),
        ],
        vecs,
    )
}

/// Closed polyline of a 2-D ellipse in world N/E/TVD. `center` is [N, E, TVD].
pub fn ellipse_polyline(
    center: [f64; 3],
    ellipse: &Ellipse2d,
    plane: &str,
    n: usize,
) -> Vec<[f64; 3]> {
    let steps = n.max(8);
    let a = ellipse.axes[0];
    let b = ellipse.axes[1];
    let th = ellipse.angle_deg.to_radians();
    let (c, s) = (th.cos(), th.sin());
    (0..=steps)
        .map(|i| {
            let t = 2.0 * std::f64::consts::PI * i as f64 / steps as f64;
            let u = a * t.cos();
            let v = b * t.sin();
            match plane {
                "profile" => [
                    center[0] + c * u - s * v,
                    center[1],
                    center[2] + s * u + c * v,
                ],
                _ => [
                    center[0] + c * u - s * v,
                    center[1] + s * u + c * v,
                    center[2],
                ],
            }
        })
        .collect()
}

/// Three principal-plane rings of the 3-D ellipsoid. Each ring is closed.
pub fn ellipsoid_wireframe(
    center: [f64; 3],
    c: &[[f64; 3]; 3],
    k: f64,
    n: usize,
) -> Vec<Vec<[f64; 3]>> {
    let (axes, vecs) = ellipsoid_axes(c, k);
    let steps = n.max(8);
    let pairs = [(0, 1), (0, 2), (1, 2)];
    pairs
        .into_iter()
        .map(|(i, j)| {
            (0..=steps)
                .map(|kstep| {
                    let t = 2.0 * std::f64::consts::PI * kstep as f64 / steps as f64;
                    let mut p = center;
                    for row in 0..3 {
                        p[row] +=
                            axes[i] * t.cos() * vecs[row][i] + axes[j] * t.sin() * vecs[row][j];
                    }
                    p
                })
                .collect()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chi_square_matches_nist_table_and_does_not_round_probability() {
        // NIST/SEMATECH e-Handbook §1.3.6.7.4, printed to 0.001.
        for (p, x) in [
            (0.90, 6.251),
            (0.975, 9.348),
            (0.99, 11.345),
            (0.999, 16.266),
        ] {
            assert!((chi2_k(3, p).unwrap().powi(2) - x).abs() < 0.0006);
        }
        assert!(chi2_k(3, 0.95004).unwrap() > chi2_k(3, 0.95).unwrap());
        assert!(chi2_k(0, 0.95).is_err());
        assert!(chi2_k(3, f64::NAN).is_err());
    }

    #[test]
    fn chi2_reference_values() {
        assert!((chi2_k(2, 0.95).unwrap() - 2.4477).abs() < 1e-3);
        assert!((chi2_k(3, 0.95).unwrap() - 2.7955).abs() < 1e-3);
        let cov = coverage_3d(3.0);
        assert!(
            (cov - 0.9707).abs() < 0.005,
            "3-D k=3 coverage ≈ 97.1%, got {cov}"
        );
    }

    #[test]
    fn diagonal_axes() {
        let c = [[4.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 9.0]];
        let (axes, _) = ellipsoid_axes(&c, 1.0);
        let mut a = axes;
        a.sort_by(|x, y| x.partial_cmp(y).unwrap());
        assert!((a[0] - 1.0).abs() < 1e-6);
        assert!((a[1] - 2.0).abs() < 1e-6);
        assert!((a[2] - 3.0).abs() < 1e-6);
    }

    #[test]
    fn reject_non_psd() {
        let row = ImportedCovariance {
            md: 100.0,
            c_nn: 1.0,
            c_ne: 2.0,
            c_nv: 0.0,
            c_ee: 1.0,
            c_ev: 0.0,
            c_vv: 1.0,
            length_unit: UnitSystem::Imperial,
            covariance_unit: UnitSystem::Imperial,
            basis: MatrixBasis::OneSigmaCovariance,
            source_dimension: Some(3),
            source_probability: None,
            source_k: None,
            provider: "test".into(),
            model: "x".into(),
            version: "1".into(),
            source_timestamp: "t".into(),
        };
        assert!(normalize_one_sigma(&row, UnitSystem::Imperial).is_err());
    }

    #[test]
    fn scaled_and_one_sigma_match() {
        let one = ImportedCovariance {
            md: 10.0,
            c_nn: 4.0,
            c_ne: 0.0,
            c_nv: 0.0,
            c_ee: 1.0,
            c_ev: 0.0,
            c_vv: 9.0,
            length_unit: UnitSystem::Imperial,
            covariance_unit: UnitSystem::Imperial,
            basis: MatrixBasis::OneSigmaCovariance,
            source_dimension: Some(3),
            source_probability: Some(0.95),
            source_k: None,
            provider: "test".into(),
            model: "x".into(),
            version: "1".into(),
            source_timestamp: "t".into(),
        };
        let k = 2.0;
        let scaled = ImportedCovariance {
            basis: MatrixBasis::ScaledMatrix,
            source_k: Some(k),
            c_nn: 4.0 * k * k,
            c_ee: 1.0 * k * k,
            c_vv: 9.0 * k * k,
            ..one.clone()
        };
        let a = normalize_one_sigma(&one, UnitSystem::Imperial).unwrap();
        let b = normalize_one_sigma(&scaled, UnitSystem::Imperial).unwrap();
        assert!((a.c[0][0] - b.c[0][0]).abs() < 1e-12);
        let amb = ImportedCovariance {
            basis: MatrixBasis::ScaledMatrix,
            source_k: None,
            ..one
        };
        assert!(normalize_one_sigma(&amb, UnitSystem::Imperial).is_err());
    }

    #[test]
    fn unit_squared_conversion() {
        let row = ImportedCovariance {
            md: 100.0,
            c_nn: 1.0,
            c_ne: 0.0,
            c_nv: 0.0,
            c_ee: 1.0,
            c_ev: 0.0,
            c_vv: 1.0,
            length_unit: UnitSystem::Imperial,
            covariance_unit: UnitSystem::Imperial,
            basis: MatrixBasis::OneSigmaCovariance,
            source_dimension: None,
            source_probability: None,
            source_k: None,
            provider: "t".into(),
            model: "t".into(),
            version: "1".into(),
            source_timestamp: "t".into(),
        };
        let m = normalize_one_sigma(&row, UnitSystem::Metric).unwrap();
        assert!((m.c[0][0] - 0.3048 * 0.3048).abs() < 1e-12);
        assert!((m.md - 30.48).abs() < 1e-12);
    }

    #[test]
    fn marginal_vs_outline_labels() {
        let c = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        let m = project_ellipse(&c, EllipseMode::Marginal2d, 0.95, "plan").unwrap();
        let o = project_ellipse(&c, EllipseMode::Outline3d, 0.95, "plan").unwrap();
        assert!(m.k < o.k);
        assert!(m.label.contains("χ²₂"));
        assert!(m.label.contains("95.0%"));
        assert!(o.label.contains("χ²₃"));
        let poly = ellipse_polyline([0.0, 0.0, 0.0], &m, "plan", 16);
        assert_eq!(poly.len(), 17);
        assert!((poly[0][0] - poly[16][0]).abs() < 1e-12);
        let wires = ellipsoid_wireframe([0.0, 0.0, 0.0], &c, 1.0, 12);
        assert_eq!(wires.len(), 3);
        assert_eq!(wires[0].len(), 13);
    }
}
