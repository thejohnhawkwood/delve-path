//! Shared NEV geometry. TVD / V is positive down.
//!
//! Unit tangent, high-side, and right follow the independently derived
//! local frame used by planning and assurance. Survey reconstruction
//! still uses only the tangent (ISCWSA minimum curvature).

use crate::units::{deg_to_rad, rad_to_deg};

/// Dogleg below this (radians) is treated as a straight interval.
pub const SMALL_BETA_RAD: f64 = 1e-12;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Vec3 {
    pub n: f64,
    pub e: f64,
    pub t: f64,
}

impl Vec3 {
    pub const ZERO: Self = Self {
        n: 0.0,
        e: 0.0,
        t: 0.0,
    };

    pub fn new(n: f64, e: f64, t: f64) -> Self {
        Self { n, e, t }
    }

    pub fn dot(self, o: Self) -> f64 {
        self.n * o.n + self.e * o.e + self.t * o.t
    }

    pub fn cross(self, o: Self) -> Self {
        Self {
            n: self.e * o.t - self.t * o.e,
            e: self.t * o.n - self.n * o.t,
            t: self.n * o.e - self.e * o.n,
        }
    }

    pub fn norm(self) -> f64 {
        self.dot(self).sqrt()
    }

    pub fn try_normalize(self) -> Option<Self> {
        let n = self.norm();
        if n < 1e-15 || !n.is_finite() {
            None
        } else {
            Some(self.scale(1.0 / n))
        }
    }

