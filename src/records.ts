import type { AzimuthReference, MeasuredStation, TieIn, UnitSystem } from "./domain";

export interface CalcRequest {
  unit_system: UnitSystem;
  convention: "oilfield_from_vertical";
  azimuth_reference: AzimuthReference;
  vsp_deg: number;
  tie_in: TieIn;
  stations: MeasuredStation[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  client: string;
  notes: string;
}

export interface HoleRecord {
  id: string;
  project_id: string;
  name: string;
  unit_system: string;
  survey_convention: string;
  azimuth_reference: string;
  vsp_deg: number;
  declination_note: string;
  grid_note: string;
  parent_hole_id: string | null;
  branch_md: number | null;
  color: string | null;
}

export interface StationRecord {
  id: string;
  hole_id: string;
  seq: number;
  md: number;
  inc_deg: number;
  azi_deg: number;
  comment: string;
  source: string;
  class: string;
  tvd_tie: number | null;
  north_tie: number | null;
  east_tie: number | null;
}
