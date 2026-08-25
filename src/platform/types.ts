import type { Target, Trajectory, ValidationIssue } from "../domain";
import type { CalcRequest, HoleRecord, ProjectRecord, StationRecord } from "../records";

export type RuntimeKind = "tauri" | "browser";

export interface CalculationService {
  calculate(req: CalcRequest): Promise<Trajectory>;
  validateSurvey(req: CalcRequest): Promise<ValidationIssue[]>;
  projectTangentMd(req: CalcRequest, addedMd: number): Promise<Trajectory>;
  projectTangentTvd(req: CalcRequest, targetTvd: number): Promise<Trajectory>;
  projectTangentBit(req: CalcRequest, bitToSensor: number): Promise<Trajectory>;
}

export interface ProjectSummary {
  id: string;
  name: string;
  client: string;
  updatedAt: string;
}

export interface ProjectRepository {
  create(input: { name: string; client: string; path?: string | null }): Promise<ProjectRecord>;
  open(idOrPath: string): Promise<ProjectRecord>;
  list(): Promise<ProjectSummary[]>;
  rename(id: string, name: string): Promise<void>;
  deleteProject(id: string): Promise<void>;
  getLastOpenedId(): Promise<string | null>;
  setLastOpenedId(id: string): Promise<void>;
  saveHole(hole: HoleRecord): Promise<void>;
  saveStations(holeId: string, stations: StationRecord[]): Promise<void>;
  loadStations(holeId: string): Promise<StationRecord[]>;
  saveTarget(target: Target): Promise<void>;
  loadTargets(holeId: string): Promise<Target[]>;
  listHoles(projectId: string): Promise<HoleRecord[]>;
  deleteTarget(targetId: string): Promise<void>;
  deleteHole(holeId: string): Promise<void>;
  exportSnapshot(projectId: string): Promise<BrowserProjectSnapshot>;
  importSnapshot(data: unknown): Promise<ProjectRecord>;
  resetAll(): Promise<void>;
}

export interface FileOperations {
  pickNewProjectPath(): Promise<string | null>;
  pickOpenProjectPath(): Promise<string | null>;
  pickTextFile(accept: string): Promise<{ name: string; text: string } | null>;
  saveTextFile(filename: string, text: string, mime: string): Promise<void>;
}

export interface Platform {
  kind: RuntimeKind;
  calc: CalculationService;
  repo: ProjectRepository;
  files: FileOperations;
  newId(): string;
}

export const SNAPSHOT_FORMAT = "delvepath-browser-snapshot";
export const SNAPSHOT_VERSION = 1;

export interface BrowserProjectSnapshot {
  format: typeof SNAPSHOT_FORMAT;
  formatVersion: number;
  notCompatibleWith: "desktop-sqlite-delvepath";
  exportedAt: string;
  applicationVersion: string;
  project: ProjectRecord;
  holes: HoleRecord[];
  stations: StationRecord[];
  targets: Target[];
}
