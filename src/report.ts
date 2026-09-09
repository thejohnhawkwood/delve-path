import type { Trajectory, UnitSystem } from "./domain";
import { openReport, surveyReportModel } from "./reportModel";

export function printReport(
  projectName: string,
  holeName: string,
  traj: Trajectory,
  unit: UnitSystem
): void {
  openReport(
    surveyReportModel({
      projectName,
      holeName,
      traj,
      unit,
      northReference: traj.azimuth_reference,
      originId: "unspecified",
      mdDatum: "as entered",
      tvdDatum: "as entered",
      method: "Minimum Curvature",
      reviewStates: traj.stations.map((s) => (s.class === "measured" ? "see survey table" : "n/a")),
      targets: [],
      current: traj.stations.filter((s) => s.class === "measured").slice(-1)[0],
    })
  );
}
