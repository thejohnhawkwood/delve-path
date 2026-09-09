import { centerlineReportModel, depthReportModel, openReport, planningReportModel, surveyReportModel } from "../reportModel";
import { fmt, type Target, type Trajectory, type UnitSystem } from "../domain";
import type { HoleRecord } from "../records";
import type { MeasuredStation } from "../domain";

export function ReportsWorkspace({
  projectName,
  hole,
  traj,
  unit,
  targets,
  rows,
  planStations,
}: {
  projectName: string;
  hole: HoleRecord | null;
  traj: Trajectory | null;
  unit: UnitSystem;
  targets: Target[];
  rows: MeasuredStation[];
  planStations: { md: number; inc_deg: number; azi_deg: number; north: number; east: number; tvd: number; dls_display: number }[];
}) {
  return (
    <div className="workspace-panel">
      <h2>Reports</h2>
      <p className="muted">
        Printable handover artifacts are built from report models, not raw HTML strings. Production runtime stays local —
        reports do not fetch remote assets. Flight Deck Shift Card is on the Flight Deck workspace.
      </p>
      <div className="ws-row">
        <button
          type="button"
          disabled={!traj}
          onClick={() =>
            traj &&
            openReport(
              surveyReportModel({
                projectName,
                holeName: hole?.name ?? "Hole 1",
                traj,
                unit,
                northReference: hole?.azimuth_reference ?? traj.azimuth_reference,
                originId: hole?.origin_id ?? "unspecified",
                mdDatum: hole?.vertical_datum_name || hole?.vertical_datum || "as entered",
                tvdDatum: hole?.vertical_datum_name || hole?.vertical_datum || "as entered",
                method: "Minimum Curvature",
                reviewStates: traj.stations.map((s) => {
                  const row = rows.find((r) => Math.abs(r.md - s.md) < 1e-6);
                  return row?.review_state ?? s.class;
                }),
                targets,
                current: traj.stations.filter((s) => s.class === "measured").slice(-1)[0],
              })
            )
          }
        >
          Survey report
        </button>
        <button
          type="button"
          onClick={() =>
            openReport(
              planningReportModel({
                planName: "Active plan",
                revision: 1,
                status: planStations.length ? "solved" : "draft",
                targetSummary: targets[0]?.name ?? "none",
                constraints: ["UD/LR corridor as entered", "+UP high-side · +RIGHT plan right"],
                sections: [["1", "user profile", "target", planStations.length ? "solved" : "see Planning"]],
                stations: planStations.map((s) => [
                  fmt(s.md),
                  fmt(s.inc_deg),
                  fmt(s.azi_deg),
                  fmt(s.north),
                  fmt(s.east),
                  fmt(s.tvd),
                  fmt(s.dls_display),
                ]),
                residuals: "See Planning workspace residuals",
                maxDls: planStations.length ? fmt(Math.max(...planStations.map((s) => s.dls_display))) : "see plan",
                totalMd: planStations.slice(-1)[0] ? fmt(planStations.slice(-1)[0]!.md) : "see plan",
              })
            )
          }
        >
          Planning report
        </button>
        <button
          type="button"
          onClick={() =>
            openReport(
              centerlineReportModel({
                refPath: hole?.name ?? "current",
                offPath: "select in Centerline",
                frame: "see Centerline workspace",
                distance: "—",
                refMd: "—",
                offMd: "—",
                threshold: "user",
                tolerance: "engine",
              })
            )
          }
        >
          Centerline report
        </button>
        <button
          type="button"
          onClick={() =>
            openReport(
              depthReportModel({
                datums: [["see Depth workspace", "", "", ""]],
                ties: [],
                markers: [],
              })
            )
          }
        >
          Depth report
        </button>
      </div>
    </div>
  );
}