    pub fn scale(self, s: f64) -> Self {
        Self {
            n: self.n * s,
            e: self.e * s,
            t: self.t * s,
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn add(self, o: Self) -> Self {
        Self {
            n: self.n + o.n,
            e: self.e + o.e,
            t: self.t + o.t,
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn sub(self, o: Self) -> Self {
        Self {
            n: self.n - o.n,
            e: self.e - o.e,
            t: self.t - o.t,
        }
    }

    pub fn is_finite(self) -> bool {
        self.n.is_finite() && self.e.is_finite() && self.t.is_finite()
    }

    pub fn to_array(self) -> [f64; 3] {
        [self.n, self.e, self.t]
    }
}

/// Station unit tangent in +N, +E, +TVD-down.
pub fn unit_tangent(inc_rad: f64, azi_rad: f64) -> Vec3 {
    let s = inc_rad.sin();
    Vec3 {
        n: s * azi_rad.cos(),
        e: s * azi_rad.sin(),
        t: inc_rad.cos(),
    }
}

/// High-side unit vector. Undefined (returns None) at the gravity-toolface
/// singularities |sin I| ≈ 0.
pub fn high_side(inc_rad: f64, azi_rad: f64) -> Vec3 {
    Vec3 {
        n: inc_rad.cos() * azi_rad.cos(),
        e: inc_rad.cos() * azi_rad.sin(),
        t: -inc_rad.sin(),
    }
}

/// Right-side unit vector in the local high-side/right frame.
pub fn right_side(azi_rad: f64) -> Vec3 {
    Vec3 {
        n: -azi_rad.sin(),
        e: azi_rad.cos(),
        t: 0.0,
    }
}

/// Recover inclination [0, π] and azimuth [0, 2π) from a unit tangent.
pub fn attitude_from_tangent(t: Vec3) -> (f64, f64) {
    let n = t.try_normalize().unwrap_or(t);
    let inc = n.t.clamp(-1.0, 1.0).acos();
    let mut azi = n.e.atan2(n.n);
    if azi < 0.0 {
        azi += std::f64::consts::TAU;
    }
    if !azi.is_finite() {
        azi = 0.0;
    }
    (inc, azi)
}

pub fn wrap_azimuth_rad(mut azi: f64) -> f64 {
    let tau = std::f64::consts::TAU;
    azi %= tau;
    if azi < 0.0 {
        azi += tau;
    }
    azi
}

pub fn wrap_azimuth_deg(azi_deg: f64) -> f64 {
    rad_to_deg(wrap_azimuth_rad(deg_to_rad(azi_deg)))
}

/// Smallest signed azimuth difference in radians, in (−π, π].
pub fn azimuth_delta_rad(from: f64, to: f64) -> f64 {
    let mut d = wrap_azimuth_rad(to) - wrap_azimuth_rad(from);
    if d > std::f64::consts::PI {
        d -= std::f64::consts::TAU;
    } else if d <= -std::f64::consts::PI {
        d += std::f64::consts::TAU;
    }
    d
}

pub fn dogleg_and_rf(v1: Vec3, v2: Vec3) -> (f64, f64) {
    let cos_b = v1.dot(v2).clamp(-1.0, 1.0);
    let beta = cos_b.acos();
    let rf = if beta < SMALL_BETA_RAD {
        1.0
    } else {
        (2.0 / beta) * (beta / 2.0).tan()
    };
    (beta, rf)
}

pub fn vertical_section(north: f64, east: f64, vsp_rad: f64) -> f64 {
    north * vsp_rad.cos() + east * vsp_rad.sin()
}

pub fn closure(north: f64, east: f64) -> (f64, f64) {
    let dist = north.hypot(east);
    let azi = wrap_azimuth_rad(east.atan2(north));
    (dist, azi)
}

/// Position increment of a minimum-curvature interval in metres.
pub fn min_curvature_delta_m(v1: Vec3, v2: Vec3, course_m: f64) -> (f64, Vec3) {
    let (beta, rf) = dogleg_and_rf(v1, v2);
    let half = (course_m / 2.0) * rf;
    (
        beta,
        Vec3 {
            n: half * (v1.n + v2.n),
            e: half * (v1.e + v2.e),
            t: half * (v1.t + v2.t),
        },
    )
}

/// Interpolate attitude and position along a minimum-curvature interval.
///
/// `frac` is course fraction in [0, 1]. Lengths are metres. The dogleg plane
/// is the unique plane of `v1` and `v2` (survey reconstruction, not gravity TF).
pub fn interpolate_min_curvature(
    start: Vec3,
    v1: Vec3,
    v2: Vec3,
    course_m: f64,
    frac: f64,
) -> (Vec3, Vec3, f64) {
    let f = frac.clamp(0.0, 1.0);
    let (beta, _) = dogleg_and_rf(v1, v2);
    if beta < SMALL_BETA_RAD || course_m.abs() < 1e-15 {
        let pos = start.add(v1.scale(course_m * f));
        return (pos, v1, 0.0);
    }
    let theta = beta * f;
    let sin_b = beta.sin();
    let u = if sin_b > 1e-14 {
        v2.sub(v1.scale(beta.cos())).scale(1.0 / sin_b)
    } else {
        v2.sub(v1).try_normalize().unwrap_or(Vec3::ZERO)
    };
    let kappa = beta / course_m;
    let delta = v1
        .scale(theta.sin() / kappa)
        .add(u.scale((1.0 - theta.cos()) / kappa));
    let t = v1.scale(theta.cos()).add(u.scale(theta.sin()));
    let t = t.try_normalize().unwrap_or(t);
    (start.add(delta), t, theta)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vertical_tangent_is_down() {
        let t = unit_tangent(0.0, 1.2);
        assert!((t.t - 1.0).abs() < 1e-12);
        assert!(t.n.abs() < 1e-12);
        assert!(t.e.abs() < 1e-12);
    }

    #[test]
    fn high_side_right_are_orthonormal_at_45() {
        let i = 45_f64.to_radians();
        let a = 30_f64.to_radians();
        let t = unit_tangent(i, a);
        let h = high_side(i, a);
        let r = right_side(a);
        assert!((t.dot(h)).abs() < 1e-12);
        assert!((t.dot(r)).abs() < 1e-12);
        assert!((h.dot(r)).abs() < 1e-12);
        assert!((t.norm() - 1.0).abs() < 1e-12);
        assert!((h.norm() - 1.0).abs() < 1e-12);
        assert!((r.norm() - 1.0).abs() < 1e-12);
    }

    #[test]
    fn interpolate_endpoints_match_full_interval() {
        let v1 = unit_tangent(10_f64.to_radians(), 0.0);
        let v2 = unit_tangent(20_f64.to_radians(), 10_f64.to_radians());
        let start = Vec3::ZERO;
        let cl = 30.0;
        let (end, _, _) = interpolate_min_curvature(start, v1, v2, cl, 1.0);
        let (_, delta) = min_curvature_delta_m(v1, v2, cl);
        assert!((end.n - delta.n).abs() < 1e-9);
        assert!((end.e - delta.e).abs() < 1e-9);
        assert!((end.t - delta.t).abs() < 1e-9);
    }
}
