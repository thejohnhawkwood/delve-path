import type { Point, Envelope } from "./collision/types";
import type { ExtraPath } from "./Charts";
import { boundsFor3d } from "./chartBounds";
import type { UnitSystem } from "./domain";

export interface FlightSelection {
  id: string;
  name: string;
  sensor: Point;
  bit: Point;
  estimatedPath: Point[];
  path: Point[];
  nextSensor: Point;
  maxDls: number;
  unit: UnitSystem;
  modelKey: string;
}
export interface SharedUncertainty {
  holeId: string;
  station: Point;
  unit: UnitSystem;
  covariance: number[][];
  source: string;
  /** An explicit user declaration, never inferred from a station ellipsoid. */
  wholePath: boolean;
}
export function envelopeFrom(u: SharedUncertainty): Envelope {
  return { covariance: u.covariance, source: `${u.source}; user-declared constant envelope from MD ${u.station.md}`, scope: "whole_path_constant_envelope" };
}
export function pathBounds(paths: ExtraPath[]) {
  return boundsFor3d(paths.map(p => ({ x: p.points.map(q => q.east), y: p.points.map(q => q.north), z: p.points.map(q => q.tvd) })));
}
