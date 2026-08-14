export type UnitSystem = "metric" | "imperial";
export type SurveyConvention = "oilfield_from_vertical";
export type AzimuthReference = "true" | "grid" | "magnetic" | "unknown";
export type StationClass = "measured" | "projected" | "planned";

export interface MeasuredStation {
  md: number;
  inc_deg: number;
  azi_deg: number;
  comment: string;
  class: StationClass;
  source: "manual" | "paste" | "csv" | "tie_in";
}

export interface TieIn {
  tvd: number;
  north: number;
  east: number;
}

export interface CalculatedStation {
  md: number;
  inc_deg: number;
  azi_deg: number;
  tvd: number;
  north: number;
  east: number;
  vs: number;
  closure: number;
  closure_azi_deg: number;
  dogleg_deg: number;
  dls: number;
  comment: string;
  class: StationClass;
}

export interface Trajectory {
  unit_system: UnitSystem;
  convention: SurveyConvention;
  azimuth_reference: AzimuthReference;
  vsp_deg: number;
  stations: CalculatedStation[];
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  index: number | null;
  code: string;
  message: string;
}

export interface Target {
  id: string;
  hole_id: string;
  name: string;
  north: number;
  east: number;
  tvd: number;
  horiz_tol: number | null;
  vert_tol: number | null;
  /** Null = junction / standalone. Set = child of that junction (BHL or intermediate). */
  parent_target_id: string | null;
}

export function emptyRow(md = 0): MeasuredStation {
  return {
    md,
    inc_deg: 0,
    azi_deg: 0,
    comment: "",
    class: "measured",
    source: "manual",
  };
}

export function lengthLabel(u: UnitSystem): string {
  return u === "imperial" ? "ft" : "m";
}

export function dlsLabel(u: UnitSystem): string {
  return u === "imperial" ? "°/100 ft" : "°/30 m";
}

export function fmt(n: number, d = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}
