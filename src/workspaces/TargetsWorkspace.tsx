import { useState } from "react";
import { engineCall, parseEngineError } from "../engine";
import { lengthLabel, type Target, type UnitSystem } from "../domain";

export type TargetOutline = { name: string; world: [number, number, number][]; section: [number, number][]; projection: [number, number][] };

export function TargetsWorkspace({
  unit,
  vsp,
  targets,
  onChange,
  onOutlines,
}: {
  unit: UnitSystem;
  vsp: number;
  targets: Target[];
  onChange: (t: Target) => void;
  onOutlines: (o: TargetOutline[]) => void;
}) {
  const [shape, setShape] = useState("circle");
  const [radius, setRadius] = useState("50");
  const [length, setLength] = useState("80");
  const [width, setWidth] = useState("40");
  const [rot, setRot] = useState("30");
  const [dip, setDip] = useState("0");
  const [dipAzi, setDipAzi] = useState("0");
  const [err, setErr] = useState("");
  const selected = targets[0];
  const len = lengthLabel(unit);

  async function applyShape() {
    if (!selected) return;
    setErr("");
    try {
      const orientation =
        Number(dip) === 0
          ? { kind: "horizontal" }
          : { kind: "dip_and_dip_azimuth", dip_deg: Number(dip), dip_azi_deg: Number(dipAzi) };
      const basis = await engineCall<{ dip_deg: number; dip_azi_deg: number }>("canonical_basis", orientation);
      let footprint: Record<string, unknown> = { kind: "point" };
      if (shape === "circle") footprint = { kind: "circle", radius: Number(radius) };
      if (shape === "rectangle") {
        footprint = { kind: "rectangle", length: Number(length), width: Number(width), rotation_in_plane_deg: Number(rot) };
      }
      if (shape === "polygon") {
        const r = Number(radius);
        footprint = {
          kind: "polygon",
          vertices: [
            [-r, -r],
            [r, -r],
            [0, r],
          ],
        };
      }
      const geom = {
        id: selected.id,
        hole_id: selected.hole_id,
        name: selected.name,
        aim_north: selected.north,
        aim_east: selected.east,
        aim_tvd: selected.tvd,
        orientation_input: orientation,
        basis,
        thickness_above: null,
        thickness_below: null,
        footprint,
        source_diameter: null,
        source: "user",
        parent_target_id: selected.parent_target_id,
        horiz_tol: selected.horiz_tol,
        vert_tol: selected.vert_tol,
      };
      const world = await engineCall<[number, number, number][]>("target_outline", geom);
      const section = await engineCall<[number, number][]>("target_section_intersection", { target: geom, vsp_deg: vsp });
      const projection = await engineCall<[number, number][]>("target_section_projection", { target: geom, vsp_deg: vsp });
      onChange({ ...selected, geometry_json: JSON.stringify(geom) });
      onOutlines([{ name: selected.name, world, section, projection }]);
    } catch (e) {
      setErr(parseEngineError(e));
    }
  }

  return (
    <div className="workspace-panel">
      <h2>Targets</h2>
      <p className="muted">
        Target plane + in-plane footprint. Circle input is radius. A dipped circle may appear elliptical in Plan. Profile
        shows labelled <b>section-plane intersection</b> (may be empty) and <b>orthogonal projection</b> — they are different.
      </p>
      <p className="muted">
        Dip δ down from horizontal; dip azimuth α clockwise from north. +N along +n is above the plane. Positive footprint
        rotation is uθ = cosθ u + sinθ v.
      </p>
      <div className="ws-row">
        <label>
          Shape
          <select value={shape} onChange={(e) => setShape(e.target.value)}>
            <option value="circle">Circle (radius)</option>
            <option value="rectangle">Rotated rectangle</option>
            <option value="polygon">Polygon</option>
          </select>
        </label>
        <label>
          Radius {len}
          <input value={radius} onChange={(e) => setRadius(e.target.value)} />
        </label>
        <label>
          Length {len}
          <input value={length} onChange={(e) => setLength(e.target.value)} />
        </label>
        <label>
          Width {len}
          <input value={width} onChange={(e) => setWidth(e.target.value)} />
        </label>
        <label>
          In-plane rotation °
          <input value={rot} onChange={(e) => setRot(e.target.value)} />
        </label>
        <label>
          Dip °
          <input value={dip} onChange={(e) => setDip(e.target.value)} />
        </label>
        <label>
          Dip azi °
          <input value={dipAzi} onChange={(e) => setDipAzi(e.target.value)} />
        </label>
        <button type="button" onClick={() => void applyShape()} disabled={!selected}>
          Build geometry
        </button>
      </div>
      {err && <div className="error">{err}</div>}
      {!selected && <p>Set a target on the Survey workspace first.</p>}
    </div>
  );
}
