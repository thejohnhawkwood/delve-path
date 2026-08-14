import { describe, expect, it } from "vitest";
import { exportCalculatedCsv, looksLikeMiningHeaders, parseSurveyTable } from "./csv";

describe("parseSurveyTable", () => {
  it("parses Oregon-style headers", () => {
    const text = "md_ft,incl_deg,azi_deg,comment\n445.0,0.0,0.0,\n488.0,1.4,235.5,";
    const { stations, warnings } = parseSurveyTable(text, "csv");
    expect(warnings).toEqual([]);
    expect(stations).toHaveLength(2);
    expect(stations[0].md).toBe(445);
    expect(stations[1].inc_deg).toBe(1.4);
    expect(stations[1].azi_deg).toBe(235.5);
    expect(stations[0].class).toBe("measured");
  });

  it("parses tab paste without headers", () => {
    const text = "100\t0\t0\n200\t2\t90";
    const { stations } = parseSurveyTable(text, "paste");
    expect(stations).toHaveLength(2);
    expect(stations[1].azi_deg).toBe(90);
  });

  it("blocks mining-style headers", () => {
    const text = "md,dip,azi\n10,-90,0";
    const { stations, warnings } = parseSurveyTable(text, "csv");
    expect(stations).toHaveLength(0);
    expect(warnings[0]).toMatch(/Mining/);
  });
});

describe("looksLikeMiningHeaders", () => {
  it("detects dip", () => {
    expect(looksLikeMiningHeaders(["MD", "Dip", "AZI"])).toBe(true);
    expect(looksLikeMiningHeaders(["md", "inc", "azi"])).toBe(false);
  });
});

describe("exportCalculatedCsv", () => {
  it("includes class so projections are not relabelled", () => {
    const csv = exportCalculatedCsv(
      [
        {
          md: 100,
          inc_deg: 0,
          azi_deg: 0,
          tvd: 100,
          north: 0,
          east: 0,
          vs: 0,
          closure: 0,
          closure_azi_deg: 0,
          dogleg_deg: 0,
          dls: 0,
          comment: "tie",
          class: "measured",
        },
      ],
      "imperial"
    );
    expect(csv).toContain("class");
    expect(csv).toContain("measured");
    expect(csv).toContain("dls_deg_per_100ft");
  });
});
