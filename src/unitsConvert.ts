import { convertLength, type MeasuredStation, type Target, type UnitSystem } from "./domain";
import type { HoleRecord } from "./records";

const LENGTH_KEYS = new Set([
  "md",
  "tvd",
  "north",
  "east",
  "added_md",
  "sensor_to_bit",
  "stand_length",
  "max_slide_per_stand",
  "min_useful_slide",
  "start_md",
  "end_md",
  "start_bit_md",
  "end_bit_md",
  "radius",
  "length",
  "width",
  "semi_major",
  "semi_minor",
  "horiz_tol",
  "vert_tol",
  "up_down",
  "left_right",
  "elevation",
  "shift",
  "source_depth",
  "dest_depth",
  "target_tvd",
  "target_disp",
  "kop",
  "tangent_length",
  "curve_length",
  "hold_length",
  "land_tvd",
  "land_north",
  "land_east",
  "bit_size",
  "hole_size",
  "threshold",
  "c_nn",
  "c_ne",
  "c_nv",
  "c_ee",
  "c_ev",
  "c_vv",
]);

export function convertJsonLengths(value: unknown, from: UnitSystem, to: UnitSystem): unknown {
  if (from === to) return value;
  if (Array.isArray(value)) return value.map((v) => convertJsonLengths(v, from, to));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith("c_") && typeof v === "number") out[k] = convertLength(v, from, to) * convertLength(1, from, to);
      else if (typeof v === "number" && LENGTH_KEYS.has(k)) out[k] = convertLength(v, from, to);
      else out[k] = convertJsonLengths(v, from, to);
    }
    return out;
  }
  return value;
}

export function convertHoleLengths(
  from: UnitSystem,
  to: UnitSystem,
  hole: HoleRecord,
  rows: MeasuredStation[],
  targets: Target[],
  tie: { tvd: number; north: number; east: number }
): { hole: HoleRecord; rows: MeasuredStation[]; targets: Target[]; tie: typeof tie } {
  const L = (v: number) => convertLength(v, from, to);
  return {
    hole: {
      ...hole,
      unit_system: to,
      branch_md: hole.branch_md == null ? null : L(hole.branch_md),
      origin_north: L(hole.origin_north),
      origin_east: L(hole.origin_east),
    },
    rows: rows.map((r) => ({ ...r, md: L(r.md) })),
    targets: targets.map((t) => ({
      ...t,
      north: L(t.north),
      east: L(t.east),
      tvd: L(t.tvd),
      horiz_tol: t.horiz_tol == null ? null : L(t.horiz_tol),
      vert_tol: t.vert_tol == null ? null : L(t.vert_tol),
    })),
    tie: { tvd: L(tie.tvd), north: L(tie.north), east: L(tie.east) },
  };
}
