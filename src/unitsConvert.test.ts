import { describe, expect, it } from "vitest";
import { convertLength } from "./domain";
import { convertHoleLengths, convertJsonLengths } from "./unitsConvert";
import { defaultHoleFrame } from "./records";

describe("unit conversion", () => {
  it("converts covariance in squared length units", () => {
    const c=convertJsonLengths({c_nn:4,c_ne:-2,md:100},"imperial","metric") as {c_nn:number;c_ne:number;md:number};
    expect(c.c_nn).toBeCloseTo(4*0.3048**2,12);
    expect(c.c_ne).toBeCloseTo(-2*0.3048**2,12);
    expect(c.md).toBeCloseTo(30.48,10);
  });
  it("converts lengths instead of relabelling", () => {
    expect(convertLength(100, "imperial", "metric")).toBeCloseTo(30.48, 9);
    expect(convertLength(30.48, "metric", "imperial")).toBeCloseTo(100, 9);
  });

  it("converts hole, stations, targets, and tie together", () => {
    const hole = {
      id: "h",
      project_id: "p",
      name: "H",
      unit_system: "imperial",
      survey_convention: "oilfield_from_vertical",
      azimuth_reference: "grid",
      vsp_deg: 45,
      declination_note: "",
      grid_note: "",
      parent_hole_id: null,
      branch_md: 100,
      color: null,
      ...defaultHoleFrame(),
      origin_north: 10,
    };
    const out = convertHoleLengths(
      "imperial",
      "metric",
      hole,
      [{ md: 100, inc_deg: 1, azi_deg: 2, comment: "", class: "measured", source: "manual" }],
      [{ id: "t", hole_id: "h", name: "T", north: 10, east: 20, tvd: 30, horiz_tol: 5, vert_tol: null, parent_target_id: null }],
      { tvd: 50, north: 4, east: 6 }
    );
    expect(out.rows[0].md).toBeCloseTo(30.48, 6);
    expect(out.targets[0].north).toBeCloseTo(3.048, 6);
    expect(out.tie.tvd).toBeCloseTo(15.24, 6);
    expect(out.hole.branch_md).toBeCloseTo(30.48, 6);
    expect(out.rows[0].inc_deg).toBe(1);
  });

  it("converts known length keys in JSON documents", () => {
    const next = convertJsonLengths({ md: 100, inc_deg: 12, nested: { sensor_to_bit: 52 } }, "imperial", "metric") as {
      md: number;
      inc_deg: number;
      nested: { sensor_to_bit: number };
    };
    expect(next.md).toBeCloseTo(30.48, 6);
    expect(next.inc_deg).toBe(12);
    expect(next.nested.sensor_to_bit).toBeCloseTo(15.8496, 4);
  });
});
