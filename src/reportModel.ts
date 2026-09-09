import type { CalculatedStation, Target, Trajectory, UnitSystem } from "./domain";
import { dlsLabel, fmt, lengthLabel } from "./domain";
import { SAFETY } from "./web/config";

export const REPORT_SAFETY = SAFETY;

export interface ReportColumn {
  key: string;
  label: string;
  value: string;
}

export interface ReportTable {
  title: string;
  headers: string[];
  rows: string[][];
  rowClass?: string[];
}

export interface ReportModel {
  kind: "survey" | "planning" | "centerline" | "depth" | "shift_card";
  title: string;
  mark: string;
  safety: string;
  identity: ReportColumn[];
  notices: string[];
  tables: ReportTable[];
  provenance: string[];
}

export function surveyReportModel(input: {
  projectName: string;
  holeName: string;
  traj: Trajectory;
  unit: UnitSystem;
  northReference: string;
  originId: string;
  mdDatum: string;
  tvdDatum: string;
  method: string;
  reviewStates: string[];
  targets: Target[];
  current?: CalculatedStation;
}): ReportModel {
  const len = lengthLabel(input.unit);
  const rows = input.traj.stations.map((s, i) => [
    fmt(s.md),
    fmt(s.inc_deg),
    fmt(s.azi_deg),
    fmt(s.tvd),
    fmt(s.north),
    fmt(s.east),
    fmt(s.vs),
    fmt(s.dls),
    s.class,
    input.reviewStates[i] ?? "n/a",
    s.comment,
  ]);
  const notices = [
    REPORT_SAFETY,
    "ACCEPTED SURVEY means user-reviewed MD/INC/AZI feeding a calculated sensor position. It does not mean exact, uncertainty-free, or certified.",
    "Calculated positions are derived. Raw measurements are not overwritten.",
  ];
  return {
    kind: "survey",
    title: "DelvePath survey report",
    mark: "WORKING",
    safety: REPORT_SAFETY,
    identity: [
      { key: "project", label: "Project", value: input.projectName },
      { key: "hole", label: "Hole", value: input.holeName },
      { key: "unit", label: "Length unit", value: input.unit },
      { key: "north", label: "North reference", value: input.northReference },
      { key: "origin", label: "Local N/E origin", value: input.originId },
      { key: "md_datum", label: "MD datum", value: input.mdDatum },
      { key: "tvd_datum", label: "TVD datum", value: input.tvdDatum },
      { key: "method", label: "Survey method", value: input.method },
    ],
    notices,
    tables: [
      {
        title: "Stations",
        headers: [
          `MD ${len}`,
          "INC °",
          "AZI °",
          `TVD ${len}`,
          `+N ${len}`,
          `+E ${len}`,
          `VS ${len}`,
          `DLS ${dlsLabel(input.unit)}`,
          "Class",
          "Review",
          "Comment",
        ],
        rows,
        rowClass: input.traj.stations.map((s) => s.class),
      },
      {
        title: "Targets",
        headers: ["Name", `+N ${len}`, `+E ${len}`, `TVD ${len}`],
        rows: input.targets.map((t) => [t.name, fmt(t.north), fmt(t.east), fmt(t.tvd)]),
      },
    ],
    provenance: [
      input.current
        ? `Current position MD ${fmt(input.current.md)} class ${input.current.class}.`
        : "No current position.",
      "Minimum Curvature (ISCWSA interval semantics). Not claimed bit-identical to WinSERVE.",
    ],
  };
}

export function planningReportModel(input: {
  planName: string;
  revision: number;
  status: string;
  targetSummary: string;
  constraints: string[];
  sections: string[][];
  stations: string[][];
  residuals: string;
  maxDls: string;
  totalMd: string;
}): ReportModel {
  return {
    kind: "planning",
    title: "DelvePath planning report",
    mark: "WORKING",
    safety: REPORT_SAFETY,
    identity: [
      { key: "plan", label: "Plan", value: input.planName },
      { key: "revision", label: "Revision", value: String(input.revision) },
      { key: "status", label: "Status", value: input.status },
      { key: "target", label: "Target", value: input.targetSummary },
    ],
    notices: [
      REPORT_SAFETY,
      "Candidate paths are scenarios, not recommended, safe, approved, or execute instructions.",
    ],
    tables: [
      { title: "Constraints", headers: ["Item"], rows: input.constraints.map((c) => [c]) },
      {
        title: "Sections",
        headers: ["Seq", "Section", "End", "Status"],
        rows: input.sections,
      },
      {
        title: "Calculated plan stations",
        headers: ["MD", "INC", "AZI", "+N", "+E", "TVD", "DLS"],
        rows: input.stations,
      },
    ],
    provenance: [input.residuals, `Max DLS ${input.maxDls}`, `Total MD ${input.totalMd}`],
  };
}

export function centerlineReportModel(input: {
  refPath: string;
  offPath: string;
  frame: string;
  distance: string;
  refMd: string;
  offMd: string;
  threshold: string;
  tolerance: string;
}): ReportModel {
  return {
    kind: "centerline",
    title: "DelvePath centerline screening report",
    mark: "WORKING",
    safety: REPORT_SAFETY,
    identity: [
      { key: "ref", label: "Reference path", value: input.refPath },
      { key: "off", label: "Offset path", value: input.offPath },
      { key: "frame", label: "Frame compatibility", value: input.frame },
    ],
    notices: [
      REPORT_SAFETY,
      "Centerline separation screening only — position uncertainty, hole/casing size, survey quality, and company anti-collision rules are not included.",
      "This is not a separation factor, ellipse separation, MASD, probability of collision, or a safe/unsafe result.",
    ],
    tables: [
      {
        title: "Closest approach",
        headers: ["Item", "Value"],
        rows: [
          ["Center-to-center distance", input.distance],
          ["Reference MD", input.refMd],
          ["Offset MD", input.offMd],
          ["User threshold", input.threshold],
          ["Calculation tolerance", input.tolerance],
        ],
      },
    ],
    provenance: ["Not included: positional uncertainty, casing/hole size, company AC rules."],
  };
}

