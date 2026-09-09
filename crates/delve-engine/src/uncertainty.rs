//! Plot-ready ellipsoid geometry. All views use the SAME 3-D confidence region.
use crate::collision::validate_covariance;
use delve_assurance::covariance::{chi2_k, ellipsoid_axes};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct GlyphRequest {
    pub center: [f64; 3],
    pub covariance: [[f64; 3]; 3],
    pub confidence: f64,
    pub vsp_deg: f64,
}
#[derive(Debug, Serialize)]
pub struct Glyph {
    pub vertices: Vec<[f64; 3]>,
    pub triangles: Vec<[usize; 3]>,
    pub plan: Vec<[f64; 3]>,
    pub profile: Vec<[f64; 3]>,
    pub k: f64,
    pub label: String,
}
pub fn glyph(r: &GlyphRequest) -> Result<Glyph, String> {
    validate_covariance(&r.covariance)?;
    if !r
        .center
        .iter()
        .chain([r.vsp_deg].iter())
        .all(|x| x.is_finite())
    {
        return Err("Finite ellipsoid center and section azimuth required.".into());
    }
    let k = chi2_k(3, r.confidence).map_err(|e| e.to_string())?;
    let (axes, v) = ellipsoid_axes(&r.covariance, k);
    let mut vertices = Vec::new();
    let mut triangles = Vec::new();
    let n = 20;
    let m = 12;
    for i in 0..=m {
        for j in 0..=n {
            let lat = std::f64::consts::PI * i as f64 / m as f64;
            let lon = std::f64::consts::TAU * j as f64 / n as f64;
            let q = [
                axes[0] * lat.sin() * lon.cos(),
                axes[1] * lat.sin() * lon.sin(),
                axes[2] * lat.cos(),
            ];
            vertices.push(std::array::from_fn(|a| {
                r.center[a] + (0..3).map(|b| v[a][b] * q[b]).sum::<f64>()
            }));
            if i < m && j < n {
                let a = i * (n + 1) + j;
                let b = a + n + 1;
                triangles.push([a, b, a + 1]);
                triangles.push([a + 1, b, b + 1]);
            }
        }
    }
    let th = r.vsp_deg.to_radians();
    let vs = [th.cos(), th.sin(), 0.0];
    Ok(Glyph{vertices,triangles,plan:outline(r,[1.0,0.0,0.0],[0.0,1.0,0.0],k),profile:outline(r,vs,[0.0,0.0,1.0],k),k,label:format!("3-D {:.1}% ellipsoid · k={k:.6} · 2-D views show orthographic outlines, not marginal confidence ellipses",r.confidence*100.0)})
}
fn outline(r: &GlyphRequest, a: [f64; 3], b: [f64; 3], k: f64) -> Vec<[f64; 3]> {
    let cov = |u: [f64; 3], v: [f64; 3]| {
        (0..3)
            .map(|i| {
                (0..3)
                    .map(|j| u[i] * r.covariance[i][j] * v[j])
                    .sum::<f64>()
            })
            .sum::<f64>()
    };
    let aa = cov(a, a);
    let bb = cov(b, b);
    let ab = cov(a, b);
    let disc = ((aa - bb).powi(2) + 4.0 * ab * ab).sqrt();
    let major = k * ((aa + bb + disc) / 2.0).max(0.0).sqrt();
    let minor = k * ((aa + bb - disc) / 2.0).max(0.0).sqrt();
    let angle = (2.0 * ab).atan2(aa - bb) / 2.0;
    (0..=48)
        .map(|i| {
            let t = std::f64::consts::TAU * i as f64 / 48.0;
            let u = major * t.cos() * angle.cos() - minor * t.sin() * angle.sin();
            let v = major * t.cos() * angle.sin() + minor * t.sin() * angle.cos();
            std::array::from_fn(|j| r.center[j] + a[j] * u + b[j] * v)
        })
        .collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn profile_rotates_covariance_into_selected_vertical_section() {
        let r = GlyphRequest {
            center: [0.0; 3],
            covariance: [[1.0, 0.0, 0.0], [0.0, 9.0, 0.0], [0.0, 0.0, 4.0]],
            confidence: 0.95,
            vsp_deg: 90.0,
        };
        let g = glyph(&r).unwrap();
        let max_e = g.profile.iter().map(|p| p[1]).fold(0.0, f64::max);
        assert!((max_e - 3.0 * g.k).abs() < 1e-8);
        assert!(g.profile.iter().all(|p| p[0].abs() < 1e-10));
        assert!(g.label.contains("95.0%"));
    }
    #[test]
    fn rotated_ellipsoid_vertices_match_quadratic_surface() {
        let r = GlyphRequest {
            center: [1.0, 2.0, 3.0],
            covariance: [[2.5, 1.5, 0.0], [1.5, 2.5, 0.0], [0.0, 0.0, 9.0]],
            confidence: 0.95,
            vsp_deg: 0.0,
        };
        let g = glyph(&r).unwrap();
        for p in g.vertices {
            let x = p[0] - 1.0;
            let y = p[1] - 2.0;
            let z = p[2] - 3.0;
            let q = (2.5 * x * x - 3.0 * x * y + 2.5 * y * y) / 4.0 + z * z / 9.0;
            assert!((q - g.k * g.k).abs() < 1e-9);
        }
    }
}
