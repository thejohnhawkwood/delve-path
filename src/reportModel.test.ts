import { describe, expect, it } from "vitest";
import { reportToHtml, shiftCardModel, surveyReportModel } from "./reportModel";
import type { Trajectory } from "./domain";

const traj: Trajectory = {
  unit_system: "imperial",
  convention: "oilfield_from_vertical",
  azimuth_reference: "grid",
  vsp_deg: 45,
  stations: [
    {
      md: 0,
      inc_deg: 0,
      azi_deg: 45,
      tvd: 0,
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
};

describe("report models", () => {
  it("builds a survey report without window.open", () => {
    const model = surveyReportModel({
      projectName: "Demo",
      holeName: "H1",
      traj,
      unit: "imperial",
      northReference: "grid",
      originId: "wellhead",
      mdDatum: "RKB",
      tvdDatum: "RKB",
      method: "Minimum Curvature",
      reviewStates: ["accepted"],
      targets: [],
      current: traj.stations[0],
    });
    expect(model.safety).toMatch(/not certified/i);
    expect(model.identity.some((c) => c.value === "wellhead")).toBe(true);
    const html = reportToHtml(model);
    expect(html).toContain("not certified");
    expect(html).toContain("Demo");
    expect(html).not.toContain("http://");
  });

  it("shift card carries frozen scorecard and BHA revision", () => {
    const model = shiftCardModel({
      accepted: "MD 2400 accepted",
      estimatedBit: "MD 2495 estimated",
      startBitMd: "2400",
      endBitMd: "2495",
      drilled: "95",
      slide: "0",
      rotate: "95",
      slidePct: "0",
      hours: "1.2",
      selected: "Short correction",
      alternatives: "Hold; Longer / gentler",
      offsets: "UD/LR vs active plan",
      bha: "Demo motor revision 1",
      memory: "n=5",
      scores: [["Hold", "12.0", "0.4", "1.1", "5"]],
      warnings: ["Held-out reveal required"],
      planRev: "1",
      timestamp: "2026-08-28T12:00:00Z",
    });
    expect(model.kind).toBe("shift_card");
    expect(model.tables[2].rows[0][0]).toBe("Hold");
    expect(reportToHtml(model)).toContain("BHA response envelope is not positional uncertainty");
  });
});
