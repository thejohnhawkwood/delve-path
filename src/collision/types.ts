import type { ExtraPath } from "../Charts";
export interface Point {
  md: number;
  north: number;
  east: number;
  tvd: number;
  inc_deg: number;
  azi_deg: number;
}
export interface Frame {
  unit_system: "metric" | "imperial";
  north_reference: string;
  origin_id: string;
  origin_north: number;
  origin_east: number;
  vertical_datum: string;
  vertical_datum_name: string;
  crs_epsg: number | null;
  crs_note: string;
}
export interface Envelope {
  covariance: number[][];
  source: string;
  scope: "whole_path_constant_envelope";
}
export interface CollisionCase {
  name: string;
  synthetic: boolean;
  frame: Frame;
  current: Point[];
  start: Point;
  target: Point;
  radius: number;
  envelope: Envelope;
  offsets: {
    id: string;
    name: string;
    frame: Frame;
    points: Point[];
    radius: number;
    envelope: Envelope;
  }[];
  confidence: number;
  margin: number;
  max_dls: number;
  max_excursion: number;
  chord_tolerance: number;
}
export interface Encounter {
  offset_id: string;
  offset_name: string;
  distance: number;
  reference: Point;
  offset: Point;
  reference_envelope_radius: number;
  offset_envelope_radius: number;
  required_distance: number;
  clearance_lower_bound: number;
  directional_support_gap: number | null;
}
export interface CandidateSummary {
  id: string;
  excursion_right: number;
  excursion_high: number;
  length: number;
  length_error_bound: number;
  max_dls_bound: number;
  min_clearance_bound: number;
  meets_constraints: boolean;
  reasons: string[];
}
export interface Candidate {
  summary: CandidateSummary;
  points: Point[];
  controls: [number, number, number][];
  encounters: Encounter[];
}
export interface Generation {
  method: string;
  notice: string;
  input: CollisionCase;
  baseline: Candidate;
  alternatives: Candidate[];
  ledger: CandidateSummary[];
  status: string;
  assumptions: string[];
}
export interface Glyph {
  vertices: [number, number, number][];
  triangles: [number, number, number][];
  plan: [number, number, number][];
  profile: [number, number, number][];
  k: number;
  label: string;
}
export function glyphPaths(
  g: Glyph,
  label: string,
  color: string,
): ExtraPath[] {
  const points = (p: [number, number, number][]) =>
    p.map(([north, east, tvd]) => ({ north, east, tvd }));
  return [
    {
      name: `${label} · ${g.label}`,
      layer: "Uncertainty",
      color,
      view: "3d",
      mesh: g,
      points: [],
      opacity: 0.22,
    },
    {
      name: `${label} · ${g.label}`,
      layer: "Uncertainty",
      color,
      view: "planView",
      points: points(g.plan),
      fill: true,
      opacity: 0.32,
      dash: "solid",
      width: 1,
    },
    {
      name: `${label} · ${g.label}`,
      layer: "Uncertainty",
      color,
      view: "profile",
      points: points(g.profile),
      fill: true,
      opacity: 0.32,
      dash: "solid",
      width: 1,
    },
  ];
}
