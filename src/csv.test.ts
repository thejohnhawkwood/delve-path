import { describe, expect, it } from "vitest";
import { exportCalculatedCsv, formatStationTsv, looksLikeMiningHeaders, parseSurveyTable, parseTargetPaste } from "./csv";

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

describe("formatStationTsv", () => {
  it("round-trips through paste", () => {
    const tsv = formatStationTsv(
      {
        md: 8000,
        inc_deg: 90,
        azi_deg: 270,
        comment: "west hold",
        class: "measured",
        source: "manual",
      },
      { north: 0, east: -3954.93, tvd: 7454.93 }
    );
    expect(tsv).toBe("8000\t90\t270\twest hold\t0\t-3954.93\t7454.93");
    const { stations } = parseSurveyTable(tsv, "paste");
    expect(stations).toHaveLength(1);
    expect(stations[0].md).toBe(8000);
    expect(stations[0].azi_deg).toBe(270);
    expect(stations[0].comment).toBe("west hold");
    expect(parseTargetPaste(tsv)).toEqual({ north: 0, east: -3954.93, tvd: 7454.93 });
  });

  it("parses three numbers as N E TVD", () => {
    expect(parseTargetPaste("10\t-20\t6500")).toEqual({ north: 10, east: -20, tvd: 6500 });
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
