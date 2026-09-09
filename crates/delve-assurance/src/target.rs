//! Target plane + in-plane footprint. NEV, TVD positive down.

use delve_core::{unit_tangent, PathState, Vec3};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq)]
pub enum TargetError {
    #[error("{0}")]
    Message(String),
}

impl serde::Serialize for TargetError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum OrientationInput {
    Horizontal,
    NormalVector {
        n: f64,
        e: f64,
        t: f64,
        positive_side: String,
    },
    DipAndDipAzimuth {
        dip_deg: f64,
        dip_azi_deg: f64,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct PlaneBasis {
    pub u: [f64; 3],
    pub v: [f64; 3],
    pub normal: [f64; 3],
    pub dip_deg: f64,
    pub dip_azi_deg: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Footprint {
    Point,
    Circle {
        radius: f64,
    },
    Ellipse {
        semi_major: f64,
        semi_minor: f64,
        rotation_in_plane_deg: f64,
    },
    Rectangle {
        length: f64,
        width: f64,
        rotation_in_plane_deg: f64,
    },
    Polygon {
        vertices: Vec<[f64; 2]>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TargetGeom {
    pub id: String,
    pub hole_id: String,
    pub name: String,
    pub aim_north: f64,
    pub aim_east: f64,
    pub aim_tvd: f64,
    pub orientation_input: OrientationInput,
    pub basis: PlaneBasis,
    pub thickness_above: Option<f64>,
    pub thickness_below: Option<f64>,
    pub footprint: Footprint,
    /// Provenance when a source used diameter instead of radius.
    pub source_diameter: Option<f64>,
    pub source: String,
    pub parent_target_id: Option<String>,
    pub horiz_tol: Option<f64>,
    pub vert_tol: Option<f64>,
}

impl TargetGeom {
    pub fn from_legacy_point(
        id: impl Into<String>,
        hole_id: impl Into<String>,
        name: impl Into<String>,
        north: f64,
        east: f64,
        tvd: f64,
        parent_target_id: Option<String>,
        horiz_tol: Option<f64>,
        vert_tol: Option<f64>,
    ) -> Self {
        let basis = canonical_basis(OrientationInput::Horizontal).unwrap();
        Self {
            id: id.into(),
            hole_id: hole_id.into(),
            name: name.into(),
            aim_north: north,
            aim_east: east,
            aim_tvd: tvd,
            orientation_input: OrientationInput::Horizontal,
            basis,
            thickness_above: None,
            thickness_below: None,
            footprint: Footprint::Point,
            source_diameter: None,
            source: "legacy_point_v1".into(),
            parent_target_id,
            horiz_tol,
            vert_tol,
        }
    }
}

/// Canonical orthonormal plane transform. Do not persist a second editable basis.
pub fn canonical_basis(input: OrientationInput) -> Result<PlaneBasis, TargetError> {
    match input {
        OrientationInput::Horizontal => {
            // α = 0: u = strike = (0, 1, 0), v = down-dip = (1, 0, 0), n = (0, 0, -1)
            // From the specified construction with δ=0, α=0:
            // u = (-sin 0, cos 0, 0) = (0, 1, 0)
            // v = (cos 0 cos 0, cos 0 sin 0, sin 0) = (1, 0, 0)
            // n = (0, 0, -1)  above/up-normal; +signed distance is above (shallower TVD)
            Ok(PlaneBasis {
                u: [0.0, 1.0, 0.0],
                v: [1.0, 0.0, 0.0],
                normal: [0.0, 0.0, -1.0],
                dip_deg: 0.0,
                dip_azi_deg: 0.0,
            })
        }
        OrientationInput::DipAndDipAzimuth {
            dip_deg,
            dip_azi_deg,
        } => {
            let d = dip_deg.to_radians();
            let a = dip_azi_deg.to_radians();
            let u = Vec3::new(-a.sin(), a.cos(), 0.0);
            let v = Vec3::new(d.cos() * a.cos(), d.cos() * a.sin(), d.sin());
            let n = u.cross(v);
            let n = n
                .try_normalize()
                .ok_or_else(|| TargetError::Message("Degenerate dip basis.".into()))?;
            Ok(PlaneBasis {
                u: u.to_array(),
                v: v.to_array(),
                normal: n.to_array(),
                dip_deg,
                dip_azi_deg,
            })
        }
        OrientationInput::NormalVector {
            n,
            e,
            t,
            positive_side,
        } => {
            let mut nv = Vec3::new(n, e, t)
                .try_normalize()
                .ok_or_else(|| TargetError::Message("Normal vector is degenerate.".into()))?;
            // Positive side is above (shallower) unless the user names the opposite.
            if positive_side == "below" || positive_side == "down" {
                nv = nv.scale(-1.0);
            }
            // Vertical plane: t ≈ 0. Require explicit positive side (already applied).
            if nv.t.abs() < 1e-8 && positive_side.trim().is_empty() {
                return Err(TargetError::Message(
                    "A vertical target plane requires an explicit positive-side label.".into(),
                ));
            }
            // Reconstruct a right-handed u,v with u horizontal when possible.
            let world_up = Vec3::new(0.0, 0.0, -1.0);
            let u = world_up
                .cross(nv)
                .try_normalize()
                .unwrap_or(Vec3::new(0.0, 1.0, 0.0));
            let v = nv
                .cross(u)
                .try_normalize()
                .unwrap_or(Vec3::new(1.0, 0.0, 0.0));
            let dip = (-nv.t).clamp(-1.0, 1.0).acos().to_degrees();
            let dip_azi = nv.e.atan2(nv.n).to_degrees().rem_euclid(360.0);
            Ok(PlaneBasis {
                u: u.to_array(),
                v: v.to_array(),
                normal: nv.to_array(),
                dip_deg: dip,
                dip_azi_deg: dip_azi,
            })
        }
    }
}

fn rot_uv(u: Vec3, v: Vec3, theta_deg: f64) -> (Vec3, Vec3) {
    let t = theta_deg.to_radians();
    let ut = u.scale(t.cos()).add(v.scale(t.sin()));
    let vt = u.scale(-t.sin()).add(v.scale(t.cos()));
    (ut, vt)
}

pub fn world_from_uv(t: &TargetGeom, uu: f64, vv: f64) -> Vec3 {
    let o = Vec3::new(t.aim_north, t.aim_east, t.aim_tvd);
    let u = Vec3::new(t.basis.u[0], t.basis.u[1], t.basis.u[2]);
    let v = Vec3::new(t.basis.v[0], t.basis.v[1], t.basis.v[2]);
    o.add(u.scale(uu)).add(v.scale(vv))
}

pub fn uv_from_world(t: &TargetGeom, p: Vec3) -> (f64, f64, f64) {
    let o = Vec3::new(t.aim_north, t.aim_east, t.aim_tvd);
    let d = p.sub(o);
    let u = Vec3::new(t.basis.u[0], t.basis.u[1], t.basis.u[2]);
    let v = Vec3::new(t.basis.v[0], t.basis.v[1], t.basis.v[2]);
    let n = Vec3::new(t.basis.normal[0], t.basis.normal[1], t.basis.normal[2]);
    (d.dot(u), d.dot(v), d.dot(n))
}

/// Signed footprint-boundary distance: negative inside, 0 on boundary, positive outside.
pub fn footprint_boundary_distance(fp: &Footprint, u: f64, v: f64) -> Result<f64, TargetError> {
    match fp {
        Footprint::Point => Ok((u * u + v * v).sqrt()),
        Footprint::Circle { radius } => {
            if *radius < 0.0 {
                return Err(TargetError::Message(
                    "Circle radius must be ≥ 0 (not a diameter).".into(),
                ));
            }
            Ok((u * u + v * v).sqrt() - radius)
        }
        Footprint::Ellipse {
            semi_major,
            semi_minor,
            rotation_in_plane_deg,
        } => {
            let th = rotation_in_plane_deg.to_radians();
            let ur = u * th.cos() + v * th.sin();
            let vr = -u * th.sin() + v * th.cos();
            if *semi_major <= 0.0 || *semi_minor <= 0.0 {
                return Err(TargetError::Message(
                    "Ellipse semi-axes must be positive.".into(),
                ));
            }
            let q = (ur / semi_major).powi(2) + (vr / semi_minor).powi(2);
            // Approximate signed distance via radial scale.
            let r = (u * u + v * v).sqrt();
            if q <= 1.0 {
                Ok(-r * (1.0 - q.sqrt()).max(0.0))
            } else {
                Ok(r * (q.sqrt() - 1.0))
            }
        }
        Footprint::Rectangle {
            length,
            width,
            rotation_in_plane_deg,
        } => {
            let th = rotation_in_plane_deg.to_radians();
            let ur = u * th.cos() + v * th.sin();
            let vr = -u * th.sin() + v * th.cos();
            let hx = length / 2.0;
            let hy = width / 2.0;
            let dx = ur.abs() - hx;
            let dy = vr.abs() - hy;
            if dx <= 0.0 && dy <= 0.0 {
                Ok(dx.max(dy))
            } else {
                Ok((dx.max(0.0).powi(2) + dy.max(0.0).powi(2)).sqrt())
            }
        }
        Footprint::Polygon { vertices } => polygon_boundary_distance(vertices, u, v),
    }
}

fn polygon_boundary_distance(verts: &[[f64; 2]], u: f64, v: f64) -> Result<f64, TargetError> {
    validate_polygon(verts)?;
    let n = verts.len();
    let mut min_d = f64::MAX;
    let mut inside = false;
    for i in 0..n {
        let a = verts[i];
        let b = verts[(i + 1) % n];
        min_d = min_d.min(seg_dist(a, b, u, v));
        // Ray cast
        let (x1, y1) = (a[0], a[1]);
        let (x2, y2) = (b[0], b[1]);
        let hit = ((y1 > v) != (y2 > v)) && (u < (x2 - x1) * (v - y1) / (y2 - y1 + 1e-18) + x1);
        if hit {
            inside = !inside;
        }
    }
    Ok(if inside { -min_d } else { min_d })
}

fn seg_dist(a: [f64; 2], b: [f64; 2], u: f64, v: f64) -> f64 {
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    let l2 = dx * dx + dy * dy;
    if l2 < 1e-18 {
        return (u - a[0]).hypot(v - a[1]);
    }
    let t = ((u - a[0]) * dx + (v - a[1]) * dy) / l2;
    let t = t.clamp(0.0, 1.0);
    (u - (a[0] + t * dx)).hypot(v - (a[1] + t * dy))
}

pub fn validate_polygon(verts: &[[f64; 2]]) -> Result<(), TargetError> {
    if verts.len() < 3 {
        return Err(TargetError::Message(
            "Polygon requires at least three distinct vertices.".into(),
        ));
    }
    let mut seen = Vec::new();
    for p in verts {
        if seen
            .iter()
            .any(|q: &[f64; 2]| (q[0] - p[0]).hypot(q[1] - p[1]) < 1e-9)
        {
            return Err(TargetError::Message(
                "Polygon vertices must be distinct.".into(),
            ));
        }
        seen.push(*p);
    }
    let n = verts.len();
    for i in 0..n {
        let a1 = verts[i];
        let a2 = verts[(i + 1) % n];
        for j in i + 1..n {
            if j == i || (j + 1) % n == i || i + 1 == j {
                continue;
            }
            let b1 = verts[j];
            let b2 = verts[(j + 1) % n];
            if segments_cross(a1, a2, b1, b2) {
                return Err(TargetError::Message("Polygon is self-intersecting.".into()));
            }
        }
    }
    Ok(())
}

fn segments_cross(a: [f64; 2], b: [f64; 2], c: [f64; 2], d: [f64; 2]) -> bool {
    fn orient(p: [f64; 2], q: [f64; 2], r: [f64; 2]) -> f64 {
        (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1])
    }
    let o1 = orient(a, b, c);
    let o2 = orient(a, b, d);
    let o3 = orient(c, d, a);
    let o4 = orient(c, d, b);
    o1 * o2 < 0.0 && o3 * o4 < 0.0
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TargetQueryResult {
    pub hit: bool,
    pub entry_md: Option<f64>,
    pub exit_md: Option<f64>,
    pub path_north: f64,
    pub path_east: f64,
    pub path_tvd: f64,
    pub path_md: f64,
    pub target_north: f64,
    pub target_east: f64,
    pub target_tvd: f64,
    pub signed_normal: f64,
    pub signed_footprint: f64,
    pub miss_n: f64,
    pub miss_e: f64,
    pub miss_tvd: f64,
    pub representation: String,
}

/// Closest approach of a polyline path to the finite target (one paired miss).
pub fn query_path_target(
    target: &TargetGeom,
    states: &[PathState],
) -> Result<TargetQueryResult, TargetError> {
    if states.len() < 2 {
        return Err(TargetError::Message(
            "Path needs at least two states.".into(),
        ));
    }
    let mut best: Option<TargetQueryResult> = None;
    let mut best_d = f64::MAX;
    let mut entry = None;
    let mut exit = None;
    let mut prev_inside = false;
    for w in states.windows(2) {
        let a = w[0];
        let b = w[1];
        // Sample the interval.
        for k in 0..=8 {
            let f = k as f64 / 8.0;
            let p = Vec3::new(
                a.north + f * (b.north - a.north),
                a.east + f * (b.east - a.east),
                a.tvd + f * (b.tvd - a.tvd),
            );
            let md = a.md + f * (b.md - a.md);
            let (u, v, sn) = uv_from_world(target, p);
            let sf = footprint_boundary_distance(&target.footprint, u, v)?;
            let on_plane = match (target.thickness_above, target.thickness_below) {
                (None, None) => sn.abs() <= 1e-6,
                (Some(up), Some(dn)) => sn <= up + 1e-6 && sn >= -dn - 1e-6,
                (Some(up), None) => sn <= up + 1e-6 && sn >= -1e-6,
                (None, Some(dn)) => sn >= -dn - 1e-6 && sn <= 1e-6,
            };
            let inside = on_plane && sf <= 1e-6;
            if inside && !prev_inside {
                entry = Some(entry.unwrap_or(md));
            }
            if !inside && prev_inside {
                exit = Some(md);
            }
            prev_inside = inside;
            let tp = if sf <= 0.0 {
                let n = Vec3::new(
                    target.basis.normal[0],
                    target.basis.normal[1],
                    target.basis.normal[2],
                );
                p.sub(n.scale(sn))
            } else {
                closest_on_footprint(target, u, v)
            };
            let miss = tp.sub(p); // wait: miss should be target-path or path-to-target
            let d = p.sub(tp).norm();
            if d < best_d {
                best_d = d;
                best = Some(TargetQueryResult {
                    hit: inside || (on_plane && sf <= 1e-4),
                    entry_md: entry,
                    exit_md: exit,
                    path_north: p.n,
                    path_east: p.e,
                    path_tvd: p.t,
                    path_md: md,
                    target_north: tp.n,
                    target_east: tp.e,
                    target_tvd: tp.t,
                    signed_normal: sn,
                    signed_footprint: sf,
                    miss_n: tp.n - p.n,
                    miss_e: tp.e - p.e,
                    miss_tvd: tp.t - p.t,
                    representation:
                        "single paired miss (not independent normal + footprint minima)".into(),
                });
                let _ = miss;
            }
        }
    }
    let mut r = best.ok_or_else(|| TargetError::Message("No sample.".into()))?;
    r.entry_md = entry;
    r.exit_md = exit;
    r.hit = entry.is_some();
    Ok(r)
}

fn closest_on_footprint(t: &TargetGeom, u: f64, v: f64) -> Vec3 {
    match &t.footprint {
        Footprint::Point => world_from_uv(t, 0.0, 0.0),
        Footprint::Circle { radius } => {
            let r = (u * u + v * v).sqrt().max(1e-12);
            world_from_uv(t, u * radius / r, v * radius / r)
        }
        Footprint::Rectangle {
            length,
            width,
            rotation_in_plane_deg,
        } => {
            let th = rotation_in_plane_deg.to_radians();
            let ur = (u * th.cos() + v * th.sin()).clamp(-length / 2.0, length / 2.0);
            let vr = (-u * th.sin() + v * th.cos()).clamp(-width / 2.0, width / 2.0);
            let uu = ur * th.cos() - vr * th.sin();
            let vv = ur * th.sin() + vr * th.cos();
            world_from_uv(t, uu, vv)
        }
        _ => {
            let n = Vec3::new(t.basis.normal[0], t.basis.normal[1], t.basis.normal[2]);
            let p = world_from_uv(t, u, v);
            let (_, _, sn) = uv_from_world(t, p);
            p.sub(n.scale(sn))
        }
    }
}

/// World-space outline for Plan/3-D. A dipped circle is an ellipse in N/E — do not redraw as a circle.
pub fn target_world_outline(t: &TargetGeom, n: usize) -> Vec<[f64; 3]> {
    match &t.footprint {
        Footprint::Point => vec![[t.aim_north, t.aim_east, t.aim_tvd]],
        Footprint::Circle { radius } => (0..n)
            .map(|i| {
                let a = std::f64::consts::TAU * i as f64 / n as f64;
                let p = world_from_uv(t, radius * a.cos(), radius * a.sin());
                [p.n, p.e, p.t]
            })
            .collect(),
        Footprint::Ellipse {
            semi_major,
            semi_minor,
            rotation_in_plane_deg,
        } => {
            let (uu, vv) = rot_uv(
                Vec3::new(1.0, 0.0, 0.0),
                Vec3::new(0.0, 1.0, 0.0),
                *rotation_in_plane_deg,
            );
            (0..n)
                .map(|i| {
                    let a = std::f64::consts::TAU * i as f64 / n as f64;
                    let lu = uu
                        .scale(semi_major * a.cos())
                        .add(vv.scale(semi_minor * a.sin()));
                    let p = world_from_uv(t, lu.n, lu.e);
                    [p.n, p.e, p.t]
                })
                .collect()
        }
        Footprint::Rectangle {
            length,
            width,
            rotation_in_plane_deg,
        } => {
            let hx = length / 2.0;
            let hy = width / 2.0;
            let corners = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy], [-hx, -hy]];
            let th = rotation_in_plane_deg.to_radians();
            corners
                .iter()
                .map(|c| {
                    let u = c[0] * th.cos() - c[1] * th.sin();
                    let v = c[0] * th.sin() + c[1] * th.cos();
                    let p = world_from_uv(t, u, v);
                    [p.n, p.e, p.t]
                })
                .collect()
        }
        Footprint::Polygon { vertices } => {
            let mut out: Vec<[f64; 3]> = vertices
                .iter()
                .map(|q| {
                    let p = world_from_uv(t, q[0], q[1]);
                    [p.n, p.e, p.t]
                })
                .collect();
            if let Some(first) = out.first().copied() {
                out.push(first);
            }
            out
        }
    }
}

/// Section-plane intersection of the finite target (may be empty).
pub fn section_plane_intersection(t: &TargetGeom, vsp_deg: f64) -> Vec<[f64; 2]> {
    let vsp = vsp_deg.to_radians();
    let outline = target_world_outline(t, 48);
    let mut hits = Vec::new();
    for w in outline.windows(2) {
        let a = w[0];
        let b = w[1];
        // Vertical section plane through origin at azimuth vsp: points with
        // N sinθ - E cosθ = 0. Intersect segment with that plane.
        let fa = a[0] * vsp.sin() - a[1] * vsp.cos();
        let fb = b[0] * vsp.sin() - b[1] * vsp.cos();
        if fa * fb > 0.0 {
            continue;
        }
        let den = fb - fa;
        if den.abs() < 1e-12 {
            continue;
        }
        let s = -fa / den;
        if !(0.0..=1.0).contains(&s) {
            continue;
        }
        let n = a[0] + s * (b[0] - a[0]);
        let e = a[1] + s * (b[1] - a[1]);
        let tvd = a[2] + s * (b[2] - a[2]);
        let vs = n * vsp.cos() + e * vsp.sin();
        hits.push([vs, tvd]);
    }
    hits
}

/// Orthogonal projection of the outline into the vertical-section view.
pub fn orthogonal_section_projection(t: &TargetGeom, vsp_deg: f64) -> Vec<[f64; 2]> {
    let vsp = vsp_deg.to_radians();
    target_world_outline(t, 48)
        .into_iter()
        .map(|p| [p[0] * vsp.cos() + p[1] * vsp.sin(), p[2]])
        .collect()
}

pub fn path_state(md: f64, inc: f64, azi: f64, n: f64, e: f64, tvd: f64) -> PathState {
    let t = unit_tangent(inc.to_radians(), azi.to_radians());
    PathState {
        md,
        inc_deg: inc,
        azi_deg: azi,
        north: n,
        east: e,
        tvd,
        tangent_n: t.n,
        tangent_e: t.e,
        tangent_t: t.t,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn radius_is_not_diameter() {
        let t = TargetGeom {
            id: "t".into(),
            hole_id: "h".into(),
            name: "C".into(),
            aim_north: 0.0,
            aim_east: 0.0,
            aim_tvd: 1000.0,
            orientation_input: OrientationInput::Horizontal,
            basis: canonical_basis(OrientationInput::Horizontal).unwrap(),
            thickness_above: None,
            thickness_below: None,
            footprint: Footprint::Circle { radius: 10.0 },
            source_diameter: Some(20.0),
            source: "import_diameter_converted".into(),
            parent_target_id: None,
            horiz_tol: None,
            vert_tol: None,
        };
        assert!((footprint_boundary_distance(&t.footprint, 10.0, 0.0).unwrap()).abs() < 1e-9);
        assert!(footprint_boundary_distance(&t.footprint, 20.0, 0.0).unwrap() > 9.0);
    }

    #[test]
    fn rotated_rectangle_vertices() {
        let t = TargetGeom {
            id: "t".into(),
            hole_id: "h".into(),
            name: "R".into(),
            aim_north: 0.0,
            aim_east: 0.0,
            aim_tvd: 0.0,
            orientation_input: OrientationInput::Horizontal,
            basis: canonical_basis(OrientationInput::Horizontal).unwrap(),
            thickness_above: None,
            thickness_below: None,
            footprint: Footprint::Rectangle {
                length: 20.0,
                width: 10.0,
                rotation_in_plane_deg: 90.0,
            },
            source_diameter: None,
            source: "test".into(),
            parent_target_id: None,
            horiz_tol: None,
            vert_tol: None,
        };
        let o = target_world_outline(&t, 4);
        assert!(o.len() >= 4);
        // 90° in-plane: length along v (north for horizontal α=0).
        let ns: Vec<f64> = o.iter().map(|p| p[0]).collect();
        assert!(ns.iter().any(|n| n.abs() > 8.0));
    }

    #[test]
    fn polygon_self_intersection_rejected() {
        let bowtie = vec![[0.0, 0.0], [1.0, 1.0], [0.0, 1.0], [1.0, 0.0]];
        assert!(validate_polygon(&bowtie).is_err());
        let square = vec![[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]];
        assert!(validate_polygon(&square).is_ok());
        assert!(
            footprint_boundary_distance(&Footprint::Polygon { vertices: square }, 0.5, 0.5)
                .unwrap()
                < 0.0
        );
    }

    #[test]
    fn dipped_circle_projects_as_ellipse() {
        let basis = canonical_basis(OrientationInput::DipAndDipAzimuth {
            dip_deg: 30.0,
            dip_azi_deg: 90.0,
        })
        .unwrap();
        let t = TargetGeom {
            id: "t".into(),
            hole_id: "h".into(),
            name: "D".into(),
            aim_north: 0.0,
            aim_east: 0.0,
            aim_tvd: 1000.0,
            orientation_input: OrientationInput::DipAndDipAzimuth {
                dip_deg: 30.0,
                dip_azi_deg: 90.0,
            },
            basis,
            thickness_above: None,
            thickness_below: None,
            footprint: Footprint::Circle { radius: 50.0 },
            source_diameter: None,
            source: "test".into(),
            parent_target_id: None,
            horiz_tol: None,
            vert_tol: None,
        };
        let o = target_world_outline(&t, 32);
        let easts: Vec<f64> = o.iter().map(|p| p[1]).collect();
        let norths: Vec<f64> = o.iter().map(|p| p[0]).collect();
        let e_span = easts.iter().cloned().fold(f64::MIN, f64::max)
            - easts.iter().cloned().fold(f64::MAX, f64::min);
        let n_span = norths.iter().cloned().fold(f64::MIN, f64::max)
            - norths.iter().cloned().fold(f64::MAX, f64::min);
        assert!(
            (e_span - n_span).abs() > 5.0,
            "dipped circle must not look circular in plan"
        );
    }

    #[test]
    fn section_intersection_and_projection_differ() {
        let t = TargetGeom::from_legacy_point("t", "h", "P", 100.0, 0.0, 1000.0, None, None, None);
        let mut circle = t.clone();
        circle.footprint = Footprint::Circle { radius: 20.0 };
        let vsp = 90.0;
        let inter = section_plane_intersection(&circle, vsp);
        let proj = orthogonal_section_projection(&circle, vsp);
        assert_ne!(inter.len(), proj.len());
    }

    #[test]
    fn closest_miss_is_one_pair() {
        let t = TargetGeom::from_legacy_point("t", "h", "P", 0.0, 100.0, 1000.0, None, None, None);
        let path = vec![
            path_state(0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
            path_state(1000.0, 0.0, 0.0, 0.0, 0.0, 1000.0),
        ];
        let q = query_path_target(&t, &path).unwrap();
        assert!(!q.hit);
        assert!((q.path_tvd - 1000.0).abs() < 1.0);
        assert!((q.miss_e - 100.0).abs() < 1.0);
    }
}
