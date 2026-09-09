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
  origin_id: string;
  origin_north: number;
  origin_east: number;
  vertical_datum: string;
  vertical_datum_name: string;
  crs_epsg: number | null;
  crs_note: string;
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
  review_state: string;
  reviewer: string;
  review_source: string;
  reviewed_at: string | null;
  exclusion_reason: string;
}

export interface DocumentRecord {
  id: string;
  hole_id: string;
  kind: string;
  payload: string;
  updated_at: string;
}

export function defaultHoleFrame(): Pick<
  HoleRecord,
  | "origin_id"
  | "origin_north"
  | "origin_east"
  | "vertical_datum"
  | "vertical_datum_name"
  | "crs_epsg"
  | "crs_note"
> {
  return {
    origin_id: "unspecified",
    origin_north: 0,
    origin_east: 0,
    vertical_datum: "unspecified",
    vertical_datum_name: "",
    crs_epsg: null,
    crs_note: "",
  };
}

/** Named origin + datum so two constructed paths can be compared. */
export function comparableDemoFrame(): ReturnType<typeof defaultHoleFrame> {
  return {
    origin_id: "wellhead",
    origin_north: 0,
    origin_east: 0,
    vertical_datum: "rkb",
    vertical_datum_name: "RKB",
    crs_epsg: null,
    crs_note: "synthetic local NEV; no geodetic transform",
  };
}

export function defaultStationReview(): Pick<
  StationRecord,
  "review_state" | "reviewer" | "review_source" | "reviewed_at" | "exclusion_reason"
> {
  return {
    review_state: "unreviewed",
    reviewer: "",
    review_source: "",
    reviewed_at: null,
    exclusion_reason: "",
  };
}
