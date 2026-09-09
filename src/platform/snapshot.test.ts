import { describe, expect, it } from "vitest";
import { defaultHoleFrame, defaultStationReview } from "../records";
import { buildSnapshot, parseSnapshot, SnapshotError } from "./snapshot";

const good = buildSnapshot({
  applicationVersion: "0.1.1",
  project: { id: "p1", name: "Demo", client: "", notes: "" },
  holes: [
    {
      id: "h1",
      project_id: "p1",
      name: "Parent",
      unit_system: "imperial",
      survey_convention: "oilfield_from_vertical",
      azimuth_reference: "unknown",
      vsp_deg: 90,
      declination_note: "",
      grid_note: "",
      parent_hole_id: null,
      branch_md: null,
      color: "#8ec8c8",
      ...defaultHoleFrame(),
    },
  ],
  stations: [
    {
      id: "s1",
      hole_id: "h1",
      seq: 0,
      md: 0,
      inc_deg: 0,
      azi_deg: 0,
      comment: "",
      source: "manual",
      class: "measured",
      tvd_tie: 0,
      north_tie: 0,
      east_tie: 0,
      ...defaultStationReview(),
    },
  ],
  targets: [
    {
      id: "t1",
      hole_id: "h1",
      name: "Junction",
      north: 0,
      east: 0,
      tvd: 6500,
      horiz_tol: null,
      vert_tol: null,
      parent_target_id: null,
    },
  ],
  documents: [],
});

describe("browser snapshot", () => {
  it("round-trips a valid snapshot", () => {
    const parsed = parseSnapshot(JSON.parse(JSON.stringify(good)));
    expect(parsed.project.name).toBe("Demo");
    expect(parsed.holes[0].color).toBe("#8ec8c8");
    expect(parsed.targets[0].name).toBe("Junction");
    expect(parsed.notCompatibleWith).toBe("desktop-sqlite-delvepath");
  });

  it("rejects corrupt JSON objects without throwing on unrelated data", () => {
    expect(() => parseSnapshot({ format: "nope" })).toThrow(SnapshotError);
    expect(() => parseSnapshot(null)).toThrow(SnapshotError);
    expect(() => parseSnapshot({ ...good, stations: [{ md: "x" }] })).toThrow(SnapshotError);
  });

  it("migrates a v1 snapshot to v2 without rejecting it", () => {
    const { documents: _docs, ...rest } = good;
    const v1 = { ...rest, formatVersion: 1 };
    const parsed = parseSnapshot(v1);
    expect(parsed.formatVersion).toBe(2);
    expect(parsed.stations[0].review_state).toBe("unreviewed");
    expect(parsed.holes[0].origin_id).toBe("unspecified");
    expect(parsed.documents).toEqual([]);
  });

  it("rejects a hole from another project", () => {
    expect(() =>
      parseSnapshot({
        ...good,
        holes: [{ ...good.holes[0], project_id: "other" }],
      })
    ).toThrow(/wrong project/);
  });
});
