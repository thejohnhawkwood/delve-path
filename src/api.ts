import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  AzimuthReference,
  CalculatedStation,
  MeasuredStation,
  Target,
  TieIn,
  Trajectory,
  UnitSystem,
  ValidationIssue,
} from "./domain";

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

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function calculate(req: CalcRequest): Promise<Trajectory> {
  return invoke("calculate", { req });
}

export async function validateSurvey(req: CalcRequest): Promise<ValidationIssue[]> {
  return invoke("validate_survey", { req });
}

export async function projectTangentMd(req: CalcRequest, addedMd: number): Promise<Trajectory> {
  return invoke("project_tangent_md", { req, addedMd });
}

export async function projectTangentTvd(req: CalcRequest, targetTvd: number): Promise<Trajectory> {
  return invoke("project_tangent_tvd", { req, targetTvd });
}

export async function projectTangentBit(req: CalcRequest, bitToSensor: number): Promise<Trajectory> {
  return invoke("project_tangent_bit", { req, bitToSensor });
}

export async function createProject(path: string, name: string, client: string): Promise<ProjectRecord> {
  return invoke("create_project", { path, name, client });
}

export async function openProject(path: string): Promise<ProjectRecord> {
  return invoke("open_project", { path });
}

export async function saveHole(hole: HoleRecord): Promise<void> {
  return invoke("save_hole", { hole });
}

export async function saveStations(holeId: string, stations: StationRecord[]): Promise<void> {
  return invoke("save_stations", { holeId, stations });
}

export async function loadStations(holeId: string): Promise<StationRecord[]> {
  return invoke("load_stations", { holeId });
}

export async function saveTarget(target: Target): Promise<void> {
  return invoke("save_target", { target });
}

export async function loadTargets(holeId: string): Promise<Target[]> {
  return invoke("load_targets", { holeId });
}

export async function listHoles(projectId: string): Promise<HoleRecord[]> {
  return invoke("list_holes", { projectId });
}

export async function deleteTarget(targetId: string): Promise<void> {
  return invoke("delete_target", { targetId });
}

export async function deleteHole(holeId: string): Promise<void> {
  return invoke("delete_hole", { holeId });
}

export async function newUuid(): Promise<string> {
  return invoke("new_uuid");
}

export async function pickSavePath(): Promise<string | null> {
  return save({
    title: "New DelvePath project",
    defaultPath: "project.delvepath",
    filters: [{ name: "DelvePath project", extensions: ["delvepath"] }],
  });
}

export async function pickOpenPath(): Promise<string | null> {
  return open({
    title: "Open DelvePath project",
    multiple: false,
    filters: [{ name: "DelvePath project", extensions: ["delvepath", "db"] }],
  }) as Promise<string | null>;
}

export async function pickCsvOpen(): Promise<string | null> {
  return open({
    title: "Import survey CSV",
    multiple: false,
    filters: [{ name: "CSV", extensions: ["csv", "txt"] }],
  }) as Promise<string | null>;
}

export async function pickCsvSave(): Promise<string | null> {
  return save({
    title: "Export survey CSV",
    defaultPath: "survey.csv",
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
}

export function lastMeasured(stations: CalculatedStation[]): CalculatedStation | undefined {
  return [...stations].reverse().find((s) => s.class === "measured");
}
