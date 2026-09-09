import type { Target } from "../domain";
import {
  defaultHoleFrame,
  defaultStationReview,
  type DocumentRecord,
  type HoleRecord,
  type ProjectRecord,
  type StationRecord,
} from "../records";
import {
  SNAPSHOT_FORMAT,
  SNAPSHOT_VERSION,
  type BrowserProjectSnapshot,
} from "./types";

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function reqString(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  if (typeof v !== "string") throw new SnapshotError(`Missing string "${key}".`);
  return v;
}

function optString(o: Record<string, unknown>, key: string): string | null {
  const v = o[key];
  if (v == null) return null;
  if (typeof v !== "string") throw new SnapshotError(`"${key}" must be a string or null.`);
  return v;
}

function reqNumber(o: Record<string, unknown>, key: string): number {
  const v = o[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new SnapshotError(`Missing finite number "${key}".`);
  }
  return v;
}

function optNumber(o: Record<string, unknown>, key: string): number | null {
  const v = o[key];
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new SnapshotError(`"${key}" must be a finite number or null.`);
  }
  return v;
}

function parseProject(v: unknown): ProjectRecord {
  if (!isRecord(v)) throw new SnapshotError("project must be an object.");
  return {
    id: reqString(v, "id"),
    name: reqString(v, "name"),
    client: typeof v.client === "string" ? v.client : "",
    notes: typeof v.notes === "string" ? v.notes : "",
  };
}

function parseHole(v: unknown): HoleRecord {
  if (!isRecord(v)) throw new SnapshotError("hole must be an object.");
  const frame = defaultHoleFrame();
  return {
    id: reqString(v, "id"),
    project_id: reqString(v, "project_id"),
    name: reqString(v, "name"),
    unit_system: reqString(v, "unit_system"),
    survey_convention: reqString(v, "survey_convention"),
    azimuth_reference: reqString(v, "azimuth_reference"),
    vsp_deg: reqNumber(v, "vsp_deg"),
    declination_note: typeof v.declination_note === "string" ? v.declination_note : "",
    grid_note: typeof v.grid_note === "string" ? v.grid_note : "",
    parent_hole_id: optString(v, "parent_hole_id"),
    branch_md: optNumber(v, "branch_md"),
    color: optString(v, "color"),
    origin_id: typeof v.origin_id === "string" ? v.origin_id : frame.origin_id,
    origin_north: typeof v.origin_north === "number" && Number.isFinite(v.origin_north) ? v.origin_north : 0,
    origin_east: typeof v.origin_east === "number" && Number.isFinite(v.origin_east) ? v.origin_east : 0,
    vertical_datum: typeof v.vertical_datum === "string" ? v.vertical_datum : frame.vertical_datum,
    vertical_datum_name: typeof v.vertical_datum_name === "string" ? v.vertical_datum_name : "",
    crs_epsg: typeof v.crs_epsg === "number" && Number.isFinite(v.crs_epsg) ? v.crs_epsg : null,
    crs_note: typeof v.crs_note === "string" ? v.crs_note : "",
  };
}

function parseStation(v: unknown): StationRecord {
  if (!isRecord(v)) throw new SnapshotError("station must be an object.");
  const review = defaultStationReview();
  return {
    id: reqString(v, "id"),
    hole_id: reqString(v, "hole_id"),
    seq: reqNumber(v, "seq"),
    md: reqNumber(v, "md"),
    inc_deg: reqNumber(v, "inc_deg"),
    azi_deg: reqNumber(v, "azi_deg"),
    comment: typeof v.comment === "string" ? v.comment : "",
    source: typeof v.source === "string" ? v.source : "manual",
    class: typeof v.class === "string" ? v.class : "measured",
    tvd_tie: optNumber(v, "tvd_tie"),
    north_tie: optNumber(v, "north_tie"),
    east_tie: optNumber(v, "east_tie"),
    review_state: typeof v.review_state === "string" ? v.review_state : review.review_state,
    reviewer: typeof v.reviewer === "string" ? v.reviewer : "",
    review_source: typeof v.review_source === "string" ? v.review_source : "",
    reviewed_at: optString(v, "reviewed_at"),
    exclusion_reason: typeof v.exclusion_reason === "string" ? v.exclusion_reason : "",
  };
}