export function depthReportModel(input: {
  datums: string[][];
  ties: string[][];
  markers: string[][];
}): ReportModel {
  return {
    kind: "depth",
    title: "DelvePath depth & zone integrity report",
    mark: "WORKING",
    safety: REPORT_SAFETY,
    identity: [{ key: "note", label: "Depth model", value: "Typed datum + explicit wireline mapping" }],
    notices: [
      REPORT_SAFETY,
      "A derived wireline mapping is not a simple datum conversion unless the user selected a constant-offset mapping.",
      "Do not use the ambiguous label TVDSS. Outputs are TVD MSL (positive down) and/or Elevation MSL (positive up).",
    ],
    tables: [
      { title: "Datum registry", headers: ["Name", "Kind", "Elevation", "Permanent vertical"], rows: input.datums },
      { title: "Wireline ties", headers: ["Source", "Destination", "Residual"], rows: input.ties },
      { title: "Zone markers", headers: ["Name", "Entered", "Reported"], rows: input.markers },
    ],
    provenance: ["Original value → source datum/scale → applied transform(s) → reported value."],
  };
}

export function shiftCardModel(input: {
  accepted: string;
  estimatedBit: string;
  startBitMd: string;
  endBitMd: string;
  drilled: string;
  slide: string;
  rotate: string;
  slidePct: string;
  hours: string;
  selected: string;
  alternatives: string;
  offsets: string;
  bha: string;
  memory: string;
  scores: string[][];
  warnings: string[];
  planRev: string;
  timestamp: string;
}): ReportModel {
  return {
    kind: "shift_card",
    title: "Flight Deck Shift Card",
    mark: "WORKING",
    safety: REPORT_SAFETY,
    identity: [
      { key: "accepted", label: "Latest accepted sensor", value: input.accepted },
      { key: "bit", label: "Estimated current bit", value: input.estimatedBit },
      { key: "bha", label: "BHA configuration", value: input.bha },
      { key: "plan", label: "Plan revision", value: input.planRev },
      { key: "when", label: "Immutable scenario time", value: input.timestamp },
    ],
    notices: [
      REPORT_SAFETY,
      "Scenarios are user-authored candidates. Constraint-feasible under entered assumptions is not drillable, recommended, or approved.",
      "BHA response envelope is not positional uncertainty.",
    ],
    tables: [
      {
        title: "Drilled interval (from segment log)",
        headers: ["Item", "Value"],
        rows: [
          ["Start bit MD", input.startBitMd],
          ["End bit MD", input.endBitMd],
          ["Drilled footage", input.drilled],
          ["Slide", input.slide],
          ["Rotate", input.rotate],
          ["Slide %", input.slidePct],
          ["Elapsed hours", input.hours],
        ],
      },
      {
        title: "Selected scenario",
        headers: ["Item", "Value"],
        rows: [
          ["Selected", input.selected],
          ["Alternatives", input.alternatives],
          ["Plan/target offsets", input.offsets],
          ["BHA memory", input.memory],
        ],
      },
      {
        title: "Frozen forecast scorecard",
        headers: ["Forecast", "3-D miss", "ΔINC", "ΔAZI", "ΔMD"],
        rows: input.scores,
      },
    ],
    provenance: input.warnings.length ? input.warnings : ["No unresolved warnings."],
  };
}

export function reportToHtml(model: ReportModel): string {
  const identity = model.identity
    .map((c) => `<div><span>${escapeHtml(c.label)}</span><b>${escapeHtml(c.value)}</b></div>`)
    .join("");
  const notices = model.notices.map((n) => `<div class="warn">${escapeHtml(n)}</div>`).join("");
  const tables = model.tables
    .map((t) => {
      const head = t.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
      const body = t.rows
        .map((r, i) => {
          const cls = t.rowClass?.[i] ?? "";
          return `<tr class="${cls}">${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`;
        })
        .join("");
      return `<h2>${escapeHtml(t.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join("");
  const prov = model.provenance.map((p) => `<li>${escapeHtml(p)}</li>`).join("");
  return `<!doctype html><html><head><title>${escapeHtml(model.title)}</title>
  <style>
    body{font:12px/1.4 Segoe UI,sans-serif;color:#111;margin:24px}
    h1{font-size:16px;margin:0 0 4px}
    h2{font-size:13px;margin:16px 0 6px}
    .warn{background:#fff3cd;border:1px solid #c9a227;padding:8px;margin:8px 0}
    .id{display:grid;grid-template-columns:repeat(2,1fr);gap:4px 16px;margin:8px 0}
    .id span{color:#555;display:block;font-size:11px}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #bbb;padding:3px 6px;text-align:right;font-variant-numeric:tabular-nums}
    th:first-child,td:first-child,th:last-child,td:last-child{text-align:left}
    tr.projected{background:#fff6d6}
  </style></head><body>
  <h1>${escapeHtml(model.title)}</h1>
  <p>${escapeHtml(model.mark)} · Created by Philip Bird — Mithril Consulting</p>
  ${notices}
  <div class="id">${identity}</div>
  ${tables}
  <h2>Provenance</h2>
  <ul>${prov}</ul>
  </body></html>`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
}

export function openReport(model: ReportModel): void {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(reportToHtml(model));
  w.document.close();
  w.focus();
  w.print();
}
