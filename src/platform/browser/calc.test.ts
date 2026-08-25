import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { browserCalc, initBrowserCalc } from "./calc";
import type { CalcRequest } from "../../records";

const wasmBytes = readFileSync(
  fileURLToPath(new URL("../../generated/delve-wasm/delve_wasm_bg.wasm", import.meta.url))
);

function req(stations: CalcRequest["stations"], extra: Partial<CalcRequest> = {}): CalcRequest {
  return {
    unit_system: "metric",
    convention: "oilfield_from_vertical",
    azimuth_reference: "unknown",
    vsp_deg: 0,
    tie_in: { tvd: 0, north: 0, east: 0 },
    stations,
    ...extra,
  };
}

function st(md: number, inc: number, azi: number) {
  return { md, inc_deg: inc, azi_deg: azi, comment: "", class: "measured" as const, source: "manual" as const };
}

describe("WASM calculation parity", () => {
  beforeAll(async () => {
    await initBrowserCalc(wasmBytes);
  }, 30000);

  it("L1 vertical / north / east / wrap / near-zero / units / tie-in", async () => {
    const vertical = await browserCalc.calculate(req([st(0, 0, 123), st(100, 0, 123), st(250, 0, 40)]));
    expect(vertical.stations[2].tvd).toBeCloseTo(250, 10);
    expect(Math.abs(vertical.stations[2].north)).toBeLessThan(1e-12);

    const north = await browserCalc.calculate(req([st(0, 30, 0), st(100, 30, 0)]));
    expect(Math.abs(north.stations[1].east)).toBeLessThan(1e-12);
    expect(north.stations[1].north).toBeGreaterThan(0);

    const east = await browserCalc.calculate(req([st(0, 30, 90), st(100, 30, 90)], { vsp_deg: 90 }));
    expect(Math.abs(east.stations[1].north)).toBeLessThan(1e-12);
    expect(east.stations[1].east).toBeGreaterThan(0);

    const wrap = await browserCalc.calculate(req([st(0, 10, 359), st(30, 10, 1)]));
    expect(wrap.stations[1].dogleg_deg).toBeLessThan(3);
    expect(wrap.stations[1].dogleg_deg).toBeGreaterThan(0.1);

    const hold = await browserCalc.calculate(req([st(0, 45, 90), st(50, 45, 90)], { vsp_deg: 90 }));
    expect(Math.abs(hold.stations[1].dls)).toBeLessThan(1e-9);

    const issues = await browserCalc.validateSurvey(req([st(100, 0, 0), st(90, 0, 0)]));
    expect(issues.some((i) => i.code === "md_decreasing")).toBe(true);
    await expect(browserCalc.calculate(req([st(100, 0, 0), st(90, 0, 0)]))).rejects.toBeTruthy();

    const dup = await browserCalc.validateSurvey(req([st(100, 0, 0), st(100, 1, 0)]));
    expect(dup.some((i) => i.code === "md_duplicate")).toBe(true);

    const high = await browserCalc.calculate(req([st(0, 90, 90), st(100, 90, 90)], { vsp_deg: 90 }));
    expect(high.stations[1].east).toBeCloseTo(100, 8);
    expect(Math.abs(high.stations[1].tvd)).toBeLessThan(1e-9);

    const metric = await browserCalc.calculate(req([st(0, 30, 0), st(30.48, 30, 0)]));
    const imperial = await browserCalc.calculate(
      req([st(0, 30, 0), st(100, 30, 0)], { unit_system: "imperial" })
    );
    expect(imperial.stations[1].north * 0.3048).toBeCloseTo(metric.stations[1].north, 8);

    const tie = await browserCalc.calculate(
      req([st(1500, 2, 300), st(1600, 2, 300)], {
        tie_in: { tvd: 1499.7, north: 13.09, east: 22.67 },
      })
    );
    expect(tie.stations[0].tvd).toBeCloseTo(1499.7, 10);
    expect(tie.stations[1].tvd).toBeGreaterThan(1499.7);
  });

  it("marks tangent projections PROJECTED", async () => {
    const base = req([st(0, 0, 0), st(100, 0, 0)]);
    const md = await browserCalc.projectTangentMd(base, 50);
    const lastMd = md.stations[md.stations.length - 1];
    expect(lastMd.class).toBe("projected");
    expect(lastMd.comment).toMatch(/PROJECTED/);
    const tvd = await browserCalc.projectTangentTvd(base, 160);
    expect(tvd.stations[tvd.stations.length - 1].class).toBe("projected");
    const bit = await browserCalc.projectTangentBit(base, 60);
    const lastBit = bit.stations[bit.stations.length - 1];
    expect(lastBit.md).toBeCloseTo(160, 10);
    expect(lastBit.class).toBe("projected");
  });
});