function parseTarget(v: unknown): Target {
  if (!isRecord(v)) throw new SnapshotError("target must be an object.");
  return {
    id: reqString(v, "id"),
    hole_id: reqString(v, "hole_id"),
    name: reqString(v, "name"),
    north: reqNumber(v, "north"),
    east: reqNumber(v, "east"),
    tvd: reqNumber(v, "tvd"),
    horiz_tol: optNumber(v, "horiz_tol"),
    vert_tol: optNumber(v, "vert_tol"),
    parent_target_id: optString(v, "parent_target_id"),
    geometry_json: optString(v, "geometry_json"),
  };
}

function parseDocument(v: unknown): DocumentRecord {
  if (!isRecord(v)) throw new SnapshotError("document must be an object.");
  return {
    id: reqString(v, "id"),
    hole_id: reqString(v, "hole_id"),
    kind: reqString(v, "kind"),
    payload: reqString(v, "payload"),
    updated_at: typeof v.updated_at === "string" ? v.updated_at : "",
  };
}

/** Validate imported JSON. v1 snapshots migrate to v2. Throws SnapshotError without mutating caller state. */
export function parseSnapshot(data: unknown): BrowserProjectSnapshot {
  if (!isRecord(data)) throw new SnapshotError("Snapshot must be a JSON object.");
  if (data.format !== SNAPSHOT_FORMAT) {
    throw new SnapshotError(
      "Not a DelvePath browser snapshot. Desktop *.delvepath SQLite files cannot be imported here."
    );
  }
  const version = data.formatVersion;
  if (version !== 1 && version !== 2) {
    throw new SnapshotError(`Unsupported snapshot version ${String(version)}.`);
  }
  if (!Array.isArray(data.holes) || !Array.isArray(data.stations) || !Array.isArray(data.targets)) {
    throw new SnapshotError("Snapshot must include holes, stations, and targets arrays.");
  }
  const project = parseProject(data.project);
  const holes = data.holes.map(parseHole);
  const stations = data.stations.map(parseStation);
  const targets = data.targets.map(parseTarget);
  const documents = Array.isArray(data.documents) ? data.documents.map(parseDocument) : [];
  const holeIds = new Set(holes.map((h) => h.id));
  if (holes.some((h) => h.project_id !== project.id)) {
    throw new SnapshotError("A hole references the wrong project.");
  }
  if (stations.some((s) => !holeIds.has(s.hole_id))) {
    throw new SnapshotError("A station references a missing hole.");
  }
  if (targets.some((t) => t.hole_id && !holeIds.has(t.hole_id))) {
    throw new SnapshotError("A target references a missing hole.");
  }
  if (documents.some((d) => !holeIds.has(d.hole_id))) {
    throw new SnapshotError("A document references a missing hole.");
  }
  return {
    format: SNAPSHOT_FORMAT,
    formatVersion: SNAPSHOT_VERSION,
    notCompatibleWith: "desktop-sqlite-delvepath",
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : new Date().toISOString(),
    applicationVersion: typeof data.applicationVersion === "string" ? data.applicationVersion : "",
    project,
    holes,
    stations,
    targets,
    documents,
  };
}

export function buildSnapshot(input: {
  project: ProjectRecord;
  holes: HoleRecord[];
  stations: StationRecord[];
  targets: Target[];
  documents?: DocumentRecord[];
  applicationVersion: string;
}): BrowserProjectSnapshot {
  return {
    format: SNAPSHOT_FORMAT,
    formatVersion: SNAPSHOT_VERSION,
    notCompatibleWith: "desktop-sqlite-delvepath",
    exportedAt: new Date().toISOString(),
    applicationVersion: input.applicationVersion,
    project: input.project,
    holes: input.holes,
    stations: input.stations,
    targets: input.targets,
    documents: input.documents ?? [],
  };
}
