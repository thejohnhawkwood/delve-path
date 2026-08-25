import type { CalculatedStation, Target, Trajectory, ValidationIssue } from "./domain";
import { getPlatform, isTauri } from "./platform";
import type { CalcRequest, HoleRecord, ProjectRecord, StationRecord } from "./records";

export type { CalcRequest, HoleRecord, ProjectRecord, StationRecord } from "./records";
export { isTauri };

export async function calculate(req: CalcRequest): Promise<Trajectory> {
  return getPlatform().calc.calculate(req);
}

export async function validateSurvey(req: CalcRequest): Promise<ValidationIssue[]> {
  return getPlatform().calc.validateSurvey(req);
}

export async function projectTangentMd(req: CalcRequest, addedMd: number): Promise<Trajectory> {
  return getPlatform().calc.projectTangentMd(req, addedMd);
}

export async function projectTangentTvd(req: CalcRequest, targetTvd: number): Promise<Trajectory> {
  return getPlatform().calc.projectTangentTvd(req, targetTvd);
}

export async function projectTangentBit(req: CalcRequest, bitToSensor: number): Promise<Trajectory> {
  return getPlatform().calc.projectTangentBit(req, bitToSensor);
}

export async function createProject(path: string, name: string, client: string): Promise<ProjectRecord> {
  return getPlatform().repo.create({ path, name, client });
}

export async function openProject(path: string): Promise<ProjectRecord> {
  return getPlatform().repo.open(path);
}

export async function saveHole(hole: HoleRecord): Promise<void> {
  return getPlatform().repo.saveHole(hole);
}

export async function saveStations(holeId: string, stations: StationRecord[]): Promise<void> {
  return getPlatform().repo.saveStations(holeId, stations);
}

export async function loadStations(holeId: string): Promise<StationRecord[]> {
  return getPlatform().repo.loadStations(holeId);
}

export async function saveTarget(target: Target): Promise<void> {
  return getPlatform().repo.saveTarget(target);
}

export async function loadTargets(holeId: string): Promise<Target[]> {
  return getPlatform().repo.loadTargets(holeId);
}

export async function listHoles(projectId: string): Promise<HoleRecord[]> {
  return getPlatform().repo.listHoles(projectId);
}

export async function deleteTarget(targetId: string): Promise<void> {
  return getPlatform().repo.deleteTarget(targetId);
}

export async function deleteHole(holeId: string): Promise<void> {
  return getPlatform().repo.deleteHole(holeId);
}

export async function newUuid(): Promise<string> {
  return getPlatform().newId();
}

export async function pickSavePath(): Promise<string | null> {
  return getPlatform().files.pickNewProjectPath();
}

export async function pickOpenPath(): Promise<string | null> {
  return getPlatform().files.pickOpenProjectPath();
}

export function lastMeasured(stations: CalculatedStation[]): CalculatedStation | undefined {
  return [...stations].reverse().find((s) => s.class === "measured");
}
